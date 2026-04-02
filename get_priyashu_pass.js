import mongoose from 'mongoose';
import dotenv from 'dotenv';
import CryptoJS from 'crypto-js';

// Load env from HRMS-BACKEND
dotenv.config({ path: 'd:/Desktop/HRMS2/HRMS-BACKEND/.env' });

const MONGO_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;

const employeeSchema = new mongoose.Schema({
  employeeId: String,
  email: String,
  password: { type: String, required: true },
  name: { first: String, last: String }
});

const Employee = mongoose.model('Employee', employeeSchema);

const decryptPassword = (encryptedPassword) => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedPassword, JWT_SECRET);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    return 'Decryption failed';
  }
};

async function getPriyashuCredentials() {
  try {
    await mongoose.connect(MONGO_URI);
    
    const employee = await Employee.findOne({ employeeId: 'EMP0028' });
    
    if (!employee) {
      console.log('Employee EMP0028 not found');
    } else {
      const plainPassword = decryptPassword(employee.password);
      console.log('--- Priyashu Singh (EMP0028) Credentials ---');
      console.log(`Email:    ${employee.email}`);
      console.log(`Password: ${plainPassword}`);
      console.log('-------------------------------------------');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

getPriyashuCredentials();
