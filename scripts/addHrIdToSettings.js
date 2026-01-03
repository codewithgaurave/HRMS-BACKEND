import mongoose from 'mongoose';
import Employee from '../models/Employee.js';
import Department from '../models/Department.js';
import Designation from '../models/Designation.js';
import EmploymentStatus from '../models/EmploymentStatus.js';
import WorkShift from '../models/WorkShift.js';
import OfficeLocation from '../models/OfficeLocation.js';
import LeavePolicy from '../models/LeavePolicy.js';

const addHrIdToSettings = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms');
    
    // Find the first HR user to assign existing data to
    const hrUser = await Employee.findOne({ role: 'HR_Manager' });
    
    if (!hrUser) {
      console.log('No HR user found. Please create an HR user first.');
      return;
    }
    
    console.log(`Assigning existing data to HR: ${hrUser.name.first} ${hrUser.name.last}`);
    
    // Update all existing records to include hrId
    const updates = [
      Department.updateMany({ hrId: { $exists: false } }, { hrId: hrUser._id }),
      Designation.updateMany({ hrId: { $exists: false } }, { hrId: hrUser._id }),
      EmploymentStatus.updateMany({ hrId: { $exists: false } }, { hrId: hrUser._id }),
      WorkShift.updateMany({ hrId: { $exists: false } }, { hrId: hrUser._id }),
      OfficeLocation.updateMany({ hrId: { $exists: false } }, { hrId: hrUser._id }),
      LeavePolicy.updateMany({ hrId: { $exists: false } }, { hrId: hrUser._id })
    ];
    
    const results = await Promise.all(updates);
    
    console.log('Migration completed:');
    console.log(`Departments updated: ${results[0].modifiedCount}`);
    console.log(`Designations updated: ${results[1].modifiedCount}`);
    console.log(`Employment Statuses updated: ${results[2].modifiedCount}`);
    console.log(`Work Shifts updated: ${results[3].modifiedCount}`);
    console.log(`Office Locations updated: ${results[4].modifiedCount}`);
    console.log(`Leave Policies updated: ${results[5].modifiedCount}`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
  }
};

addHrIdToSettings();