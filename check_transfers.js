import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load env from HRMS-BACKEND
dotenv.config({ path: 'd:/Desktop/HRMS2/HRMS-BACKEND/.env' });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms';

const assetSchema = new mongoose.Schema({
  name: String,
  assetId: String,
  pendingTransfer: {
    toEmployee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    fromEmployee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    transferType: String,
    status: String,
    requestDate: Date
  }
});

const employeeSchema = new mongoose.Schema({
  name: { first: String, last: String },
  employeeId: String
});

const Asset = mongoose.model('Asset', assetSchema);
const Employee = mongoose.model('Employee', employeeSchema);

async function checkPendingTransfers() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to DB');

    const assets = await Asset.find({ 'pendingTransfer': { $exists: true, $ne: null } })
      .populate('pendingTransfer.toEmployee', 'name employeeId')
      .populate('pendingTransfer.fromEmployee', 'name employeeId');

    if (assets.length === 0) {
      console.log('No pending transfers found.');
    } else {
      console.log(`Found ${assets.length} pending transfer(s):`);
      assets.forEach(a => {
        const p = a.pendingTransfer;
        console.log(`- Asset: ${a.name} (${a.assetId})`);
        console.log(`  From: ${p.fromEmployee?.name?.first} ${p.fromEmployee?.name?.last} (${p.fromEmployee?.employeeId})`);
        console.log(`  To:   ${p.toEmployee?.name?.first} ${p.toEmployee?.name?.last} (${p.toEmployee?.employeeId})`);
        console.log(`  Type: ${p.transferType} | Status: ${p.status}`);
        console.log('-------------------');
      });
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkPendingTransfers();
