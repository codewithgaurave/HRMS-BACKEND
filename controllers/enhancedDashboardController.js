import mongoose from "mongoose";
import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import Department from "../models/Department.js";
import Designation from "../models/Designation.js";
import OfficeLocation from "../models/OfficeLocation.js";
import WorkShift from "../models/WorkShift.js";
import Leave from "../models/Leave.js";
import Event from "../models/Event.js";
import Announcement from "../models/Announcement.js";
import Asset from "../models/Asset.js";
import AssetRequest from "../models/AssetRequest.js";
import Payroll from "../models/Payroll.js";

// @desc    Get Enhanced HR Dashboard Stats with comprehensive data
// @route   GET /api/dashboard/enhanced-stats
// @access  Private (HR_Manager only)
export const getEnhancedHRDashboardStats = async (req, res) => {
  try {
    const { role, _id: hrId } = req.employee;
    
    if (role !== "HR_Manager") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only HR Managers can access this data."
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    // Get HR-managed employees
    const hrEmployees = await Employee.find({ addedBy: hrId }).select('_id');
    const hrEmployeeIds = hrEmployees.map(emp => emp._id);

    // Execute all queries in parallel for better performance
    const [
      // Employee Statistics
      totalEmployees,
      activeEmployees,
      inactiveEmployees,
      newEmployeesThisMonth,
      newEmployeesLastMonth,
      
      // Department & Role Statistics
      departmentStats,
      roleDistribution,
      designationStats,
      
      // Attendance Statistics
      todayAttendanceStats,
      weekAttendanceStats,
      monthAttendanceStats,
      yearAttendanceStats,
      attendanceTrends,
      
      // Leave Statistics
      pendingLeaves,
      approvedLeavesThisMonth,
      rejectedLeavesThisMonth,
      leavesByType,
      leaveTrends,
      
      // Asset Statistics
      totalAssets,
      assignedAssets,
      availableAssets,
      pendingAssetRequests,
      assetsByCategory,
      
      // Payroll Statistics
      totalPayrollThisMonth,
      avgSalary,
      salaryDistribution,
      
      // Location & Shift Statistics
      locationStats,
      shiftStats,
      
      // Recent Activities
      recentEmployees,
      recentLeaves,
      upcomingEvents,
      recentAnnouncements,
      
      // Performance Metrics
      topPerformingDepartments,
      attendanceByDepartment,
      overtimeStats
      
    ] = await Promise.all([
      // Employee Statistics
      Employee.countDocuments({ addedBy: hrId }),
      Employee.countDocuments({ addedBy: hrId, isActive: true }),
      Employee.countDocuments({ addedBy: hrId, isActive: false }),
      Employee.countDocuments({ 
        addedBy: hrId, 
        dateOfJoining: { $gte: startOfMonth, $lte: today } 
      }),
      Employee.countDocuments({ 
        addedBy: hrId, 
        dateOfJoining: { $gte: startOfLastMonth, $lte: endOfLastMonth } 
      }),
      
      // Department Statistics
      Employee.aggregate([
        { $match: { addedBy: new mongoose.Types.ObjectId(hrId), isActive: true } },
        { $lookup: { from: "departments", localField: "department", foreignField: "_id", as: "dept" } },
        { $unwind: "$dept" },
        { $group: { 
          _id: "$dept.name", 
          count: { $sum: 1 },
          avgSalary: { $avg: "$salary" },
          totalSalary: { $sum: "$salary" }
        }},
        { $sort: { count: -1 } }
      ]),
      
      // Role Distribution
      Employee.aggregate([
        { $match: { addedBy: new mongoose.Types.ObjectId(hrId), isActive: true } },
        { $group: { _id: "$role", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      
      // Designation Statistics
      Employee.aggregate([
        { $match: { addedBy: new mongoose.Types.ObjectId(hrId), isActive: true } },
        { $lookup: { from: "designations", localField: "designation", foreignField: "_id", as: "desig" } },
        { $unwind: "$desig" },
        { $group: { _id: "$desig.title", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      
      // Today's Attendance
      getDetailedAttendanceStats(today, today, hrEmployeeIds),
      
      // Week Attendance
      getDetailedAttendanceStats(startOfWeek, today, hrEmployeeIds),
      
      // Month Attendance
      getDetailedAttendanceStats(startOfMonth, today, hrEmployeeIds),
      
      // Year Attendance
      getDetailedAttendanceStats(startOfYear, today, hrEmployeeIds),
      
      // Attendance Trends (Last 30 days)
      getAttendanceTrendsData(hrEmployeeIds),
      
      // Leave Statistics
      Leave.countDocuments({ employee: { $in: hrEmployeeIds }, status: "Pending" }),
      Leave.countDocuments({ 
        employee: { $in: hrEmployeeIds }, 
        status: "Approved",
        createdAt: { $gte: startOfMonth, $lte: today }
      }),
      Leave.countDocuments({ 
        employee: { $in: hrEmployeeIds }, 
        status: "Rejected",
        createdAt: { $gte: startOfMonth, $lte: today }
      }),
      
      // Leaves by Type
      Leave.aggregate([
        { $match: { employee: { $in: hrEmployeeIds } } },
        { $group: { _id: "$leaveType", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      
      // Leave Trends
      getLeaveTrendsData(hrEmployeeIds),
      
      // Asset Statistics
      Asset.countDocuments({}),
      Asset.countDocuments({ assignedTo: { $in: hrEmployeeIds } }),
      Asset.countDocuments({ status: "Available" }),
      AssetRequest.countDocuments({ 
        employee: { $in: hrEmployeeIds }, 
        status: "Pending" 
      }),
      
      // Assets by Category
      Asset.aggregate([
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      
      // Payroll Statistics
      Payroll.aggregate([
        { $match: { 
          employee: { $in: hrEmployeeIds },
          month: startOfMonth.getMonth() + 1,
          year: startOfMonth.getFullYear()
        }},
        { $group: { 
          _id: null, 
          totalPayroll: { $sum: "$netSalary" },
          avgSalary: { $avg: "$netSalary" }
        }}
      ]),
      
      // Average Salary
      Employee.aggregate([
        { $match: { addedBy: new mongoose.Types.ObjectId(hrId), isActive: true } },
        { $group: { _id: null, avgSalary: { $avg: "$salary" } } }
      ]),
      
      // Salary Distribution
      Employee.aggregate([
        { $match: { addedBy: new mongoose.Types.ObjectId(hrId), isActive: true } },
        { $bucket: {
          groupBy: "$salary",
          boundaries: [0, 30000, 50000, 75000, 100000, 150000, 999999],
          default: "Other",
          output: { count: { $sum: 1 } }
        }}
      ]),
      
      // Location Statistics
      Employee.aggregate([
        { $match: { addedBy: new mongoose.Types.ObjectId(hrId), isActive: true } },
        { $lookup: { from: "officelocations", localField: "officeLocation", foreignField: "_id", as: "location" } },
        { $unwind: "$location" },
        { $group: { _id: "$location.officeName", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      
      // Shift Statistics
      Employee.aggregate([
        { $match: { addedBy: new mongoose.Types.ObjectId(hrId), isActive: true } },
        { $lookup: { from: "workshifts", localField: "workShift", foreignField: "_id", as: "shift" } },
        { $unwind: "$shift" },
        { $group: { _id: "$shift.name", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      
      // Recent Employees (Last 10)
      Employee.find({ addedBy: hrId })
        .populate('department', 'name')
        .populate('designation', 'title')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      
      // Recent Leaves (Last 10)
      Leave.find({ employee: { $in: hrEmployeeIds } })
        .populate('employee', 'name employeeId')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      
      // Upcoming Events
      Event.find({ 
        startDate: { $gte: today },
        endDate: { $lte: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) }
      })
      .populate('officeLocation', 'officeName')
      .sort({ startDate: 1 })
      .limit(10)
      .lean(),
      
      // Recent Announcements
      Announcement.find({ isActive: true })
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      
      // Top Performing Departments (by attendance)
      getTopPerformingDepartments(hrEmployeeIds),
      
      // Attendance by Department
      getAttendanceByDepartment(hrEmployeeIds, startOfMonth, today),
      
      // Overtime Statistics
      getOvertimeStats(hrEmployeeIds, startOfMonth, today)
    ]);

    // Calculate growth percentages
    const employeeGrowth = newEmployeesLastMonth > 0 
      ? (((newEmployeesThisMonth - newEmployeesLastMonth) / newEmployeesLastMonth) * 100).toFixed(1)
      : newEmployeesThisMonth > 0 ? 100 : 0;

    // Calculate attendance rates
    const todayAttendanceRate = todayAttendanceStats.totalEmployees > 0 
      ? ((todayAttendanceStats.present + todayAttendanceStats.late + todayAttendanceStats.halfDay) / todayAttendanceStats.totalEmployees * 100).toFixed(1)
      : 0;

    const monthAttendanceRate = monthAttendanceStats.totalEmployees > 0 
      ? ((monthAttendanceStats.present + monthAttendanceStats.late + monthAttendanceStats.halfDay) / monthAttendanceStats.totalEmployees * 100).toFixed(1)
      : 0;

    // Prepare comprehensive response
    const enhancedStats = {
      // Overview Statistics
      overview: {
        totalEmployees,
        activeEmployees,
        inactiveEmployees,
        newEmployeesThisMonth,
        employeeGrowth: parseFloat(employeeGrowth),
        pendingLeaves,
        totalAssets,
        assignedAssets,
        availableAssets
      },

      // Attendance Analytics
      attendance: {
        today: {
          present: todayAttendanceStats.present,
          absent: todayAttendanceStats.absent,
          late: todayAttendanceStats.late,
          halfDay: todayAttendanceStats.halfDay,
          rate: parseFloat(todayAttendanceRate),
          totalEmployees: todayAttendanceStats.totalEmployees
        },
        week: {
          ...weekAttendanceStats,
          rate: weekAttendanceStats.totalEmployees > 0 
            ? ((weekAttendanceStats.present + weekAttendanceStats.late + weekAttendanceStats.halfDay) / weekAttendanceStats.totalEmployees * 100).toFixed(1)
            : 0
        },
        month: {
          ...monthAttendanceStats,
          rate: parseFloat(monthAttendanceRate)
        },
        trends: attendanceTrends
      },

      // Leave Analytics
      leaves: {
        pending: pendingLeaves,
        approvedThisMonth: approvedLeavesThisMonth,
        rejectedThisMonth: rejectedLeavesThisMonth,
        byType: leavesByType,
        trends: leaveTrends,
        approvalRate: (approvedLeavesThisMonth + rejectedLeavesThisMonth) > 0 
          ? ((approvedLeavesThisMonth / (approvedLeavesThisMonth + rejectedLeavesThisMonth)) * 100).toFixed(1)
          : 0
      },

      // Asset Analytics
      assets: {
        total: totalAssets,
        assigned: assignedAssets,
        available: availableAssets,
        pendingRequests: pendingAssetRequests,
        byCategory: assetsByCategory,
        utilizationRate: totalAssets > 0 ? ((assignedAssets / totalAssets) * 100).toFixed(1) : 0
      },

      // Payroll Analytics
      payroll: {
        totalThisMonth: totalPayrollThisMonth[0]?.totalPayroll || 0,
        avgSalary: avgSalary[0]?.avgSalary || 0,
        salaryDistribution: salaryDistribution
      },

      // Department Analytics
      departments: {
        stats: departmentStats,
        topPerforming: topPerformingDepartments,
        attendanceByDept: attendanceByDepartment
      },

      // Role & Designation Analytics
      workforce: {
        roleDistribution,
        designationStats,
        locationStats,
        shiftStats
      },

      // Performance Metrics
      performance: {
        overtimeStats,
        avgWorkHours: monthAttendanceStats.avgHoursWorked || 0,
        productivityScore: calculateProductivityScore(monthAttendanceStats, overtimeStats)
      },

      // Recent Activities
      recentActivities: {
        newEmployees: recentEmployees.slice(0, 5).map(emp => ({
          name: emp.name,
          employeeId: emp.employeeId,
          department: emp.department?.name,
          designation: emp.designation?.title,
          dateOfJoining: emp.dateOfJoining
        })),
        recentLeaves: recentLeaves.slice(0, 5).map(leave => ({
          employee: leave.employee,
          leaveType: leave.leaveType,
          startDate: leave.startDate,
          endDate: leave.endDate,
          status: leave.status
        })),
        upcomingEvents: upcomingEvents.slice(0, 5),
        recentAnnouncements: recentAnnouncements.slice(0, 5)
      },

      // System Alerts
      alerts: generateEnhancedAlerts({
        todayAttendance: todayAttendanceStats,
        pendingLeaves,
        pendingAssetRequests,
        inactiveEmployees,
        totalEmployees
      })
    };

    res.status(200).json({
      success: true,
      message: "Enhanced HR dashboard stats retrieved successfully",
      data: enhancedStats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Enhanced HR Dashboard Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching enhanced dashboard stats",
      error: error.message
    });
  }
};

// Helper Functions

// Get detailed attendance statistics
const getDetailedAttendanceStats = async (startDate, endDate, employeeIds) => {
  if (!employeeIds || employeeIds.length === 0) {
    return {
      present: 0, absent: 0, late: 0, halfDay: 0,
      totalEmployees: 0, totalHours: 0, overtimeHours: 0, avgHoursWorked: 0
    };
  }

  const stats = await Attendance.aggregate([
    {
      $match: {
        employee: { $in: employeeIds },
        date: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalHours: { $sum: "$totalWorkHours" },
        overtimeHours: { $sum: "$overtimeHours" }
      }
    }
  ]);

  const result = {
    present: 0, absent: 0, late: 0, halfDay: 0,
    totalEmployees: employeeIds.length,
    totalHours: 0, overtimeHours: 0, avgHoursWorked: 0
  };

  let totalRecords = 0;
  stats.forEach(stat => {
    totalRecords += stat.count;
    result.totalHours += stat.totalHours || 0;
    result.overtimeHours += stat.overtimeHours || 0;
    
    switch(stat._id) {
      case "Present": result.present = stat.count; break;
      case "Absent": result.absent = stat.count; break;
      case "Late": result.late = stat.count; break;
      case "Half Day": result.halfDay = stat.count; break;
    }
  });

  result.avgHoursWorked = totalRecords > 0 ? (result.totalHours / totalRecords).toFixed(1) : 0;
  return result;
};

// Get attendance trends for last 30 days
const getAttendanceTrendsData = async (employeeIds) => {
  if (!employeeIds || employeeIds.length === 0) return [];

  const last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);

  return await Attendance.aggregate([
    {
      $match: {
        employee: { $in: employeeIds },
        date: { $gte: last30Days }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
        present: { $sum: { $cond: [{ $in: ["$status", ["Present", "Late", "Half Day"]] }, 1, 0] } },
        absent: { $sum: { $cond: [{ $eq: ["$status", "Absent"] }, 1, 0] } },
        late: { $sum: { $cond: [{ $eq: ["$status", "Late"] }, 1, 0] } },
        total: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

// Get leave trends for last 6 months
const getLeaveTrendsData = async (employeeIds) => {
  if (!employeeIds || employeeIds.length === 0) return [];

  const last6Months = new Date();
  last6Months.setMonth(last6Months.getMonth() - 6);

  return await Leave.aggregate([
    {
      $match: {
        employee: { $in: employeeIds },
        createdAt: { $gte: last6Months }
      }
    },
    {
      $group: {
        _id: {
          month: { $month: "$createdAt" },
          year: { $year: "$createdAt" },
          status: "$status"
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: { month: "$_id.month", year: "$_id.year" },
        pending: { $sum: { $cond: [{ $eq: ["$_id.status", "Pending"] }, "$count", 0] } },
        approved: { $sum: { $cond: [{ $eq: ["$_id.status", "Approved"] }, "$count", 0] } },
        rejected: { $sum: { $cond: [{ $eq: ["$_id.status", "Rejected"] }, "$count", 0] } }
      }
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } }
  ]);
};

// Get top performing departments
const getTopPerformingDepartments = async (employeeIds) => {
  if (!employeeIds || employeeIds.length === 0) return [];

  const last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);

  return await Attendance.aggregate([
    {
      $match: {
        employee: { $in: employeeIds },
        date: { $gte: last30Days }
      }
    },
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
        present: { $sum: { $cond: [{ $in: ["$status", ["Present", "Late", "Half Day"]] }, 1, 0] } },
        total: { $sum: 1 }
      }
    },
    {
      $project: {
        department: "$_id",
        attendanceRate: { $multiply: [{ $divide: ["$present", "$total"] }, 100] },
        _id: 0
      }
    },
    { $sort: { attendanceRate: -1 } }
  ]);
};

// Get attendance by department
const getAttendanceByDepartment = async (employeeIds, startDate, endDate) => {
  if (!employeeIds || employeeIds.length === 0) return [];

  return await Employee.aggregate([
    { $match: { _id: { $in: employeeIds }, isActive: true } },
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
      $lookup: {
        from: "attendances",
        let: { empId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$employee", "$$empId"] },
              date: { $gte: startDate, $lte: endDate }
            }
          }
        ],
        as: "attendance"
      }
    },
    {
      $group: {
        _id: "$deptInfo.name",
        totalEmployees: { $sum: 1 },
        totalAttendance: { $sum: { $size: "$attendance" } },
        presentDays: {
          $sum: {
            $size: {
              $filter: {
                input: "$attendance",
                cond: { $in: ["$$this.status", ["Present", "Late", "Half Day"]] }
              }
            }
          }
        }
      }
    },
    {
      $project: {
        department: "$_id",
        totalEmployees: 1,
        attendanceRate: {
          $cond: [
            { $gt: ["$totalAttendance", 0] },
            { $multiply: [{ $divide: ["$presentDays", "$totalAttendance"] }, 100] },
            0
          ]
        },
        _id: 0
      }
    }
  ]);
};

// Get overtime statistics
const getOvertimeStats = async (employeeIds, startDate, endDate) => {
  if (!employeeIds || employeeIds.length === 0) {
    return { totalOvertime: 0, avgOvertime: 0, employeesWithOvertime: 0 };
  }

  const stats = await Attendance.aggregate([
    {
      $match: {
        employee: { $in: employeeIds },
        date: { $gte: startDate, $lte: endDate },
        overtimeHours: { $gt: 0 }
      }
    },
    {
      $group: {
        _id: null,
        totalOvertime: { $sum: "$overtimeHours" },
        avgOvertime: { $avg: "$overtimeHours" },
        employeesWithOvertime: { $addToSet: "$employee" }
      }
    }
  ]);

  const result = stats[0] || { totalOvertime: 0, avgOvertime: 0, employeesWithOvertime: [] };
  return {
    totalOvertime: result.totalOvertime,
    avgOvertime: result.avgOvertime ? result.avgOvertime.toFixed(1) : 0,
    employeesWithOvertime: result.employeesWithOvertime.length
  };
};

// Calculate productivity score
const calculateProductivityScore = (attendanceStats, overtimeStats) => {
  const attendanceScore = attendanceStats.totalEmployees > 0 
    ? ((attendanceStats.present + attendanceStats.late + attendanceStats.halfDay) / attendanceStats.totalEmployees) * 40
    : 0;
  
  const hoursScore = attendanceStats.avgHoursWorked ? (attendanceStats.avgHoursWorked / 8) * 30 : 0;
  const overtimeScore = overtimeStats.totalOvertime > 0 ? 20 : 30;
  const efficiencyScore = 10; // Base efficiency score

  return Math.round(attendanceScore + hoursScore + overtimeScore + efficiencyScore);
};

// Generate enhanced system alerts
const generateEnhancedAlerts = (data) => {
  const alerts = [];
  const { todayAttendance, pendingLeaves, pendingAssetRequests, inactiveEmployees, totalEmployees } = data;

  // High absenteeism alert
  if (todayAttendance.absent > todayAttendance.totalEmployees * 0.15) {
    alerts.push({
      type: "attendance",
      severity: "high",
      message: `High absenteeism today: ${todayAttendance.absent} employees absent`,
      action: "Review attendance patterns and contact absent employees",
      timestamp: new Date()
    });
  }

  // Pending leaves alert
  if (pendingLeaves > 10) {
    alerts.push({
      type: "leaves",
      severity: "medium",
      message: `${pendingLeaves} leave requests pending approval`,
      action: "Review and process pending leave requests",
      timestamp: new Date()
    });
  }

  // Asset requests alert
  if (pendingAssetRequests > 5) {
    alerts.push({
      type: "assets",
      severity: "medium",
      message: `${pendingAssetRequests} asset requests pending`,
      action: "Process pending asset allocation requests",
      timestamp: new Date()
    });
  }

  // Inactive employees alert
  if (inactiveEmployees > totalEmployees * 0.05) {
    alerts.push({
      type: "employees",
      severity: "low",
      message: `${inactiveEmployees} inactive employee records`,
      action: "Review and clean up inactive employee data",
      timestamp: new Date()
    });
  }

  // Late arrivals alert
  if (todayAttendance.late > todayAttendance.totalEmployees * 0.1) {
    alerts.push({
      type: "attendance",
      severity: "medium",
      message: `${todayAttendance.late} employees arrived late today`,
      action: "Monitor punctuality and send reminders",
      timestamp: new Date()
    });
  }

  return alerts;
};

export default {
  getEnhancedHRDashboardStats
};