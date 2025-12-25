import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const updateHRUser = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Database connected');
    
    const db = mongoose.connection.db;
    
    // Get required IDs
    const department = await db.collection('departments').findOne({ name: 'HR' });
    const designation = await db.collection('designations').findOne({ title: 'HR Manager' });
    const employmentStatus = await db.collection('employmentstatuses').findOne({ title: 'Full Time' });
    const officeLocation = await db.collection('officelocations').findOne({ officeName: 'Main Office' });
    const workShift = await db.collection('workshifts').findOne({ name: 'Morning Shift' });
    
    if (!department || !designation || !employmentStatus || !officeLocation || !workShift) {
      console.log('❌ Required master data not found');
      return;
    }
    
    // Update HR user
    const result = await db.collection('employees').updateOne(
      { email: 'gauravhr.digicoders@gmail.com' },
      {
        $set: {
          department: department._id,
          designation: designation._id,
          employmentStatus: employmentStatus._id,
          officeLocation: officeLocation._id,
          workShift: workShift._id,
          salary: 50000,
          addedBy: null, // HR is self-added
          updatedAt: new Date()
        }
      }
    );
    
    console.log('✅ HR user updated:', result.modifiedCount);
    
    // Also update leave policies with createdBy
    await db.collection('leavepolicies').updateMany(
      { createdBy: { $exists: false } },
      { $set: { createdBy: (await db.collection('employees').findOne({ email: 'gauravhr.digicoders@gmail.com' }))._id } }
    );
    
    console.log('✅ Leave policies updated with createdBy');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
};

updateHRUser();