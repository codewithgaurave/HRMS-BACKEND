import TaskType from "../models/TaskType.js";

export const createTaskType = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Name is required." });

    const existing = await TaskType.findOne({ name: { $regex: `^${name}$`, $options: "i" }, createdBy: req.employee._id });
    if (existing) return res.status(400).json({ success: false, message: "Task type with this name already exists." });

    const taskType = await TaskType.create({ name, description, createdBy: req.employee._id });
    res.status(201).json({ success: true, message: "Task type created successfully.", taskType });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllTaskTypes = async (req, res) => {
  try {
    const taskTypes = await TaskType.find({ createdBy: req.employee._id, isActive: true })
      .sort({ createdAt: -1 });
    res.json({ success: true, taskTypes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteTaskType = async (req, res) => {
  try {
    const taskType = await TaskType.findOne({ _id: req.params.id, createdBy: req.employee._id });
    if (!taskType) return res.status(404).json({ success: false, message: "Task type not found." });

    taskType.isActive = false;
    await taskType.save();
    res.json({ success: true, message: "Task type deleted successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTaskType = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Name is required." });

    const duplicate = await TaskType.findOne({
      name: { $regex: `^${name}$`, $options: "i" },
      createdBy: req.employee._id,
      _id: { $ne: req.params.id }
    });
    if (duplicate) return res.status(400).json({ success: false, message: "Task type with this name already exists." });

    const taskType = await TaskType.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.employee._id },
      { name, description },
      { new: true }
    );
    if (!taskType) return res.status(404).json({ success: false, message: "Task type not found." });

    res.json({ success: true, message: "Task type updated successfully.", taskType });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
