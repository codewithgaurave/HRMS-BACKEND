import AssetCategory from "../models/AssetCategory.js";

export const createAssetCategory = async (req, res) => {
  try {
    const { name, description, status } = req.body;
    if (!name) return res.status(400).json({ message: "Category name is required" });

    const exists = await AssetCategory.findOne({ name, hrId: req.employee._id });
    if (exists) return res.status(400).json({ message: "Asset category already exists" });

    const category = await AssetCategory.create({
      name,
      description,
      status,
      createdBy: req.employee._id,
      hrId: req.employee._id,
    });

    res.status(201).json({ message: "Asset category created", category });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const getAssetCategories = async (req, res) => {
  try {
    const {
      search,
      status,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 10,
    } = req.query;

    const filter = { hrId: req.employee._id };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }
    if (status) filter.status = status;

    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === "desc" ? -1 : 1;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const categories = await AssetCategory.find(filter)
      .populate("createdBy", "name.first name.last employeeId role")
      .sort(sortConfig)
      .skip(skip)
      .limit(limitNum);

    const totalCount = await AssetCategory.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limitNum);

    res.json({
      categories,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
        limit: limitNum,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const getAssetCategoryById = async (req, res) => {
  try {
    const category = await AssetCategory.findOne({
      _id: req.params.id,
      hrId: req.employee._id,
    }).populate("createdBy", "name.first name.last employeeId");

    if (!category) return res.status(404).json({ message: "Asset category not found" });

    res.json(category);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const updateAssetCategory = async (req, res) => {
  try {
    const { name, description, status } = req.body;

    const updated = await AssetCategory.findOneAndUpdate(
      { _id: req.params.id, hrId: req.employee._id },
      { name, description, status },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Asset category not found" });

    res.json({ message: "Asset category updated", category: updated });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const deleteAssetCategory = async (req, res) => {
  try {
    const deleted = await AssetCategory.findOneAndDelete({
      _id: req.params.id,
      hrId: req.employee._id,
    });

    if (!deleted) return res.status(404).json({ message: "Asset category not found" });

    res.json({ message: "Asset category deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
