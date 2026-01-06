import express from 'express';
import { getHRSummary } from '../controllers/hrSummaryController.js';
import { authenticateToken, requireRole } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/summary', authenticateToken, requireRole(['HR Manager']), getHRSummary);

export default router;