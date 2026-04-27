# AbroadReady: Development & Deployment Guide

**Last Updated**: April 27, 2026

---

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- SQLite3 (included with `better-sqlite3`)
- Gmail account with app password (for email)
- Google OAuth credentials (for social login)

### Installation

```bash
# 1. Clone/extract the project
cd abroadready

# 2. Install dependencies
npm install

# 3. Create .env from template
cp .env.example .env

# 4. Generate strong SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 

# 5. Edit .env and fill in your values:
# - SESSION_SECRET (from step 4)
# - BASE_URL (http://localhost:3000 for dev, https://yourdomain.com for prod)
# - Database path (optional)
# - Email SMTP settings
# - Google OAuth credentials
# - API keys (optional, only if needed)

# 6. Initialize database
npm run setup

# 7. Seed initial data (countries, universities)
npm run seed

# 8. Start development server
npm run dev
```

### Access the App

- **Landing/Login**: http://localhost:3000/
- **Dashboard**: http://localhost:3000/dashboard (after login)
- **Admin Panel**: http://localhost:3000/admin (admin users only)

---

## Architecture Overview

### Frontend
- **Framework**: Vanilla JavaScript (no build step required)
- **HTML Files**: `views/*.html` - Pure HTML5, no templating
- **JS Utilities**: `public/js/global.js` - Shared functions (modals, toasts, formatting)
- **Page-Specific JS**: `public/js/[page].js` - Logic for each page
- **Styling**: `public/css/*.css` - CSS Grid + Flexbox
- **Status**: ✅ Functional, needs UI/UX improvements

### Backend
- **Framework**: Express.js 4.18+
- **Database**: SQLite with better-sqlite3 (prepared statements)
- **Authentication**: 
  - Email/password (bcryptjs for hashing)
  - Google OAuth (Passport.js)
  - Magic links via email
  - Email verification flow
  - Password reset flow
- **Middleware**:
  - Security headers (CSP, HSTS, etc.)
  - Rate limiting (100 req/15min per IP)
  - Input validation
  - Session management

### Database
- **Type**: SQLite 3 (local file-based)
- **Schema**: 14 tables with relationships
- **Key Tables**:
  - `users` - Core user data
  - `student_profiles` - Extended profile info
  - `universities` - University database
  - `countries` - Country info & costs
  - `resumes` - Resume uploads & analysis
  - `portfolios` - Portfolio analysis
  - `scholarships` - Scholarship data
  - And more...

### API Routes

#### Public Routes
- `GET /` - Landing page
- `GET /[page]` - View HTML pages
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/magic-link` - Send magic link
- `GET /auth/magic-link/verify` - Verify magic link
- `POST /auth/password-reset-request` - Request password reset
- `POST /auth/password-reset` - Reset password
- `GET /api/universities` - Search universities
- `GET /api/countries` - Get countries list
- `GET /api/scholarships` - Browse scholarships

#### Protected Routes (require login)
- `GET /auth/me` - Current user info
- `POST /auth/logout` - User logout
- `POST /api/profile/...` - User profile management
- `POST /api/resumes/...` - Resume upload & analysis
- `POST /api/portfolios/...` - Portfolio analysis
- `POST /api/budget/...` - Budget tracking
- `POST /api/loans/...` - Loan planning
- And many more...

#### Admin Routes (require admin flag)
- `POST /api/admin/...` - Admin functions

---

## Security Implementation

### ✅ Completed Security Measures

1. **Input Validation**
   - All auth endpoints validate email, password, name
   - Length limits enforced (password 8-128 chars, name max 256)
   - Type checking for all inputs
   - Pattern matching for email format
   ```javascript
   const emailCheck = validateInput(req.body.email, "email", { required: true });
   ```

2. **XSS Prevention**
   - Use `textContent` instead of `innerHTML` for user data
   - Sanitize HTML when necessary using DOMPurify
   - CSP header prevents inline script execution
   ```javascript
   function escapeHTML(text) {
     const map = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'};
     return String(text).replace(/[&<>"']/g, m => map[m]);
   }
   ```

3. **CSRF Protection**
   - SameSite cookies (`sameSite: "lax"`)
   - Session-based token storage
   - All state-changing operations use POST/PUT/DELETE

4. **SQL Injection Prevention**
   - SQLite prepared statements for all queries
   - Parameters passed separately from SQL
   ```javascript
   db.prepare("SELECT * FROM users WHERE email = ?").get(email);  // ✅ Safe
   ```

5. **Authentication**
   - Password hashing with bcryptjs (10 rounds salt)
   - Timing-safe hash comparison
   - Magic token signatures with HMAC-SHA256
   - Email verification flow
   - Password reset tokens (time-limited)

6. **Session Security**
   - HttpOnly cookies (prevents JavaScript access)
   - Secure flag in production (HTTPS only)
   - SameSite=lax (prevents cross-site requests)
   - 7-day expiration

7. **Rate Limiting**
   - 100 requests per 15 minutes per IP
   - Per-endpoint customization possible
   - Production: upgrade to Redis-backed

8. **Security Headers**
   - Content-Security-Policy (prevents inline JS/CSS)
   - X-Frame-Options: DENY (clickjacking prevention)
   - X-Content-Type-Options: nosniff (MIME sniffing)
   - Referrer-Policy: strict-origin-when-cross-origin
   - Strict-Transport-Security (HTTPS only in prod)
   - Permissions-Policy (disables dangerous APIs)

### ⏳ Remaining Security Tasks

- [ ] Two-Factor Authentication (2FA)
- [ ] CORS configuration per domain
- [ ] API key rotation
- [ ] Database encryption at rest
- [ ] Audit logging for admin actions
- [ ] Penetration testing
- [ ] OWASP Top 10 compliance check
- [ ] Secrets scanning in CI/CD

---

## Error Handling

### Error Handler Middleware

All errors are caught and handled gracefully:

```javascript
// Async route wrapper catches errors automatically
router.post('/endpoint', asyncHandler(async (req, res) => {
  // Errors here are caught and logged
}));

// Custom error class for app errors
throw new AppError('User not found', 404, { userId: 123 });

// All errors logged to:
// - Console (development)
// - logs/[module].log (always)
```

### Error Response Format

**API errors** (JSON):
```json
{
  "ok": false,
  "error": "User-friendly error message"
}
```

**HTML errors** (development includes stack trace):
```html
<!DOCTYPE html>
<html>
<head><title>Error 500</title></head>
<body>
  <h1>Error 500</h1>
  <p>Server error message</p>
</body>
</html>
```

---

## Logging

### Log Files Location
- `logs/Server.log` - Server startup/shutdown
- `logs/Auth.log` - Authentication events
- `logs/ErrorHandler.log` - Errors
- `logs/[ModuleName].log` - Module-specific logs

### Log Format
```
[2026-04-27T10:30:45.123Z] [INFO] [ModuleName] Message { additionalData: value }
```

### Usage
```javascript
const { getLogger } = require('./lib/logger');
const logger = getLogger('MyModule');

logger.info('User logged in', { userId: 123 });
logger.warn('High CPU usage', { cpu: 85 });
logger.error('Database connection failed', { host: 'localhost' }, err);
logger.debug('Debug information', { query: 'SELECT...' });
```

### Log Level Configuration
```bash
# Set in .env
LOG_LEVEL=INFO  # DEBUG, INFO, WARN, ERROR
```

---

## Environment Variables

### Required for Production

```env
# Core
NODE_ENV=production
PORT=3000
BASE_URL=https://yourdomain.com

# Session
SESSION_SECRET=<strong-random-secret>

# Database
DB_PATH=./database/abroadready.db

# Email (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=<app-password-not-regular-password>
FROM_EMAIL=noreply@yourdomain.com

# Google OAuth
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-secret>
GOOGLE_CALLBACK_URL=https://yourdomain.com/auth/google/callback

# CORS
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Logging
LOG_LEVEL=WARN
```

### Optional Variables

```env
# AI APIs (only if features need them)
GEMINI_API_KEY=
OPENAI_API_KEY=
HUGGINGFACE_API_KEY=

# Third-party integrations
SCRAPINGBEE_API_KEY=
GITHUB_TOKEN=
GITHUB_STORAGE_REPO=

# Development
DEBUG=abroadready:*
```

---

## API Documentation

### Authentication Endpoints

#### Register
```
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "name": "John Doe"
}

Response 200:
{
  "ok": true,
  "userId": 123,
  "message": "Registration successful. Please check your email..."
}

Response 400:
{
  "error": "Email already registered"
}
```

#### Login
```
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123"
}

Response 200:
{
  "ok": true,
  "user": {
    "id": 123,
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

#### Current User
```
GET /auth/me

Response 200:
{
  "ok": true,
  "user": { ... }
}

Response 401:
{
  "error": "Unauthorized"
}
```

#### Logout
```
POST /auth/logout

Response 200:
{
  "ok": true
}
```

#### Magic Link Login
```
POST /auth/magic-link
{
  "email": "user@example.com"
}

Response 200:
{
  "ok": true
}
```

#### Email Verification
```
GET /auth/verify-email?token=...

Redirects to /dashboard?verified=1 on success
```

#### Password Reset
```
POST /auth/password-reset-request
{
  "email": "user@example.com"
}

POST /auth/password-reset
{
  "token": "...",
  "newPassword": "NewPassword123"
}
```

---

## Deployment

### Pre-Deployment Checklist

- [ ] All environment variables set in production
- [ ] SESSION_SECRET is strong (32+ bytes)
- [ ] Database backed up
- [ ] Email working (test manually)
- [ ] Google OAuth working (test login flow)
- [ ] HTTPS enabled
- [ ] Security headers verified (https://securityheaders.com)
- [ ] Rate limiting tested
- [ ] Error handling tested
- [ ] Logging verified

### Deploy to Vercel

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Login to Vercel
vercel login

# 3. Deploy
vercel --prod

# 4. Set environment variables in Vercel dashboard
# Project > Settings > Environment Variables

# 5. Monitor logs
vercel logs <project-name>
```

### Deploy to Azure App Service

```bash
# 1. Create Azure Web App
az webapp create --resource-group myGroup --name myApp --runtime "node|18"

# 2. Set environment variables
az webapp config appsettings set \
  --resource-group myGroup \
  --name myApp \
  --settings SESSION_SECRET=xxx BASE_URL=xxx

# 3. Deploy code
git push azure main
```

### Deploy to Render

```bash
# 1. Connect GitHub repository
# 2. Create new Web Service
# 3. Set environment variables
# 4. Deploy
```

---

## Monitoring & Maintenance

### Health Check
```bash
# Check if server is running
curl http://localhost:3000/

# Check API
curl http://localhost:3000/api/universities
```

### Database Maintenance

```bash
# Backup database
cp database/abroadready.db database/abroadready.backup.db

# Vacuum database (optimize storage)
sqlite3 database/abroadready.db "VACUUM;"

# Check integrity
sqlite3 database/abroadready.db "PRAGMA integrity_check;"
```

### Performance Monitoring

```bash
# Enable debug logging
DEBUG=abroadready:* npm start

# Monitor memory usage
node --max-old-space-size=512 server.js

# CPU profiling
node --prof server.js
node --prof-process isolate-*.log > profile.txt
```

---

## Troubleshooting

### Email Not Sending

1. Check SMTP settings in `.env`
2. Verify Gmail app password (not regular password)
3. Check firewall/ports (587 for TLS)
4. Review logs: `cat logs/ErrorHandler.log`

### Login Not Working

1. Clear browser cookies
2. Check session secret is strong
3. Verify bcryptjs version
4. Check user_name table exists in database

### Google OAuth Not Working

1. Verify CLIENT_ID and SECRET in `.env`
2. Check callback URL matches exactly in Google Console
3. Test with `http://localhost:3000` in development
4. Ensure email scope is requested

### Database Locked Error

1. Ensure only one instance running
2. Close any SQLite GUI tools
3. Delete `.db-wal` and `.db-shm` files
4. Restart server

---

## Development Workflow

### Adding a New Route

```javascript
// routes/myroute.js
const express = require('express');
const { asyncHandler, AppError } = require('../lib/errors');
const { getLogger } = require('../lib/logger');
const { validateInput } = require('../lib/security');
const { getDB } = require('../database/db');

const router = express.Router();
const logger = getLogger('MyRoute');

router.post('/', asyncHandler(async (req, res) => {
  // Input validation
  const nameCheck = validateInput(req.body.name, 'string', { required: true, max: 256 });
  if (!nameCheck.valid) throw new AppError(nameCheck.error, 400);

  // Business logic
  const db = getDB();
  const result = db.prepare('SELECT * FROM ...').all();

  logger.info('Operation completed', { resultCount: result.length });
  return res.json({ ok: true, data: result });
}));

module.exports = router;
```

### Adding a New Database Table

```sql
CREATE TABLE IF NOT EXISTS my_table (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

Add to `database/schema.sql` and run `npm run setup`

---

## Contributing

### Code Style
- Use ES6+ features
- Prefer `const` over `let`
- Use template strings
- Add error handling
- Comment complex logic

### Testing
- Manual testing via browser/Postman
- Test both success and error cases
- Check security headers
- Verify logging works

---

## Resources

- [Express.js Docs](https://expressjs.com/)
- [SQLite Docs](https://sqlite.org/docs.html)
- [OWASP Security](https://owasp.org/Top10/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

**Questions?** Contact the development team or review the inline code comments.
