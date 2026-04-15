# HRMS Backend Configuration Analysis

## 🔐 Token Configuration

### JWT Token Expiry Time
**Current Setting**: `1 year (365 days)`

**Location**: `/controllers/employeeController.js` - Line 67
```javascript
const token = jwt.sign(
  { 
    id: employee._id, 
    email: employee.email,
    role: employee.role 
  },
  JWT_SECRET,
  { expiresIn: '365d' }  // ← 1 year expiry
);
```

### JWT Secret
**Location**: `.env` file
```
JWT_SECRET=mynameisgauravguptaimfromdigicoderstechnologiespvtltdlucknow
```

---

## 📋 Environment Variables (.env)

| Variable | Value | Purpose |
|----------|-------|---------|
| `ENCRYPTION_KEY` | `thisisthebestencryptionkeyforencriptingpasswordusethis` | Password encryption |
| `JWT_SECRET` | `mynameisgauravguptaimfromdigicoderstechnologiespvtltdlucknow` | JWT token signing |
| `NODE_ENV` | `development` | Environment mode |
| `PORT` | `8000` | Server port |
| `MONGODB_URI` | `mongodb+srv://prabhakar_rajput:prabhakar%40rajput@prabhakar.ars3j7r.mongodb.net/hrms` | Database connection |
| `MAP_API_KEY` | `AIzaSyDCnVyEfrPoO-kMeL0lPw9YSKffXOgxRfo` | Google Maps API |
| `MAP_ID` | `93c4e3f147e5fccd9afaf05f` | Maps ID |
| `FRONTEND_URL` | Multiple URLs (localhost, netlify, onrender) | CORS allowed origins |

---

## 🔑 Authentication Flow

### 1. Login Process
**Endpoint**: `POST /api/employees/login`

**Steps**:
1. User provides email and password
2. Backend finds employee by email
3. Checks if employee is active (`isActive: true`)
4. Decrypts stored password and compares with input
5. Generates JWT token with 24-hour expiry
6. Returns token + employee data (without password)

**Code Location**: `/controllers/employeeController.js` - `loginEmployee()` function

### 2. Token Verification
**Middleware**: `authenticateToken` in `/middlewares/authMiddleware.js`

**Process**:
1. Extracts token from `Authorization: Bearer {token}` header
2. Verifies token using JWT_SECRET
3. Decodes token to get employee ID
4. Fetches employee from database
5. Attaches employee to request object (`req.employee`)
6. Passes to next middleware/controller

**Code**:
```javascript
export const authenticateToken = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const employee = await Employee.findById(decoded.id).select('-password');
    
    if (!employee) {
      return res.status(401).json({ message: 'Invalid token.' });
    }

    req.employee = employee;
    next();
  } catch (error) {
    res.status(400).json({ message: 'Invalid token.' });
  }
};
```

---

## 🛡️ Authorization Middleware

### Role-Based Access Control

| Middleware | Allowed Roles | Purpose |
|-----------|---------------|---------|
| `requireHRManager` | `HR_Manager` | HR-only operations |
| `requireTeamLeader` | `Team_Leader`, `HR_Manager` | Team leader operations |
| `requireDashboardAccess` | `HR_Manager`, `Admin`, `Team_Leader`, `Employee` | Dashboard access |
| `requireWorkshiftAccess` | `HR_Manager`, `Team_Leader` | Workshift management |
| `canAccessEmployee` | Self, Team Members, Added Employees | Employee data access |

### Role Hierarchy
```
HR_Manager (Highest)
  ├── Can manage all employees
  ├── Can create other HR managers
  ├── Can view all data
  └── Can manage team leaders

Team_Leader
  ├── Can view team members
  ├── Can manage team members
  └── Cannot create HR managers

Employee (Lowest)
  ├── Can view own data
  ├── Can update own profile
  └── Cannot manage others
```

---

## 🔄 CORS Configuration

**Allowed Origins**:
```
http://localhost:5173
http://localhost:5174
http://localhost:5175
https://dct-hrms-hr-panel.netlify.app
https://hrms-panels.onrender.com
https://hrms-panel.onrender.com
```

**Allowed Methods**: GET, POST, PUT, DELETE, PATCH, OPTIONS

**Allowed Headers**: Content-Type, Authorization

---

## 📊 API Routes

### Employee Routes
- `POST /api/employees/login` - Login
- `POST /api/employees/register` - Register employee (HR only)
- `GET /api/employees` - Get all employees
- `GET /api/employees/my-profile` - Get current user profile
- `GET /api/employees/team` - Get team members (Team Leader)
- `GET /api/employees/colleagues` - Get colleagues under same HR
- `PUT /api/employees/:id` - Update employee
- `PATCH /api/employees/:id/toggle-status` - Toggle active/inactive (HR only)

### Other Protected Routes
- `/api/payroll` - Payroll management
- `/api/attendance` - Attendance tracking
- `/api/leaves` - Leave management
- `/api/tasks` - Task management
- `/api/assets` - Asset management
- `/api/dashboard` - Dashboard data
- `/api/announcements` - Announcements
- `/api/events` - Events management

---

## 🔒 Security Features

### 1. Password Encryption
- Uses CryptoJS AES encryption
- Encryption key from environment variable
- Passwords never stored in plain text

### 2. JWT Token Security
- Tokens expire after 24 hours
- Tokens signed with JWT_SECRET
- Token verification on every protected route

### 3. Role-Based Access Control
- Every endpoint checks user role
- Prevents unauthorized access
- Granular permission control

### 4. Data Validation
- Email and mobile uniqueness checks
- Required field validation
- Reference field validation

### 5. Employee Status Check
- Only active employees can login
- Deactivated employees blocked
- Cannot deactivate only HR manager

---

## ⚠️ Important Security Notes

### Current Issues to Address

1. **JWT_SECRET in .env**
   - ⚠️ Currently visible in repository
   - Should be rotated in production
   - Use strong, random secret

2. **ENCRYPTION_KEY in .env**
   - ⚠️ Currently visible in repository
   - Should be rotated in production
   - Use strong, random key

3. **Database Credentials**
   - ⚠️ MongoDB URI contains credentials
   - Should use environment-specific credentials
   - Consider using MongoDB Atlas IP whitelist

4. **API Keys**
   - ⚠️ Google Maps API key visible
   - Should be restricted to specific domains
   - Consider using backend proxy

### Recommendations

1. **Rotate Secrets**
   ```bash
   # Generate new JWT_SECRET
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   
   # Generate new ENCRYPTION_KEY
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Use Secrets Manager**
   - AWS Secrets Manager
   - HashiCorp Vault
   - Azure Key Vault

3. **Implement Token Refresh**
   - Short-lived access tokens (15 min)
   - Long-lived refresh tokens (7 days)
   - Refresh endpoint to get new access token

4. **Add Rate Limiting**
   - Limit login attempts
   - Prevent brute force attacks
   - Use express-rate-limit

5. **Add Logging**
   - Log all authentication attempts
   - Log authorization failures
   - Monitor suspicious activities

---

## 🚀 Token Expiry Recommendations

### Current: 1 year (365 days)
**Pros**:
- Users don't need to login for a full year
- Excellent user experience
- Minimal server load
- Reduced authentication overhead

**Cons**:
- High security risk if token is compromised
- Very long exposure window
- Not ideal for sensitive operations
- Difficult to revoke compromised tokens

### Recommended: Dual Token System
```javascript
// Access Token: 15 minutes
const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });

// Refresh Token: 7 days
const refreshToken = jwt.sign(payload, REFRESH_SECRET, { expiresIn: '7d' });
```

**Benefits**:
- Short-lived access tokens reduce compromise risk
- Refresh tokens allow seamless user experience
- Can revoke refresh tokens if needed
- Better security posture

---

## 📝 Implementation Checklist

- [ ] Rotate JWT_SECRET
- [ ] Rotate ENCRYPTION_KEY
- [ ] Update MongoDB credentials
- [ ] Restrict Google Maps API key
- [ ] Implement token refresh mechanism
- [ ] Add rate limiting to login endpoint
- [ ] Add authentication logging
- [ ] Implement token blacklist for logout
- [ ] Add HTTPS enforcement
- [ ] Set secure cookie flags
- [ ] Add CSRF protection
- [ ] Implement 2FA for HR managers
- [ ] Add audit logging
- [ ] Regular security audits

---

## 🔗 Related Files

- **Authentication**: `/middlewares/authMiddleware.js`
- **Login Logic**: `/controllers/employeeController.js` (loginEmployee function)
- **Configuration**: `.env`
- **Routes**: `/routes/employeeRoutes.js`
- **Models**: `/models/Employee.js`

---

## 📞 Support

For security concerns or questions about token configuration, contact the development team.

**Last Updated**: 2024
**Status**: ✅ Analyzed and Documented
