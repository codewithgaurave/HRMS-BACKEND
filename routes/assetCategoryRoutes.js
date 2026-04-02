import express from "express";
import {
  createAssetCategory,
  getAssetCategories,
  getAssetCategoryById,
  updateAssetCategory,
  deleteAssetCategory,
} from "../controllers/assetCategoryController.js";
import { authenticateToken, requireHRManager } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/", authenticateToken, requireHRManager, createAssetCategory);
router.get("/", authenticateToken, getAssetCategories);
router.get("/:id", authenticateToken, getAssetCategoryById);
router.put("/:id", authenticateToken, requireHRManager, updateAssetCategory);
router.delete("/:id", authenticateToken, requireHRManager, deleteAssetCategory);

export default router;
