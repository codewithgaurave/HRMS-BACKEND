import Task from "../models/Task.js";
import Employee from "../models/Employee.js";

// 📌 Create Task (Team Leader only — can assign to own team members only)
export const createTask = async (req, res) => {
  try {
    const { title, description, assignedTo, priority, dueDate, deadline, taskType } = req.body;

    if (!title || !assignedTo || !deadline) {
      return res.status(400).json({ success: false, message: "Title, assignedTo, and deadline are required." });
    }

    if (new Date(deadline) <= new Date()) {
      return res.status(400).json({ success: false, message: "Deadline must be in the future." });
    }

    // Team Leader can only assign to their own team members
    if (req.employee.role === 'Team_Leader') {
      const teamMember = await Employee.findOne({ _id: assignedTo, manager: req.employee._id });
      if (!teamMember) {
        return res.status(403).json({ success: false, message: "You can only assign tasks to your own team members." });
      }
    }

    const assignedEmployee = await Employee.findById(assignedTo);
    if (!assignedEmployee) {
      return res.status(404).json({ success: false, message: "Assigned employee not found." });
    }

    const task = await Task.create({
      title, description,
      assignedBy: req.employee._id,
      assignedTo,
      priority,
      dueDate,
      deadline: new Date(deadline),
      taskType: taskType || null,
      status: "Assigned",
      taskHistory: [{ status: "Assigned", updatedBy: req.employee._id, remarks: "Task created and assigned" }],
    });

    const populatedTask = await Task.findById(task._id)
      .populate("assignedBy", "name email employeeId")
      .populate("assignedTo", "name email employeeId")
      .populate("taskType", "name")
      .populate("taskHistory.updatedBy", "name email employeeId");

    res.status(201).json({ success: true, message: "Task created successfully.", task: populatedTask });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 📌 Get All Tasks — HR sees all or filtered by TL; Team Leader sees only tasks they created
export const getAllTasks = async (req, res) => {
  try {
    const {
      search,
      status,
      priority,
      assignedTo,
      assignedBy,
      taskType,
      deadlineStatus,
      period,
      date,
      month,
      year,
      startDate,
      endDate,
      dateField = "createdAt",
      sortBy = "createdAt",
      sortOrder = "desc",
      isActive,
    } = req.query;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const filter = {};

    // Team Leader sees only tasks they assigned; HR can filter by assignedBy or see all
    if (req.employee.role === 'Team_Leader') {
      filter.assignedBy = req.employee._id;
    } else if (assignedBy) {
      filter.assignedBy = assignedBy;
    }

    if (isActive === "true") filter.isActive = true;
    else if (isActive === "false") filter.isActive = false;
    else filter.isActive = true;

    if (assignedTo) filter.assignedTo = assignedTo;
    if (taskType) filter.taskType = taskType;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    // Search by title, description, or assigned/assignee employee name/ID
    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: "i" };
      const matchingEmployees = await Employee.find({
        $or: [
          { "name.first": searchRegex },
          { "name.last": searchRegex },
          { employeeId: searchRegex },
          { email: searchRegex }
        ]
      }).select('_id');
      const matchedIds = matchingEmployees.map(e => e._id);

      filter.$or = [
        { title: searchRegex },
        { description: searchRegex },
        ...(matchedIds.length > 0 ? [
          { assignedTo: { $in: matchedIds } },
          { assignedBy: { $in: matchedIds } }
        ] : [])
      ];
    }

    // Deadline status filter
    if (deadlineStatus) {
      const now = new Date();
      switch (deadlineStatus) {
        case 'overdue':
          filter.deadline = { $lt: now };
          filter.status = { $nin: ['Completed', 'Approved'] };
          break;
        case 'urgent':
          const t = new Date(now);
          t.setDate(t.getDate() + 1);
          filter.deadline = { $gte: now, $lte: t };
          filter.status = { $nin: ['Completed', 'Approved'] };
          break;
        case 'approaching':
          const td = new Date(now);
          td.setDate(td.getDate() + 3);
          filter.deadline = { $gte: now, $lte: td };
          filter.status = { $nin: ['Completed', 'Approved'] };
          break;
        case 'completed':
          filter.status = { $in: ['Completed', 'Approved'] };
          break;
      }
    }

    // Date filters (Daily / Monthly / Custom Range)
    const targetDateField = ['createdAt', 'deadline', 'dueDate'].includes(dateField) ? dateField : 'createdAt';

    if (period === 'daily' && date) {
      const d = new Date(date);
      if (!isNaN(d.getTime())) {
        const startOfDay = new Date(d);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(d);
        endOfDay.setHours(23, 59, 59, 999);
        filter[targetDateField] = { $gte: startOfDay, $lte: endOfDay };
      }
    } else if (period === 'monthly' && (month || year)) {
      let y = parseInt(year) || new Date().getFullYear();
      let m = parseInt(month) || (new Date().getMonth() + 1);
      if (typeof month === 'string' && month.includes('-')) {
        const parts = month.split('-');
        y = parseInt(parts[0]);
        m = parseInt(parts[1]);
      }
      if (m >= 1 && m <= 12) {
        const startOfMonth = new Date(y, m - 1, 1, 0, 0, 0, 0);
        const endOfMonth = new Date(y, m, 0, 23, 59, 59, 999);
        filter[targetDateField] = { $gte: startOfMonth, $lte: endOfMonth };
      }
    } else if (startDate || endDate) {
      const dateRange = {};
      if (startDate) {
        const s = new Date(startDate);
        if (!isNaN(s.getTime())) {
          s.setHours(0, 0, 0, 0);
          dateRange.$gte = s;
        }
      }
      if (endDate) {
        const e = new Date(endDate);
        if (!isNaN(e.getTime())) {
          e.setHours(23, 59, 59, 999);
          dateRange.$lte = e;
        }
      }
      if (Object.keys(dateRange).length > 0) {
        filter[targetDateField] = dateRange;
      }
    }

    const tasks = await Task.find(filter)
      .populate("assignedBy", "name email employeeId role designation")
      .populate("assignedTo", "name email employeeId designation department")
      .populate("taskType", "name")
      .populate("taskHistory.updatedBy", "name email employeeId")
      .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await Task.countDocuments(filter);

    res.json({
      success: true,
      tasks,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit) || 1,
        totalTasks: total,
        limit
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 📌 Get My Tasks (Employee)
export const getMyTasks = async (req, res) => {
  try {
    const { status, priority, deadlineStatus } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const filter = { 
      assignedTo: req.employee._id, 
      isActive: true 
    };
    
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    // Deadline status filter
    if (deadlineStatus) {
      const now = new Date();
      switch (deadlineStatus) {
        case 'overdue':
          filter.deadline = { $lt: now };
          filter.status = { $nin: ['Completed', 'Approved'] };
          break;
        case 'urgent':
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          filter.deadline = { $gte: now, $lte: tomorrow };
          filter.status = { $nin: ['Completed', 'Approved'] };
          break;
        case 'approaching':
          const threeDays = new Date(now);
          threeDays.setDate(threeDays.getDate() + 3);
          filter.deadline = { $gte: now, $lte: threeDays };
          filter.status = { $nin: ['Completed', 'Approved'] };
          break;
        case 'completed':
          filter.status = { $in: ['Completed', 'Approved'] };
          break;
      }
    }

    const tasks = await Task.find(filter)
      .populate("assignedBy", "name email employeeId")
      .populate("assignedTo", "name email employeeId")
      .populate("taskType", "name")
      .populate("taskHistory.updatedBy", "name email employeeId")
      .sort({ deadline: 1, createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await Task.countDocuments(filter);

    res.json({ 
      success: true, 
      tasks,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalTasks: total
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 📌 Update Task Status (Employee - Only for assigned tasks)
export const updateTaskStatus = async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const taskId = req.params.id;
    
    if (!remarks) {
      return res.status(400).json({ 
        success: false,
        message: "Remarks are required for status update." 
      });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ 
        success: false,
        message: "Task not found." 
      });
    }

    // Check if task is assigned to the employee
    if (task.assignedTo.toString() !== req.employee._id.toString()) {
      return res.status(403).json({ 
        success: false,
        message: "You can only update your own assigned tasks." 
      });
    }

    // Status validation for employees
    const allowedEmployeeStatuses = ["In Progress", "Pending", "Completed"];
    if (!allowedEmployeeStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false,
        message: "Employees can only set status to: In Progress, Pending, or Completed." 
      });
    }

    // Check if task can be updated (cannot update if Approved)
    if (task.status === "Approved") {
      return res.status(400).json({ 
        success: false,
        message: "Cannot update task status after it has been approved." 
      });
    }

    // Update task status
    const oldStatus = task.status;
    task.status = status;
    task.statusRemarks = remarks;

    // Add to history manually to ensure proper updatedBy
    task.taskHistory.push({
      status: status,
      updatedBy: req.employee._id,
      remarks: remarks,
      updatedAt: new Date()
    });

    await task.save();

    const populatedTask = await Task.findById(task._id)
      .populate("assignedBy", "name email employeeId")
      .populate("assignedTo", "name email employeeId")
      .populate("taskHistory.updatedBy", "name email employeeId");

    res.json({ 
      success: true, 
      message: `Task status updated from ${oldStatus} to ${status}.`, 
      task: populatedTask 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 📌 Approve/Reject Task (Team Leader — only tasks they assigned)
export const reviewTask = async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const taskId = req.params.id;

    if (!remarks) return res.status(400).json({ success: false, message: "Remarks are required for task review." });
    if (!["Approved", "Rejected"].includes(status)) return res.status(400).json({ success: false, message: "Invalid status. Only Approved or Rejected allowed." });

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ success: false, message: "Task not found." });

    // Team Leader can only review tasks they assigned
    if (req.employee.role === 'Team_Leader' && task.assignedBy.toString() !== req.employee._id.toString()) {
      return res.status(403).json({ success: false, message: "You can only review tasks that you assigned." });
    }

    if (task.status !== "Completed") {
      return res.status(400).json({ success: false, message: "Only completed tasks can be approved or rejected." });
    }

    task.status = status;
    task.statusRemarks = remarks;
    task.taskHistory.push({ status, updatedBy: req.employee._id, remarks, updatedAt: new Date() });
    await task.save();

    const populatedTask = await Task.findById(task._id)
      .populate("assignedBy", "name email employeeId")
      .populate("assignedTo", "name email employeeId")
      .populate("taskHistory.updatedBy", "name email employeeId");

    res.json({ success: true, message: `Task ${status.toLowerCase()} successfully.`, task: populatedTask });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 📌 Update Task Details (HR/Team Leader) - PATCH Behavior
export const updateTask = async (req, res) => {
  try {
    const { title, description, assignedTo, priority, dueDate, deadline, remarks } = req.body;
    const taskId = req.params.id;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ 
        success: false,
        message: "Task not found." 
      });
    }

    // Check if task can be updated (cannot update if Approved)
    if (task.status === "Approved") {
      return res.status(400).json({ 
        success: false,
        message: "Cannot update task after it has been approved." 
      });
    }

    // Track which fields are being updated
    const updatedFields = [];
    const oldValues = {};

    // Update only the fields that are provided and different from current values
    if (title !== undefined && title !== task.title) {
      oldValues.title = task.title;
      task.title = title;
      updatedFields.push("title");
    }

    if (description !== undefined && description !== task.description) {
      oldValues.description = task.description;
      task.description = description;
      updatedFields.push("description");
    }

    if (priority !== undefined && priority !== task.priority) {
      oldValues.priority = task.priority;
      task.priority = priority;
      updatedFields.push("priority");
    }

    if (dueDate !== undefined) {
      const newDueDate = dueDate ? new Date(dueDate) : null;
      const currentDueDate = task.dueDate ? new Date(task.dueDate).getTime() : null;
      const newDueDateTimestamp = newDueDate ? newDueDate.getTime() : null;
      
      if (newDueDateTimestamp !== currentDueDate) {
        oldValues.dueDate = task.dueDate;
        task.dueDate = newDueDate;
        updatedFields.push("dueDate");
      }
    }

    if (assignedTo !== undefined && assignedTo !== task.assignedTo.toString()) {
      const newAssignee = await Employee.findById(assignedTo);
      if (!newAssignee) {
        return res.status(404).json({ 
          success: false,
          message: "New assigned employee not found." 
        });
      }
      oldValues.assignedTo = task.assignedTo;
      task.assignedTo = assignedTo;
      updatedFields.push("assignedTo");
    }

    if (deadline !== undefined) {
      const newDeadline = new Date(deadline);
      if (!isNaN(newDeadline.getTime())) {
        if (newDeadline <= new Date()) {
          return res.status(400).json({ 
            success: false,
            message: "Deadline must be in the future." 
          });
        }
        if (newDeadline.getTime() !== task.deadline.getTime()) {
          oldValues.deadline = task.deadline;
          task.deadline = newDeadline;
          updatedFields.push("deadline");
        }
      }
    }

    // Check if at least one field is being updated
    if (updatedFields.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: "No changes detected. Please provide at least one field to update." 
      });
    }

    // Generate automatic remarks if not provided
    let historyRemarks = remarks;
    if (!historyRemarks) {
      historyRemarks = `Updated: ${updatedFields.join(", ")}`;
      
      // Add specific changes for important fields
      const changes = [];
      if (oldValues.title) changes.push(`title from "${oldValues.title}" to "${task.title}"`);
      if (oldValues.priority) changes.push(`priority from ${oldValues.priority} to ${task.priority}`);
      if (oldValues.assignedTo) changes.push(`reassigned task`);
      if (oldValues.deadline) changes.push(`deadline from ${oldValues.deadline.toDateString()} to ${task.deadline.toDateString()}`);
      if (oldValues.dueDate) changes.push(`due date updated`);
      if (oldValues.description) changes.push(`description updated`);
      
      if (changes.length > 0) {
        historyRemarks += `. Changes: ${changes.join("; ")}`;
      }
    }

    // Add to history
    task.taskHistory.push({
      status: task.status,
      updatedBy: req.employee._id,
      remarks: historyRemarks,
      updatedAt: new Date()
    });

    await task.save();

    const populatedTask = await Task.findById(task._id)
      .populate("assignedBy", "name email employeeId")
      .populate("assignedTo", "name email employeeId")
      .populate("taskHistory.updatedBy", "name email employeeId");

    res.json({ 
      success: true, 
      message: `Task updated successfully. Updated: ${updatedFields.join(", ")}`, 
      task: populatedTask,
      updatedFields: updatedFields
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 📌 Soft Delete Task (HR or Team Leader)
export const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ 
        success: false,
        message: "Task not found." 
      });
    }

    
    if (!task.isActive) {
      return res.status(400).json({ 
        success: false,
        message: "Task already deleted." 
      });
    }

    task.isActive = false;
    await task.save();

    res.json({ 
      success: true, 
      message: "Task deleted successfully." 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 📌 restore Task (HR or Team Leader)
export const restoreTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ 
        success: false,
        message: "Task not found." 
      });
    }
    
    if (task.isActive) {
      return res.status(400).json({ 
        success: false,
        message: "Task already active not-deleted yet." 
      });
    }

    task.isActive = true;
    await task.save();

    res.json({ 
      success: true, 
      message: "Task restored successfully." 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 📌 Get Task Statistics (HR / Team Leader / Employee)
export const getTaskStats = async (req, res) => {
  try {
    const { assignedBy, assignedTo, period, date, month, year, startDate, endDate, dateField = "createdAt" } = req.query;

    const baseFilter = { isActive: true };

    if (req.employee.role === 'Team_Leader') {
      baseFilter.assignedBy = req.employee._id;
    } else if (assignedBy) {
      baseFilter.assignedBy = assignedBy;
    }

    if (assignedTo) {
      baseFilter.assignedTo = assignedTo;
    }

    // Target Date Field
    const targetDateField = ['createdAt', 'deadline', 'dueDate'].includes(dateField) ? dateField : 'createdAt';

    // Apply period/date filters if provided
    if (period === 'daily' && date) {
      const d = new Date(date);
      if (!isNaN(d.getTime())) {
        const startOfDay = new Date(d);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(d);
        endOfDay.setHours(23, 59, 59, 999);
        baseFilter[targetDateField] = { $gte: startOfDay, $lte: endOfDay };
      }
    } else if (period === 'monthly' && (month || year)) {
      let y = parseInt(year) || new Date().getFullYear();
      let m = parseInt(month) || (new Date().getMonth() + 1);
      if (typeof month === 'string' && month.includes('-')) {
        const parts = month.split('-');
        y = parseInt(parts[0]);
        m = parseInt(parts[1]);
      }
      if (m >= 1 && m <= 12) {
        const startOfMonth = new Date(y, m - 1, 1, 0, 0, 0, 0);
        const endOfMonth = new Date(y, m, 0, 23, 59, 59, 999);
        baseFilter[targetDateField] = { $gte: startOfMonth, $lte: endOfMonth };
      }
    } else if (startDate || endDate) {
      const dateRange = {};
      if (startDate) {
        const s = new Date(startDate);
        if (!isNaN(s.getTime())) {
          s.setHours(0, 0, 0, 0);
          dateRange.$gte = s;
        }
      }
      if (endDate) {
        const e = new Date(endDate);
        if (!isNaN(e.getTime())) {
          e.setHours(23, 59, 59, 999);
          dateRange.$lte = e;
        }
      }
      if (Object.keys(dateRange).length > 0) {
        baseFilter[targetDateField] = dateRange;
      }
    }

    const totalTasks = await Task.countDocuments(baseFilter);
    const myTasks = await Task.countDocuments({ 
      assignedTo: req.employee._id, 
      isActive: true 
    });
    
    const statusStats = await Task.aggregate([
      { $match: baseFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const priorityStats = await Task.aggregate([
      { $match: baseFilter },
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);

    // Deadline statistics based on current filter
    const now = new Date();
    const overdueTasks = await Task.countDocuments({
      ...baseFilter,
      deadline: { $lt: now },
      status: { $nin: ['Completed', 'Approved'] }
    });

    const urgentTasks = await Task.countDocuments({
      ...baseFilter,
      deadline: { 
        $gte: now, 
        $lte: new Date(now.getTime() + 24 * 60 * 60 * 1000)
      },
      status: { $nin: ['Completed', 'Approved'] }
    });

    const approachingTasks = await Task.countDocuments({
      ...baseFilter,
      deadline: { 
        $gte: new Date(now.getTime() + 24 * 60 * 60 * 1000), 
        $lte: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
      },
      status: { $nin: ['Completed', 'Approved'] }
    });

    // Today's tasks count
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const todayTasks = await Task.countDocuments({
      isActive: true,
      ...(req.employee.role === 'Team_Leader' ? { assignedBy: req.employee._id } : (assignedBy ? { assignedBy } : {})),
      createdAt: { $gte: startOfToday, $lte: endOfToday }
    });

    // This month's tasks count
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const endOfThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const thisMonthTasks = await Task.countDocuments({
      isActive: true,
      ...(req.employee.role === 'Team_Leader' ? { assignedBy: req.employee._id } : (assignedBy ? { assignedBy } : {})),
      createdAt: { $gte: startOfThisMonth, $lte: endOfThisMonth }
    });

    // Team Leader breakdown (for HR)
    let teamLeaderStats = [];
    if (req.employee.role === 'HR_Manager') {
      teamLeaderStats = await Task.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: '$assignedBy',
            totalTasks: { $sum: 1 },
            completedTasks: {
              $sum: { $cond: [{ $in: ['$status', ['Completed', 'Approved']] }, 1, 0] }
            },
            inProgressTasks: {
              $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] }
            },
            pendingTasks: {
              $sum: { $cond: [{ $in: ['$status', ['Pending', 'Assigned', 'New']] }, 1, 0] }
            }
          }
        },
        {
          $lookup: {
            from: 'employees',
            localField: '_id',
            foreignField: '_id',
            as: 'teamLeader'
          }
        },
        { $unwind: { path: '$teamLeader', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            totalTasks: 1,
            completedTasks: 1,
            inProgressTasks: 1,
            pendingTasks: 1,
            name: '$teamLeader.name',
            email: '$teamLeader.email',
            employeeId: '$teamLeader.employeeId'
          }
        },
        { $sort: { totalTasks: -1 } }
      ]);
    }

    res.json({
      success: true,
      stats: {
        totalTasks,
        myTasks,
        overdueTasks,
        urgentTasks,
        approachingTasks,
        todayTasks,
        thisMonthTasks,
        statusStats,
        priorityStats,
        teamLeaderStats
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 📌 Get Assignable Employees — Team Leader sees only their team members; HR sees all employees & team leaders
export const getAssignableEmployees = async (req, res) => {
  try {
    let employees;
    let teamLeaders = [];
    if (req.employee.role === 'Team_Leader') {
      employees = await Employee.find({ manager: req.employee._id, isActive: true })
        .select('name email employeeId designation department role')
        .populate('designation', 'title')
        .populate('department', 'name');
    } else {
      employees = await Employee.find({ isActive: true, role: { $in: ['Employee', 'Team_Leader'] } })
        .select('name email employeeId designation department role manager')
        .populate('designation', 'title')
        .populate('department', 'name')
        .populate('manager', 'name employeeId');

      teamLeaders = await Employee.find({ isActive: true, role: 'Team_Leader' })
        .select('name email employeeId designation department')
        .populate('designation', 'title')
        .populate('department', 'name');
    }
    res.json({ success: true, employees, teamLeaders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 📌 Get Tasks with Deadline Alerts
export const getDeadlineAlerts = async (req, res) => {
  try {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const overdueTasks = await Task.find({
      assignedTo: req.employee._id,
      isActive: true,
      deadline: { $lt: now },
      status: { $nin: ['Completed', 'Approved'] }
    })
    .populate("assignedBy", "name email employeeId")
    .populate("assignedTo", "name email employeeId")
    .sort({ deadline: 1 })
    .limit(10);

    const upcomingTasks = await Task.find({
      assignedTo: req.employee._id,
      isActive: true,
      deadline: { $gte: now, $lte: threeDaysFromNow },
      status: { $nin: ['Completed', 'Approved'] }
    })
    .populate("assignedBy", "name email employeeId")
    .populate("assignedTo", "name email employeeId")
    .sort({ deadline: 1 })
    .limit(10);

    res.json({
      success: true,
      alerts: {
        overdue: overdueTasks,
        upcoming: upcomingTasks
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 📌 Get Task by ID
export const getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate("assignedBy", "name email employeeId")
      .populate("assignedTo", "name email employeeId")
      .populate("taskHistory.updatedBy", "name email employeeId");

    if (!task) {
      return res.status(404).json({ 
        success: false,
        message: "Task not found." 
      });
    }

    // Check access rights
    if (task.assignedTo._id.toString() !== req.employee._id.toString() && 
        !["Team_Leader", "HR_Manager"].includes(req.employee.role)) {
      return res.status(403).json({ 
        success: false,
        message: "Access denied." 
      });
    }

    res.json({
      success: true,
      task
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};