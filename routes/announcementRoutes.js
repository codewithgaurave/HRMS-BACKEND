import express from "express";
import {
  createAnnouncement,
  getAllAnnouncements,
  getMyAnnouncements,
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement,
  toggleAnnouncementStatus,
  getAnnouncementStats,
  getMyAnnouncementStats,
  getHRManagedEmployees,
  createHRScopedAnnouncement,
  getHRScopedAnnouncements,
  getEmployeeFilteredAnnouncements,
  getMyCreatedAnnouncements
} from "../controllers/announcementController.js";
import { authenticateToken, requireHRManager, requireTeamLeader } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(authenticateToken);

// Specific routes MUST come before generic /:id route
router.get("/hr-managed-employees", requireHRManager, getHRManagedEmployees);
router.get("/hr-scoped", requireHRManager, getHRScopedAnnouncements);
router.post("/hr-scoped", requireHRManager, createHRScopedAnnouncement);
router.get("/employee-filtered", getEmployeeFilteredAnnouncements);
router.get("/created-by-me", getMyCreatedAnnouncements);
router.get("/my-announcements", getMyAnnouncements);
router.get("/my-stats", getMyAnnouncementStats);
router.get("/stats", requireTeamLeader, getAnnouncementStats);
router.post("/", requireTeamLeader, createAnnouncement);
router.get("/", requireTeamLeader, getAllAnnouncements);

// Generic /:id routes MUST be at the end
router.get("/:id", getAnnouncementById);
router.put("/:id", requireTeamLeader, updateAnnouncement);
router.patch("/:id/toggle-status", requireTeamLeader, toggleAnnouncementStatus);
router.delete("/:id", requireTeamLeader, deleteAnnouncement);

export default router;