/*
|--------------------------------------------------------------------------
| IntellEdu API Routes
|--------------------------------------------------------------------------
| All REST API routes for the IntellEdu backend.
| Prefix: /api/v1
*/
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'


// ── Lazy-load controllers ──────────────────────────────────────────────────
const AuthController          = () => import('#controllers/auth_controller')
const AuthOtpController       = () => import('#controllers/auth_otp_controller')
const CoursesController       = () => import('#controllers/courses_controller')
const QuizzesController       = () => import('#controllers/quizzes_controller')
const LeaderboardController   = () => import('#controllers/leaderboard_controller')
const ProgressController      = () => import('#controllers/progress_controller')
const GeminiDoubtSolverController = () => import('#controllers/gemini_doubt_solver_controller')
const UsersController         = () => import('#controllers/users_controller')
const FriendsController       = () => import('#controllers/friends_controller')

/*
|--------------------------------------------------------------------------
| Health-check Route (no auth required)
|--------------------------------------------------------------------------
*/
router.get('/', async () => ({
  status: 'ok',
  service: 'IntellEdu API',
  version: '1.0.0',
}))

router.get('/health', async () => ({
  status: 'healthy',
  timestamp: new Date().toISOString(),
}))

/*
|--------------------------------------------------------------------------
| API v1 Routes
|--------------------------------------------------------------------------
*/
router.group(() => {

  /*
  |── AUTH Routes (/api/v1/auth/*) ──────────────────────────────────────
  | POST /auth/register   → Sign up new student
  | POST /auth/login      → Login, returns JWT
  | POST /auth/logout     → Invalidate token (protected)
  | GET  /auth/me         → Get current user profile (protected)
  | PUT  /auth/me         → Update profile (protected)
  */
  router.group(() => {
    router.get('/whatsapp/status', async () => {
      const { whatsappService } = await import('#services/whatsapp_service')
      return whatsappService.getStatus()
    })
    router.post('/login',    [AuthController, 'login'])
    router.post('/otp/send', [AuthOtpController, 'send'])
    router.post('/otp/verify', [AuthOtpController, 'verify'])
    router.post('/firebase', [AuthController, 'firebase'])
    router.post('/logout',   [AuthController, 'logout']).use(middleware.auth())
    router.get('/me',        [AuthController, 'me']).use(middleware.auth())
    router.put('/me',        [AuthController, 'updateProfile']).use(middleware.auth())
    router.put('/password',  [AuthController, 'updatePassword']).use(middleware.auth())
  }).prefix('/auth')

  /*
  |── USER Routes (/api/v1/users/*) ──────────────────────────────────────
  | GET  /users/:id/stats   → Get user progress stats (protected)
  */
  router.group(() => {
    router.get('/:id/stats', [UsersController, 'stats'])
  }).prefix('/users').use(middleware.auth())

  /*
  |── FRIEND Routes (/api/v1/friends/*) ─────────────────────────────────────
  */
  router.group(() => {
    router.get('/', [FriendsController, 'index'])
    router.post('/:id', [FriendsController, 'store'])
    router.delete('/:id', [FriendsController, 'destroy'])
  }).prefix('/friends').use(middleware.auth())

  /*
  |── COURSE Routes (/api/v1/courses/*) ──────────────────────────────────
  | GET    /courses             → List all courses
  | GET    /courses/:id         → Get single course details
  | POST   /courses             → Create course (admin)
  | PUT    /courses/:id         → Update course (admin)
  | DELETE /courses/:id         → Delete course (admin)
  | GET    /courses/:id/enroll  → Enroll user in course (protected)
  */
  router.group(() => {
    router.get('/',           [CoursesController, 'index'])
    router.get('/:id/resources', [CoursesController, 'resources'])
    router.get('/:id',        [CoursesController, 'show'])
    router.post('/:id/resources', [CoursesController, 'addResource']).use(middleware.auth())
    router.post('/:id/resources/:resourceId/sessions', [CoursesController, 'startLearningSession']).use(middleware.auth())
    router.post('/:id/resources/:resourceId/sessions/:sessionId/complete', [CoursesController, 'completeLearningSession']).use(middleware.auth())
    router.post('/',          [CoursesController, 'store']).use(middleware.auth())
    router.put('/:id',        [CoursesController, 'update']).use(middleware.auth())
    router.delete('/:id',     [CoursesController, 'destroy']).use(middleware.auth())
    router.post('/:id/enroll',[CoursesController, 'enroll']).use(middleware.auth())
    router.put('/:id/progress',[CoursesController, 'updateProgress']).use(middleware.auth())
  }).prefix('/courses')

  /*
  |── QUIZ Routes (/api/v1/quizzes/*) ──────────────────────────────────────
  | GET  /quizzes              → List all quizzes
  | GET  /quizzes/:id          → Get quiz with questions
  | POST /quizzes/:id/submit   → Submit quiz answers, get score (protected)
  | GET  /quizzes/my-results   → Get user's quiz history (protected)
  */
  router.group(() => {
    router.get('/',                 [QuizzesController, 'index'])
    router.get('/my-results',       [QuizzesController, 'myResults']).use(middleware.auth())
    router.get('/:id',              [QuizzesController, 'show'])
    router.post('/:id/submit',      [QuizzesController, 'submit']).use(middleware.auth())
  }).prefix('/quizzes')

  /*
  |── LEADERBOARD Routes (/api/v1/leaderboard/*) ────────────────────────────
  | GET /leaderboard            → Global top 50 leaderboard
  | GET /leaderboard/weekly     → This week's top 20
  | GET /leaderboard/class/:grade → Class/grade-level leaderboard
  */
  router.group(() => {
    router.get('/',              [LeaderboardController, 'global'])
    router.get('/worldwide',     [LeaderboardController, 'global'])
    router.get('/friends',       [LeaderboardController, 'friends']).use(middleware.auth())
    router.get('/weekly',        [LeaderboardController, 'weekly'])
    router.get('/class/:grade',  [LeaderboardController, 'byGrade'])
  }).prefix('/leaderboard')

  /*
  |── PROGRESS Routes (/api/v1/progress/*) ────────────────────────────────
  | GET /progress              → My overall progress dashboard (protected)
  | GET /progress/streak       → My current streak info (protected)
  | POST /progress/streak/ping → Ping to update today's streak (protected)
  */
  router.group(() => {
    router.get('/',              [ProgressController, 'myProgress'])
    router.get('/streak',        [ProgressController, 'streak'])
    router.post('/streak/ping',  [ProgressController, 'pingStreak'])
  }).prefix('/progress').use(middleware.auth())

  /*
  |── AI DOUBT SOLVER Routes (/api/v1/doubts/*) ────────────────────────────
  | POST /doubts/ask            → Proxy AI doubt question (protected)
  | GET  /doubts/history        → My doubt history (protected)
  */
  router.group(() => {
    router.post('/ask',          [GeminiDoubtSolverController, 'ask'])
    router.get('/status',        [GeminiDoubtSolverController, 'status'])
    router.get('/history',       [GeminiDoubtSolverController, 'history'])
  }).prefix('/doubts').use(middleware.auth())

}).prefix('/api/v1')

// Initialize IntellEdu WhatsApp Bot service
import('#services/whatsapp_service').then(({ whatsappService }) => {
  whatsappService.init().catch((err) => console.warn('[WhatsApp Bot Init Failed]:', err))
})
