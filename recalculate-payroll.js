import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payroll from './models/Payroll.js';
import Attendance from './models/Attendance.js';
import Employee from './models/Employee.js';

dotenv.config();

const WORKING_DAYS = 30;

// Use aggregation with $month/$year to handle mixed UTC date formats
async function getAttendanceForMonth(employeeId, month, year) {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

  // Approach: get all records where the IST date falls in target month
  // IST date = UTC date + 5:30, so we use a wide range and filter by IST month
  const startUTC = new Date(Date.UTC(year, month - 1, 1) - IST_OFFSET_MS);
  const endUTC = new Date(Date.UTC(year, month, 1) + IST_OFFSET_MS);

  const allRecords = await Attendance.find({
    employee: employeeId,
    date: { $gte: startUTC, $lte: endUTC }
  }).select('date status overtimeHours totalWorkHours');

  // Filter by actual IST month/year
  return allRecords.filter(r => {
    const istDate = new Date(r.date.getTime() + IST_OFFSET_MS);
    return istDate.getUTCMonth() + 1 === month && istDate.getUTCFullYear() === year;
  });
}

async function recalculate(month, year) {
  const payrolls = await Payroll.find({ month, year });
  console.log(`\nFound ${payrolls.length} payrolls for ${month}/${year}`);

  let updated = 0;
  for (const payroll of payrolls) {
    const employee = await Employee.findById(payroll.employee);
    if (!employee) continue;

    const records = await getAttendanceForMonth(payroll.employee, month, year);

    const presentDays = records.filter(a => ['Present', 'Late', 'Early Departure'].includes(a.status)).length;
    const halfDays = records.filter(a => a.status === 'Half Day').length;
    const effectivePresentDays = presentDays + (halfDays * 0.5);
    const leaveDays = records.filter(a => a.status === 'On Leave').length;
    const overtimeHours = records.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);

    const basicSalary = employee.salary || payroll.basicSalary || 0;
    const perDaySalary = basicSalary / WORKING_DAYS;
    const overtimeRate = (basicSalary / WORKING_DAYS / 8) * 1.5;
    const overtimeAmount = Math.round(overtimeHours * overtimeRate);
    const grossSalary = Math.round(perDaySalary * effectivePresentDays) + overtimeAmount;

    await Payroll.updateOne(
      { _id: payroll._id },
      {
        $set: {
          workingDays: WORKING_DAYS,
          presentDays: effectivePresentDays,
          leaveDays,
          overtimeHours: Math.round(overtimeHours * 100) / 100,
          overtimeAmount,
          grossSalary,
          netSalary: grossSalary
        }
      }
    );

    const empName = `${employee.name?.first} ${employee.name?.last}`;
    console.log(`  ${employee.employeeId} ${empName}: ${records.length} records, present=${effectivePresentDays}, OT=${overtimeHours.toFixed(2)}h, net=Rs${grossSalary}`);
    updated++;
  }
  console.log(`Updated ${updated} payrolls for ${month}/${year}`);
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  await recalculate(5, 2026);
  await recalculate(4, 2026);
  await recalculate(3, 2026);

  await mongoose.disconnect();
  console.log('\nDone!');
}

run().catch(console.error);
