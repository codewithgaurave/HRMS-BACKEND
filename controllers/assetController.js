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
    const { employeeId, forceAssign } = req.body;
    const assetId = req.params.id;

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

    // Check if asset is already assigned (before Team Leader validation)
    const currentActiveAssignment = asset.assignedTo.find(a => a.isActive);
    
    if (currentActiveAssignment && !forceAssign) {
      const currentEmployee = await Employee.findById(currentActiveAssignment.employee)
        .select('name employeeId');
      
      return res.status(400).json({
        success: false,
        message: 'Asset is already assigned',
        alreadyAssignedTo: {
          employeeId: currentEmployee.employeeId,
          name: `${currentEmployee.name.first} ${currentEmployee.name.last}`,
          assignedDate: currentActiveAssignment.assignedDate
        },
        requireConfirmation: true
      });
    }

    // Team Leader validation
    if (req.employee.role === 'Team_Leader') {
      // Check 1: Employee team member hai?
      const isTeamMember = await Employee.findOne({
        _id: employeeId,
        manager: req.employee._id
      });
      
      if (!isTeamMember) {
        return res.status(403).json({
          success: false,
          message: 'You can only assign assets to your team members'
        });
      }

      // Check 2: Asset Team Leader ke control mein hai?
      const currentAssignment = asset.assignedTo.find(a => a.isActive);
      
      if (currentAssignment) {
        const currentEmployee = await Employee.findById(currentAssignment.employee);
        
        // Asset Team Leader ke paas hai ya uske team member ke paas
        const isTeamLeaderAsset = currentAssignment.employee.toString() === req.employee._id.toString();
        const isTeamMemberAsset = currentEmployee && currentEmployee.manager && 
                                  currentEmployee.manager.toString() === req.employee._id.toString();
        
        if (!isTeamLeaderAsset && !isTeamMemberAsset) {
          return res.status(403).json({
            success: false,
            message: 'You can only reassign assets that are assigned to you or your team members'
          });
        }
      }
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

    // Deactivate current assignment (only if forceAssign is true)
    if (currentActiveAssignment && forceAssign) {
      asset.assignedTo.forEach(assignment => {
        if (assignment.isActive) {
          assignment.isActive = false;
          assignment.returnDate = new Date();
        }
      });
    }

    // Initialize assignedTo if it doesn't exist or is not an array
    if (!Array.isArray(asset.assignedTo)) {
      asset.assignedTo = [];
    }

    // Add new assignment
    asset.assignedTo.push({
      employee: employeeId,
      assignedBy: req.employee._id,
      assignedDate: new Date(),
      isActive: true,
      transferType: 'assign'
    });
    
    asset.status = 'Assigned';
    asset.updatedBy = req.employee.id;
    
    await asset.save();
    await asset.populate('assignedTo.employee', 'name employeeId designation department');
    await asset.populate('assignedTo.assignedBy', 'name employeeId');

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
      'assignedTo': {
        $elemMatch: {
          employee: employeeId,
          isActive: true
        }
      }
    })
      .populate('assignedTo.employee', 'name employeeId designation department')
      .populate('assignedTo.assignedBy', 'name employeeId')
      .populate('createdBy', 'name employeeId')
      .sort({ 'assignedTo.assignedDate': -1 });

    const filteredAssets = assets.map(asset => {
      const activeAssignments = asset.assignedTo.filter(
        a => a.isActive && a.employee._id.toString() === employeeId
      );
      
      return {
        ...asset.toObject(),
        assignedTo: activeAssignments
      };
    });

    res.json({
      success: true,
      assets: filteredAssets
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

// Get Team Leader's Team Assets
export const getTeamLeaderAssets = async (req, res) => {
  try {
    // Get team members managed by this Team Leader
    const teamMembers = await Employee.find({ manager: req.employee._id, isActive: true });
    const teamMemberIds = teamMembers.map(member => member._id);

    // Get all assets assigned to team members
    const assets = await Asset.find({
      'assignedTo.employee': { $in: teamMemberIds },
      'assignedTo.isActive': true
    })
      .populate('assignedTo.employee', 'name employeeId designation department')
      .populate('createdBy', 'name employeeId')
      .sort({ 'assignedTo.assignedDate': -1 });

    // Stats
    const stats = {
      totalAssets: assets.length,
      teamSize: teamMembers.length,
      categories: [...new Set(assets.map(a => a.category))]
    };

    res.json({
      success: true,
      assets,
      teamMembers,
      stats
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
  getHRTeamEmployeesForAssets,
  getTeamLeaderAssets
};


// Employee can transfer or share asset
export const transferAsset = async (req, res) => {
  try {
    const { toEmployeeId, transferType } = req.body;
    const assetId = req.params.id;

    if (!toEmployeeId || !transferType) {
      return res.status(400).json({
        success: false,
        message: 'Target employee ID and transfer type are required'
      });
    }

    if (!['transfer', 'share'].includes(transferType)) {
      return res.status(400).json({
        success: false,
        message: 'Transfer type must be either "transfer" or "share"'
      });
    }

    const asset = await Asset.findById(assetId);
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    // Check if asset is currently assigned to logged-in employee
    const myAssignment = asset.assignedTo.find(
      a => a.isActive && a.employee.toString() === req.employee._id.toString()
    );

    if (!myAssignment) {
      return res.status(403).json({
        success: false,
        message: 'You can only transfer/share assets assigned to you'
      });
    }

    // Validate target employee
    const targetEmployee = await Employee.findById(toEmployeeId);
    if (!targetEmployee) {
      return res.status(404).json({
        success: false,
        message: 'Target employee not found'
      });
    }

    if (transferType === 'transfer') {
      // Transfer: Remove from current employee and assign to target
      myAssignment.isActive = false;
      myAssignment.returnDate = new Date();

      asset.assignedTo.push({
        employee: toEmployeeId,
        assignedBy: req.employee._id,
        assignedDate: new Date(),
        isActive: true,
        transferType: 'transfer'
      });

      asset.updatedBy = req.employee.id;
      await asset.save();
      await asset.populate('assignedTo.employee', 'name employeeId designation department');
      await asset.populate('assignedTo.assignedBy', 'name employeeId');

      return res.json({
        success: true,
        message: 'Asset transferred successfully',
        asset
      });
    } 
    
    else if (transferType === 'share') {
      // Share: Both employees will have active assignment
      const alreadyShared = asset.assignedTo.find(
        a => a.isActive && a.employee.toString() === toEmployeeId
      );

      if (alreadyShared) {
        return res.status(400).json({
          success: false,
          message: 'Asset is already shared with this employee'
        });
      }

      asset.assignedTo.push({
        employee: toEmployeeId,
        assignedBy: req.employee._id,
        assignedDate: new Date(),
        isActive: true,
        transferType: 'share'
      });

      asset.updatedBy = req.employee.id;
      await asset.save();
      await asset.populate('assignedTo.employee', 'name employeeId designation department');
      await asset.populate('assignedTo.assignedBy', 'name employeeId');

      return res.json({
        success: true,
        message: 'Asset shared successfully',
        asset
      });
    }

  } catch (error) {
    console.error('Transfer Asset Error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// Get Asset History (Complete transfer history)
export const getAssetHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const asset = await Asset.findById(id)
      .populate('assignedTo.employee', 'name employeeId email designation department')
      .populate('createdBy', 'name employeeId')
      .populate('updatedBy', 'name employeeId');

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    // Sort history by date (latest first)
    const history = asset.assignedTo
      .sort((a, b) => new Date(b.assignedDate) - new Date(a.assignedDate))
      .map(assignment => ({
        employee: assignment.employee,
        assignedDate: assignment.assignedDate,
        returnDate: assignment.returnDate,
        isActive: assignment.isActive,
        daysUsed: assignment.returnDate 
          ? Math.ceil((new Date(assignment.returnDate) - new Date(assignment.assignedDate)) / (1000 * 60 * 60 * 24))
          : Math.ceil((new Date() - new Date(assignment.assignedDate)) / (1000 * 60 * 60 * 24))
      }));

    res.json({
      success: true,
      asset: {
        assetId: asset.assetId,
        name: asset.name,
        category: asset.category,
        status: asset.status
      },
      history,
      stats: {
        totalAssignments: history.length,
        currentHolder: history.find(h => h.isActive)?.employee || null,
        totalEmployeesUsed: [...new Set(history.map(h => h.employee._id.toString()))].length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get My Asset History (Employee sees their own asset history)
export const getMyAssetHistory = async (req, res) => {
  try {
    const employeeId = req.employee._id;

    const assets = await Asset.find({
      'assignedTo.employee': employeeId
    })
      .populate('assignedTo.employee', 'name employeeId')
      .populate('assignedTo.assignedBy', 'name employeeId')
      .sort({ 'assignedTo.assignedDate': -1 });

    const myHistory = assets.map(asset => {
      const myAssignments = asset.assignedTo.filter(
        a => a.employee._id.toString() === employeeId.toString()
      );

      // Find who I transferred this asset to
      let transferredTo = null;
      myAssignments.forEach(myAssignment => {
        if (!myAssignment.isActive && myAssignment.returnDate) {
          // Find next assignment after my return date
          const nextAssignment = asset.assignedTo.find(
            a => a.assignedBy && 
                 a.assignedBy._id.toString() === employeeId.toString() &&
                 new Date(a.assignedDate) >= new Date(myAssignment.returnDate)
          );
          
          if (nextAssignment) {
            transferredTo = {
              employee: nextAssignment.employee,
              transferDate: nextAssignment.assignedDate,
              transferType: nextAssignment.transferType
            };
          }
        }
      });

      return {
        asset: {
          _id: asset._id,
          assetId: asset.assetId,
          name: asset.name,
          category: asset.category,
          status: asset.status
        },
        assignments: myAssignments.map(assignment => ({
          assignedTo: assignment.employee,
          assignedBy: assignment.assignedBy,
          assignedDate: assignment.assignedDate,
          returnDate: assignment.returnDate,
          isActive: assignment.isActive,
          transferType: assignment.transferType,
          daysUsed: assignment.returnDate 
            ? Math.ceil((new Date(assignment.returnDate) - new Date(assignment.assignedDate)) / (1000 * 60 * 60 * 24))
            : Math.ceil((new Date() - new Date(assignment.assignedDate)) / (1000 * 60 * 60 * 24))
        })),
        currentlyWithMe: myAssignments.some(a => a.isActive),
        transferredTo: transferredTo
      };
    });

    res.json({
      success: true,
      history: myHistory,
      stats: {
        totalAssetsUsed: myHistory.length,
        currentlyHolding: myHistory.filter(h => h.currentlyWithMe).length,
        totalDaysUsed: myHistory.reduce((sum, h) => 
          sum + h.assignments.reduce((s, a) => s + a.daysUsed, 0), 0
        ),
        assetsTransferred: myHistory.filter(h => h.transferredTo !== null).length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get All Assets History (HR Panel - Complete overview)
export const getAllAssetsHistory = async (req, res) => {
  try {
    const { startDate, endDate, employeeId, category } = req.query;

    let filter = {};
    if (category) filter.category = category;

    const assets = await Asset.find(filter)
      .populate('assignedTo.employee', 'name employeeId designation department')
      .populate('createdBy', 'name employeeId')
      .sort({ createdAt: -1 });

    let allHistory = [];

    assets.forEach(asset => {
      asset.assignedTo.forEach(assignment => {
        // Filter by date range if provided
        if (startDate && new Date(assignment.assignedDate) < new Date(startDate)) return;
        if (endDate && assignment.returnDate && new Date(assignment.returnDate) > new Date(endDate)) return;
        
        // Filter by employee if provided
        if (employeeId && assignment.employee._id.toString() !== employeeId) return;

        allHistory.push({
          asset: {
            _id: asset._id,
            assetId: asset.assetId,
            name: asset.name,
            category: asset.category
          },
          employee: assignment.employee,
          assignedDate: assignment.assignedDate,
          returnDate: assignment.returnDate,
          isActive: assignment.isActive,
          daysUsed: assignment.returnDate 
            ? Math.ceil((new Date(assignment.returnDate) - new Date(assignment.assignedDate)) / (1000 * 60 * 60 * 24))
            : Math.ceil((new Date() - new Date(assignment.assignedDate)) / (1000 * 60 * 60 * 24))
        });
      });
    });

    // Sort by date (latest first)
    allHistory.sort((a, b) => new Date(b.assignedDate) - new Date(a.assignedDate));

    res.json({
      success: true,
      history: allHistory,
      stats: {
        totalRecords: allHistory.length,
        activeAssignments: allHistory.filter(h => h.isActive).length,
        completedAssignments: allHistory.filter(h => !h.isActive).length,
        totalDaysUsed: allHistory.reduce((sum, h) => sum + h.daysUsed, 0)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};




// Employee Transfer Asset (Employee-to-Employee)
export const employeeTransferAsset = async (req, res) => {
  try {
    const { toEmployeeId, transferType = 'transfer', reason } = req.body;
    const assetId = req.params.id;
    const fromEmployeeId = req.employee._id;

    if (!toEmployeeId) {
      return res.status(400).json({
        success: false,
        message: 'Target employee ID is required'
      });
    }

    if (toEmployeeId === fromEmployeeId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot transfer asset to yourself'
      });
    }

    const asset = await Asset.findById(assetId);
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    const myActiveAssignment = asset.assignedTo.find(
      a => a.isActive && a.employee.toString() === fromEmployeeId.toString()
    );

    if (!myActiveAssignment) {
      return res.status(403).json({
        success: false,
        message: 'You can only transfer assets that are currently assigned to you'
      });
    }

    const toEmployee = await Employee.findById(toEmployeeId);
    if (!toEmployee) {
      return res.status(404).json({
        success: false,
        message: 'Target employee not found'
      });
    }

    if (!toEmployee.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cannot transfer to inactive employee'
      });
    }

    const myProfile = await Employee.findById(fromEmployeeId).select('addedBy');
    const targetProfile = await Employee.findById(toEmployeeId).select('addedBy');

    if (myProfile.addedBy.toString() !== targetProfile.addedBy.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only transfer assets to colleagues under the same HR'
      });
    }

    if (transferType === 'transfer') {
      myActiveAssignment.isActive = false;
      myActiveAssignment.returnDate = new Date();

      asset.assignedTo.push({
        employee: toEmployeeId,
        assignedBy: fromEmployeeId,
        assignedDate: new Date(),
        isActive: true,
        transferType: 'transfer'
      });

      asset.status = 'Assigned';

    } else if (transferType === 'share') {
      asset.assignedTo.push({
        employee: toEmployeeId,
        assignedBy: fromEmployeeId,
        assignedDate: new Date(),
        isActive: true,
        transferType: 'share'
      });

      asset.status = 'Assigned';
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid transfer type. Use "transfer" or "share"'
      });
    }

    await asset.save();
    await asset.populate('assignedTo.employee', 'name employeeId designation');
    await asset.populate('assignedTo.assignedBy', 'name employeeId');

    res.json({
      success: true,
      message: transferType === 'transfer' 
        ? `Asset transferred successfully to ${toEmployee.name.first} ${toEmployee.name.last}`
        : `Asset shared successfully with ${toEmployee.name.first} ${toEmployee.name.last}`,
      asset,
      transferDetails: {
        from: {
          employeeId: req.employee.employeeId,
          name: `${req.employee.name.first} ${req.employee.name.last}`
        },
        to: {
          employeeId: toEmployee.employeeId,
          name: `${toEmployee.name.first} ${toEmployee.name.last}`
        },
        transferType,
        transferDate: new Date(),
        reason: reason || 'Employee initiated transfer'
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get My Transferable Assets
export const getMyTransferableAssets = async (req, res) => {
  try {
    const employeeId = req.employee._id;

    const assets = await Asset.find({
      'assignedTo': {
        $elemMatch: {
          employee: employeeId,
          isActive: true
        }
      }
    })
      .populate('assignedTo.employee', 'name employeeId')
      .populate('assignedTo.assignedBy', 'name employeeId')
      .sort({ 'assignedTo.assignedDate': -1 });

    res.json({
      success: true,
      message: 'Your transferable assets',
      totalAssets: assets.length,
      assets
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get Colleagues for Transfer
export const getColleaguesForTransfer = async (req, res) => {
  try {
    const myProfile = await Employee.findById(req.employee._id).select('addedBy');
    
    if (!myProfile || !myProfile.addedBy) {
      return res.status(404).json({
        success: false,
        message: 'Unable to find your HR manager'
      });
    }

    const colleagues = await Employee.find({
      addedBy: myProfile.addedBy,
      isActive: true,
      _id: { $ne: req.employee._id }
    })
      .select('employeeId name email designation department')
      .populate('designation', 'title')
      .populate('department', 'name')
      .sort({ 'name.first': 1 });

    res.json({
      success: true,
      message: 'Colleagues available for asset transfer',
      totalColleagues: colleagues.length,
      colleagues
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
