import express from 'express';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import {
  getEmployeeReports,
  getPayrollReports,
  getAssetReports,
  getAttendanceReports,
  getLeaveReports,
  getDepartmentReports,
  getHRTeamEmployeeReports,
  getHRTeamPayrollReports,
  getHRTeamAttendanceReports,
  getHRTeamLeaveReports
} from '../controllers/reportsController.js';

const router = express.Router();

router.use(authenticateToken);

// HR Team specific routes (must come before general routes)
router.get('/team/employees', getHRTeamEmployeeReports);
router.get('/team/payroll', getHRTeamPayrollReports);
router.get('/team/attendance', getHRTeamAttendanceReports);
router.get('/team/leaves', getHRTeamLeaveReports);

// General routes
router.get('/employees', getEmployeeReports);
router.get('/payroll', getPayrollReports);
router.get('/assets', getAssetReports);
router.get('/attendance', getAttendanceReports);
router.get('/leaves', getLeaveReports);
router.get('/departments', getDepartmentReports);

export default router;