import express from "express";
import { createTaskType, getAllTaskTypes, deleteTaskType, updateTaskType } from "../controllers/taskTypeController.js";
import { authenticateToken, requireTeamLeader } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/", authenticateToken, requireTeamLeader, createTaskType);
router.get("/", authenticateToken, requireTeamLeader, getAllTaskTypes);
router.put("/:id", authenticateToken, requireTeamLeader, updateTaskType);
router.delete("/:id", authenticateToken, requireTeamLeader, deleteTaskType);

export default router;
