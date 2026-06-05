import Payroll from '../models/Payroll.js';
import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';

// Create Payroll
export const createPayroll = async (req, res) => {
  try {
    const payroll = new Payroll({
      ...req.body,
      createdBy: req.employee.id
    });

    await payroll.save();
    await payroll.populate('employee', 'name employeeId department designation');
    
    res.status(201).json({
      success: true,
      message: 'Payroll created successfully',
      payroll
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get All Payrolls
export const getAllPayrolls = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      month,
      year,
      status,
      employeeId,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    let query = {};
    
    // Role-based filtering - HR sees only their team's payrolls
    if (req.employee.role === 'HR_Manager') {
      // HR can see payrolls of employees they added + their own payroll
      const teamMembers = await Employee.find({ addedBy: req.employee._id });
      const teamMemberIds = teamMembers.map(member => member._id);
      teamMemberIds.push(req.employee._id); // Include own payroll
      query.employee = { $in: teamMemberIds };
      console.log('HR Manager - Team Member IDs:', teamMemberIds.length, 'members');
    } else if (req.employee.role === 'Team_Leader') {
      // Team Leaders can see their own payroll and their team members' payrolls
      const teamMembers = await Employee.find({ manager: req.employee._id });
      const teamMemberIds = teamMembers.map(member => member._id);
      teamMemberIds.push(req.employee._id); // Include own payroll
      query.employee = { $in: teamMemberIds };
      console.log('Team Leader - Team Member IDs:', teamMemberIds.length, 'members');
    } else {
      // Regular employees can only see their own payroll
      query.employee = req.employee._id;
      console.log('Employee - Own ID only');
    }
    
    console.log('Payroll Query:', JSON.stringify(query, null, 2));
    
    // Additional filters (only apply if employee filter is already set)
    if (month) query.month = month;
    if (year) query.year = year;
    if (status) query.status = status;
    if (employeeId && query.employee) {
      // Only allow if the requested employee is in the allowed list
      if (query.employee.$in) {
        const isAllowed = query.employee.$in.some(id => id.toString() === employeeId);
        if (isAllowed) {
          query.employee = employeeId;
        } else {
          return res.status(403).json({
            success: false,
            message: "Access denied. You can only view payrolls of employees you manage."
          });
        }
      } else if (query.employee.toString() === employeeId) {
        query.employee = employeeId;
      } else {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view your own payroll."
        });
      }
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const skip = (page - 1) * limit;
    
    const payrolls = await Payroll.find(query)
      .populate('employee', 'name employeeId department designation')
      .populate('createdBy', 'name employeeId')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const totalCount = await Payroll.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      success: true,
      payrolls,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get Payroll by ID
export const getPayrollById = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id)
      .populate('employee', 'name employeeId department designation bankDetails')
      .populate('createdBy', 'name employeeId');

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll not found'
      });
    }

    res.json({
      success: true,
      payroll
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update Payroll
export const updatePayroll = async (req, res) => {
  try {
    const payroll = await Payroll.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('employee', 'name employeeId department designation');

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll not found'
      });
    }

    res.json({
      success: true,
      message: 'Payroll updated successfully',
      payroll
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Delete Payroll
export const deletePayroll = async (req, res) => {
  try {
    const payroll = await Payroll.findByIdAndDelete(req.params.id);

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll not found'
      });
    }

    res.json({
      success: true,
      message: 'Payroll deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Generate Payroll for All Employees (HR generates only for their team)
export const generatePayrollForAll = async (req, res) => {
  try {
    const { month, year } = req.body;
    
    // Get employees based on role
    let employees = [];
    if (req.employee.role === 'HR_Manager') {
      // HR can generate payroll for employees they added
      employees = await Employee.find({ 
        addedBy: req.employee._id, 
        isActive: true 
      });
      // Also include themselves
      const hrEmployee = await Employee.findById(req.employee._id);
      if (hrEmployee && hrEmployee.isActive) {
        employees.push(hrEmployee);
      }
    } else if (req.employee.role === 'Team_Leader') {
      // Team Leader can generate for their team members
      employees = await Employee.find({ 
        manager: req.employee._id, 
        isActive: true 
      });
      // Also include themselves
      const tlEmployee = await Employee.findById(req.employee._id);
      if (tlEmployee && tlEmployee.isActive) {
        employees.push(tlEmployee);
      }
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only HR Managers and Team Leaders can generate payrolls.'
      });
    }
    
    const payrolls = [];

    for (const employee of employees) {
      // Check if payroll already exists
      const existingPayroll = await Payroll.findOne({
        employee: employee._id,
        month,
        year
      });

      if (!existingPayroll) {
        const basicSalary = employee.salary || 0;
        const workingDays = 30;

        // Fetch actual attendance for this employee for the given month/year
        const startDate = new Date(Date.UTC(year, month - 1, 1));
        const endDate = new Date(Date.UTC(year, month, 1));

        const attendanceRecords = await Attendance.find({
          employee: employee._id,
          date: { $gte: startDate, $lt: endDate }
        });

        // Count present days (Present + Late + Early Departure = worked that day)
        const presentDays = attendanceRecords.filter(a =>
          ['Present', 'Late', 'Early Departure'].includes(a.status)
        ).length;

        // Half day = 0.5
        const halfDays = attendanceRecords.filter(a => a.status === 'Half Day').length;
        const effectivePresentDays = presentDays + (halfDays * 0.5);

        // Total overtime hours
        const overtimeHours = attendanceRecords.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);

        // Per day salary
        const perDaySalary = basicSalary / workingDays;

        // Overtime rate = per hour salary (basicSalary / workingDays / 8) * 1.5
        const overtimeRate = (basicSalary / workingDays / 8) * 1.5;
        const overtimeAmount = Math.round(overtimeHours * overtimeRate);

        // Gross = perDay * effectivePresentDays + overtime
        const grossSalary = Math.round(perDaySalary * effectivePresentDays) + overtimeAmount;
        const netSalary = grossSalary;

        const payroll = new Payroll({
          employee: employee._id,
          month,
          year,
          basicSalary,
          workingDays,
          presentDays: effectivePresentDays,
          leaveDays: attendanceRecords.filter(a => a.status === 'On Leave').length,
          overtimeHours: Math.round(overtimeHours * 100) / 100,
          overtimeAmount,
          grossSalary,
          netSalary,
          createdBy: req.employee.id
        });

        await payroll.save();
        payrolls.push(payroll);
      }
    }

    res.json({
      success: true,
      message: `Generated payroll for ${payrolls.length} employees`,
      count: payrolls.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get HR Team Payrolls (specific endpoint for HR managers)
export const getHRTeamPayrolls = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      month,
      year,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Only HR Managers can access this endpoint
    if (req.employee.role !== 'HR_Manager') {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only HR Managers can access this endpoint."
      });
    }

    // Get employees added by this HR manager
    const teamMembers = await Employee.find({ 
      addedBy: req.employee._id,
      isActive: true 
    }).select('_id name employeeId');
    
    console.log('HR Team Members Found:', teamMembers.length);
    
    const teamMemberIds = teamMembers.map(member => member._id);
    teamMemberIds.push(req.employee._id); // Include HR's own payroll
    
    console.log('Team Member IDs for payroll:', teamMemberIds);

    let query = {
      employee: { $in: teamMemberIds }
    };
    
    // Additional filters
    if (month) query.month = month;
    if (year) query.year = year;
    if (status) query.status = status;

    console.log('Final Payroll Query:', JSON.stringify(query, null, 2));

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const skip = (page - 1) * limit;
    
    const payrolls = await Payroll.find(query)
      .populate('employee', 'name employeeId department designation')
      .populate('createdBy', 'name employeeId')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const totalCount = await Payroll.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);

    console.log('Payrolls Found:', payrolls.length, 'Total Count:', totalCount);

    res.json({
      success: true,
      payrolls,
      teamMembers: teamMembers.length,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get HR Team Payrolls Error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export default {
  createPayroll,
  getAllPayrolls,
  getHRTeamPayrolls,
  getPayrollById,
  updatePayroll,
  deletePayroll,
  generatePayrollForAll,
  recalculatePayroll
};

// Recalculate existing payroll based on actual attendance
export const recalculatePayroll = async (req, res) => {
  try {
    const { month, year } = req.body;

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

    const workingDays = 30;
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 1));
    let updated = 0;

    for (const employee of employees) {
      const existingPayroll = await Payroll.findOne({ employee: employee._id, month, year });
      if (!existingPayroll) continue;

      const attendanceRecords = await Attendance.find({
        employee: employee._id,
        date: { $gte: startDate, $lt: endDate }
      });

      const presentDays = attendanceRecords.filter(a =>
        ['Present', 'Late', 'Early Departure'].includes(a.status)
      ).length;
      const halfDays = attendanceRecords.filter(a => a.status === 'Half Day').length;
      const effectivePresentDays = presentDays + (halfDays * 0.5);
      const leaveDays = attendanceRecords.filter(a => a.status === 'On Leave').length;
      const overtimeHours = attendanceRecords.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);

      const basicSalary = employee.salary || existingPayroll.basicSalary || 0;
      const perDaySalary = basicSalary / workingDays;
      const overtimeRate = (basicSalary / workingDays / 8) * 1.5;
      const overtimeAmount = Math.round(overtimeHours * overtimeRate);
      const grossSalary = Math.round(perDaySalary * effectivePresentDays) + overtimeAmount;

      await Payroll.updateOne(
        { _id: existingPayroll._id },
        {
          $set: {
            workingDays,
            presentDays: effectivePresentDays,
            leaveDays,
            overtimeHours: Math.round(overtimeHours * 100) / 100,
            overtimeAmount,
            grossSalary,
            netSalary: grossSalary
          }
        }
      );
      updated++;
    }

    res.json({ success: true, message: `Recalculated payroll for ${updated} employees`, count: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};