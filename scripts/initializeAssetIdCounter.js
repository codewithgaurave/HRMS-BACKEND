const mongoose = require('mongoose');
const Counter = require('../models/Counter');
require('dotenv').config();

const initializeAssetIdCounter = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const existingCounter = await Counter.findOne({ name: 'assetId' });
    
    if (!existingCounter) {
      await Counter.create({
        name: 'assetId',
        value: 0
      });
      console.log('Asset ID counter initialized successfully');
    } else {
      console.log('Asset ID counter already exists');
    }

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error initializing asset ID counter:', error);
    process.exit(1);
  }
};

initializeAssetIdCounter();