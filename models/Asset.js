import mongoose from 'mongoose';

const assetSchema = new mongoose.Schema({
  assetId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Laptop', 'Desktop', 'Mobile', 'Tablet', 'T-Shirt', 'Uniform', 'ID Card', 'Access Card', 'Headphones', 'Monitor', 'Keyboard', 'Mouse', 'Charger', 'Other']
  },
  brand: {
    type: String,
    trim: true
  },
  model: {
    type: String,
    trim: true
  },
  serialNumber: {
    type: String,
    trim: true
  },
  purchaseDate: {
    type: Date
  },
  purchasePrice: {
    type: Number,
    min: 0
  },
  condition: {
    type: String,
    enum: ['New', 'Good', 'Fair', 'Poor', 'Damaged'],
    default: 'New'
  },
  status: {
    type: String,
    enum: ['Available', 'Assigned', 'Under Maintenance', 'Retired'],
    default: 'Available'
  },
  assignedTo: [{
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    assignedDate: {
      type: Date,
      default: Date.now
    },
    returnDate: {
      type: Date
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  location: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  warranty: {
    startDate: Date,
    endDate: Date,
    provider: String
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  }
}, {
  timestamps: true
});

// Index for better performance
assetSchema.index({ assetId: 1 });
assetSchema.index({ category: 1 });
assetSchema.index({ status: 1 });
assetSchema.index({ assignedTo: 1 });

export default mongoose.model('Asset', assetSchema);