import express from 'express';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import {
  createAssetRequest,
  getAssetRequests,
  getMyAssetRequests,
  updateAssetRequestStatus,
  getAssetRequestStats,
  getTeamAssetOverview
} from '../controllers/assetRequestController.js';

const router = express.Router();

router.use(authenticateToken);

// Create asset request
router.post('/', createAssetRequest);

// Get asset requests (team members' requests for team leaders, all for HR)
router.get('/', getAssetRequests);

// Get my own asset requests (for team leaders)
router.get('/my-requests', getMyAssetRequests);

// Get asset request stats
router.get('/stats', getAssetRequestStats);

// Get team asset overview (Team Leader only)
router.get('/team-overview', getTeamAssetOverview);

// Update asset request status (approve/reject)
router.patch('/:id/status', updateAssetRequestStatus);

export default router;