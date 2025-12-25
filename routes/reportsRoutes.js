import express from 'express';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import {
  getEmployeeReports,
  getPayrollReports,
  getAssetReports,
  getAttendanceReports,
  getLeaveReports,
  getDepartmentReports
} from '../controllers/reportsController.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/employees', getEmployeeReports);
router.get('/payroll', getPayrollReports);
router.get('/assets', getAssetReports);
router.get('/attendance', getAttendanceReports);
router.get('/leaves', getLeaveReports);
router.get('/departments', getDepartmentReports);

export default router;