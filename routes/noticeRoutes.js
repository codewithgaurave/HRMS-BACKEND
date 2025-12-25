import express from 'express';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import {
  createNotice,
  getNoticesForEmployee,
  markNoticeAsRead,
  getMyNotices,
  getTeamStats
} from '../controllers/noticeController.js';

const router = express.Router();

router.use(authenticateToken);

// Create notice
router.post('/', createNotice);

// Get notices for current employee
router.get('/', getNoticesForEmployee);

// Get team stats
router.get('/team-stats', async (req, res) => {
  try {
    console.log('Team stats route hit!');
    
    // Get team members count
    const Employee = (await import('../models/Employee.js')).default;
    const Notice = (await import('../models/Notice.js')).default;
    
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
    console.error('Team stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching team stats',
      error: error.message
    });
  }
});

// Get notices created by current user
router.get('/my-notices', getMyNotices);

// Mark notice as read
router.patch('/:id/read', markNoticeAsRead);

export default router;