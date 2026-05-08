// Script to create sample assets and assign to Team Leaders
import Asset from '../models/Asset.js';
import Employee from '../models/Employee.js';
import { Counter } from '../models/Counter.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Generate Asset ID
const generateAssetId = async () => {
  try {
    const counter = await Counter.findOneAndUpdate(
      { name: 'assetId' },
      { $inc: { value: 1 } },
      { new: true, upsert: true }
    );
    return `AST${String(counter.value).padStart(4, '0')}`;
  } catch (error) {
    throw new Error('Failed to generate asset ID');
  }
};

async function createAndAssignAssets() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms_db');
    console.log('✅ Connected to MongoDB\n');
    
    // Get an HR Manager to use as createdBy
    console.log('🔍 Finding HR Manager...');
    const hrManager = await Employee.findOne({ role: 'HR_Manager', isActive: true });
    
    if (!hrManager) {
      console.log('❌ No HR Manager found');
      process.exit(1);
    }
    console.log(`✅ Found HR Manager: ${hrManager.name.first} ${hrManager.name.last}\n`);
    
    // Get all Team Leaders
    console.log('🔍 Finding Team Leaders...');
    const teamLeaders = await Employee.find({ role: 'Team_Leader', isActive: true });
    console.log(`✅ Found ${teamLeaders.length} Team Leaders\n`);
    
    if (teamLeaders.length === 0) {
      console.log('❌ No Team Leaders found');
      process.exit(1);
    }
    
    // Create sample assets
    console.log('📦 Creating sample assets...\n');
    
    const sampleAssets = [
      {
        name: 'Dell Laptop XPS 13',
        category: 'Laptop',
        brand: 'Dell',
        model: 'XPS 13',
        serialNumber: 'DELL-XPS-001',
        status: 'Available',
        condition: 'Good',
        createdBy: hrManager._id
      },
      {
        name: 'HP Pavilion Laptop',
        category: 'Laptop',
        brand: 'HP',
        model: 'Pavilion 15',
        serialNumber: 'HP-PAV-001',
        status: 'Available',
        condition: 'Good',
        createdBy: hrManager._id
      },
      {
        name: 'Apple MacBook Pro',
        category: 'Laptop',
        brand: 'Apple',
        model: 'MacBook Pro 14',
        serialNumber: 'APPLE-MBP-001',
        status: 'Available',
        condition: 'New',
        createdBy: hrManager._id
      },
      {
        name: 'Samsung 27 inch Monitor',
        category: 'Monitor',
        brand: 'Samsung',
        model: 'U28E590D',
        serialNumber: 'SAMSUNG-MON-001',
        status: 'Available',
        condition: 'New',
        createdBy: hrManager._id
      },
      {
        name: 'LG 24 inch Monitor',
        category: 'Monitor',
        brand: 'LG',
        model: '24UP550',
        serialNumber: 'LG-MON-001',
        status: 'Available',
        condition: 'Good',
        createdBy: hrManager._id
      },
      {
        name: 'Logitech MX Keys Keyboard',
        category: 'Keyboard',
        brand: 'Logitech',
        model: 'MX Keys',
        serialNumber: 'LOGI-KB-001',
        status: 'Available',
        condition: 'New',
        createdBy: hrManager._id
      },
      {
        name: 'Logitech MX Master 3 Mouse',
        category: 'Mouse',
        brand: 'Logitech',
        model: 'MX Master 3',
        serialNumber: 'LOGI-MOUSE-001',
        status: 'Available',
        condition: 'New',
        createdBy: hrManager._id
      },
      {
        name: 'Sony WH-1000XM4 Headphones',
        category: 'Headphones',
        brand: 'Sony',
        model: 'WH-1000XM4',
        serialNumber: 'SONY-HP-001',
        status: 'Available',
        condition: 'New',
        createdBy: hrManager._id
      },
      {
        name: 'iPhone 13 Pro',
        category: 'Mobile',
        brand: 'Apple',
        model: 'iPhone 13 Pro',
        serialNumber: 'APPLE-IPHONE-001',
        status: 'Available',
        condition: 'New',
        createdBy: hrManager._id
      },
      {
        name: 'Samsung Galaxy S21',
        category: 'Mobile',
        brand: 'Samsung',
        model: 'Galaxy S21',
        serialNumber: 'SAMSUNG-S21-001',
        status: 'Available',
        condition: 'Good',
        createdBy: hrManager._id
      }
    ];
    
    // Generate assetIds and create assets
    for (let asset of sampleAssets) {
      asset.assetId = await generateAssetId();
    }
    
    const createdAssets = await Asset.insertMany(sampleAssets);
    console.log(`✅ Created ${createdAssets.length} sample assets\n`);
    
    // Assign assets to Team Leaders
    console.log('📝 Assigning assets to Team Leaders...\n');
    
    let assignmentCount = 0;
    const assetsPerLeader = Math.ceil(createdAssets.length / teamLeaders.length);
    
    for (let i = 0; i < teamLeaders.length; i++) {
      const teamLeader = teamLeaders[i];
      const startIdx = i * assetsPerLeader;
      const endIdx = Math.min(startIdx + assetsPerLeader, createdAssets.length);
      
      for (let j = startIdx; j < endIdx; j++) {
        const asset = createdAssets[j];
        
        // Assign asset to Team Leader
        asset.assignedTo.push({
          employee: teamLeader._id,
          assignedBy: hrManager._id,
          assignedDate: new Date(),
          isActive: true,
          transferType: 'assign'
        });
        
        asset.status = 'Assigned';
        asset.updatedBy = hrManager._id;
        
        await asset.save();
        assignmentCount++;
        
        console.log(`✅ Assigned "${asset.name}" to ${teamLeader.name.first} ${teamLeader.name.last}`);
      }
    }
    
    console.log(`\n✅ Successfully assigned ${assignmentCount} assets to Team Leaders!`);
    console.log('📝 Team Leaders can now assign these assets to their team members.\n');
    
    // Show summary
    const availableCount = await Asset.countDocuments({ status: 'Available' });
    const assignedCount = await Asset.countDocuments({ status: 'Assigned' });
    
    console.log('📊 Summary:');
    console.log(`   Total Assets: ${availableCount + assignedCount}`);
    console.log(`   Available: ${availableCount}`);
    console.log(`   Assigned to Team Leaders: ${assignedCount}`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
createAndAssignAssets();
