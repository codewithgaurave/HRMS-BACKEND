import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Attendance from './models/Attendance.js';
import WorkShift from './models/WorkShift.js';

dotenv.config();

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

async function recalcStatus(attendance) {
  if (!attendance.punchIn?.timestamp) return 'Absent';

  let shiftStart = { hours: 9, minutes: 0 };
  let shiftEnd   = { hours: 18, minutes: 0 };

  try {
    const shift = await WorkShift.findById(attendance.shift).select('startTime endTime');
    if (shift?.startTime && shift?.endTime) {
      const [sH, sM] = shift.startTime.split(':').map(Number);
      const [eH, eM] = shift.endTime.split(':').map(Number);
      shiftStart = { hours: sH, minutes: sM };
      shiftEnd   = { hours: eH, minutes: eM };
    }
  } catch (e) {}

  const punchInUTC = new Date(attendance.punchIn.timestamp);
  const punchInIST = new Date(punchInUTC.getTime() + IST_OFFSET_MS);
  const scheduledStartIST = new Date(Date.UTC(punchInIST.getUTCFullYear(), punchInIST.getUTCMonth(), punchInIST.getUTCDate(), shiftStart.hours, shiftStart.minutes, 0, 0));
  const scheduledStartUTC = new Date(scheduledStartIST.getTime() - IST_OFFSET_MS);
  const lateMinutes = Math.max(0, (punchInUTC - scheduledStartUTC) / (1000 * 60));

  let earlyDepartureMinutes = 0;
  if (attendance.punchOut?.timestamp) {
    const punchOutUTC = new Date(attendance.punchOut.timestamp);
    const punchOutIST = new Date(punchOutUTC.getTime() + IST_OFFSET_MS);
    const scheduledEndIST = new Date(Date.UTC(punchOutIST.getUTCFullYear(), punchOutIST.getUTCMonth(), punchOutIST.getUTCDate(), shiftEnd.hours, shiftEnd.minutes, 0, 0));
    const scheduledEndUTC = new Date(scheduledEndIST.getTime() - IST_OFFSET_MS);
    earlyDepartureMinutes = Math.max(0, (scheduledEndUTC - punchOutUTC) / (1000 * 60));
  }

  if (lateMinutes > 30) return 'Late';
  if (earlyDepartureMinutes > 30) return 'Early Departure';
  if (attendance.totalWorkHours < 4) return 'Half Day';
  return 'Present';
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Find all Early Departure records
  const records = await Attendance.find({ status: 'Early Departure' });
  console.log(`Found ${records.length} Early Departure records`);

  let fixed = 0;
  for (const rec of records) {
    const newStatus = await recalcStatus(rec);
    if (newStatus !== 'Early Departure') {
      await Attendance.updateOne({ _id: rec._id }, { $set: { status: newStatus } });
      fixed++;
    }
  }

  console.log(`Fixed ${fixed} records`);
  await mongoose.disconnect();
}

run().catch(console.error);
