import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payroll from './models/Payroll.js';
import Attendance from './models/Attendance.js';
import Employee from './models/Employee.js';

dotenv.config();

const WORKING_DAYS = 30;

async function recalculate(month, year) {
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 1));

  const payrolls = await Payroll.find({ month, year });
  console.log(`Found ${payrolls.length} payrolls for ${month}/${year}`);

  let updated = 0;
  for (const payroll of payrolls) {
    const employee = await Employee.findById(payroll.employee);
    if (!employee) continue;

    const records = await Attendance.find({
      employee: payroll.employee,
      date: { $gte: startDate, $lt: endDate }
    });

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
    console.log(`  ${employee.employeeId} ${empName}: present=${effectivePresentDays}, OT=${overtimeHours.toFixed(2)}h, net=₹${grossSalary}`);
    updated++;
  }
  console.log(`Updated ${updated} payrolls for ${month}/${year}`);
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');

  await recalculate(5, 2026);
  await recalculate(4, 2026);
  await recalculate(3, 2026);

  await mongoose.disconnect();
  console.log('\nDone!');
}

run().catch(console.error);
