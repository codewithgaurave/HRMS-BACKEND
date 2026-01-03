import mongoose from "mongoose";

const employmentStatusSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
    },
    hrId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
  },
  { timestamps: true }
);

// Compound index to ensure unique employment status titles per HR
employmentStatusSchema.index({ title: 1, hrId: 1 }, { unique: true });

const EmploymentStatus = mongoose.model("EmploymentStatus", employmentStatusSchema);
export default EmploymentStatus;
