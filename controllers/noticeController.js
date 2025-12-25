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
    
    // If Team Leader, send to team members only
    if (req.employee.role === 'Team_Leader') {
      const teamMembers = await Employee.find({ 
        $or: [
          { manager: req.employee._id },
          { addedBy: req.employee._id }
        ]
      });
      targetEmployees = teamMembers.map(member => member._id);
      
      if (targetEmployees.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No team members found. You can only send notices to your team members.'
        });
      }
    }

    const notice = new Notice({
      title,
      content,
      type: type || 'General',
      priority: priority || 'Medium',
      createdBy: req.employee._id,
      targetAudience: req.employee.role === 'Team_Leader' ? 'Team' : (targetAudience || 'All'),
      targetEmployees: req.employee.role === 'Team_Leader' ? targetEmployees : [],
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
    
    // Simple filter - show all active notices
    let filter = {
      isActive: true
    };

    if (type) {
      filter.type = type;
    }

    const skip = (page - 1) * limit;

    const notices = await Notice.find(filter)
      .populate('createdBy', 'name employeeId role')
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