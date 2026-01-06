import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';
import Leave from '../models/Leave.js';
import Payroll from '../models/Payroll.js';

export const getHRSummary = async (req, res) => {
  try {
    const hrId = req.employee._id;
    
    // Get all employees under this HR
    const employees = await Employee.find({
      $or: [
        { addedBy: hrId },
        { _id: hrId }
      ]
    });
    
    const employeeIds = employees.map(emp => emp._id);
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's attendance
    const todayAttendance = await Attendance.find({
      employeeId: { $in: employeeIds },
      date: today,
      status: 'Present'
    });
    
    // Get pending leaves
    const pendingLeaves = await Leave.countDocuments({
      employeeId: { $in: employeeIds },
      status: 'Pending'
    });
    
    // Get total salary budget
    const payrolls = await Payroll.find({
      employeeId: { $in: employeeIds }
    });
    
    const totalSalary = payrolls.reduce((sum, payroll) => sum + (payroll.basicSalary || 0), 0);
    
    res.json({
      success: true,
      data: {
        teamSize: employees.length,
        todayAttendance: {
          present: todayAttendance.length,
          total: employees.length,
          percentage: employees.length > 0 ? ((todayAttendance.length / employees.length) * 100).toFixed(2) : 0
        },
        pendingLeaves: pendingLeaves,
        teamSalaryBudget: totalSalary
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching HR summary',
      error: error.message
    });
  }
};