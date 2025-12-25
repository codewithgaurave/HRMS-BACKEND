import mongoose from 'mongoose';
import Asset from './models/Asset.js';
import { connectDB } from './config/db.js';
import dotenv from 'dotenv';

dotenv.config();

const migrateAssets = async () => {
  try {
    await connectDB();
    console.log('Connected to database');

    // Find all assets with old structure
    const assets = await Asset.find({});
    console.log(`Found ${assets.length} assets to migrate`);

    for (const asset of assets) {
      // Check if asset has old structure (assignedTo is ObjectId)
      if (asset.assignedTo && !Array.isArray(asset.assignedTo)) {
        console.log(`Migrating asset ${asset.assetId}`);
        
        // Convert to new structure
        const newAssignedTo = [{
          employee: asset.assignedTo,
          assignedDate: asset.assignedDate || new Date(),
          isActive: true
        }];

        // Update the asset
        await Asset.findByIdAndUpdate(asset._id, {
          assignedTo: newAssignedTo
        });
        
        console.log(`Migrated asset ${asset.assetId}`);
      } else if (!asset.assignedTo) {
        // Set empty array for unassigned assets
        await Asset.findByIdAndUpdate(asset._id, {
          assignedTo: []
        });
        console.log(`Set empty assignedTo for asset ${asset.assetId}`);
      }
    }

    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrateAssets();