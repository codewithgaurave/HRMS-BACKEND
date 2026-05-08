import mongoose from 'mongoose';
import Attendance from './models/Attendance.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkAttendance() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check total attendance records
    const total = await Attendance.countDocuments();
    console.log('\n=== TOTAL ATTENDANCE RECORDS ===');
    console.log('Total records:', total);

    // Check records by month
    console.log('\n=== RECORDS BY MONTH ===');
    const monthlyStats = await Attendance.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    monthlyStats.forEach(stat => {
      const monthName = new Date(stat._id.year, stat._id.month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
      console.log(`${monthName}: ${stat.count} records`);
    });

    // Check April specifically
    console.log('\n=== APRIL RECORDS DETAILS ===');
    const aprilStart = new Date('2024-04-01');
    const aprilEnd = new Date('2024-04-30');
    aprilEnd.setHours(23, 59, 59, 999);

    const aprilRecords = await Attendance.find({
      date: { $gte: aprilStart, $lte: aprilEnd }
    }).select('date employee status').limit(10);

    console.log(`April records found: ${aprilRecords.length}`);
    if (aprilRecords.length > 0) {
      aprilRecords.forEach(record => {
        console.log(`- Date: ${record.date}, Employee: ${record.employee}, Status: ${record.status}`);
      });
    }

    // Check date range for April using different approach
    console.log('\n=== CHECKING DATE STORAGE FORMAT ===');
    const sampleRecords = await Attendance.find().select('date').limit(5);
    sampleRecords.forEach(record => {
      console.log(`Sample date: ${record.date}, Type: ${typeof record.date}, ISO: ${record.date.toISOString()}`);
    });

    // Check if there are any records at all
    console.log('\n=== DATE RANGE CHECK ===');
    const minDate = await Attendance.findOne().sort({ date: 1 }).select('date');
    const maxDate = await Attendance.findOne().sort({ date: -1 }).select('date');
    
    if (minDate) console.log('Earliest record:', minDate.date);
    if (maxDate) console.log('Latest record:', maxDate.date);

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkAttendance();
