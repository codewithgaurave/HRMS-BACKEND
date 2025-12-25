import mongoose from 'mongoose';

const noticeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['General', 'Urgent', 'Policy', 'Event', 'Holiday'],
    default: 'General'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Medium'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  targetAudience: {
    type: String,
    enum: ['All', 'Department', 'Team', 'Individual'],
    default: 'All'
  },
  targetEmployees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  }],
  targetDepartments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  expiryDate: {
    type: Date
  },
  readBy: [{
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

export default mongoose.model('Notice', noticeSchema);