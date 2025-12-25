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
    const totalAssets = await Asset.countDocuments();
    
    // Status wise count
    const statusStats = await Asset.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Category wise count
    const categoryStats = await Asset.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          assigned: {
            $sum: { $cond: [{ $eq: ['$status', 'Assigned'] }, 1, 0] }
          }
        }
      }
    ]);

    // Assignment stats
    const assignmentStats = await Asset.aggregate([
      {
        $match: { status: 'Assigned' }
      },
      {
        $unwind: '$assignedTo'
      },
      {
        $match: { 'assignedTo.isActive': true }
      },
      {
        $lookup: {
          from: 'employees',
          localField: 'assignedTo.employee',
          foreignField: '_id',
          as: 'employeeInfo'
        }
      },
      {
        $unwind: '$employeeInfo'
      },
      {
        $group: {
          _id: '$employeeInfo.name',
          assetCount: { $sum: 1 },
          employeeId: { $first: '$employeeInfo.employeeId' }
        }
      },
      {
        $sort: { assetCount: -1 }
      },
      {
        $limit: 10
      }
    ]);

    res.json({
      success: true,
      data: {
        totalAssets,
        statusStats,
        categoryStats,
        topAssignees: assignmentStats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Attendance Reports
export const getAttendanceReports = async (req, res) => {
  try {
    const totalEmployees = await Employee.countDocuments({ isActive: true });
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const monthlyStats = await Attendance.aggregate([
      {
        $match: {
          date: { $gte: startOfMonth }
        }
      },
      {
        $group: {
          _id: { $month: "$date" },
          present: { $sum: { $cond: [{ $eq: ["$status", "Present"] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ["$status", "Absent"] }, 1, 0] } },
          late: { $sum: { $cond: [{ $eq: ["$status", "Late"] }, 1, 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    const todayAttendance = await Attendance.countDocuments({
      date: { $gte: new Date(today.setHours(0,0,0,0)), $lt: new Date(today.setHours(23,59,59,999)) },
      status: 'Present'
    });
    
    const lateToday = await Attendance.countDocuments({
      date: { $gte: new Date(today.setHours(0,0,0,0)), $lt: new Date(today.setHours(23,59,59,999)) },
      status: 'Late'
    });
    
    res.json({
      success: true,
      data: {
        totalEmployees,
        todayAttendance,
        lateToday,
        monthlyStats,
        averageAttendance: monthlyStats.length > 0 ? 
          (monthlyStats.reduce((acc, curr) => acc + curr.present, 0) / (monthlyStats.length * totalEmployees) * 100).toFixed(1) : 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Leave Reports
export const getLeaveReports = async (req, res) => {
  try {
    const totalLeaves = await Leave.countDocuments();
    
    const statusStats = await Leave.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);
    
    const typeStats = await Leave.aggregate([
      {
        $group: {
          _id: "$leaveType",
          count: { $sum: 1 }
        }
      }
    ]);
    
    const monthlyStats = await Leave.aggregate([
      {
        $group: {
          _id: { $month: "$startDate" },
          approved: { $sum: { $cond: [{ $eq: ["$status", "Approved"] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ["$status", "Rejected"] }, 1, 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    res.json({
      success: true,
      data: {
        totalLeaves,
        statusStats,
        typeStats,
        monthlyStats
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Department Reports
export const getDepartmentReports = async (req, res) => {
  try {
    const departmentStats = await Employee.aggregate([
      {
        $lookup: {
          from: "departments",
          localField: "department",
          foreignField: "_id",
          as: "deptInfo"
        }
      },
      { $unwind: "$deptInfo" },
      {
        $group: {
          _id: "$deptInfo.name",
          employees: { $sum: 1 },
          avgSalary: { $avg: "$salary" }
        }
      }
    ]);
    
    const payrollByDept = await Payroll.aggregate([
      {
        $lookup: {
          from: "employees",
          localField: "employee",
          foreignField: "_id",
          as: "empInfo"
        }
      },
      { $unwind: "$empInfo" },
      {
        $lookup: {
          from: "departments",
          localField: "empInfo.department",
          foreignField: "_id",
          as: "deptInfo"
        }
      },
      { $unwind: "$deptInfo" },
      {
        $group: {
          _id: "$deptInfo.name",
          totalBudget: { $sum: "$netSalary" },
          employeeCount: { $addToSet: "$employee" }
        }
      },
      {
        $project: {
          _id: 1,
          totalBudget: 1,
          employeeCount: { $size: "$employeeCount" }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        departmentStats,
        payrollByDept
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export default {
  getEmployeeReports,
  getPayrollReports,
  getAssetReports,
  getAttendanceReports,
  getLeaveReports,
  getDepartmentReports
};