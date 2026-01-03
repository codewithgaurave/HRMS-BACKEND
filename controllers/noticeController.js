import Notice from '../models/Notice.js';
import Employee from '../models/Employee.js';
import mongoose from 'mongoose';

// Create notice (Team Leader to team, HR to all)
export const createNotice = async (req, res) => {
  try {
    const { title, content, type, priority, targetAudience, expiryDate } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        message: 'Title and content are required'
      });
    }

    let targetEmployees = [];
    let finalTargetAudience = targetAudience || 'All';
    
    // If Team Leader, send to team members only
    if (req.employee.role === 'Team_Leader') {
      const teamMembers = await Employee.find({ 
        $or: [
          { manager: req.employee._id },
          { addedBy: req.employee._id }
        ],
        isActive: true
      });
      targetEmployees = teamMembers.map(member => member._id);
      finalTargetAudience = 'Team';
      
      if (targetEmployees.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No team members found. You can only send notices to your team members.'
        });
      }
    }
    // If HR Manager, can send to all employees under them
    else if (req.employee.role === 'HR_Manager') {
      if (finalTargetAudience === 'Team' || finalTargetAudience === 'Department') {
        // Get employees added by this HR
        const hrEmployees = await Employee.find({ 
          addedBy: req.employee._id,
          isActive: true
        });
        targetEmployees = hrEmployees.map(emp => emp._id);
      }
      // For 'All' audience, targetEmployees can remain empty as it will be handled by filtering
    }

    const notice = new Notice({
      title,
      content,
      type: type || 'General',
      priority: priority || 'Medium',
      createdBy: req.employee._id,
      targetAudience: finalTargetAudience,
      targetEmployees: targetEmployees,
      expiryDate: expiryDate ? new Date(expiryDate) : null
    });

    await notice.save();

    const populatedNotice = await Notice.findById(notice._id)
      .populate('createdBy', 'name employeeId role')
      .populate('targetEmployees', 'name employeeId');

    res.status(201).json({
      success: true,
      message: 'Notice created successfully',
      notice: populatedNotice
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating notice',
      error: error.message
    });
  }
};

// Get notices for employee
export const getNoticesForEmployee = async (req, res) => {
  try {
    const { page = 1, limit = 10, type } = req.query;
    const currentEmployee = req.employee;
    
    console.log('Employee ID:', currentEmployee._id);
    console.log('Employee Role:', currentEmployee.role);
    
    // Find who added this employee (their HR) and their manager
    const employeeData = await Employee.findById(currentEmployee._id)
      .populate('addedBy', '_id role name')
      .populate('manager', '_id role name');
    
    if (!employeeData) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    console.log('Employee addedBy:', employeeData.addedBy);
    console.log('Employee manager:', employeeData.manager);

    // Build filter to show notices from HR and Team Leader only
    let creatorIds = [];
    
    // Add HR manager (who added this employee)
    if (employeeData.addedBy) {
      creatorIds.push(employeeData.addedBy._id);
    }
    
    // Add Team Leader (manager)
    if (employeeData.manager) {
      creatorIds.push(employeeData.manager._id);
    }

    console.log('Creator IDs allowed:', creatorIds);

    // Filter notices - ONLY from HR and Team Leader
    let filter = {
      isActive: true,
      $or: [
        // Notices from HR/Team Leader
        { createdBy: { $in: creatorIds } },
        // Notices specifically targeted to this employee
        { targetEmployees: currentEmployee._id }
      ]
    };

    // Remove the 'All' audience filter to be more restrictive
    if (type) {
      filter.type = type;
    }

    console.log('Final filter:', JSON.stringify(filter, null, 2));

    const skip = (page - 1) * limit;

    const notices = await Notice.find(filter)
      .populate('createdBy', 'name employeeId role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    console.log('Found notices:', notices.length);
    notices.forEach(notice => {
      console.log(`Notice: ${notice.title} by ${notice.createdBy?.name} (${notice.createdBy?.role})`);
    });

    const total = await Notice.countDocuments(filter);

    res.json({
      success: true,
      notices,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalNotices: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error in getNoticesForEmployee:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notices',
      error: error.message
    });
  }
};

// Mark notice as read
export const markNoticeAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notice = await Notice.findById(id);
    if (!notice) {
      return res.status(404).json({
        message: 'Notice not found'
      });
    }

    // Check if already read
    const alreadyRead = notice.readBy.some(
      read => read.employee.toString() === req.employee._id.toString()
    );

    if (!alreadyRead) {
      notice.readBy.push({
        employee: req.employee._id,
        readAt: new Date()
      });
      await notice.save();
    }

    res.json({
      success: true,
      message: 'Notice marked as read'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error marking notice as read',
      error: error.message
    });
  }
};

// Get notices created by user (for Team Leaders)
export const getMyNotices = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const filter = { createdBy: req.employee._id };
    const skip = (page - 1) * limit;

    const notices = await Notice.find(filter)
      .populate('targetEmployees', 'name employeeId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Notice.countDocuments(filter);

    res.json({
      success: true,
      notices,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalNotices: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching notices',
      error: error.message
    });
  }
};

// Get team stats for Team Leader
export const getTeamStats = async (req, res) => {
  try {
    // Get team members count
    const teamMembers = await Employee.find({ 
      $or: [
        { manager: req.employee._id },
        { addedBy: req.employee._id }
      ]
    });
    
    // Get total notices sent by this team leader
    const totalNotices = await Notice.countDocuments({ createdBy: req.employee._id });
    
    // Get active notices (not expired)
    const activeNotices = await Notice.countDocuments({ 
      createdBy: req.employee._id,
      isActive: true,
      $or: [
        { expiryDate: { $exists: false } },
        { expiryDate: { $gte: new Date() } }
      ]
    });

    res.json({
      success: true,
      stats: {
        totalNoticesSent: totalNotices,
        activeNotices: activeNotices,
        teamMembers: teamMembers.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching team stats',
      error: error.message
    });
  }
};

export default {
  createNotice,
  getNoticesForEmployee,
  markNoticeAsRead,
  getMyNotices,
  getTeamStats
};