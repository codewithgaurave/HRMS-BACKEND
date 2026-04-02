import mongoose from "mongoose";

const assetCategorySchema = new mongoose.Schema(
  {
    name: {
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

assetCategorySchema.index({ name: 1, hrId: 1 }, { unique: true });

const AssetCategory = mongoose.model("AssetCategory", assetCategorySchema);
export default AssetCategory;
