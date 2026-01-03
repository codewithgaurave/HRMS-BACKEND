import Announcement from "../models/Announcement.js";
import Employee from "../models/Employee.js";

export const createAnnouncement = async (req, res) => {
    console.log(req.body)
    try {
        const { title, message, audience, category, isActive = true } = req.body;

        if (!title || !message) {
            return res.status(400).json({
                success: false,
                message: "Title and message are required"
            });
        }

        if (audience && !audience.allEmployees &&
            (!audience.departments || audience.departments.length === 0) &&
            (!audience.designations || audience.designations.length === 0) &&
            (!audience.roles || audience.roles.length === 0)) {
            return res.status(400).json({
                success: false,
                message: "Specify at least one audience criteria"
            });
        }

        const announcement = await Announcement.create({
            title,
            message,
            audience: audience || { allEmployees: true },
            category,
            isActive,
            createdBy: req.employee._id
        });

        const populatedAnnouncement = await Announcement.findById(announcement._id)
            .populate("createdBy", "name.first name.last employeeId designation")
            .populate("audience.departments", "name")
            .populate("audience.designations", "name");

        res.status(201).json({
            success: true,
            message: "Announcement created successfully",
            announcement: populatedAnnouncement
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

export const getAllAnnouncements = async (req, res) => {
  try {
    const {
      category,
      isActive,
      search,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const filter = {};

    // 🔍 Category filter (keep if user sends a valid category)
    if (category) {
      filter.category = category;
    }

    // ✅ Active status filter
    if (isActive !== undefined && isActive !== "") {
      filter.isActive = isActive === "true";
    }

    // 🔍 Search filter for title, message, category (case-insensitive)
    if (search && search.trim() !== "") {
      const regex = new RegExp(search, "i");
      filter.$or = [
        { title: regex },
        { message: regex },
        { category: regex },
      ];
    }

    // 🧭 Sorting setup
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === "desc" ? -1 : 1;

    // 📄 Pagination setup
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // 🗃️ Fetch announcements
    const announcements = await Announcement.find(filter)
      .populate("createdBy", "name.first name.last employeeId designation department")
      .populate("updatedBy", "name.first name.last employeeId designation")
      .populate("audience.departments", "name")
      .populate("audience.designations", "name")
      .sort(sortConfig)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // 📊 Metadata
    const totalCount = await Announcement.countDocuments(filter);
    const categories = await Announcement.distinct("category");
    const totalPages = Math.ceil(totalCount / limitNum);

    // ✅ Response
    res.status(200).json({
      success: true,
      message: "Announcements fetched successfully",
      total: totalCount,
      announcements,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
        limit: limitNum,
      },
      filters: {
        categories: categories.filter(Boolean),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

export const getMyAnnouncements = async (req, res) => {
  try {
    const {
      category,
      search,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;
    const currentEmployee = req.employee;

    // Base filter (only announcements created by the logged-in user)
    const baseFilter = { 
      createdBy: currentEmployee._id
    };

    if (category) {
      baseFilter.category = category;
    }

    if (search && search.trim() !== "") {
      const regex = new RegExp(search, "i");
      baseFilter.$or = [
        { title: regex },
        { message: regex },
        { category: regex },
      ];
    }

    // Sorting
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Fetch announcements created by the user
    const announcements = await Announcement.find(baseFilter)
      .populate("createdBy", "name.first name.last employeeId designation department")
      .populate("audience.departments", "name")
      .populate("audience.designations", "name")
      .sort(sortConfig)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get total count
    const totalCount = await Announcement.countDocuments(baseFilter);
    const totalPages = Math.ceil(totalCount / limitNum);

    // Extract distinct categories for filters
    const categories = await Announcement.distinct("category", { createdBy: currentEmployee._id });

    res.status(200).json({
      success: true,
      message: "My created announcements fetched successfully",
      total: totalCount,
      announcements,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
        limit: limitNum,
      },
      filters: { categories: categories.filter(Boolean) },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// export const getAllAnnouncements = async (req, res) => {
//     try {
//         const { category, isActive, page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc" } = req.query;
        
//         let filter = {};

//         if (category && category !== "All") {
//             filter.category = category;
//         }
//      // Active status filter - only apply if isActive is explicitly provided
//         if (isActive !== undefined && isActive !== "") {
//             filter.isActive = isActive === "true";
//         }

//         const sortConfig = {};
//         sortConfig[sortBy] = sortOrder === "desc" ? -1 : 1;

//         const pageNum = parseInt(page);
//         const limitNum = parseInt(limit);
//         const skip = (pageNum - 1) * limitNum;

//         const announcements = await Announcement.find(filter)
//             .populate("createdBy", "name.first name.last employeeId designation department")
//             .populate("updatedBy", "name.first name.last employeeId designation")
//             .populate("audience.departments", "name")
//             .populate("audience.designations", "name")
//             .sort(sortConfig)
//             .skip(skip)
//             .limit(limitNum)
//             .lean();

//         const totalCount = await Announcement.countDocuments(filter);
//         const categories = await Announcement.distinct("category", filter);
//         const totalPages = Math.ceil(totalCount / limitNum);

//         res.status(200).json({
//             success: true,
//             message: "Announcements fetched successfully",
//             total: totalCount,
//             announcements,
//             pagination: {
//                 currentPage: pageNum,
//                 totalPages,
//                 totalCount,
//                 hasNext: pageNum < totalPages,
//                 hasPrev: pageNum > 1,
//                 limit: limitNum
//             },
//             filters: {
//                 categories: categories.filter(cat => cat)
//             }
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: "Server error",
//             error: error.message
//         });
//     }
// };

// export const getMyAnnouncements = async (req, res) => {
//     try {
//         const { category, page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc" } = req.query;
//         const currentEmployee = req.employee;

//         const baseFilter = { isActive: true };

//         if (category && category !== "All") {
//             baseFilter.category = category;
//         }

//         const allAnnouncements = await Announcement.find(baseFilter)
//             .populate("createdBy", "name.first name.last employeeId designation department")
//             .populate("audience.departments", "name")
//             .populate("audience.designations", "name")
//             .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
//             .lean();

//         const filteredAnnouncements = allAnnouncements.filter(announcement => {
//             const { audience } = announcement;

//             if (audience.allEmployees) return true;

//             if (audience.departments?.length > 0) {
//                 const departmentIds = audience.departments.map(dept => dept._id.toString());
//                 if (currentEmployee.department && departmentIds.includes(currentEmployee.department.toString())) {
//                     return true;
//                 }
//             }

//             if (audience.designations?.length > 0) {
//                 const designationIds = audience.designations.map(desig => desig._id.toString());
//                 if (currentEmployee.designation && designationIds.includes(currentEmployee.designation.toString())) {
//                     return true;
//                 }
//             }

//             if (audience.roles?.length > 0) {
//                 if (audience.roles.includes(currentEmployee.role)) return true;
//             }

//             return false;
//         });

//         const pageNum = parseInt(page);
//         const limitNum = parseInt(limit);
//         const startIndex = (pageNum - 1) * limitNum;
//         const endIndex = startIndex + limitNum;

//         const paginatedAnnouncements = filteredAnnouncements.slice(startIndex, endIndex);
//         const categories = [...new Set(filteredAnnouncements.map(ann => ann.category).filter(cat => cat))];

//         res.status(200).json({
//             success: true,
//             message: "Announcements fetched successfully",
//             total: filteredAnnouncements.length,
//             announcements: paginatedAnnouncements,
//             pagination: {
//                 currentPage: pageNum,
//                 totalPages: Math.ceil(filteredAnnouncements.length / limitNum),
//                 totalCount: filteredAnnouncements.length,
//                 hasNext: endIndex < filteredAnnouncements.length,
//                 hasPrev: pageNum > 1,
//                 limit: limitNum
//             },
//             filters: { categories }
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: "Server error",
//             error: error.message
//         });
//     }
// };

export const getAnnouncementById = async (req, res) => {
    try {
        const announcement = await Announcement.findById(req.params.id)
            .populate("createdBy", "name.first name.last employeeId designation department")
            .populate("updatedBy", "name.first name.last employeeId designation")
            .populate("audience.departments", "name")
            .populate("audience.designations", "name");

        if (!announcement) {
            return res.status(404).json({
                success: false,
                message: "Announcement not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Announcement fetched successfully",
            announcement
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

export const updateAnnouncement = async (req, res) => {
    try {
        const { title, message, audience, category, isActive } = req.body;

        const announcement = await Announcement.findById(req.params.id);

        if (!announcement) {
            return res.status(404).json({
                success: false,
                message: "Announcement not found"
            });
        }

        if (audience && !audience.allEmployees &&
            (!audience.departments || audience.departments.length === 0) &&
            (!audience.designations || audience.designations.length === 0) &&
            (!audience.roles || audience.roles.length === 0)) {
            return res.status(400).json({
                success: false,
                message: "Specify at least one audience criteria"
            });
        }

        if (title !== undefined) announcement.title = title;
        if (message !== undefined) announcement.message = message;
        if (audience !== undefined) announcement.audience = audience;
        if (category !== undefined) announcement.category = category;
        if (isActive !== undefined) announcement.isActive = isActive;

        announcement.updatedBy = req.employee._id;

        await announcement.save();

        const updatedAnnouncement = await Announcement.findById(announcement._id)
            .populate("createdBy", "name.first name.last employeeId designation department")
            .populate("updatedBy", "name.first name.last employeeId designation")
            .populate("audience.departments", "name")
            .populate("audience.designations", "name");

        res.status(200).json({
            success: true,
            message: "Announcement updated successfully",
            announcement: updatedAnnouncement
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

export const deleteAnnouncement = async (req, res) => {
    try {
        const announcement = await Announcement.findById(req.params.id);

        if (!announcement) {
            return res.status(404).json({
                success: false,
                message: "Announcement not found"
            });
        }

        await Announcement.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: "Announcement deleted successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

export const toggleAnnouncementStatus = async (req, res) => {
    try {
        const announcement = await Announcement.findById(req.params.id);

        if (!announcement) {
            return res.status(404).json({
                success: false,
                message: "Announcement not found"
            });
        }

        announcement.isActive = !announcement.isActive;
        announcement.updatedBy = req.employee._id;

        await announcement.save();

        const updatedAnnouncement = await Announcement.findById(announcement._id)
            .populate("createdBy", "name.first name.last employeeId designation department")
            .populate("updatedBy", "name.first name.last employeeId designation");

        res.status(200).json({
            success: true,
            message: `Announcement ${announcement.isActive ? 'activated' : 'deactivated'} successfully`,
            announcement: updatedAnnouncement
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

export const getAnnouncementStats = async (req, res) => {
    try {
        const totalAnnouncements = await Announcement.countDocuments();
        const activeAnnouncements = await Announcement.countDocuments({ isActive: true });
        const inactiveAnnouncements = await Announcement.countDocuments({ isActive: false });

        const categories = await Announcement.aggregate([
            { $group: { _id: "$category", count: { $sum: 1 } } },
            { $project: { category: "$_id", count: 1, _id: 0 } }
        ]);

        res.status(200).json({
            success: true,
            message: "Announcement statistics fetched successfully",
            stats: {
                total: totalAnnouncements,
                active: activeAnnouncements,
                inactive: inactiveAnnouncements,
                categories
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

// NEW FUNCTION: Get HR-specific announcement stats
export const getMyAnnouncementStats = async (req, res) => {
    try {
        const currentEmployee = req.employee;
        
        // Filter by current user's created announcements
        const filter = { createdBy: currentEmployee._id };
        
        const totalAnnouncements = await Announcement.countDocuments(filter);
        const activeAnnouncements = await Announcement.countDocuments({ ...filter, isActive: true });
        const inactiveAnnouncements = await Announcement.countDocuments({ ...filter, isActive: false });

        const categories = await Announcement.aggregate([
            { $match: filter },
            { $group: { _id: "$category", count: { $sum: 1 } } },
            { $project: { category: "$_id", count: 1, _id: 0 } }
        ]);

        res.status(200).json({
            success: true,
            message: "My announcement statistics fetched successfully",
            stats: {
                total: totalAnnouncements,
                active: activeAnnouncements,
                inactive: inactiveAnnouncements,
                categories
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

// NEW FUNCTION: Get HR-managed employees for announcements
export const getHRManagedEmployees = async (req, res) => {
    try {
        console.log('HR Managed Employees - Start');
        const { role, _id: hrId } = req.employee;
        console.log('HR ID:', hrId, 'Role:', role);
        
        if (role !== "HR_Manager") {
            return res.status(403).json({
                success: false,
                message: "Access denied. Only HR Managers can access this data."
            });
        }

        // Get employees added by this HR
        const employees = await Employee.find({ addedBy: hrId, isActive: true })
            .select('name employeeId department designation role')
            .lean();

        console.log('Found employees:', employees.length);

        res.status(200).json({
            success: true,
            message: "HR managed employees fetched successfully",
            data: {
                employees,
                totalEmployees: employees.length,
                departments: [],
                designations: [],
                roles: []
            }
        });
    } catch (error) {
        console.error('HR Managed Employees Error:', error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

// NEW FUNCTION: Create HR-scoped announcement
export const createHRScopedAnnouncement = async (req, res) => {
    try {
        const { title, message, audience, category, isActive = true } = req.body;
        const { role, _id: hrId } = req.employee;

        if (role !== "HR_Manager") {
            return res.status(403).json({
                success: false,
                message: "Access denied. Only HR Managers can create scoped announcements."
            });
        }

        if (!title || !message) {
            return res.status(400).json({
                success: false,
                message: "Title and message are required"
            });
        }

        // Get HR-managed employees
        const hrEmployees = await Employee.find({ addedBy: hrId, isActive: true }).select('_id');
        const hrEmployeeIds = hrEmployees.map(emp => emp._id);

        if (hrEmployeeIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No employees found under your management"
            });
        }

        // Create announcement with HR scope
        const announcement = await Announcement.create({
            title,
            message,
            audience: audience || { allEmployees: true },
            category,
            isActive,
            createdBy: hrId,
            hrScope: {
                managedBy: hrId,
                targetEmployees: hrEmployeeIds
            }
        });

        const populatedAnnouncement = await Announcement.findById(announcement._id)
            .populate("createdBy", "name.first name.last employeeId designation")
            .populate("audience.departments", "name")
            .populate("audience.designations", "name");

        res.status(201).json({
            success: true,
            message: "HR-scoped announcement created successfully",
            announcement: populatedAnnouncement
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

// NEW FUNCTION: Get HR-scoped announcements
export const getHRScopedAnnouncements = async (req, res) => {
    try {
        console.log('HR Scoped Announcements - Start');
        const { role, _id: hrId } = req.employee;
        console.log('HR ID:', hrId, 'Role:', role);

        if (role !== "HR_Manager") {
            return res.status(403).json({
                success: false,
                message: "Access denied. Only HR Managers can access scoped announcements."
            });
        }

        const filter = {
            createdBy: hrId
        };

        const announcements = await Announcement.find(filter)
            .populate("createdBy", "name.first name.last employeeId")
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        console.log('Found announcements:', announcements.length);

        res.status(200).json({
            success: true,
            message: "HR-scoped announcements fetched successfully",
            total: announcements.length,
            announcements,
            pagination: {
                currentPage: 1,
                totalPages: 1,
                totalCount: announcements.length,
                hasNext: false,
                hasPrev: false,
                limit: 10,
            },
            filters: {
                categories: [],
            },
        });
    } catch (error) {
        console.error('HR Scoped Announcements Error:', error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

// NEW FUNCTION: Get filtered announcements for employees (only from their HR)
export const getEmployeeFilteredAnnouncements = async (req, res) => {
    try {
        const {
            category,
            search,
            page = 1,
            limit = 10,
            sortBy = "createdAt",
            sortOrder = "desc",
        } = req.query;
        const currentEmployee = req.employee;

        // Find who added this employee (their HR)
        const employeeData = await Employee.findById(currentEmployee._id).populate('addedBy', '_id role');
        
        if (!employeeData || !employeeData.addedBy) {
            return res.status(400).json({
                success: false,
                message: "No HR manager found for this employee"
            });
        }

        const hrManagerId = employeeData.addedBy._id;

        // Base filter (only active announcements from their HR)
        const baseFilter = { 
            isActive: true,
            createdBy: hrManagerId // Only announcements from their HR
        };

        // Filter by category
        if (category) {
            baseFilter.category = category;
        }

        // Search filter
        if (search && search.trim() !== "") {
            const regex = new RegExp(search, "i");
            baseFilter.$or = [
                { title: regex },
                { message: regex },
                { category: regex },
            ];
        }

        // Sorting
        const sortConfig = {};
        sortConfig[sortBy] = sortOrder === "desc" ? -1 : 1;

        // Fetch all announcements first
        const allAnnouncements = await Announcement.find(baseFilter)
            .populate("createdBy", "name.first name.last employeeId designation department")
            .populate("audience.departments", "name")
            .populate("audience.designations", "name")
            .sort(sortConfig)
            .lean();

        // Filter announcements based on audience (visibility)
        const filteredAnnouncements = allAnnouncements.filter((announcement) => {
            const { audience } = announcement;

            if (audience.allEmployees) return true;

            // Department match
            if (audience.departments?.length > 0) {
                const departmentIds = audience.departments.map((d) => d._id.toString());
                if (
                    currentEmployee.department &&
                    departmentIds.includes(currentEmployee.department.toString())
                ) {
                    return true;
                }
            }

            // Designation match
            if (audience.designations?.length > 0) {
                const designationIds = audience.designations.map((d) => d._id.toString());
                if (
                    currentEmployee.designation &&
                    designationIds.includes(currentEmployee.designation.toString())
                ) {
                    return true;
                }
            }

            // Role match
            if (audience.roles?.length > 0) {
                if (audience.roles.includes(currentEmployee.role)) return true;
            }

            return false;
        });

        // Pagination
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const startIndex = (pageNum - 1) * limitNum;
        const endIndex = startIndex + limitNum;
        const paginatedAnnouncements = filteredAnnouncements.slice(startIndex, endIndex);

        // Extract distinct categories for filters
        const categories = [
            ...new Set(filteredAnnouncements.map((a) => a.category).filter(Boolean)),
        ];

        res.status(200).json({
            success: true,
            message: "Employee filtered announcements fetched successfully",
            total: filteredAnnouncements.length,
            announcements: paginatedAnnouncements,
            pagination: {
                currentPage: pageNum,
                totalPages: Math.ceil(filteredAnnouncements.length / limitNum),
                totalCount: filteredAnnouncements.length,
                hasNext: endIndex < filteredAnnouncements.length,
                hasPrev: pageNum > 1,
                limit: limitNum,
            },
            filters: { categories },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

// NEW FUNCTION: Get announcements created by the logged-in user
export const getMyCreatedAnnouncements = async (req, res) => {
    try {
        const {
            category,
            search,
            page = 1,
            limit = 10,
            sortBy = "createdAt",
            sortOrder = "desc",
        } = req.query;
        const currentEmployee = req.employee;

        // Base filter (only announcements created by the logged-in user)
        const baseFilter = { 
            createdBy: currentEmployee._id
        };

        // Filter by category
        if (category) {
            baseFilter.category = category;
        }

        // Search filter
        if (search && search.trim() !== "") {
            const regex = new RegExp(search, "i");
            baseFilter.$or = [
                { title: regex },
                { message: regex },
                { category: regex },
            ];
        }

        // Sorting
        const sortConfig = {};
        sortConfig[sortBy] = sortOrder === "desc" ? -1 : 1;

        // Pagination
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Fetch announcements created by the user
        const announcements = await Announcement.find(baseFilter)
            .populate("createdBy", "name.first name.last employeeId designation department")
            .populate("audience.departments", "name")
            .populate("audience.designations", "name")
            .sort(sortConfig)
            .skip(skip)
            .limit(limitNum)
            .lean();

        // Get total count
        const totalCount = await Announcement.countDocuments(baseFilter);
        const totalPages = Math.ceil(totalCount / limitNum);

        // Extract distinct categories for filters
        const categories = await Announcement.distinct("category", { createdBy: currentEmployee._id });

        res.status(200).json({
            success: true,
            message: "My created announcements fetched successfully",
            total: totalCount,
            announcements,
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalCount,
                hasNext: pageNum < totalPages,
                hasPrev: pageNum > 1,
                limit: limitNum,
            },
            filters: { categories: categories.filter(Boolean) },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};