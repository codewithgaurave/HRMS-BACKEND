import Payroll from '../models/Payroll.js';
import Employee from '../models/Employee.js';

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
    
    // Role-based filtering
    if (req.employee.role === 'HR_Manager') {
      // HR can see all payrolls
    } else if (req.employee.role === 'Team_Leader') {
      // Team Leaders can see their own payroll and their team members' payrolls
      const teamMembers = await Employee.find({ manager: req.employee._id });
      const teamMemberIds = teamMembers.map(member => member._id);
      teamMemberIds.push(req.employee._id); // Include own payroll
      query.employee = { $in: teamMemberIds };
    } else {
      // Regular employees can only see their own payroll
      query.employee = req.employee._id;
    }
    if (month) query.month = month;
    if (year) query.year = year;
    if (status) query.status = status;
    if (employeeId) query.employee = employeeId;

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

// Generate Payroll for All Employees
export const generatePayrollForAll = async (req, res) => {
  try {
    const { month, year } = req.body;
    
    const employees = await Employee.find({ isActive: true });
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
        const workingDays = 30; // Default working days
        const presentDays = workingDays; // Default present days
        
        const grossSalary = basicSalary;
        const netSalary = grossSalary;

        const payroll = new Payroll({
          employee: employee._id,
          month,
          year,
          basicSalary,
          workingDays,
          presentDays,
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

export default {
  createPayroll,
  getAllPayrolls,
  getPayrollById,
  updatePayroll,
  deletePayroll,
  generatePayrollForAll
};