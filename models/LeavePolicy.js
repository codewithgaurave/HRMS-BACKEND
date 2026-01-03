// type like : ["Casual", "Sick", "Earned", "Maternity", "Paternity", "Other"],
import mongoose from "mongoose";

const leavePolicySchema = new mongoose.Schema(
  {
    leaveType: {
      type: String,
      trim: true,
      required: true,
    },
    maxLeavesPerYear: {
      type: Number,
      required: true,
      default: 12,
    },
    genderRestriction: {
      type: String,
      enum: ["Male", "Female", "All"],
      default: "All",
    },
    carryForward: {
      type: Boolean,
      default: false,
    },
    description: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee"
    },
    hrId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
  },
  { timestamps: true }
);

// Compound index to ensure unique leave types per HR
leavePolicySchema.index({ leaveType: 1, hrId: 1 }, { unique: true });

const LeavePolicy = mongoose.model("LeavePolicy", leavePolicySchema);
export default LeavePolicy;