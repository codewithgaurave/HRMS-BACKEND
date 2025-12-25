import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import dotenv from 'dotenv';

dotenv.config();

const fixAssets = async () => {
  try {
    await connectDB();
    console.log('Connected to database');

    const db = mongoose.connection.db;
    const collection = db.collection('assets');

    // Update all assets to new structure
    const result = await collection.updateMany(
      {},
      [
        {
          $set: {
            assignedTo: {
              $cond: {
                if: { $ne: ["$assignedTo", null] },
                then: [
                  {
                    employee: "$assignedTo",
                    assignedDate: { $ifNull: ["$assignedDate", new Date()] },
                    isActive: true
                  }
                ],
                else: []
              }
            }
          }
        },
        {
          $unset: ["assignedDate", "returnDate"]
        }
      ]
    );

    console.log(`Updated ${result.modifiedCount} assets`);
    process.exit(0);
  } catch (error) {
    console.error('Fix failed:', error);
    process.exit(1);
  }
};

fixAssets();