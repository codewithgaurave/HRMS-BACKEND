# 🔄 Employee-to-Employee Asset Transfer Feature

## Overview
Employees can now **transfer** or **share** their assigned assets with colleagues under the same HR Manager.

---

## 🎯 Features

### 1️⃣ **Transfer Asset** (Complete Ownership Transfer)
- Employee apna asset completely dusre employee ko transfer kar sakta hai
- Original employee ka assignment deactivate ho jata hai
- New employee ko asset assign ho jata hai

### 2️⃣ **Share Asset** (Shared Usage)
- Employee apna asset dusre employee ke saath share kar sakta hai
- Dono employees ke paas asset active rahega
- Multiple employees ek hi asset use kar sakte hain

---

## 📡 API Endpoints

### 1. Get My Transferable Assets
**Endpoint:** `GET /api/assets/my/transferable`  
**Auth:** Required (Employee Token)  
**Description:** Employee ke paas currently jo assets hain, wo list milegi

**Response:**
```json
{
  "success": true,
  "message": "Your transferable assets",
  "totalAssets": 3,
  "assets": [
    {
      "_id": "asset_id",
      "assetId": "AST0001",
      "name": "MacBook Pro",
      "category": "Laptop",
      "status": "Assigned",
      "assignedTo": [...]
    }
  ]
}
```

---

### 2. Get Colleagues for Transfer
**Endpoint:** `GET /api/assets/colleagues/transfer`  
**Auth:** Required (Employee Token)  
**Description:** Same HR ke under jo colleagues hain, unki list (excluding self)

**Response:**
```json
{
  "success": true,
  "message": "Colleagues available for asset transfer",
  "totalColleagues": 15,
  "colleagues": [
    {
      "_id": "employee_id",
      "employeeId": "EMP0002",
      "name": {
        "first": "Rahul",
        "last": "Sharma"
      },
      "email": "rahul@company.com",
      "designation": {
        "title": "Senior Developer"
      },
      "department": {
        "name": "IT"
      }
    }
  ]
}
```

---

### 3. Transfer/Share Asset to Colleague
**Endpoint:** `POST /api/assets/:id/employee-transfer`  
**Auth:** Required (Employee Token)  
**Description:** Asset ko dusre employee ko transfer ya share karo

**Request Body:**
```json
{
  "toEmployeeId": "employee_id_here",
  "transferType": "transfer",  // "transfer" or "share"
  "reason": "Project requirement" // Optional
}
```

**Transfer Types:**
- **`transfer`** - Complete ownership transfer (original assignment deactivate)
- **`share`** - Shared usage (both employees can use)

**Success Response:**
```json
{
  "success": true,
  "message": "Asset transferred successfully to Rahul Sharma",
  "asset": {
    "_id": "asset_id",
    "assetId": "AST0001",
    "name": "MacBook Pro",
    "status": "Assigned",
    "assignedTo": [
      {
        "employee": {...},
        "assignedBy": {...},
        "assignedDate": "2024-01-15",
        "isActive": false,  // Old assignment
        "transferType": "assign"
      },
      {
        "employee": {...},
        "assignedBy": {...},
        "assignedDate": "2024-01-20",
        "isActive": true,   // New assignment
        "transferType": "transfer"
      }
    ]
  },
  "transferDetails": {
    "from": {
      "employeeId": "EMP0001",
      "name": "Vivek Chaurasiya"
    },
    "to": {
      "employeeId": "EMP0002",
      "name": "Rahul Sharma"
    },
    "transferType": "transfer",
    "transferDate": "2024-01-20T10:30:00.000Z",
    "reason": "Project requirement"
  }
}
```

**Error Responses:**

1. **Target employee not provided:**
```json
{
  "success": false,
  "message": "Target employee ID is required"
}
```

2. **Trying to transfer to self:**
```json
{
  "success": false,
  "message": "Cannot transfer asset to yourself"
}
```

3. **Asset not assigned to you:**
```json
{
  "success": false,
  "message": "You can only transfer assets that are currently assigned to you"
}
```

4. **Target employee not a colleague:**
```json
{
  "success": false,
  "message": "You can only transfer assets to colleagues under the same HR"
}
```

5. **Target employee inactive:**
```json
{
  "success": false,
  "message": "Cannot transfer to inactive employee"
}
```

---

## 🔒 Security & Validation

### ✅ Validations:
1. **Authentication Required** - Employee must be logged in
2. **Asset Ownership** - Employee can only transfer assets assigned to them
3. **Same HR Check** - Can only transfer to colleagues under same HR Manager
4. **Active Employee Check** - Target employee must be active
5. **Self-Transfer Prevention** - Cannot transfer to yourself
6. **Asset Existence** - Asset must exist in database

### 🔐 Access Control:
- **Employee Role** - Any employee can transfer their own assets
- **No HR Approval Required** - Direct peer-to-peer transfer
- **Audit Trail** - Complete history maintained in `assignedTo` array

---

## 📊 Use Cases

### Use Case 1: Project Transfer
```
Scenario: Vivek ka project complete ho gaya, ab Rahul ko laptop chahiye

Step 1: GET /api/assets/my/transferable
        → Vivek apne assets dekhe

Step 2: GET /api/assets/colleagues/transfer
        → Rahul ko list mein dhundhe

Step 3: POST /api/assets/AST0001/employee-transfer
        Body: {
          "toEmployeeId": "rahul_id",
          "transferType": "transfer",
          "reason": "Project handover"
        }
        → Laptop Rahul ko transfer ho gaya
```

### Use Case 2: Shared Resource
```
Scenario: Vivek aur Rahul dono ek hi monitor share karenge

Step 1: POST /api/assets/AST0002/employee-transfer
        Body: {
          "toEmployeeId": "rahul_id",
          "transferType": "share",
          "reason": "Shared workspace"
        }
        → Dono ke paas monitor active hai
```

---

## 🎨 Frontend Integration Example

```javascript
// 1. Get my transferable assets
const getMyAssets = async () => {
  const response = await fetch('/api/assets/my/transferable', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  return data.assets;
};

// 2. Get colleagues list
const getColleagues = async () => {
  const response = await fetch('/api/assets/colleagues/transfer', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  return data.colleagues;
};

// 3. Transfer asset
const transferAsset = async (assetId, toEmployeeId, transferType) => {
  const response = await fetch(`/api/assets/${assetId}/employee-transfer`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      toEmployeeId,
      transferType, // 'transfer' or 'share'
      reason: 'Employee initiated transfer'
    })
  });
  const data = await response.json();
  return data;
};
```

---

## 📝 Database Schema Impact

### Asset Model - `assignedTo` Array:
```javascript
assignedTo: [
  {
    employee: ObjectId,           // Target employee
    assignedBy: ObjectId,         // Who assigned (can be another employee)
    assignedDate: Date,           // When assigned
    returnDate: Date,             // When returned (if applicable)
    isActive: Boolean,            // Currently active?
    transferType: String          // 'assign' | 'transfer' | 'share'
  }
]
```

**Transfer Type Values:**
- `assign` - HR/Team Leader ne assign kiya
- `transfer` - Employee ne transfer kiya (complete ownership)
- `share` - Employee ne share kiya (shared usage)

---

## ✨ Benefits

1. **Employee Empowerment** - Employees khud assets manage kar sakte hain
2. **Faster Workflow** - HR approval ki zarurat nahi
3. **Flexibility** - Transfer ya share, dono options available
4. **Complete Audit Trail** - Har transfer ka record maintained
5. **Peer-to-Peer** - Direct colleague-to-colleague transfer
6. **Same Organization** - Only same HR ke employees ke beech transfer

---

## 🚀 Testing

### Postman Collection:

**1. Get My Transferable Assets**
```
GET http://localhost:5000/api/assets/my/transferable
Headers:
  Authorization: Bearer <employee_token>
```

**2. Get Colleagues**
```
GET http://localhost:5000/api/assets/colleagues/transfer
Headers:
  Authorization: Bearer <employee_token>
```

**3. Transfer Asset**
```
POST http://localhost:5000/api/assets/AST0001/employee-transfer
Headers:
  Authorization: Bearer <employee_token>
  Content-Type: application/json
Body:
{
  "toEmployeeId": "673abc123def456789",
  "transferType": "transfer",
  "reason": "Project requirement"
}
```

**4. Share Asset**
```
POST http://localhost:5000/api/assets/AST0001/employee-transfer
Headers:
  Authorization: Bearer <employee_token>
  Content-Type: application/json
Body:
{
  "toEmployeeId": "673abc123def456789",
  "transferType": "share",
  "reason": "Shared resource"
}
```

---

## 🎯 Summary

✅ **Employee Panel mein ab ye features hain:**
- Apne assets dekh sakte hain
- Colleagues ki list dekh sakte hain
- Assets ko transfer kar sakte hain (complete ownership)
- Assets ko share kar sakte hain (shared usage)
- Sirf same HR ke colleagues ke saath transfer/share

**Bhai ab employee apna asset dusre employee ko transfer kar sakta hai! 🚀**
