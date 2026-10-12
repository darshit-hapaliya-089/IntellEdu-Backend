# IntellEdu-Backend 🚀

Robust RESTful API backend for **IntellEdu** built with **AdonisJS v6**, **TypeScript**, and **PostgreSQL**.

---

## 📦 Features

- **JWT Authentication** (`/api/v1/auth/*`)
  - User Registration with password hashing via `scrypt`
  - Login with JWT Bearer token generation & auto-streak calculation
  - Profile retrieval & updating
- **Courses Management** (`/api/v1/courses/*`)
  - Full CRUD for courses
  - Student course enrollment
  - Real-time lesson completion & progress percentage tracking
- **Gamified Quizzes & XP Engine** (`/api/v1/quizzes/*`)
  - Timed quizzes with multiple-choice questions
  - Automatic grading engine with XP points reward
  - Answer review with concept explanations
- **Live Leaderboard** (`/api/v1/leaderboard/*`)
  - Global Top 50, Weekly Leaderboard, and Grade/Class-filtered rankings
- **Learning Progress & Streaks** (`/api/v1/progress/*`)
  - User streak tracking with daily study ping and bonus XP
  - Comprehensive subject accuracy and quiz analytics
- **AI Doubt Solver Proxy** (`/api/v1/doubts/*`)
  - Gemini AI step-by-step explanations
  - Full doubt question & answer history tracking
- **Firebase Authentication** for verified Google sign-in
- **Email/SMS 6-digit OTP** with one-minute expiry and server-side verification (Gmail SMTP and Twilio)

---

## 🛠️ Quick Start

### 1. Install Dependencies
```bash
cd IntellEdu-Backend
npm install
```

### 2. Configure Database (.env)
Make sure PostgreSQL is running, then configure your connection in `.env`:
```env
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_DATABASE=intelledu
```

Use the password for the PostgreSQL role configured in `DB_USER`. Put it in the
backend repository's `.env` file (not `.env.example`), then restart the backend.
`DB_USER` must be the PostgreSQL role name, and `DB_DATABASE` must match an
existing database exactly (including capitalization). After connecting to the
database, run `node ace migration:run`.

Copy `.env.example` to `.env` and set `GEMINI_API_KEY` and `FIREBASE_API_KEY` from
the corresponding provider projects. Keep all provider credentials in the backend
environment; do not put them in frontend source code.

For phone OTP, configure `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and the
SMS-capable E.164 `TWILIO_FROM_NUMBER` if SMS is needed. Production email uses
Brevo: set `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY`, `EMAIL_FROM` to a verified
sender, and optionally `EMAIL_FROM_NAME`. Local development can use
`EMAIL_PROVIDER=smtp` with `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS`;
SMTP is intentionally rejected in production. When WhatsApp is disabled or
disconnected, the OTP endpoint uses email as a fallback if an email address is
available. Set `WHATSAPP_ENABLED=true` only on a local machine with a linked
WhatsApp session; Render's ephemeral filesystem should keep it disabled.

In the separate frontend repository, copy `IntellEdu/.env.example` to
`IntellEdu/.env.local` and fill in the Firebase Web app settings. Enable the Google
provider in Firebase Authentication and authorize the frontend hostname in Firebase.
Email and phone OTP are sent by the backend through Brevo and the configured SMS
provider. Enable the Gemini Generative Language API in Google Cloud.

### 3. Run Migrations & Seed Database
```bash
# Run database migrations
node ace migration:run

# Seed initial courses, quizzes, questions, and demo student profiles
node ace db:seed
```
This includes migration `13_add_otp_delivery_status_and_contact_indexes`, which
adds delivery-state tracking and contact indexes. It does not rewrite existing
phone-number records.

### 4. Start the Development Server
```bash
npm run dev
# Or: node ace serve --hmr
```
The API will be live at `http://localhost:3333` (API base: `http://localhost:3333/api/v1`).

---

## 📡 API Endpoints Overview

| Method | Endpoint | Description | Protected |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Register new student | No |
| `POST` | `/api/v1/auth/login` | Login & receive JWT | No |
| `POST` | `/api/v1/auth/otp/send` | Send a six-digit signup/login code; expires after 60 seconds | No |
| `POST` | `/api/v1/auth/otp/verify` | Verify the code and receive a JWT | No |
| `GET` | `/health` | Lightweight uptime/cold-start health check | No |
| `POST` | `/api/v1/auth/firebase` | Verify Firebase Google/phone identity and issue JWT | No |
| `GET` | `/api/v1/auth/me` | Current user profile | Yes |
| `POST` | `/api/v1/auth/logout` | Invalidate token | Yes |
| `GET` | `/api/v1/courses` | List all interactive courses | No |
| `GET` | `/api/v1/courses/:id` | Course detail & lessons | No |
| `POST` | `/api/v1/courses/:id/enroll` | Enroll in a course | Yes |
| `PUT` | `/api/v1/courses/:id/progress` | Update completed lessons | Yes |
| `GET` | `/api/v1/quizzes` | List all available quizzes | No |
| `GET` | `/api/v1/quizzes/:id` | Get quiz questions (without answers) | No |
| `POST` | `/api/v1/quizzes/:id/submit` | Submit answers & earn XP | Yes |
| `GET` | `/api/v1/leaderboard` | Global student leaderboard | No |
| `GET` | `/api/v1/leaderboard/weekly` | Weekly student leaderboard | No |
| `GET` | `/api/v1/progress` | Learning progress & analytics | Yes |
| `POST` | `/api/v1/progress/streak/ping` | Daily study streak ping | Yes |
| `POST` | `/api/v1/doubts/ask` | Ask AI Doubt Solver | Yes |
| `GET` | `/api/v1/doubts/history` | User's doubt history | Yes |

### XP, AI access, course resources, and friends boards

- `GET /api/v1/doubts/status` returns `{ xpBalance, xpCostPerQuestion, trialActive, trialDay, trialStartedAt, trialExpiresAt, trialDaysRemaining }`. The 10-day clock starts on the first authenticated AI question, not on a status check.
- `POST /api/v1/doubts/ask` accepts `{ "question": "...", "subject": "..." }`. A successful in-trial answer costs 0 XP; after the trial, each answer costs 10 XP. Paid answers are charged atomically only after Gemini succeeds. Insufficient balance returns HTTP `402` with `requiredXp`, `availableXp`, `xpBalance`, and trial fields. An optional `Idempotency-Key` header (up to 100 characters) makes retries return the original answer without another charge.
- `POST /api/v1/quizzes/:id/submit` still accepts `{ "answers": [0, 1], "timeTakenSeconds": 90 }`; the server grades answers and awards the configured XP reward by accuracy. A learner can earn XP from a given quiz only once; later attempts remain available and return `xpEarned: 0`. Successful submissions include `currentXpBalance`.
- `GET /api/v1/quizzes?grade=Class%205&subject=Science` filters published catalogue entries. `GET /api/v1/leaderboard` and `/api/v1/leaderboard/worldwide` return the worldwide board; authenticated `GET /api/v1/leaderboard/friends` returns `{ scope: "friends", currentUserRank, leaderboard }`, including the requesting learner.
- `GET /api/v1/courses/:id/resources` returns resource records `{ id, courseId, title, resourceType, resourceUrl, estimatedMinutes, sortOrder }`. Authenticated `POST /api/v1/courses/:id/resources` accepts those fields (except `id`/`courseId`) to add a `video` or `reading` URL. No third-party catalogue URLs are seeded.
- Enrolled learners start time tracking with `POST /api/v1/courses/:id/resources/:resourceId/sessions` (empty body), then complete with `POST /api/v1/courses/:id/resources/:resourceId/sessions/:sessionId/complete` (empty body). Both timestamps are server-generated; completion returns `elapsedSeconds`, `awardedMinutes`, `xpEarned`, and `currentXpBalance`. XP is 5 per validated minute, capped at 60 minutes per session and 120 minutes per learner per day; an active session must be completed before another starts, and completed sessions cannot be replayed.

Migration `9_create_xp_and_learning_tracking` is required before using these endpoints. Re-run the database seeder to add the original published quiz catalogue: 21 quizzes total, including at least 2 quizzes per grade for Classes 5–12 (2 questions per added grade/subject quiz).
