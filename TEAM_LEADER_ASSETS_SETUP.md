# Team Leader Assets Assignment - Setup Guide

## Problem
Team Leader sees "No available assets to assign" message because:
1. No assets exist in the system with "Available" status
2. Assets need to be created first
3. Then Team Leaders can assign them to their team members

## Solution

### Step 1: Create Sample Assets (Backend)

Run this script in your backend to create sample assets:

```bash
node scripts/assignAssetsToTeamLeaders.js
```

Or manually create assets via API:

```bash
POST /api/assets
Content-Type: application/json
Authorization: Bearer <HR_TOKEN>

{
  "name": "Dell Laptop",
  "category": "Laptop",
  "brand": "Dell",
  "model": "XPS 13",
  "serialNumber": "DELL-XPS-001",
  "status": "Available",
  "condition": "Excellent"
}
```

### Step 2: Verify Assets Created

Check if assets exist:

```bash
GET /api/assets?status=Available
Authorization: Bearer <HR_TOKEN>
```

Should return list of available assets.

### Step 3: Update Backend Routes (assetRoutes.js)

Add these new routes:

```javascript
// Add to assetRoutes.js before the /:id routes

// Team Leader specific routes
router.get('/team/available', requireTeamLeader, getAvailableAssetsForTeamLeader);
router.post('/:id/assign-to-team', requireTeamLeader, assignAssetToTeamMember);
```

### Step 4: Update Asset Controller

Add these functions to `assetController.js`:

```javascript
// Get Available Assets for Team Leader to Assign
export const getAvailableAssetsForTeamLeader = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', category = '' } = req.query;
    
    const query = { status: 'Available' };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { serialNumber: { $regex: search, $options: 'i' } }
      ];
    }
    if (category) query.category = category;

    const assets = await Asset.find(query)
      .limit(parseInt(limit))
      .skip((page - 1) * limit);

    const totalCount = await Asset.countDocuments(query);

    res.json({
      success: true,
      assets,
      totalCount,
      totalPages: Math.ceil(totalCount / limit)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Assign Asset to Team Member
export const assignAssetToTeamMember = async (req, res) => {
  try {
    const { employeeId } = req.body;
    const assetId = req.params.id;

    // Verify employee is team member
    const employee = await Employee.findOne({
      _id: employeeId,
      manager: req.employee._id
    });

    if (!employee) {
      return res.status(403).json({
        success: false,
        message: 'Employee is not a member of your team'
      });
    }

    const asset = await Asset.findById(assetId);
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    // Assign asset
    asset.assignedTo.push({
      employee: employeeId,
      assignedBy: req.employee._id,
      assignedDate: new Date(),
      isActive: true
    });
    
    asset.status = 'Assigned';
    await asset.save();

    res.json({
      success: true,
      message: 'Asset assigned successfully',
      asset
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
```

### Step 5: Update Flutter App

Update `team_leader_assets.dart` to use the new endpoint:

```dart
Future<void> _loadAvailableAssets() async {
  setState(() => _loadingAssets = true);
  try {
    // Use new Team Leader specific endpoint
    final response = await ApiHelper.getRequest('/assets/team/available?limit=100');
    setState(() {
      _availableAssets = response['assets'] ?? [];
    });
    print('✅ Loaded ${_availableAssets.length} available assets');
  } catch (e) {
    print('❌ Error loading available assets: $e');
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error loading available assets: $e')),
      );
    }
  } finally {
    setState(() => _loadingAssets = false);
  }
}

Future<void> _assignAssetToTeamMember(String assetId, String employeeId) async {
  try {
    // Use new Team Leader specific endpoint
    final response = await ApiHelper.postRequest(
      '/assets/$assetId/assign-to-team',
      {'employeeId': employeeId},
    );

    if (response['success'] ?? false) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Asset assigned successfully!'),
            backgroundColor: Colors.green,
          ),
        );
      }
      _loadAvailableAssets();
      _controller.loadAssets();
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(response['message'] ?? 'Failed to assign asset')),
        );
      }
    }
  } catch (e) {
    print('❌ Error assigning asset: $e');
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error assigning asset: $e')),
      );
    }
  }
}
```

## Quick Setup Checklist

- [ ] Create sample assets via script or API
- [ ] Verify assets have status "Available"
- [ ] Add new routes to assetRoutes.js
- [ ] Add new functions to assetController.js
- [ ] Update Flutter app endpoints
- [ ] Test Team Leader can see available assets
- [ ] Test Team Leader can assign assets to team members
- [ ] Verify assets appear in "Team Assets" tab after assignment

## Sample Assets to Create

```javascript
const sampleAssets = [
  {
    name: 'Dell Laptop',
    category: 'Laptop',
    brand: 'Dell',
    model: 'XPS 13',
    serialNumber: 'DELL-XPS-001',
    status: 'Available',
    condition: 'Excellent'
  },
  {
    name: 'HP Laptop',
    category: 'Laptop',
    brand: 'HP',
    model: 'Pavilion 15',
    serialNumber: 'HP-PAV-001',
    status: 'Available',
    condition: 'Good'
  },
  {
    name: 'Samsung Monitor',
    category: 'Monitor',
    brand: 'Samsung',
    model: '27 inch 4K',
    serialNumber: 'SAMSUNG-MON-001',
    status: 'Available',
    condition: 'Excellent'
  },
  {
    name: 'Logitech Keyboard',
    category: 'Keyboard',
    brand: 'Logitech',
    model: 'MX Keys',
    serialNumber: 'LOGI-KB-001',
    status: 'Available',
    condition: 'Excellent'
  },
  {
    name: 'Sony Headphones',
    category: 'Headphones',
    brand: 'Sony',
    model: 'WH-1000XM4',
    serialNumber: 'SONY-HP-001',
    status: 'Available',
    condition: 'Excellent'
  }
];
```

## Testing Flow

1. **Login as HR Manager**
   - Create 5-10 sample assets with status "Available"

2. **Login as Team Leader**
   - Go to Team Assets page
   - Click "Assign Assets" tab
   - Should see list of available assets
   - Click team member button
   - Confirm assignment

3. **Verify Assignment**
   - Click "Team Assets" tab
   - Should see newly assigned asset
   - Asset should show team member name

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No assets showing | Create assets with status "Available" |
| Can't assign | Verify employee is team member of Team Leader |
| Assignment fails | Check asset status is "Available" |
| Assets not updating | Refresh page or restart app |

## API Endpoints

| Method | Endpoint | Purpose | Role |
|--------|----------|---------|------|
| GET | `/assets/team/available` | Get available assets | Team Leader |
| POST | `/assets/{id}/assign-to-team` | Assign to team member | Team Leader |
| GET | `/assets/team/leader` | Get team assets | Team Leader |
| GET | `/employees/team` | Get team members | Team Leader |

## Next Steps

1. Create sample assets
2. Update backend routes and controller
3. Update Flutter app
4. Test the complete flow
5. Deploy to production

## Support

For issues:
1. Check console logs for errors
2. Verify assets exist with "Available" status
3. Verify team members exist
4. Check user role is "Team_Leader"
5. Verify API endpoints are correct
