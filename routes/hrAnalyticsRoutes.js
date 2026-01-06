import express from 'express';
import { authenticateToken, requireHRManager } from '../middlewares/authMiddleware.js';
import { getHRAnalytics } from '../controllers/hrAnalyticsController.js';

const router = express.Router();

// HR Analytics route - simplified dashboard with key metrics
router.get('/dashboard', authenticateToken, requireHRManager, getHRAnalytics);

// Alternative route for HR summary (same endpoint)
router.get('/summary', authenticateToken, requireHRManager, getHRAnalytics);

export default router;