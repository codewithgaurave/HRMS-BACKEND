import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "../config/db.js";
import Attendance from "../models/Attendance.js";
import WorkShift from "../models/WorkShift.js";

dotenv.config();

const recalculateAllAttendance = async () => {
  await connectDB();
  console.log("✅ DB Connected");

  // Fetch all records that have both punchIn and punchOut
  const records = await Attendance.find({
    "punchIn.timestamp": { $exists: true },
    "punchOut.timestamp": { $exists: true }
  }).lean();

  console.log(`📋 Total records to process: ${records.length}`);

  // Pre-fetch all shifts to avoid repeated DB calls
  const shifts = await WorkShift.find({}).select("_id startTime endTime").lean();
  const shiftMap = {};
  shifts.forEach(s => { shiftMap[s._id.toString()] = s; });

  let updated = 0;
  let skipped = 0;

  for (const rec of records) {
    const shift = shiftMap[rec.shift?.toString()];

    let shiftStart = { hours: 9, minutes: 0 };
    let shiftEnd   = { hours: 18, minutes: 0 };

    if (shift?.startTime && shift?.endTime) {
      const [sH, sM] = shift.startTime.split(":").map(Number);
      const [eH, eM] = shift.endTime.split(":").map(Number);
      shiftStart = { hours: sH, minutes: sM };
      shiftEnd   = { hours: eH, minutes: eM };
    }

    const punchInTime  = new Date(rec.punchIn.timestamp);
    const punchOutTime = new Date(rec.punchOut.timestamp);

    // Work hours
    const workHours = Math.max(0, (punchOutTime - punchInTime) / (1000 * 60 * 60));

    // Shift duration for overtime
    const shiftDurationHours = (shiftEnd.hours * 60 + shiftEnd.minutes - (shiftStart.hours * 60 + shiftStart.minutes)) / 60;
    const overtimeHours = Math.max(0, workHours - shiftDurationHours);

    // Late minutes
    const scheduledStart = new Date(punchInTime);
    scheduledStart.setHours(shiftStart.hours, shiftStart.minutes, 0, 0);
    const lateMinutes = Math.max(0, (punchInTime - scheduledStart) / (1000 * 60));

    // Early departure minutes
    const scheduledEnd = new Date(punchOutTime);
    scheduledEnd.setHours(shiftEnd.hours, shiftEnd.minutes, 0, 0);
    const earlyDepartureMinutes = Math.max(0, (scheduledEnd - punchOutTime) / (1000 * 60));

    // New status
    let newStatus;
    if (lateMinutes > 30) {
      newStatus = "Late";
    } else if (earlyDepartureMinutes > 30) {
      newStatus = "Early Departure";
    } else if (workHours < 4) {
      newStatus = "Half Day";
    } else {
      newStatus = "Present";
    }

    // Only update if something changed
    if (
      rec.status !== newStatus ||
      Math.abs((rec.totalWorkHours || 0) - workHours) > 0.001 ||
      Math.abs((rec.overtimeHours || 0) - overtimeHours) > 0.001 ||
      Math.abs((rec.earlyDepartureMinutes || 0) - earlyDepartureMinutes) > 0.1
    ) {
      await Attendance.updateOne(
        { _id: rec._id },
        {
          $set: {
            status: newStatus,
            totalWorkHours: workHours,
            overtimeHours: overtimeHours,
            earlyDepartureMinutes: earlyDepartureMinutes
          }
        }
      );
      console.log(`  ✔ [${rec._id}] ${rec.status} → ${newStatus} | work: ${workHours.toFixed(2)}h | overtime: ${overtimeHours.toFixed(2)}h | earlyDep: ${earlyDepartureMinutes.toFixed(0)}min`);
      updated++;
    } else {
      skipped++;
    }
  }

  console.log(`\n✅ Done. Updated: ${updated} | Skipped (no change): ${skipped}`);
  process.exit(0);
};

recalculateAllAttendance().catch(err => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
