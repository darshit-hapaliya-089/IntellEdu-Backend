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
  - OpenAI / Gemini integration with intelligent pedagogical fallback tutor
  - Full doubt question & answer history tracking

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
DB_PASSWORD=postgres
DB_DATABASE=intelledu
```

### 3. Run Migrations & Seed Database
```bash
# Run database migrations
node ace migration:run

# Seed initial courses, quizzes, questions, and demo student profiles
node ace db:seed
```

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

