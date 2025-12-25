import mongoose from 'mongoose';
import LeavePolicy from './models/LeavePolicy.js';
import Employee from './models/Employee.js';

const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/hrms');
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const addDefaultLeavePolicies = async () => {
  try {
    await connectDB();
    
    // Find an employee to use as createdBy (prefer HR, but use any if not found)
    let createdByEmployee = await Employee.findOne({ role: 'HR_Manager' });
    if (!createdByEmployee) {
      createdByEmployee = await Employee.findOne();
    }
    if (!createdByEmployee) {
      console.error('No employees found. Please create an employee first.');
      process.exit(1);
    }
    
    console.log('Using employee as createdBy:', createdByEmployee.name?.first, createdByEmployee.email);

    // Check if leave policies already exist
    const existingPolicies = await LeavePolicy.find();
    if (existingPolicies.length > 0) {
      console.log('Leave policies already exist:', existingPolicies.map(p => p.leaveType));
      process.exit(0);
    }

    const defaultPolicies = [
      {
        leaveType: 'Casual',
        maxLeavesPerYear: 12,
        genderRestriction: 'All',
        carryForward: true,
        description: 'Casual leave for personal work',
        createdBy: createdByEmployee._id
      },
      {
        leaveType: 'Sick',
        maxLeavesPerYear: 10,
        genderRestriction: 'All',
        carryForward: false,
        description: 'Medical leave for health issues',
        createdBy: createdByEmployee._id
      },
      {
        leaveType: 'Earned',
        maxLeavesPerYear: 21,
        genderRestriction: 'All',
        carryForward: true,
        description: 'Annual earned leave',
        createdBy: createdByEmployee._id
      },
      {
        leaveType: 'Maternity',
        maxLeavesPerYear: 180,
        genderRestriction: 'Female',
        carryForward: false,
        description: 'Maternity leave for female employees',
        createdBy: createdByEmployee._id
      },
      {
        leaveType: 'Paternity',
        maxLeavesPerYear: 15,
        genderRestriction: 'Male',
        carryForward: false,
        description: 'Paternity leave for male employees',
        createdBy: createdByEmployee._id
      }
    ];

    await LeavePolicy.insertMany(defaultPolicies);
    console.log('✅ Default leave policies created successfully!');
    
    const policies = await LeavePolicy.find();
    console.log('Available leave policies:');
    policies.forEach(policy => {
      console.log(`- ${policy.leaveType}: ${policy.maxLeavesPerYear} days/year (${policy.genderRestriction})`);
    });
    
  } catch (error) {
    console.error('Error creating leave policies:', error);
  } finally {
    mongoose.connection.close();
  }
};

addDefaultLeavePolicies();