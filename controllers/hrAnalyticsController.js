import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';
import Leave from '../models/Leave.js';
import Task from '../models/Task.js';
import Payroll from '../models/Payroll.js';
import Asset from '../models/Asset.js';
import AssetRequest from '../models/AssetRequest.js';
import Department from '../models/Department.js';
import Designation from '../models/Designation.js';
import Announcement from '../models/Announcement.js';
import Event from '../models/Event.js';
import Notice from '../models/Notice.js';
import WorkShift from '../models/WorkShift.js';
import LeavePolicy from '../models/LeavePolicy.js';
import OfficeLocation from '../models/OfficeLocation.js';
import EmploymentStatus from '../models/EmploymentStatus.js';

export const getHRAnalytics = async (req, res) => {
  try {
    const { role, _id: hrId } = req.employee;
    console.log(`🔍 HR Analytics - Role: ${role}, HR ID: ${hrId}`);
    
    // Get HR-managed employees (include self if no managed employees)
    let hrEmployees = await Employee.find({ 
      $or: [
        { addedBy: hrId },
        { _id: hrId }
      ],
      isActive: true 
    });
    
    const hrEmployeeIds = hrEmployees.map(emp => emp._id);
    const teamSize = hrEmployees.length;
    console.log(`👥 HR Team Size: ${teamSize}`);
    
    // Calculate team salary budget
    const totalSalary = hrEmployees.reduce((sum, emp) => sum + (emp.salary || 0), 0);
    const avgSalary = teamSize > 0 ? totalSalary / teamSize : 0;
    
    // Get today's attendance
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayAttendance = await Attendance.countDocuments({
      employee: { $in: hrEmployeeIds },
      date: today
    });
    
    // Get pending leaves
    const pendingLeaves = await Leave.countDocuments({
      employee: { $in: hrEmployeeIds },
      status: 'Pending'
    });
    
    // If no employees found, return minimal response
    if (teamSize === 0) {
      console.log('⚠️ No employees found for HR');
      return res.status(200).json({
        success: true,
        data: {
          teamSize: 0,
          todayAttendance: 0,
          pendingLeaves: 0,
          teamSalaryBudget: {
            totalBudget: 0,
            averageSalary: 0
          },
          attendanceRate: 0,
          lastUpdated: new Date()
        }
      });
    }

    // Calculate attendance rate
    const attendanceRate = teamSize > 0 ? (todayAttendance / teamSize * 100) : 0;

    console.log(`📊 HR Dashboard Summary:`);
    console.log(`- Team Size: ${teamSize}`);
    console.log(`- Today Attendance: ${todayAttendance}`);
    console.log(`- Attendance Rate: ${attendanceRate.toFixed(2)}%`);
    console.log(`- Pending Leaves: ${pendingLeaves}`);
    console.log(`- Total Salary Budget: ₹${totalSalary.toLocaleString()}`);

    res.status(200).json({
      success: true,
      data: {
        teamSize: teamSize,
        todayAttendance: todayAttendance,
        pendingLeaves: pendingLeaves,
        teamSalaryBudget: {
          totalBudget: totalSalary,
          averageSalary: Math.round(avgSalary),
          formattedTotal: `₹${totalSalary.toLocaleString()}`,
          formattedAverage: `₹${Math.round(avgSalary).toLocaleString()}`
        },
        attendanceRate: Math.round(attendanceRate),
        lastUpdated: new Date(),
        hrId: hrId
      }
    });

  } catch (error) {
    console.error('❌ HR Analytics Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch HR analytics',
      error: error.message
    });
  }
};