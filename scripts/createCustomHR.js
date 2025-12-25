import mongoose from 'mongoose';
import CryptoJS from 'crypto-js';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

const encryptPassword = (password) => {
  return CryptoJS.AES.encrypt(password, JWT_SECRET).toString();
};

const createCustomHR = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Database connected');
    
    const db = mongoose.connection.db;
    
    // Delete existing HR if any
    await db.collection('employees').deleteMany({});
    await db.collection('counters').deleteMany({});
    
    const encryptedPassword = encryptPassword('123456');
    
    const hrDoc = {
      employeeId: 'EMP0001',
      name: {
        first: 'Gaurav',
        last: 'HR'
      },
      email: 'gauravhr.digicoders@gmail.com',
      password: encryptedPassword,
      mobile: '8630049759',
      gender: 'Male',
      role: 'HR_Manager',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await db.collection('employees').insertOne(hrDoc);
    console.log('🎉 HR created:', result.insertedId);
    
    await db.collection('counters').insertOne({
      name: 'employeeId',
      value: 2
    });
    
    console.log('✅ Login with: gauravhr.digicoders@gmail.com / 123456');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
};

createCustomHR();