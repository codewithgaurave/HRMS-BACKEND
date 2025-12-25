import mongoose from 'mongoose';

const assetRequestSchema = new mongoose.Schema({
  requestId: {
    type: String,
    unique: true,
    required: true
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  requestType: {
    type: String,
    enum: ['New', 'Replacement'],
    required: true
  },
  assetCategory: {
    type: String,
    enum: ['Laptop', 'Desktop', 'Mobile', 'Tablet', 'Monitor', 'Keyboard', 'Mouse', 'Headphones', 'Other'],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  justification: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium'
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Fulfilled'],
    default: 'Pending'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  approvalDate: {
    type: Date
  },
  rejectionReason: {
    type: String
  },
  fulfilledDate: {
    type: Date
  },
  assignedAsset: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Asset'
  }
}, {
  timestamps: true
});

export default mongoose.model('AssetRequest', assetRequestSchema);