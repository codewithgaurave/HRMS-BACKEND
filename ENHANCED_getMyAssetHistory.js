// ENHANCED VERSION - Replace getMyAssetHistory function with this

export const getMyAssetHistory = async (req, res) => {
  try {
    const employeeId = req.employee._id;

    const assets = await Asset.find({
      'assignedTo.employee': employeeId
    })
      .populate('assignedTo.employee', 'name employeeId')
      .populate('assignedTo.assignedBy', 'name employeeId')  // ✅ Added
      .populate('createdBy', 'name employeeId')
      .sort({ 'assignedTo.assignedDate': -1 });

    const myHistory = assets.map(asset => {
      const myAssignments = asset.assignedTo.filter(
        a => a.employee._id.toString() === employeeId.toString()
      );

      return {
        asset: {
          _id: asset._id,
          assetId: asset.assetId,
          name: asset.name,
          category: asset.category,
          status: asset.status
        },
        assignments: myAssignments.map(assignment => ({
          assignedDate: assignment.assignedDate,
          returnDate: assignment.returnDate,
          isActive: assignment.isActive,
          daysUsed: assignment.returnDate 
            ? Math.ceil((new Date(assignment.returnDate) - new Date(assignment.assignedDate)) / (1000 * 60 * 60 * 24))
            : Math.ceil((new Date() - new Date(assignment.assignedDate)) / (1000 * 60 * 60 * 24)),
          assignedBy: assignment.assignedBy || null,  // ✅ Added
          transferType: assignment.transferType || 'assign'  // ✅ Added
        })),
        currentlyWithMe: myAssignments.some(a => a.isActive)
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
        )
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ENHANCED RESPONSE EXAMPLE:
/*
{
  "success": true,
  "history": [
    {
      "asset": {
        "assetId": "AST0001",
        "name": "Dell Laptop"
      },
      "assignments": [
        {
          "assignedDate": "2024-01-15",
          "isActive": true,
          "daysUsed": 45,
          "assignedBy": {
            "_id": "65f456...",
            "name": {
              "first": "Rahul",
              "last": "Sharma"
            },
            "employeeId": "EMP0005"
          },
          "transferType": "transfer"
        }
      ]
    }
  ]
}
*/
