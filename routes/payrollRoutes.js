import express from 'express';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import {
  createPayroll,
  getAllPayrolls,
  getHRTeamPayrolls,
  getPayrollById,
  updatePayroll,
  deletePayroll,
  generatePayrollForAll
} from '../controllers/payrollController.js';

const router = express.Router();

router.use(authenticateToken);

router.post('/', createPayroll);
router.get('/team/hr', getHRTeamPayrolls);
router.post('/generate-all', generatePayrollForAll);
router.get('/', getAllPayrolls);
router.get('/:id', getPayrollById);
router.put('/:id', updatePayroll);
router.delete('/:id', deletePayroll);

export default router;