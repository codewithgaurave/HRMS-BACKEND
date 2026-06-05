import Payroll from '../models/Payroll.js';
import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Fetch attendance for a month — handles both UTC midnight and IST 18:30 UTC storage formats
async function getAttendanceForMonth(employeeId, month, year) {
  const m = parseInt(month);
  const y = parseInt(year);

  // Wide range: start of prev day UTC to end of next day UTC — covers all timezone offsets
  const startWide = new Date(Date.UTC(y, m - 1, 1) - IST_OFFSET_MS);  // Apr 30 18:30 UTC for May
  const endWide   = new Date(Date.UTC(y, m, 1)     + IST_OFFSET_MS);  // Jun 1 05:30 UTC for May

  const records = await Attendance.find({
    employee: employeeId,
    date: { $gte: startWide, $lt: endWide }
  }).select('date status overtimeHours totalWorkHours');

  // Filter: convert each record's date to IST and check month/year
  return records.filter(r => {
    const istDate = new Date(r.date.getTime() + IST_OFFSET_MS);
    return istDate.getUTCMonth() + 1 === m && istDate.getUTCFullYear() === y;
  });
}

// Create Payroll
export const createPayroll = async (req, res) => {
  try {
    const payroll = new Payroll({ ...req.body, createdBy: req.employee.id });
    await payroll.save();
    await payroll.populate('employee', 'name employeeId department designation');
    res.status(201).json({ success: true, message: 'Payroll created successfully', payroll });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get All Payrolls
export const getAllPayrolls = async (req, res) => {
  try {
    const { page = 1, limit = 10, month, year, status, employeeId, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    let query = {};

    if (req.employee.role === 'HR_Manager') {
      const teamMembers = await Employee.find({ addedBy: req.employee._id });
      const teamMemberIds = teamMembers.map(m => m._id);
      teamMemberIds.push(req.employee._id);
      query.employee = { $in: teamMemberIds };
    } else if (req.employee.role === 'Team_Leader') {
      const teamMembers = await Employee.find({ manager: req.employee._id });
      const teamMemberIds = teamMembers.map(m => m._id);
      teamMemberIds.push(req.employee._id);
      query.employee = { $in: teamMemberIds };
    } else {
      query.employee = req.employee._id;
    }

    if (month) query.month = parseInt(month);
    if (year) query.year = parseInt(year);
    if (status) query.status = status;

    if (employeeId && query.employee) {
      if (query.employee.$in) {
        const isAllowed = query.employee.$in.some(id => id.toString() === employeeId);
        if (isAllowed) query.employee = employeeId;
        else return res.status(403).json({ success: false, message: 'Access denied.' });
      } else if (query.employee.toString() === employeeId) {
        query.employee = employeeId;
      } else {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    const skip = (page - 1) * limit;

    const payrolls = await Payroll.find(query)
      .populate('employee', 'name employeeId department designation')
      .populate('createdBy', 'name employeeId')
      .sort(sort).skip(skip).limit(parseInt(limit));

    const totalCount = await Payroll.countDocuments(query);

    res.json({
      success: true, payrolls,
      pagination: { currentPage: parseInt(page), totalPages: Math.ceil(totalCount / limit), totalCount, hasNext: page < Math.ceil(totalCount / limit), hasPrev: page > 1 }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Payroll by ID
export const getPayrollById = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id)
      .populate('employee', 'name employeeId department designation bankDetails')
      .populate('createdBy', 'name employeeId');
    if (!payroll) return res.status(404).json({ success: false, message: 'Payroll not found' });
    res.json({ success: true, payroll });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Payroll
export const updatePayroll = async (req, res) => {
  try {
    const payroll = await Payroll.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('employee', 'name employeeId department designation');
    if (!payroll) return res.status(404).json({ success: false, message: 'Payroll not found' });
    res.json({ success: true, message: 'Payroll updated successfully', payroll });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete Payroll
export const deletePayroll = async (req, res) => {
  try {
    const payroll = await Payroll.findByIdAndDelete(req.params.id);
    if (!payroll) return res.status(404).json({ success: false, message: 'Payroll not found' });
    res.json({ success: true, message: 'Payroll deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Generate Payroll for All Employees
export const generatePayrollForAll = async (req, res) => {
  try {
    const { month, year } = req.body;
    const m = parseInt(month);
    const y = parseInt(year);

    let employees = [];
    if (req.employee.role === 'HR_Manager') {
      employees = await Employee.find({ addedBy: req.employee._id, isActive: true });
      const hr = await Employee.findById(req.employee._id);
      if (hr?.isActive) employees.push(hr);
    } else if (req.employee.role === 'Team_Leader') {
      employees = await Employee.find({ manager: req.employee._id, isActive: true });
      const tl = await Employee.findById(req.employee._id);
      if (tl?.isActive) employees.push(tl);
    } else {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const payrolls = [];
    const WORKING_DAYS = 30;

    for (const employee of employees) {
      const existingPayroll = await Payroll.findOne({ employee: employee._id, month: m, year: y });
      if (existingPayroll) {
        console.log(`⏭️ Payroll already exists for ${employee.employeeId} - ${m}/${y}`);
        continue;
      }

      const basicSalary = employee.salary || 0;
      const attendanceRecords = await getAttendanceForMonth(employee._id, m, y);
      console.log(`📋 ${employee.employeeId}: found ${attendanceRecords.length} attendance records for ${m}/${y}`);

      const presentDays = attendanceRecords.filter(a => ['Present', 'Late', 'Early Departure'].includes(a.status)).length;
      const halfDays = attendanceRecords.filter(a => a.status === 'Half Day').length;
      const effectivePresentDays = presentDays + (halfDays * 0.5);
      const leaveDays = attendanceRecords.filter(a => a.status === 'On Leave').length;
      const overtimeHours = attendanceRecords.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);

      const perDaySalary = basicSalary / WORKING_DAYS;
      const overtimeRate = (basicSalary / WORKING_DAYS / 8) * 1.5;
      const overtimeAmount = Math.round(overtimeHours * overtimeRate);
      const grossSalary = Math.round(perDaySalary * effectivePresentDays) + overtimeAmount;

      const payroll = new Payroll({
        employee: employee._id, month: m, year: y, basicSalary,
        workingDays: WORKING_DAYS, presentDays: effectivePresentDays, leaveDays,
        overtimeHours: Math.round(overtimeHours * 100) / 100,
        overtimeAmount, grossSalary, netSalary: grossSalary,
        createdBy: req.employee.id
      });

      await payroll.save();
      payrolls.push(payroll);
    }

    res.json({ success: true, message: `Generated payroll for ${payrolls.length} employees`, count: payrolls.length, skipped: employees.length - payrolls.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get HR Team Payrolls
export const getHRTeamPayrolls = async (req, res) => {
  try {
    const { page = 1, limit = 10, month, year, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    if (req.employee.role !== 'HR_Manager') {
      return res.status(403).json({ success: false, message: 'Access denied. Only HR Managers can access this endpoint.' });
    }

    const teamMembers = await Employee.find({ addedBy: req.employee._id, isActive: true }).select('_id name employeeId');
    const teamMemberIds = teamMembers.map(m => m._id);
    teamMemberIds.push(req.employee._id);

    let query = { employee: { $in: teamMemberIds } };

    if (month) query.month = parseInt(month);
    if (year) query.year = parseInt(year);
    if (status) query.status = status;

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    const skip = (page - 1) * limit;

    const payrolls = await Payroll.find(query)
      .populate('employee', 'name employeeId department designation')
      .populate('createdBy', 'name employeeId')
      .sort(sort).skip(skip).limit(parseInt(limit));

    const totalCount = await Payroll.countDocuments(query);

    res.json({
      success: true, payrolls, teamMembers: teamMembers.length,
      pagination: { currentPage: parseInt(page), totalPages: Math.ceil(totalCount / limit), totalCount, hasNext: page < Math.ceil(totalCount / limit), hasPrev: page > 1 }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Recalculate existing payroll based on actual attendance
export const recalculatePayroll = async (req, res) => {
  try {
    const { month, year } = req.body;
    const m = parseInt(month);
    const y = parseInt(year);

    let employees = [];
    if (req.employee.role === 'HR_Manager') {
      employees = await Employee.find({ addedBy: req.employee._id, isActive: true });
      const hr = await Employee.findById(req.employee._id);
      if (hr) employees.push(hr);
    } else if (req.employee.role === 'Team_Leader') {
      employees = await Employee.find({ manager: req.employee._id, isActive: true });
      const tl = await Employee.findById(req.employee._id);
      if (tl) employees.push(tl);
    } else {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const WORKING_DAYS = 30;
    let updated = 0;

    for (const employee of employees) {
      const existingPayroll = await Payroll.findOne({ employee: employee._id, month: m, year: y });
      if (!existingPayroll) continue;

      const attendanceRecords = await getAttendanceForMonth(employee._id, m, y);
      const presentDays = attendanceRecords.filter(a => ['Present', 'Late', 'Early Departure'].includes(a.status)).length;
      const halfDays = attendanceRecords.filter(a => a.status === 'Half Day').length;
      const effectivePresentDays = presentDays + (halfDays * 0.5);
      const leaveDays = attendanceRecords.filter(a => a.status === 'On Leave').length;
      const overtimeHours = attendanceRecords.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);

      const basicSalary = employee.salary || existingPayroll.basicSalary || 0;
      const perDaySalary = basicSalary / WORKING_DAYS;
      const overtimeRate = (basicSalary / WORKING_DAYS / 8) * 1.5;
      const overtimeAmount = Math.round(overtimeHours * overtimeRate);
      const grossSalary = Math.round(perDaySalary * effectivePresentDays) + overtimeAmount;

      await Payroll.updateOne(
        { _id: existingPayroll._id },
        { $set: { workingDays: WORKING_DAYS, presentDays: effectivePresentDays, leaveDays, overtimeHours: Math.round(overtimeHours * 100) / 100, overtimeAmount, grossSalary, netSalary: grossSalary } }
      );
      updated++;
    }

    res.json({ success: true, message: `Recalculated payroll for ${updated} employees`, count: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export default {
  createPayroll, getAllPayrolls, getHRTeamPayrolls, getPayrollById,
  updatePayroll, deletePayroll, generatePayrollForAll, recalculatePayroll
};
