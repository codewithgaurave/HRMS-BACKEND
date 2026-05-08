# MongoDB Commands - Create Sample Assets

## Quick Setup - Run These Commands in MongoDB

### Option 1: Using MongoDB Shell

```javascript
// Connect to your database
use hrms_db

// Insert sample assets
db.assets.insertMany([
  {
    assetId: "AST0001",
    name: "Dell Laptop XPS 13",
    category: "Laptop",
    brand: "Dell",
    model: "XPS 13",
    serialNumber: "DELL-XPS-001",
    status: "Available",
    condition: "Excellent",
    description: "High performance laptop for development",
    purchaseDate: new Date("2023-01-15"),
    purchasePrice: 1200,
    assignedTo: [],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    assetId: "AST0002",
    name: "HP Pavilion Laptop",
    category: "Laptop",
    brand: "HP",
    model: "Pavilion 15",
    serialNumber: "HP-PAV-001",
    status: "Available",
    condition: "Good",
    description: "General purpose laptop",
    purchaseDate: new Date("2023-02-20"),
    purchasePrice: 800,
    assignedTo: [],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    assetId: "AST0003",
    name: "Apple MacBook Pro",
    category: "Laptop",
    brand: "Apple",
    model: "MacBook Pro 14",
    serialNumber: "APPLE-MBP-001",
    status: "Available",
    condition: "Excellent",
    description: "Premium laptop for design work",
    purchaseDate: new Date("2023-03-10"),
    purchasePrice: 2000,
    assignedTo: [],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    assetId: "AST0004",
    name: "Samsung 27 inch Monitor",
    category: "Monitor",
    brand: "Samsung",
    model: "U28E590D",
    serialNumber: "SAMSUNG-MON-001",
    status: "Available",
    condition: "Excellent",
    description: "4K UHD Monitor",
    purchaseDate: new Date("2023-04-05"),
    purchasePrice: 400,
    assignedTo: [],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    assetId: "AST0005",
    name: "LG 24 inch Monitor",
    category: "Monitor",
    brand: "LG",
    model: "24UP550",
    serialNumber: "LG-MON-001",
    status: "Available",
    condition: "Good",
    description: "Full HD Monitor",
    purchaseDate: new Date("2023-04-15"),
    purchasePrice: 250,
    assignedTo: [],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    assetId: "AST0006",
    name: "Logitech MX Keys Keyboard",
    category: "Keyboard",
    brand: "Logitech",
    model: "MX Keys",
    serialNumber: "LOGI-KB-001",
    status: "Available",
    condition: "Excellent",
    description: "Wireless mechanical keyboard",
    purchaseDate: new Date("2023-05-01"),
    purchasePrice: 100,
    assignedTo: [],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    assetId: "AST0007",
    name: "Logitech MX Master 3 Mouse",
    category: "Mouse",
    brand: "Logitech",
    model: "MX Master 3",
    serialNumber: "LOGI-MOUSE-001",
    status: "Available",
    condition: "Excellent",
    description: "Advanced wireless mouse",
    purchaseDate: new Date("2023-05-05"),
    purchasePrice: 100,
    assignedTo: [],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    assetId: "AST0008",
    name: "Sony WH-1000XM4 Headphones",
    category: "Headphones",
    brand: "Sony",
    model: "WH-1000XM4",
    serialNumber: "SONY-HP-001",
    status: "Available",
    condition: "Excellent",
    description: "Noise cancelling wireless headphones",
    purchaseDate: new Date("2023-05-10"),
    purchasePrice: 350,
    assignedTo: [],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    assetId: "AST0009",
    name: "iPhone 13 Pro",
    category: "Mobile",
    brand: "Apple",
    model: "iPhone 13 Pro",
    serialNumber: "APPLE-IPHONE-001",
    status: "Available",
    condition: "Excellent",
    description: "Company mobile phone",
    purchaseDate: new Date("2023-06-01"),
    purchasePrice: 1000,
    assignedTo: [],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    assetId: "AST0010",
    name: "Samsung Galaxy S21",
    category: "Mobile",
    brand: "Samsung",
    model: "Galaxy S21",
    serialNumber: "SAMSUNG-S21-001",
    status: "Available",
    condition: "Good",
    description: "Company mobile phone",
    purchaseDate: new Date("2023-06-05"),
    purchasePrice: 800,
    assignedTo: [],
    createdAt: new Date(),
    updatedAt: new Date()
  }
])

// Verify assets were created
db.assets.find({ status: "Available" }).count()

// Should return: 10
```

### Option 2: Using MongoDB Compass

1. Open MongoDB Compass
2. Connect to your database
3. Navigate to `hrms_db` → `assets` collection
4. Click "Insert Document"
5. Paste the JSON below for each asset:

```json
{
  "assetId": "AST0001",
  "name": "Dell Laptop XPS 13",
  "category": "Laptop",
  "brand": "Dell",
  "model": "XPS 13",
  "serialNumber": "DELL-XPS-001",
  "status": "Available",
  "condition": "Excellent",
  "description": "High performance laptop for development",
  "purchaseDate": "2023-01-15T00:00:00.000Z",
  "purchasePrice": 1200,
  "assignedTo": [],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### Option 3: Using Node.js Script

Create file `create-assets.js`:

```javascript
import mongoose from 'mongoose';
import Asset from './models/Asset.js';

const sampleAssets = [
  {
    assetId: "AST0001",
    name: "Dell Laptop XPS 13",
    category: "Laptop",
    brand: "Dell",
    model: "XPS 13",
    serialNumber: "DELL-XPS-001",
    status: "Available",
    condition: "Excellent"
  },
  {
    assetId: "AST0002",
    name: "HP Pavilion Laptop",
    category: "Laptop",
    brand: "HP",
    model: "Pavilion 15",
    serialNumber: "HP-PAV-001",
    status: "Available",
    condition: "Good"
  },
  {
    assetId: "AST0003",
    name: "Apple MacBook Pro",
    category: "Laptop",
    brand: "Apple",
    model: "MacBook Pro 14",
    serialNumber: "APPLE-MBP-001",
    status: "Available",
    condition: "Excellent"
  },
  {
    assetId: "AST0004",
    name: "Samsung 27 inch Monitor",
    category: "Monitor",
    brand: "Samsung",
    model: "U28E590D",
    serialNumber: "SAMSUNG-MON-001",
    status: "Available",
    condition: "Excellent"
  },
  {
    assetId: "AST0005",
    name: "LG 24 inch Monitor",
    category: "Monitor",
    brand: "LG",
    model: "24UP550",
    serialNumber: "LG-MON-001",
    status: "Available",
    condition: "Good"
  },
  {
    assetId: "AST0006",
    name: "Logitech MX Keys Keyboard",
    category: "Keyboard",
    brand: "Logitech",
    model: "MX Keys",
    serialNumber: "LOGI-KB-001",
    status: "Available",
    condition: "Excellent"
  },
  {
    assetId: "AST0007",
    name: "Logitech MX Master 3 Mouse",
    category: "Mouse",
    brand: "Logitech",
    model: "MX Master 3",
    serialNumber: "LOGI-MOUSE-001",
    status: "Available",
    condition: "Excellent"
  },
  {
    assetId: "AST0008",
    name: "Sony WH-1000XM4 Headphones",
    category: "Headphones",
    brand: "Sony",
    model: "WH-1000XM4",
    serialNumber: "SONY-HP-001",
    status: "Available",
    condition: "Excellent"
  },
  {
    assetId: "AST0009",
    name: "iPhone 13 Pro",
    category: "Mobile",
    brand: "Apple",
    model: "iPhone 13 Pro",
    serialNumber: "APPLE-IPHONE-001",
    status: "Available",
    condition: "Excellent"
  },
  {
    assetId: "AST0010",
    name: "Samsung Galaxy S21",
    category: "Mobile",
    brand: "Samsung",
    model: "Galaxy S21",
    serialNumber: "SAMSUNG-S21-001",
    status: "Available",
    condition: "Good"
  }
];

async function createAssets() {
  try {
    await mongoose.connect('mongodb://localhost:27017/hrms_db');
    
    const created = await Asset.insertMany(sampleAssets);
    console.log(`✅ Created ${created.length} sample assets`);
    
    const count = await Asset.countDocuments({ status: 'Available' });
    console.log(`✅ Total available assets: ${count}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createAssets();
```

Run with:
```bash
node create-assets.js
```

## Verify Assets Created

### Check in MongoDB Shell:
```javascript
db.assets.find({ status: "Available" }).pretty()
```

### Check via API:
```bash
curl -X GET "http://localhost:5000/api/assets?status=Available" \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

## Next Steps

1. Create sample assets using one of the methods above
2. Verify assets appear in database
3. Login as Team Leader in Flutter app
4. Go to Team Assets → Assign Assets tab
5. Should see list of available assets
6. Click team member button to assign
7. Verify asset appears in Team Assets tab

## Troubleshooting

**Assets not showing in app?**
- Verify status is exactly "Available" (case-sensitive)
- Check API endpoint returns assets
- Restart Flutter app

**Can't assign assets?**
- Verify team members exist
- Check user is logged in as Team Leader
- Verify employee ID is correct

**Database connection issues?**
- Check MongoDB is running
- Verify connection string
- Check database name is correct
