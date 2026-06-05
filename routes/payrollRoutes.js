import express from 'express';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import Attendance from '../models/Attendance.js';
import Employee from '../models/Employee.js';
import {
  createPayroll,
  getAllPayrolls,
  getHRTeamPayrolls,
  getPayrollById,
  updatePayroll,
  deletePayroll,
  generatePayrollForAll,
  recalculatePayroll
} from '../controllers/payrollController.js';

const router = express.Router();

router.use(authenticateToken);

// DEBUG: check attendance dates for a month
router.get('/debug/attendance', async (req, res) => {
  try {
    const { month, year } = req.query;
    const m = parseInt(month || 5);
    const y = parseInt(year || 2025);
    const IST = 5.5 * 60 * 60 * 1000;

    // Get HR team members
    const teamMembers = await Employee.find({ addedBy: req.employee._id }).select('_id employeeId name');
    const ids = teamMembers.map(e => e._id);
    ids.push(req.employee._id);

    // Fetch all attendance in wide range
    const start = new Date(Date.UTC(y, m - 1, 1) - 86400000 * 2);
    const end = new Date(Date.UTC(y, m, 1) + 86400000 * 2);

    const records = await Attendance.find({
      employee: { $in: ids },
      date: { $gte: start, $lt: end }
    }).select('date status employee').populate('employee', 'employeeId');

    const result = records.map(r => ({
      employeeId: r.employee?.employeeId,
      dateUTC: r.date.toISOString(),
      dateIST: new Date(r.date.getTime() + IST).toISOString(),
      monthUTC: r.date.getUTCMonth() + 1,
      monthIST: new Date(r.date.getTime() + IST).getUTCMonth() + 1,
      status: r.status
    }));

    res.json({ total: result.length, month: m, year: y, records: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', createPayroll);
router.get('/team/hr', getHRTeamPayrolls);
router.post('/generate-all', generatePayrollForAll);
router.post('/recalculate', recalculatePayroll);
router.get('/', getAllPayrolls);
router.get('/:id', getPayrollById);
router.put('/:id', updatePayroll);
router.delete('/:id', deletePayroll);

export default router;
