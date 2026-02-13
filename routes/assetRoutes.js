import express from 'express';
import { authenticateToken, requireTeamLeader } from '../middlewares/authMiddleware.js';
import {
  createAsset,
  getAllAssets,
  getAssetById,
  updateAsset,
  deleteAsset,
  assignAsset,
  returnAsset,
  getAssetsByEmployee,
  getAssetCategories,
  getHRTeamAssets,
  assignAssetToHRTeam,
  getHRTeamEmployeesForAssets,
  getTeamLeaderAssets,
  transferAsset,
  getAssetHistory,
  getMyAssetHistory,
  getAllAssetsHistory,
  employeeTransferAsset,
  getMyTransferableAssets,
  getColleaguesForTransfer
} from '../controllers/assetController.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticateToken);

// Asset CRUD routes
router.post('/', createAsset);

// History routes (MUST come before /:id routes)
router.get('/history/all', getAllAssetsHistory); // HR Panel - All assets history
router.get('/history/my', getMyAssetHistory); // Employee Panel - My asset history

// Employee Transfer Routes (MUST come before /:id routes)
router.get('/my/transferable', getMyTransferableAssets); // Employee - My assets that I can transfer
router.get('/colleagues/transfer', getColleaguesForTransfer); // Employee - Get colleagues list

// HR Team specific routes (must come before general routes)
router.get('/team/hr', getHRTeamAssets);
router.get('/team/employees', getHRTeamEmployeesForAssets);
router.post('/:id/assign/team', assignAssetToHRTeam);

// Team Leader specific route
router.get('/team/leader', requireTeamLeader, getTeamLeaderAssets);

// Categories route
router.get('/categories', getAssetCategories);

// Employee assets
router.get('/employee/:employeeId', getAssetsByEmployee);

// General routes
router.get('/', getAllAssets);
router.get('/:id', getAssetById);
router.get('/:id/history', getAssetHistory); // Specific asset history
router.put('/:id', updateAsset);
router.delete('/:id', deleteAsset);

// Asset assignment routes
router.post('/:id/assign', assignAsset);
router.post('/:id/return', returnAsset);
router.post('/:id/transfer', transferAsset); // HR/Team Leader transfer
router.post('/:id/employee-transfer', employeeTransferAsset); // Employee-to-Employee transfer/share

export default router;