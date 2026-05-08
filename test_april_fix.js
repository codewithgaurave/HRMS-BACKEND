import mongoose from 'mongoose';
import Attendance from './models/Attendance.js';
import dotenv from 'dotenv';

dotenv.config();

async function testAprilQuery() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    // Test April 2026 query with proper UTC handling
    const startDate = new Date('2026-04-01');
    const endDate = new Date('2026-04-30');
    
    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    console.log('=== APRIL 2026 QUERY TEST ===');
    console.log('Start Date (UTC):', startDate.toISOString());
    console.log('End Date (UTC):', endDate.toISOString());

    const aprilRecords = await Attendance.find({
      date: { $gte: startDate, $lte: endDate }
    }).select('date employee status').limit(5);

    console.log(`\nRecords found: ${aprilRecords.length}`);
    
    if (aprilRecords.length > 0) {
      console.log('\nSample records:');
      aprilRecords.forEach((record, idx) => {
        console.log(`${idx + 1}. Date: ${record.date.toISOString()}, Status: ${record.status}`);
      });
    }

    // Get total count for April
    const totalApril = await Attendance.countDocuments({
      date: { $gte: startDate, $lte: endDate }
    });
    console.log(`\nTotal April 2026 records: ${totalApril}`);

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

testAprilQuery();
