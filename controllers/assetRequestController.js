import AssetRequest from '../models/AssetRequest.js';
import { Counter } from '../models/Counter.js';

// Helper function to get next request ID
const getNextRequestId = async () => {
  const counter = await Counter.findOneAndUpdate(
    { name: "assetRequestId" },
    { $inc: { value: 1 } },
    { new: true, upsert: true }
  );
  return `AR${String(counter.value).padStart(4, '0')}`;
};

// Create asset request
export const createAssetRequest = async (req, res) => {
  try {
    const { requestType, assetCategory, description, justification, priority } = req.body;

    if (!requestType || !assetCategory || !description || !justification) {
      return res.status(400).json({
        message: 'Request type, asset category, description, and justification are required'
      });
    }

    const requestId = await getNextRequestId();

    const assetRequest = new AssetRequest({
      requestId,
      requestedBy: req.employee._id,
      requestType,
      assetCategory,
      description,
      justification,
      priority: priority || 'Medium'
    });

    await assetRequest.save();

    const populatedRequest = await AssetRequest.findById(assetRequest._id)
      .populate('requestedBy', 'name employeeId email')
      .populate('approvedBy', 'name employeeId');

    res.status(201).json({
      success: true,
      message: 'Asset request created successfully',
      request: populatedRequest
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating asset request',
      error: error.message
    });
  }
};

// Get asset requests (for HR - all requests, for Team Leader - team members' requests)
export const getAssetRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    let filter = {};
    
    // Team Leaders can only see their team members' requests
    if (req.employee.role === 'Team_Leader') {
      const Employee = (await import('../models/Employee.js')).default;
      
      // Get team members
      const teamMembers = await Employee.find({ 
        $or: [
          { manager: req.employee._id },
          { addedBy: req.employee._id }
        ]
      }).select('_id');
      
      const teamMemberIds = teamMembers.map(member => member._id);
      filter.requestedBy = { $in: teamMemberIds };
    }
    // HR can see all requests
    
    if (status) {
      filter.status = status;
    }

    const skip = (page - 1) * limit;

    const requests = await AssetRequest.find(filter)
      .populate('requestedBy', 'name employeeId email department')
      .populate('approvedBy', 'name employeeId')
      .populate('assignedAsset')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await AssetRequest.countDocuments(filter);

    res.json({
      success: true,
      requests,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalRequests: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching asset requests',
      error: error.message
    });
  }
};

// Approve/Reject asset request (HR only)
export const updateAssetRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    if (req.employee.role !== 'HR_Manager') {
      return res.status(403).json({
        message: 'Only HR managers can approve/reject asset requests'
      });
    }

    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({
        message: 'Status must be either Approved or Rejected'
      });
    }

    const updateData = {
      status,
      approvedBy: req.employee._id,
      approvalDate: new Date()
    };

    if (status === 'Rejected' && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }

    const request = await AssetRequest.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('requestedBy', 'name employeeId email')
     .populate('approvedBy', 'name employeeId');

    if (!request) {
      return res.status(404).json({
        message: 'Asset request not found'
      });
    }

    res.json({
      success: true,
      message: `Asset request ${status.toLowerCase()} successfully`,
      request
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating asset request status',
      error: error.message
    });
  }
};

// Get asset request stats
export const getAssetRequestStats = async (req, res) => {
  try {
    let filter = {};
    
    // Team Leaders can only see their team members' requests
    if (req.employee.role === 'Team_Leader') {
      const Employee = (await import('../models/Employee.js')).default;
      
      // Get team members
      const teamMembers = await Employee.find({ 
        $or: [
          { manager: req.employee._id },
          { addedBy: req.employee._id }
        ]
      }).select('_id');
      
      const teamMemberIds = teamMembers.map(member => member._id);
      filter.requestedBy = { $in: teamMemberIds };
    }
    
    const totalRequests = await AssetRequest.countDocuments(filter);
    const pendingRequests = await AssetRequest.countDocuments({ ...filter, status: 'Pending' });
    const approvedRequests = await AssetRequest.countDocuments({ ...filter, status: 'Approved' });
    const rejectedRequests = await AssetRequest.countDocuments({ ...filter, status: 'Rejected' });

    res.json({
      success: true,
      stats: {
        totalRequests,
        pendingRequests,
        approvedRequests,
        rejectedRequests
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching asset request stats',
      error: error.message
    });
  }
};

// Get team asset overview (Team Leader only)
export const getTeamAssetOverview = async (req, res) => {
  try {
    const Employee = (await import('../models/Employee.js')).default;
    const Asset = (await import('../models/Asset.js')).default;
    
    // Get team members
    const teamMembers = await Employee.find({ 
      $or: [
        { manager: req.employee._id },
        { addedBy: req.employee._id }
      ]
    }).select('name employeeId email department designation');
    
    const teamMemberIds = teamMembers.map(member => member._id);
    
    // Get asset requests from team members
    const teamAssetRequests = await AssetRequest.find({
      requestedBy: { $in: teamMemberIds }
    })
    .populate('requestedBy', 'name employeeId')
    .populate('assignedAsset')
    .sort({ createdAt: -1 });
    
    // Get assigned assets to team members
    const assignedAssets = await Asset.find({
      assignedTo: { $in: teamMemberIds }
    })
    .populate('assignedTo', 'name employeeId')
    .sort({ assignedDate: -1 });
    
    // Create team overview
    const teamOverview = teamMembers.map(member => {
      const memberRequests = teamAssetRequests.filter(
        req => req.requestedBy._id.toString() === member._id.toString()
      );
      
      const memberAssets = assignedAssets.filter(
        asset => asset.assignedTo._id.toString() === member._id.toString()
      );
      
      return {
        employee: member,
        assetRequests: memberRequests,
        assignedAssets: memberAssets,
        stats: {
          totalRequests: memberRequests.length,
          pendingRequests: memberRequests.filter(req => req.status === 'Pending').length,
          approvedRequests: memberRequests.filter(req => req.status === 'Approved').length,
          rejectedRequests: memberRequests.filter(req => req.status === 'Rejected').length,
          totalAssets: memberAssets.length
        }
      };
    });
    
    res.json({
      success: true,
      teamOverview,
      summary: {
        totalTeamMembers: teamMembers.length,
        totalAssetRequests: teamAssetRequests.length,
        totalAssignedAssets: assignedAssets.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching team asset overview',
      error: error.message
    });
  }
};

// Get team leader's own asset requests
export const getMyAssetRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    let filter = { requestedBy: req.employee._id };
    
    if (status) {
      filter.status = status;
    }

    const skip = (page - 1) * limit;

    const requests = await AssetRequest.find(filter)
      .populate('requestedBy', 'name employeeId email department')
      .populate('approvedBy', 'name employeeId')
      .populate('assignedAsset')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await AssetRequest.countDocuments(filter);

    res.json({
      success: true,
      requests,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalRequests: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching my asset requests',
      error: error.message
    });
  }
};

export default {
  createAssetRequest,
  getAssetRequests,
  getMyAssetRequests,
  updateAssetRequestStatus,
  getAssetRequestStats,
  getTeamAssetOverview
};