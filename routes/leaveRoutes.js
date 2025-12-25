import express from "express";
import {
  createLeave,
  getLeaves,
  getLeaveById,
  updateLeaveStatus,
  cancelLeave,
  getMyLeaves,
  getMyAndTeamLeaves,
  getMyAndTeamLeavesWithoutFilters,
  getLeaveBalance,
  getAvailableLeaveTypes
} from "../controllers/leaveController.js";
import { authenticateToken, canAccessEmployee, requireHRManager, requireTeamLeader } from "../middlewares/authMiddleware.js";


const router = express.Router();

// Employee creates leave
router.post("/", authenticateToken, createLeave);

// SPECIFIC ROUTES FIRST
router.get('/available-types', authenticateToken, (req, res) => {
  console.log('🔥 Available types route hit!');
  getAvailableLeaveTypes(req, res);
});

// Get leaves
router.get("/", authenticateToken, requireHRManager,  getLeaves);
router.get("/my-teams-leaves", authenticateToken, canAccessEmployee,  getMyAndTeamLeaves);
router.get("/my-leaves", authenticateToken, getMyLeaves);
router.get('/balance', authenticateToken, getLeaveBalance);
router.get('/balance/:employeeId', authenticateToken, getLeaveBalance);
router.get('/team/without-filters', authenticateToken, getMyAndTeamLeavesWithoutFilters);

// DYNAMIC ROUTES LAST
router.get("/:id", authenticateToken, (req, res, next) => {
  // Check if id is valid MongoDB ObjectId
  if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
    return res.status(400).json({ message: "Invalid ID format" });
  }
  getLeaveById(req, res, next);
});
// HR approves/rejects leave
router.put("/:id/status", authenticateToken, requireTeamLeader, (req, res, next) => {
  if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
    return res.status(400).json({ message: "Invalid ID format" });
  }
  updateLeaveStatus(req, res, next);
});


// Employee cancels pending leave
router.delete("/:id", authenticateToken, (req, res, next) => {
  if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
    return res.status(400).json({ message: "Invalid ID format" });
  }
  cancelLeave(req, res, next);
});

export default router;