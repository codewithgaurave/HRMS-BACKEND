import Employee from '../models/Employee.js';
import Payroll from '../models/Payroll.js';
import Asset from '../models/Asset.js';
import Leave from '../models/Leave.js';
import Attendance from '../models/Attendance.js';
import mongoose from 'mongoose';

// Employee Reports
export const getEmployeeReports = async (req, res) => {
  try {
    const totalEmployees = await Employee.countDocuments();
    const activeEmployees = await Employee.countDocuments({ isActive: true });
    const inactiveEmployees = await Employee.countDocuments({ isActive: false });

    // Department wise count
    const departmentStats = await Employee.aggregate([
      {
        $lookup: {
          from: 'departments',
          localField: 'department',
          foreignField: '_id',
          as: 'departmentInfo'
        }
      },
      {
        $unwind: '$departmentInfo'
      },
      {
        $group: {
          _id: '$departmentInfo.name',
          count: { $sum: 1 },
          active: { $sum: { $cond: ['$isActive', 1, 0] } }
        }
      }
    ]);

    // Role wise count
    const roleStats = await Employee.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        summary: {
          totalEmployees,
          activeEmployees,
          inactiveEmployees
        },
        departmentStats,
        roleStats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Payroll Reports
export const getPayrollReports = async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;

    // Monthly payroll summary
    const monthlyStats = await Payroll.aggregate([
      {
        $match: { year: parseInt(year) }
      },
      {
        $group: {
          _id: '$month',
          totalPayrolls: { $sum: 1 },
          totalGrossSalary: { $sum: '$grossSalary' },
          totalNetSalary: { $sum: '$netSalary' },
          avgSalary: { $avg: '$netSalary' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Status wise count
    const statusStats = await Payroll.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$netSalary' }
        }
      }
    ]);

    // Department wise payroll
    const departmentPayroll = await Payroll.aggregate([
      {
        $lookup: {
          from: 'employees',
          localField: 'employee',
          foreignField: '_id',
          as: 'employeeInfo'
        }
      },
      {
        $unwind: '$employeeInfo'
      },
      {
        $lookup: {
          from: 'departments',
          localField: 'employeeInfo.department',
          foreignField: '_id',
          as: 'departmentInfo'
        }
      },
      {
        $unwind: '$departmentInfo'
      },
      {
        $group: {
          _id: '$departmentInfo.name',
          totalAmount: { $sum: '$netSalary' },
          employeeCount: { $sum: 1 },
          avgSalary: { $avg: '$netSalary' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        monthlyStats,
        statusStats,
        departmentPayroll
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Asset Reports
export const getAssetReports = async (req, res) => {
  try {
    const { year, month } = req.query;

    const assets = await Asset.find({ createdBy: req.employee._id })
      .populate('assignedTo.employee', 'name employeeId email department designation')
      .populate('assignedTo.assignedBy', 'name employeeId')
      .populate('createdBy', 'name employeeId')
      .sort({ createdAt: -1 });

    const totalAssets = assets.length;

    const statusStats = await Asset.aggregate([
      { $match: { createdBy: req.employee._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const categoryStats = await Asset.aggregate([
      { $match: { createdBy: req.employee._id } },
      { $group: { _id: '$category', count: { $sum: 1 }, assigned: { $sum: { $cond: [{ $eq: ['$status', 'Assigned'] }, 1, 0] } } } }
    ]);

    // Build transfer history with optional month/year filter
    const transferHistory = [];
    assets.forEach(asset => {
      asset.assignedTo.forEach(assignment => {
        const assignedDate = new Date(assignment.assignedDate);
        if (year && assignedDate.getFullYear() !== parseInt(year)) return;
        if (month && (assignedDate.getMonth() + 1) !== parseInt(month)) return;

        transferHistory.push({
          assetId: asset.assetId,
          assetName: asset.name,
          category: asset.category,
          brand: asset.brand || '',
          model: asset.model || '',
          serialNumber: asset.serialNumber || '',
          assignedTo: assignment.employee,
          assignedBy: assignment.assignedBy,
          assignedDate: assignment.assignedDate,
          returnDate: assignment.returnDate || null,
          isActive: assignment.isActive,
          transferType: assignment.transferType || 'assign',
          daysUsed: assignment.returnDate
            ? Math.ceil((new Date(assignment.returnDate) - new Date(assignment.assignedDate)) / 86400000)
            : Math.ceil((new Date() - new Date(assignment.assignedDate)) / 86400000)
        });
      });
    });

    transferHistory.sort((a, b) => new Date(b.assignedDate) - new Date(a.assignedDate));

    // Employee wise current assets (always show current state, not filtered)
    const employeeAssetMap = {};
    assets.forEach(asset => {
      asset.assignedTo.filter(a => a.isActive).forEach(a => {
        const empId = a.employee?._id?.toString();
        if (!empId) return;
        if (!employeeAssetMap[empId]) employeeAssetMap[empId] = { employee: a.employee, assets: [] };
        employeeAssetMap[empId].assets.push({
          assetId: asset.assetId,
          name: asset.name,
          category: asset.category,
          assignedDate: a.assignedDate
        });
      });
    });

    res.json({
      success: true,
      data: {
        totalAssets,
        statusStats,
        categoryStats,
        transferHistory,
        employeeAssets: Object.values(employeeAssetMap)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Attendance Reports
export const getAttendanceReports = async (req, res) => {
  try {
    const { year = new Date().getFullYear(), month } = req.query;
    const teamMembers = await Employee.find({ addedBy: req.employee._id, isActive: true }).select('_id');
    const teamMemberIds = teamMembers.map(m => m._id);
    teamMemberIds.push(req.employee._id);

    // UTC-safe date range
    const dateMatch = {};
    if (year && month) {
      const y = parseInt(year), m2 = parseInt(month);
      const nextMonth = m2 === 12 ? 1 : m2 + 1;
      const nextYear = m2 === 12 ? y + 1 : y;
      dateMatch.date = {
        $gte: new Date(`${y}-${String(m2).padStart(2,'0')}-01T00:00:00.000Z`),
        $lt: new Date(`${nextYear}-${String(nextMonth).padStart(2,'0')}-01T00:00:00.000Z`)
      };
    } else if (year) {
      dateMatch.date = {
        $gte: new Date(`${year}-01-01T00:00:00.000Z`),
        $lt: new Date(`${parseInt(year)+1}-01-01T00:00:00.000Z`)
      };
    }

    const baseMatch = { employee: { $in: teamMemberIds }, ...dateMatch };

    const today = new Date();
    const todayStart = new Date(today.setHours(0,0,0,0));
    const todayEnd = new Date(today.setHours(23,59,59,999));

    const todayAttendance = await Attendance.countDocuments({ employee: { $in: teamMemberIds }, date: { $gte: todayStart, $lt: todayEnd }, status: 'Present' });
    const lateToday = await Attendance.countDocuments({ employee: { $in: teamMemberIds }, date: { $gte: todayStart, $lt: todayEnd }, status: 'Late' });

    // Monthly stats
    const monthlyStats = await Attendance.aggregate([
      { $match: baseMatch },
      { $group: {
        _id: { month: { $month: '$date' }, year: { $year: '$date' } },
        present: { $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] } },
        absent: { $sum: { $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0] } },
        late: { $sum: { $cond: [{ $eq: ['$status', 'Late'] }, 1, 0] } },
        halfDay: { $sum: { $cond: [{ $eq: ['$status', 'Half Day'] }, 1, 0] } },
        onLeave: { $sum: { $cond: [{ $eq: ['$status', 'On Leave'] }, 1, 0] } },
        totalWorkHours: { $sum: '$totalWorkHours' },
        overtimeHours: { $sum: '$overtimeHours' }
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Employee wise detail
    const employeeStats = await Attendance.aggregate([
      { $match: baseMatch },
      { $lookup: { from: 'employees', localField: 'employee', foreignField: '_id', as: 'empInfo' } },
      { $unwind: '$empInfo' },
      { $lookup: { from: 'departments', localField: 'empInfo.department', foreignField: '_id', as: 'deptInfo' } },
      { $unwind: { path: '$deptInfo', preserveNullAndEmptyArrays: true } },
      { $group: {
        _id: '$employee',
        employeeId: { $first: '$empInfo.employeeId' },
        firstName: { $first: '$empInfo.name.first' },
        lastName: { $first: '$empInfo.name.last' },
        email: { $first: '$empInfo.email' },
        department: { $first: '$deptInfo.name' },
        role: { $first: '$empInfo.role' },
        present: { $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] } },
        absent: { $sum: { $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0] } },
        late: { $sum: { $cond: [{ $eq: ['$status', 'Late'] }, 1, 0] } },
        halfDay: { $sum: { $cond: [{ $eq: ['$status', 'Half Day'] }, 1, 0] } },
        onLeave: { $sum: { $cond: [{ $eq: ['$status', 'On Leave'] }, 1, 0] } },
        totalWorkHours: { $sum: '$totalWorkHours' },
        overtimeHours: { $sum: '$overtimeHours' },
        totalDays: { $sum: 1 }
      }},
      { $sort: { department: 1, lastName: 1 } }
    ]);

    const totalDays = monthlyStats.reduce((s, m) => s + m.present + m.absent + m.late + m.halfDay + m.onLeave, 0);
    const totalPresent = monthlyStats.reduce((s, m) => s + m.present + m.late, 0);
    const averageAttendance = totalDays > 0 ? ((totalPresent / totalDays) * 100).toFixed(1) : 0;

    res.json({
      success: true,
      data: { todayAttendance, lateToday, monthlyStats, employeeStats, averageAttendance, teamSize: teamMemberIds.length }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Leave Reports
export const getLeaveReports = async (req, res) => {
  try {
    const { year = new Date().getFullYear(), month } = req.query;
    const teamMembers = await Employee.find({ addedBy: req.employee._id }).select('_id');
    const teamMemberIds = teamMembers.map(m => m._id);
    teamMemberIds.push(req.employee._id);

    const dateMatch = {};
    if (year && month) {
      dateMatch.startDate = {
        $gte: new Date(`${year}-${String(month).padStart(2,'0')}-01T00:00:00.000Z`),
        $lt: new Date(`${parseInt(month) === 12 ? parseInt(year)+1 : year}-${String(parseInt(month) === 12 ? 1 : parseInt(month)+1).padStart(2,'0')}-01T00:00:00.000Z`)
      };
    } else if (year) {
      dateMatch.startDate = {
        $gte: new Date(`${year}-01-01T00:00:00.000Z`),
        $lt: new Date(`${parseInt(year)+1}-01-01T00:00:00.000Z`)
      };
    }

    const baseMatch = { employee: { $in: teamMemberIds }, ...dateMatch };

    const totalLeaves = await Leave.countDocuments(baseMatch);

    const statusStats = await Leave.aggregate([
      { $match: baseMatch },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const typeStats = await Leave.aggregate([
      { $match: baseMatch },
      { $group: { _id: '$leaveType', count: { $sum: 1 } } }
    ]);

    const monthlyStats = await Leave.aggregate([
      { $match: baseMatch },
      { $group: {
        _id: { month: { $month: '$startDate' }, year: { $year: '$startDate' } },
        approved: { $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } },
        rejected: { $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] } },
        total: { $sum: 1 }
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Employee wise leave detail
    const employeeLeaves = await Leave.aggregate([
      { $match: baseMatch },
      { $lookup: { from: 'employees', localField: 'employee', foreignField: '_id', as: 'empInfo' } },
      { $unwind: '$empInfo' },
      { $lookup: { from: 'departments', localField: 'empInfo.department', foreignField: '_id', as: 'deptInfo' } },
      { $unwind: { path: '$deptInfo', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'employees', localField: 'approvedBy', foreignField: '_id', as: 'approverInfo' } },
      { $unwind: { path: '$approverInfo', preserveNullAndEmptyArrays: true } },
      { $project: {
        leaveType: 1, startDate: 1, endDate: 1, reason: 1, status: 1, createdAt: 1,
        leaveDays: { $add: [{ $divide: [{ $subtract: ['$endDate', '$startDate'] }, 86400000] }, 1] },
        employeeId: '$empInfo.employeeId',
        firstName: '$empInfo.name.first',
        lastName: '$empInfo.name.last',
        email: '$empInfo.email',
        department: { $ifNull: ['$deptInfo.name', 'N/A'] },
        role: '$empInfo.role',
        approvedBy: { $cond: [{ $ifNull: ['$approverInfo._id', false] }, { $concat: ['$approverInfo.name.first', ' ', '$approverInfo.name.last'] }, ''] }
      }},
      { $sort: { department: 1, lastName: 1, startDate: -1 } }
    ]);

    res.json({
      success: true,
      data: { totalLeaves, statusStats, typeStats, monthlyStats, employeeLeaves }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Department Reports
export const getDepartmentReports = async (req, res) => {
  try {
    const { year = new Date().getFullYear(), month } = req.query;
    const teamMembers = await Employee.find({ addedBy: req.employee._id }).select('_id');
    const teamMemberIds = teamMembers.map(m => m._id);
    teamMemberIds.push(req.employee._id);

    const payrollDateMatch = { employee: { $in: teamMemberIds }, year: parseInt(year) };
    if (month) payrollDateMatch.month = parseInt(month);

    const departmentStats = await Employee.aggregate([
      { $match: { _id: { $in: teamMemberIds } } },
      { $lookup: { from: 'departments', localField: 'department', foreignField: '_id', as: 'deptInfo' } },
      { $unwind: { path: '$deptInfo', preserveNullAndEmptyArrays: true } },
      { $group: {
        _id: { $ifNull: ['$deptInfo.name', 'N/A'] },
        employees: { $sum: 1 },
        active: { $sum: { $cond: ['$isActive', 1, 0] } },
        avgSalary: { $avg: { $toDouble: '$salary' } },
        roles: { $push: '$role' }
      }},
      { $sort: { employees: -1 } }
    ]);

    const payrollByDept = await Payroll.aggregate([
      { $match: payrollDateMatch },
      { $lookup: { from: 'employees', localField: 'employee', foreignField: '_id', as: 'empInfo' } },
      { $unwind: '$empInfo' },
      { $lookup: { from: 'departments', localField: 'empInfo.department', foreignField: '_id', as: 'deptInfo' } },
      { $unwind: { path: '$deptInfo', preserveNullAndEmptyArrays: true } },
      { $group: {
        _id: { $ifNull: ['$deptInfo.name', 'N/A'] },
        totalBudget: { $sum: { $toDouble: '$netSalary' } },
        totalGross: { $sum: { $toDouble: '$grossSalary' } },
        uniqueEmployees: { $addToSet: '$employee' }
      }},
      { $project: { _id: 1, totalBudget: { $round: ['$totalBudget', 0] }, totalGross: { $round: ['$totalGross', 0] }, employeeCount: { $size: '$uniqueEmployees' } } },
      { $sort: { totalBudget: -1 } }
    ]);

    // Employee wise dept detail
    const employeeDetails = await Employee.find({ _id: { $in: teamMemberIds } })
      .select('-password')
      .populate('department', 'name')
      .populate('designation', 'title')
      .sort({ 'department': 1, 'name.last': 1 });

    res.json({
      success: true,
      data: { departmentStats, payrollByDept, employeeDetails }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// HR Team Employee Reports
export const getHRTeamEmployeeReports = async (req, res) => {
  try {
    // Get employees added by this HR manager
    const teamMembers = await Employee.find({ addedBy: req.employee._id });
    const teamMemberIds = teamMembers.map(member => member._id);
    teamMemberIds.push(req.employee._id); // Include HR's own data

    const totalEmployees = teamMemberIds.length;
    const activeEmployees = await Employee.countDocuments({ 
      _id: { $in: teamMemberIds }, 
      isActive: true 
    });
    const inactiveEmployees = totalEmployees - activeEmployees;

    // Department wise count for HR's team
    const departmentStats = await Employee.aggregate([
      { $match: { _id: { $in: teamMemberIds } } },
      {
        $lookup: {
          from: 'departments',
          localField: 'department',
          foreignField: '_id',
          as: 'departmentInfo'
        }
      },
      { $unwind: '$departmentInfo' },
      {
        $group: {
          _id: '$departmentInfo.name',
          count: { $sum: 1 },
          active: { $sum: { $cond: ['$isActive', 1, 0] } }
        }
      }
    ]);

    // Role wise count for HR's team
    const roleStats = await Employee.aggregate([
      { $match: { _id: { $in: teamMemberIds } } },
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    // Full employee details for export
    const employeeDetails = await Employee.find({ _id: { $in: teamMemberIds } })
      .select('-password')
      .populate('department', 'name')
      .populate('designation', 'title')
      .populate('employmentStatus', 'title')
      .populate('officeLocation', 'officeName')
      .populate('workShift', 'name')
      .populate('manager', 'name employeeId')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        summary: {
          totalEmployees,
          activeEmployees,
          inactiveEmployees
        },
        departmentStats,
        roleStats,
        employeeDetails
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// HR Team Payroll Reports
export const getHRTeamPayrollReports = async (req, res) => {
  try {
    const { year = new Date().getFullYear(), month } = req.query;

    const teamMembers = await Employee.find({ addedBy: req.employee._id });
    const teamMemberIds = teamMembers.map(member => member._id);
    teamMemberIds.push(req.employee._id);

    const baseMatch = { employee: { $in: teamMemberIds }, year: parseInt(year) };
    if (month) baseMatch.month = parseInt(month);

    // Monthly summary
    const monthlyStats = await Payroll.aggregate([
      { $match: baseMatch },
      { $group: {
        _id: '$month',
        totalPayrolls: { $sum: 1 },
        totalGrossSalary: { $sum: '$grossSalary' },
        totalNetSalary: { $sum: '$netSalary' },
        avgSalary: { $avg: '$netSalary' }
      }},
      { $sort: { _id: 1 } }
    ]);

    // Status stats
    const statusStats = await Payroll.aggregate([
      { $match: baseMatch },
      { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$netSalary' } } }
    ]);

    // Department wise payroll
    const departmentPayroll = await Payroll.aggregate([
      { $match: baseMatch },
      { $lookup: { from: 'employees', localField: 'employee', foreignField: '_id', as: 'employeeInfo' } },
      { $unwind: '$employeeInfo' },
      { $lookup: { from: 'departments', localField: 'employeeInfo.department', foreignField: '_id', as: 'departmentInfo' } },
      { $unwind: { path: '$departmentInfo', preserveNullAndEmptyArrays: true } },
      { $group: {
        _id: { $ifNull: ['$departmentInfo.name', 'Unknown'] },
        totalGross: { $sum: { $toDouble: '$grossSalary' } },
        totalNet: { $sum: { $toDouble: '$netSalary' } },
        avgSalary: { $avg: { $toDouble: '$netSalary' } },
        uniqueEmployees: { $addToSet: '$employee' },
        totalPayrolls: { $sum: 1 }
      }},
      { $project: {
        _id: 1,
        totalGross: { $round: ['$totalGross', 0] },
        totalAmount: { $round: ['$totalNet', 0] },
        avgSalary: { $round: ['$avgSalary', 0] },
        employeeCount: { $size: '$uniqueEmployees' },
        totalPayrolls: 1
      }},
      { $sort: { totalAmount: -1 } }
    ]);

    // Employee wise payroll detail
    const employeePayroll = await Payroll.aggregate([
      { $match: baseMatch },
      { $lookup: { from: 'employees', localField: 'employee', foreignField: '_id', as: 'empInfo' } },
      { $unwind: '$empInfo' },
      { $lookup: { from: 'departments', localField: 'empInfo.department', foreignField: '_id', as: 'deptInfo' } },
      { $unwind: { path: '$deptInfo', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'designations', localField: 'empInfo.designation', foreignField: '_id', as: 'desigInfo' } },
      { $unwind: { path: '$desigInfo', preserveNullAndEmptyArrays: true } },
      { $project: {
        month: 1, year: 1,
        basicSalary: { $toDouble: '$basicSalary' },
        grossSalary: { $toDouble: '$grossSalary' },
        netSalary: { $toDouble: '$netSalary' },
        workingDays: 1, presentDays: 1, leaveDays: 1,
        overtimeHours: 1, overtimeAmount: { $toDouble: '$overtimeAmount' },
        allowances: 1, deductions: 1,
        status: 1, paymentDate: 1, paymentMethod: 1, remarks: 1,
        employeeId: '$empInfo.employeeId',
        firstName: '$empInfo.name.first',
        lastName: '$empInfo.name.last',
        email: '$empInfo.email',
        mobile: '$empInfo.mobile',
        role: '$empInfo.role',
        department: { $ifNull: ['$deptInfo.name', 'N/A'] },
        designation: { $ifNull: ['$desigInfo.title', 'N/A'] }
      }},
      { $sort: { department: 1, lastName: 1, month: 1 } }
    ]);

    res.json({
      success: true,
      data: { monthlyStats, statusStats, departmentPayroll, employeePayroll, teamSize: teamMemberIds.length }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// HR Team Attendance Reports — delegates to main getAttendanceReports
export const getHRTeamAttendanceReports = getAttendanceReports;

// HR Team Leave Reports — delegates to main getLeaveReports
export const getHRTeamLeaveReports = getLeaveReports;

export default {
  getEmployeeReports,
  getPayrollReports,
  getAssetReports,
  getAttendanceReports,
  getLeaveReports,
  getDepartmentReports,
  getHRTeamEmployeeReports,
  getHRTeamPayrollReports,
  getHRTeamAttendanceReports,
  getHRTeamLeaveReports
};