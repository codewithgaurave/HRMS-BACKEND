import express from 'express';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import {
  createPayroll,
  getAllPayrolls,
  getPayrollById,
  updatePayroll,
  deletePayroll,
  generatePayrollForAll
} from '../controllers/payrollController.js';

const router = express.Router();

router.use(authenticateToken);

router.post('/', createPayroll);
router.get('/', getAllPayrolls);
router.post('/generate-all', generatePayrollForAll);
router.get('/:id', getPayrollById);
router.put('/:id', updatePayroll);
router.delete('/:id', deletePayroll);

export default router;