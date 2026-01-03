import Asset from '../models/Asset.js';
import Employee from '../models/Employee.js';
import { Counter } from '../models/Counter.js';

// Generate Asset ID
const generateAssetId = async () => {
  try {
    const counter = await Counter.findOneAndUpdate(
      { name: 'assetId' },
      { $inc: { value: 1 } },
      { new: true, upsert: true }
    );
    return `AST${String(counter.value).padStart(4, '0')}`;
  } catch (error) {
    throw new Error('Failed to generate asset ID');
  }
};

// Create Asset
export const createAsset = async (req, res) => {
  try {
    const assetId = await generateAssetId();
    
    const asset = new Asset({
      ...req.body,
      assetId,
      createdBy: req.employee.id
    });

    await asset.save();
    await asset.populate('createdBy', 'name employeeId');
    
    res.status(201).json({
      success: true,
      message: 'Asset created successfully',
      asset
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get All Assets
export const getAllAssets = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      category = '',
      status = '',
      condition = '',
      assignedTo = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { assetId: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } },
        { serialNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category) query.category = category;
    if (status) query.status = status;
    if (condition) query.condition = condition;
    if (assignedTo) query.assignedTo = assignedTo;

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const skip = (page - 1) * limit;
    
    const assets = await Asset.find(query)
      .populate('assignedTo.employee', 'name employeeId designation department')
      .populate('createdBy', 'name employeeId')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const totalCount = await Asset.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);

    // Get statistics
    const stats = await Asset.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          available: { $sum: { $cond: [{ $eq: ['$status', 'Available'] }, 1, 0] } },
          assigned: { $sum: { $cond: [{ $eq: ['$status', 'Assigned'] }, 1, 0] } },
          maintenance: { $sum: { $cond: [{ $eq: ['$status', 'Under Maintenance'] }, 1, 0] } },
          retired: { $sum: { $cond: [{ $eq: ['$status', 'Retired'] }, 1, 0] } }
        }
      }
    ]);

    res.json({
      success: true,
      assets,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      stats: stats[0] || { total: 0, available: 0, assigned: 0, maintenance: 0, retired: 0 }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get Asset by ID
export const getAssetById = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id)
      .populate('assignedTo.employee', 'name employeeId designation department')
      .populate('createdBy', 'name employeeId')
      .populate('updatedBy', 'name employeeId');

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    res.json({
      success: true,
      asset
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update Asset
export const updateAsset = async (req, res) => {
  try {
    const asset = await Asset.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.employee.id },
      { new: true, runValidators: true }
    ).populate('assignedTo.employee', 'name employeeId')
     .populate('createdBy', 'name employeeId')
     .populate('updatedBy', 'name employeeId');

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    res.json({
      success: true,
      message: 'Asset updated successfully',
      asset
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Delete Asset
export const deleteAsset = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    if (asset.status === 'Assigned') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete assigned asset. Please return it first.'
      });
    }

    await Asset.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Asset deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Assign Asset
export const assignAsset = async (req, res) => {
  try {
    const { employeeId } = req.body;
    const assetId = req.params.id;

    console.log('Assign Asset Request:', { assetId, employeeId, body: req.body });

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID is required'
      });
    }

    const asset = await Asset.findById(assetId);
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Check if employee is already assigned this asset
    const existingAssignment = asset.assignedTo.find(
      assignment => assignment.employee.toString() === employeeId && assignment.isActive
    );
    
    if (existingAssignment) {
      return res.status(400).json({
        success: false,
        message: 'Asset is already assigned to this employee'
      });
    }

    // Initialize assignedTo if it doesn't exist or is not an array
    if (!Array.isArray(asset.assignedTo)) {
      asset.assignedTo = [];
    }

    // Add new assignment
    asset.assignedTo.push({
      employee: employeeId,
      assignedDate: new Date(),
      isActive: true
    });
    
    asset.status = 'Assigned';
    asset.updatedBy = req.employee.id;
    
    await asset.save();
    await asset.populate('assignedTo.employee', 'name employeeId designation department');

    res.json({
      success: true,
      message: 'Asset assigned successfully',
      asset
    });
  } catch (error) {
    console.error('Assign Asset Error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Return Asset
export const returnAsset = async (req, res) => {
  try {
    const assetId = req.params.id;
    const { employeeId } = req.body; // Optional: return from specific employee

    const asset = await Asset.findById(assetId);
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    if (employeeId) {
      // Return from specific employee
      const assignment = asset.assignedTo.find(
        assignment => assignment.employee.toString() === employeeId && assignment.isActive
      );
      
      if (!assignment) {
        return res.status(400).json({
          success: false,
          message: 'Asset is not assigned to this employee'
        });
      }
      
      assignment.isActive = false;
      assignment.returnDate = new Date();
    } else {
      // Return from all employees
      asset.assignedTo.forEach(assignment => {
        if (assignment.isActive) {
          assignment.isActive = false;
          assignment.returnDate = new Date();
        }
      });
    }

    // Check if any active assignments remain
    const hasActiveAssignments = asset.assignedTo.some(assignment => assignment.isActive);
    asset.status = hasActiveAssignments ? 'Assigned' : 'Available';
    asset.updatedBy = req.employee.id;
    
    await asset.save();

    res.json({
      success: true,
      message: 'Asset returned successfully',
      asset
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get Assets by Employee
export const getAssetsByEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    
    const assets = await Asset.find({ 
      'assignedTo.employee': employeeId,
      'assignedTo.isActive': true 
    })
      .populate('assignedTo.employee', 'name employeeId')
      .populate('createdBy', 'name employeeId')
      .sort({ 'assignedTo.assignedDate': -1 });

    res.json({
      success: true,
      assets
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get Asset Categories
export const getAssetCategories = async (req, res) => {
  try {
    const categories = await Asset.distinct('category');
    
    res.json({
      success: true,
      categories
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get HR Team Assets (HR can only see assets they can assign to their team)
export const getHRTeamAssets = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      category = '',
      status = '',
      condition = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Get employees added by this HR manager
    const teamMembers = await Employee.find({ addedBy: req.employee._id });
    const teamMemberIds = teamMembers.map(member => member._id);
    teamMemberIds.push(req.employee._id); // Include HR's own ID

    const query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { assetId: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } },
        { serialNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category) query.category = category;
    if (status) query.status = status;
    if (condition) query.condition = condition;

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const skip = (page - 1) * limit;
    
    const assets = await Asset.find(query)
      .populate('assignedTo.employee', 'name employeeId designation department')
      .populate('createdBy', 'name employeeId')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Filter assets to show only those assigned to HR's team or available for assignment
    const filteredAssets = assets.filter(asset => {
      if (asset.status === 'Available' || asset.status === 'Under Maintenance' || asset.status === 'Retired') {
        return true; // HR can see all unassigned assets
      }
      if (asset.status === 'Assigned') {
        // Check if assigned to HR's team members
        return asset.assignedTo.some(assignment => 
          assignment.isActive && teamMemberIds.some(id => id.toString() === assignment.employee._id.toString())
        );
      }
      return false;
    });

    const totalCount = await Asset.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);

    // Get statistics for HR's team
    const stats = {
      total: filteredAssets.length,
      available: filteredAssets.filter(a => a.status === 'Available').length,
      assigned: filteredAssets.filter(a => a.status === 'Assigned').length,
      maintenance: filteredAssets.filter(a => a.status === 'Under Maintenance').length,
      retired: filteredAssets.filter(a => a.status === 'Retired').length
    };

    res.json({
      success: true,
      assets: filteredAssets,
      teamSize: teamMemberIds.length,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount: filteredAssets.length,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// HR Team Asset Assignment (HR can only assign to their team members)
export const assignAssetToHRTeam = async (req, res) => {
  try {
    const { employeeId } = req.body;
    const assetId = req.params.id;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID is required'
      });
    }

    // Check if employee is in HR's team
    const employee = await Employee.findOne({
      _id: employeeId,
      $or: [
        { addedBy: req.employee._id },
        { _id: req.employee._id } // HR can assign to themselves
      ]
    });

    if (!employee) {
      return res.status(403).json({
        success: false,
        message: 'You can only assign assets to employees you manage'
      });
    }

    const asset = await Asset.findById(assetId);
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    // Check if employee is already assigned this asset
    const existingAssignment = asset.assignedTo.find(
      assignment => assignment.employee.toString() === employeeId && assignment.isActive
    );
    
    if (existingAssignment) {
      return res.status(400).json({
        success: false,
        message: 'Asset is already assigned to this employee'
      });
    }

    // Initialize assignedTo if it doesn't exist or is not an array
    if (!Array.isArray(asset.assignedTo)) {
      asset.assignedTo = [];
    }

    // Add new assignment
    asset.assignedTo.push({
      employee: employeeId,
      assignedDate: new Date(),
      isActive: true
    });
    
    asset.status = 'Assigned';
    asset.updatedBy = req.employee.id;
    
    await asset.save();
    await asset.populate('assignedTo.employee', 'name employeeId designation department');

    res.json({
      success: true,
      message: 'Asset assigned successfully to team member',
      asset
    });
  } catch (error) {
    console.error('Assign Asset to HR Team Error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get Available Employees for HR (only HR's team members)
export const getHRTeamEmployeesForAssets = async (req, res) => {
  try {
    // Get employees added by this HR manager
    const teamMembers = await Employee.find({ 
      addedBy: req.employee._id,
      isActive: true 
    }).select('_id name employeeId designation department');
    
    // Include HR themselves
    const hrEmployee = await Employee.findById(req.employee._id)
      .select('_id name employeeId designation department');
    
    const availableEmployees = [...teamMembers];
    if (hrEmployee) {
      availableEmployees.push(hrEmployee);
    }

    res.json({
      success: true,
      employees: availableEmployees,
      teamSize: availableEmployees.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export default {
  createAsset,
  getAllAssets,
  getAssetById,
  updateAsset,
  deleteAsset,
  assignAsset,
  returnAsset,
  getAssetsByEmployee,
  getAssetCategories,
  getHRTeamAssets,
  assignAssetToHRTeam,
  getHRTeamEmployeesForAssets
};