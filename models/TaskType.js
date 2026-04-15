import mongoose from "mongoose";

const taskTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const TaskType = mongoose.model("TaskType", taskTypeSchema);
export default TaskType;
