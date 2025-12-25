import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const setupMasterData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Database connected');
    
    const db = mongoose.connection.db;
    
    // 1. Create Designations
    const designations = [
      { title: 'HR Manager', description: 'Human Resource Manager', status: 'Active' },
      { title: 'Software Developer', description: 'Software Development', status: 'Active' },
      { title: 'Team Leader', description: 'Team Leadership', status: 'Active' }
    ];
    
    for (const desig of designations) {
      await db.collection('designations').updateOne(
        { title: desig.title },
        { $setOnInsert: { ...desig, createdAt: new Date(), updatedAt: new Date() } },
        { upsert: true }
      );
    }
    console.log('✅ Designations created');
    
    // 2. Create Employment Status
    const empStatuses = [
      { title: 'Full Time', description: 'Full time employee', status: 'Active' },
      { title: 'Part Time', description: 'Part time employee', status: 'Active' },
      { title: 'Contract', description: 'Contract employee', status: 'Active' }
    ];
    
    for (const status of empStatuses) {
      await db.collection('employmentstatuses').updateOne(
        { title: status.title },
        { $setOnInsert: { ...status, createdAt: new Date(), updatedAt: new Date() } },
        { upsert: true }
      );
    }
    console.log('✅ Employment Statuses created');
    
    // 3. Create Work Shifts
    const workShifts = [
      { name: 'Morning Shift', startTime: '09:00', endTime: '18:00', status: 'Active' },
      { name: 'Evening Shift', startTime: '14:00', endTime: '23:00', status: 'Active' }
    ];
    
    for (const shift of workShifts) {
      await db.collection('workshifts').updateOne(
        { name: shift.name },
        { $setOnInsert: { ...shift, createdAt: new Date(), updatedAt: new Date() } },
        { upsert: true }
      );
    }
    console.log('✅ Work Shifts created');
    
    // 4. Create Office Location
    const officeLocation = {
      officeName: 'Main Office',
      officeAddress: 'Lucknow, UP, India',
      latitude: 26.8467,
      longitude: 80.9462,
      officeType: 'Office',
      branchCode: 'LKO001'
    };
    
    await db.collection('officelocations').updateOne(
      { officeName: officeLocation.officeName },
      { $setOnInsert: { ...officeLocation, createdAt: new Date(), updatedAt: new Date() } },
      { upsert: true }
    );
    console.log('✅ Office Location created');
    
    // 5. Create Leave Policies
    const leavePolicies = [
      { leaveType: 'Casual', maxLeavesPerYear: 12, genderRestriction: 'All', carryForward: false },
      { leaveType: 'Sick', maxLeavesPerYear: 10, genderRestriction: 'All', carryForward: false },
      { leaveType: 'Earned', maxLeavesPerYear: 15, genderRestriction: 'All', carryForward: true }
    ];
    
    for (const policy of leavePolicies) {
      await db.collection('leavepolicies').updateOne(
        { leaveType: policy.leaveType },
        { $setOnInsert: { ...policy, createdAt: new Date(), updatedAt: new Date() } },
        { upsert: true }
      );
    }
    console.log('✅ Leave Policies created');
    
    console.log('🎉 Master data setup completed!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
};

setupMasterData();