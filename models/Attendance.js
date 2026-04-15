import mongoose from "mongoose";
import WorkShift from "./WorkShift.js";

const attendanceSchema = new mongoose.Schema({
  // Employee Reference
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee",
    required: [true, "Employee is required"]
  },

  // Date Information
  date: {
    type: Date,
    required: [true, "Attendance date is required"],
    index: true
  },

  // Punch-in Information
  punchIn: {
    timestamp: {
      type: Date,
      required: [true, "Punch-in time is required"]
    },
    coordinates: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true }
    },
  },

  // Punch-out Information
  punchOut: {
    timestamp: {
      type: Date
    },
    coordinates: {
      latitude: { type: Number },
      longitude: { type: Number }
    },
  },

  // Work Duration Calculations
  totalWorkHours: {
    type: Number, // in hours
    default: 0
  },
  overtimeHours: {
    type: Number, // in hours
    default: 0
  },

  // Attendance Status
  status: {
    type: String,
    enum: [
      "Present",
      "Absent",
      "Half Day",
      "Late",
      "Early Departure",
      "Holiday",
      "Week Off",
      "On Leave"
    ],
    default: "Present"
  },

  // Early Departure Information
  earlyDepartureMinutes: {
    type: Number,
    default: 0
  },
  earlyDepartureReason: {
    type: String,
    trim: true,
    maxlength: 500
  },

  // Shift Information
  shift: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "WorkShift",
    required: true
  },

  // Location Validation
  isWithinOfficeLocation: {
    type: Boolean,
    default: false
  },
  officeLocation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "OfficeLocation",
    required: true
  },

  isActive: {
    type: Boolean,
    default: true
  }

}, {
  timestamps: true
});

// Compound Index for unique attendance per employee per day
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

// Index for better query performance
attendanceSchema.index({ date: 1, status: 1 });
attendanceSchema.index({ employee: 1, date: -1 });
attendanceSchema.index({ officeLocation: 1 });
attendanceSchema.index({ status: 1 });

// Virtual for calculating work hours
attendanceSchema.virtual('calculatedWorkHours').get(function() {
  if (!this.punchIn || !this.punchOut || !this.punchIn.timestamp || !this.punchOut.timestamp) {
    return 0;
  }
  
  const diffMs = this.punchOut.timestamp - this.punchIn.timestamp;
  return diffMs / (1000 * 60 * 60); // Convert ms to hours
});

// Pre-save middleware to calculate work hours
attendanceSchema.pre('save', async function(next) {
  if (this.punchIn && this.punchOut && this.punchIn.timestamp && this.punchOut.timestamp) {
    const workHours = this.calculatedWorkHours;
    this.totalWorkHours = Math.max(0, workHours);

    // Overtime = actual work hours minus shift duration (fetched from DB)
    try {
      const shift = await WorkShift.findById(this.shift).select('startTime endTime');
      if (shift && shift.startTime && shift.endTime) {
        const [sH, sM] = shift.startTime.split(':').map(Number);
        const [eH, eM] = shift.endTime.split(':').map(Number);
        const shiftDurationHours = (eH * 60 + eM - (sH * 60 + sM)) / 60;
        this.overtimeHours = Math.max(0, workHours - shiftDurationHours);
      } else {
        this.overtimeHours = Math.max(0, workHours - 8);
      }
    } catch (e) {
      this.overtimeHours = Math.max(0, workHours - 8);
    }
  }

  // Auto-calculate status
  await this.calculateAttendanceStatus();
  next();
});

// Static method to get attendance summary for an employee
attendanceSchema.statics.getEmployeeSummary = async function(employeeId, startDate, endDate) {
  const summary = await this.aggregate([
    {
      $match: {
        employee: new mongoose.Types.ObjectId(employeeId),
        date: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalHours: { $sum: "$totalWorkHours" },
        totalOvertime: { $sum: "$overtimeHours" }
      }
    }
  ]);
  
  return summary;
};

// Method to calculate attendance status
attendanceSchema.methods.calculateAttendanceStatus = async function() {
  if (!this.punchIn || !this.punchIn.timestamp) {
    this.status = "Absent";
    return;
  }

  // Fetch actual shift times from DB
  let shiftStart = { hours: 9, minutes: 0 };  // fallback
  let shiftEnd   = { hours: 18, minutes: 0 }; // fallback

  try {
    const shift = await WorkShift.findById(this.shift).select('startTime endTime');
    if (shift && shift.startTime && shift.endTime) {
      const [sH, sM] = shift.startTime.split(':').map(Number);
      const [eH, eM] = shift.endTime.split(':').map(Number);
      shiftStart = { hours: sH, minutes: sM };
      shiftEnd   = { hours: eH, minutes: eM };
    }
  } catch (e) { /* use fallback */ }

  const punchInTime = this.punchIn.timestamp;

  // Scheduled start on the same calendar date as punch-in
  const scheduledStart = new Date(punchInTime);
  scheduledStart.setHours(shiftStart.hours, shiftStart.minutes, 0, 0);

  // Late minutes
  const lateMinutes = Math.max(0, (punchInTime - scheduledStart) / (1000 * 60));

  // Early departure minutes (only when punched out)
  let earlyDepartureMinutes = 0;
  if (this.punchOut && this.punchOut.timestamp) {
    const punchOutTime = this.punchOut.timestamp;

    // Scheduled end on the same calendar date as punch-out
    const scheduledEnd = new Date(punchOutTime);
    scheduledEnd.setHours(shiftEnd.hours, shiftEnd.minutes, 0, 0);

    // Positive value means left before shift end, negative means stayed after (overtime)
    earlyDepartureMinutes = Math.max(0, (scheduledEnd - punchOutTime) / (1000 * 60));
    this.earlyDepartureMinutes = earlyDepartureMinutes;
  }

  // Determine status — priority: Late > Early Departure > Half Day > Present
  if (lateMinutes > 30) {
    this.status = "Late";
  } else if (earlyDepartureMinutes > 30) {
    this.status = "Early Departure";
  } else if (this.totalWorkHours < 4) {
    this.status = "Half Day";
  } else {
    this.status = "Present";
  }
};

const Attendance = mongoose.model("Attendance", attendanceSchema);
export default Attendance;