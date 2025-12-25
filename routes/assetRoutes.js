import express from 'express';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import {
  createAsset,
  getAllAssets,
  getAssetById,
  updateAsset,
  deleteAsset,
  assignAsset,
  returnAsset,
  getAssetsByEmployee,
  getAssetCategories
} from '../controllers/assetController.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticateToken);

// Asset CRUD routes
router.post('/', createAsset);
router.get('/', getAllAssets);
router.get('/categories', getAssetCategories);
router.get('/:id', getAssetById);
router.put('/:id', updateAsset);
router.delete('/:id', deleteAsset);

// Asset assignment routes
router.post('/:id/assign', assignAsset);
router.post('/:id/return', returnAsset);

// Employee assets
router.get('/employee/:employeeId', getAssetsByEmployee);

export default router;