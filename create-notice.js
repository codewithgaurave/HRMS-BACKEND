// Simple script to create a notice that should be visible to all employees
import mongoose from 'mongoose';
import Notice from './models/Notice.js';
import dotenv from 'dotenv';

dotenv.config();

const createSimpleNotice = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const notice = new Notice({
      title: "Welcome to HRMS System",
      content: "Welcome to our new HRMS system. Please explore all the features available to you including payroll, assets, and leave management.",
      type: "General",
      priority: "Medium",
      createdBy: "694ce2e28c312831c707d204", // Test employee ID
      targetAudience: "All",
      targetEmployees: [],
      targetDepartments: [],
      isActive: true,
      expiryDate: null
    });

    await notice.save();
    console.log('Notice created successfully:', notice);
    
    // Also create a simple notice without complex filtering
    const simpleNotice = new Notice({
      title: "System Update",
      content: "The system has been updated with new features. Please check out the new dashboard.",
      type: "Announcement",
      priority: "Low",
      createdBy: "694ce2e28c312831c707d204",
      targetAudience: "All",
      isActive: true
    });

    await simpleNotice.save();
    console.log('Simple notice created:', simpleNotice);
    
  } catch (error) {
    console.error('Error creating notice:', error);
  } finally {
    await mongoose.disconnect();
  }
};

createSimpleNotice();