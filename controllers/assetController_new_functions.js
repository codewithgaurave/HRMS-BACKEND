// Add this new function to assetController.js

// Get Available Assets for Team Leader to Assign
export const getAvailableAssetsForTeamLeader = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      category = '',
      condition = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = { status: 'Available' };
    
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
    if (condition) query.condition = condition;

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const skip = (page - 1) * limit;
    
    const assets = await Asset.find(query)
      .populate('createdBy', 'name employeeId')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const totalCount = await Asset.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);

    // Get statistics
    const stats = await Asset.aggregate([
      { $match: { status: 'Available' } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          byCategory: {
            $push: {
              category: '$category',
              count: 1
            }
          }
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
      stats: {
        totalAvailable: totalCount,
        categories: [...new Set(assets.map(a => a.category))]
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Assign Asset to Team Member (Team Leader only)
export const assignAssetToTeamMember = async (req, res) => {
  try {
    const { employeeId } = req.body;
    const assetId = req.params.id;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID is required'
      });
    }

    // Verify Team Leader role
    if (req.employee.role !== 'Team_Leader') {
      return res.status(403).json({
        success: false,
        message: 'Only Team Leaders can use this endpoint'
      });
    }

    // Check if employee is a team member of this Team Leader
    const employee = await Employee.findOne({
      _id: employeeId,
      manager: req.employee._id,
      isActive: true
    });

    if (!employee) {
      return res.status(403).json({
        success: false,
        message: 'Employee is not a member of your team'
      });
    }

    const asset = await Asset.findById(assetId);
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    // Check if asset is available
    if (asset.status !== 'Available') {
      return res.status(400).json({
        success: false,
        message: 'Asset is not available for assignment'
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
      assignedBy: req.employee._id,
      assignedDate: new Date(),
      isActive: true,
      transferType: 'assign'
    });
    
    asset.status = 'Assigned';
    asset.updatedBy = req.employee._id;
    
    await asset.save();
    await asset.populate('assignedTo.employee', 'name employeeId designation department');
    await asset.populate('assignedTo.assignedBy', 'name employeeId');

    res.json({
      success: true,
      message: 'Asset assigned successfully to team member',
      asset
    });
  } catch (error) {
    console.error('Assign Asset to Team Member Error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};
