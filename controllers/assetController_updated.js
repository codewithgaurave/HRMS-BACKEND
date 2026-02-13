// Get My Asset History (Employee sees their own asset history) - UPDATED
export const getMyAssetHistory = async (req, res) => {
  try {
    const employeeId = req.employee._id;

    const assets = await Asset.find({
      'assignedTo.employee': employeeId
    })
      .populate('assignedTo.employee', 'name employeeId')
      .populate('assignedTo.assignedBy', 'name employeeId')
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
          assignedBy: assignment.assignedBy,
          assignedDate: assignment.assignedDate,
          returnDate: assignment.returnDate,
          isActive: assignment.isActive,
          transferType: assignment.transferType,
          daysUsed: assignment.returnDate 
            ? Math.ceil((new Date(assignment.returnDate) - new Date(assignment.assignedDate)) / (1000 * 60 * 60 * 24))
            : Math.ceil((new Date() - new Date(assignment.assignedDate)) / (1000 * 60 * 60 * 24))
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
