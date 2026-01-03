import express from "express";
import { getEnhancedHRDashboardStats } from "../controllers/enhancedDashboardController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

// @route   GET /api/enhanced-dashboard/hr-stats
// @desc    Get comprehensive HR dashboard statistics
// @access  Private (HR_Manager only)
router.get("/hr-stats", authenticateToken, getEnhancedHRDashboardStats);

export default router;