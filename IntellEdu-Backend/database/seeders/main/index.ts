import { BaseSeeder } from '@adonisjs/lucid/seeders'
import User from '#models/user'
import Course from '#models/course'
import Quiz, { QuizQuestion } from '#models/quiz'
import { DateTime } from 'luxon'

export default class extends BaseSeeder {
  async run() {
    // 1. Seed Demo Students
    const student1 = await User.firstOrCreate(
      { email: 'alex.student@intelledu.org' },
      {
        fullName: 'Alex Johnson',
        email: 'alex.student@intelledu.org',
        password: 'password123',
        grade: 'Class 10 Science',
        role: 'student',
        points: 2850,
        streak: 14,
        badge: '🥈 Diamond Scholar',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
        lastActiveDate: DateTime.now(),
      }
    )

    const student2 = await User.firstOrCreate(
      { email: 'priya.sharma@intelledu.org' },
      {
        fullName: 'Priya Sharma',
        email: 'priya.sharma@intelledu.org',
        password: 'password123',
        grade: 'Class 10 Science',
        role: 'student',
        points: 3420,
        streak: 21,
        badge: '🥇 Grandmaster',
        avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80',
        lastActiveDate: DateTime.now(),
      }
    )

    const student3 = await User.firstOrCreate(
      { email: 'rahul.patel@intelledu.org' },
      {
        fullName: 'Rahul Patel',
        email: 'rahul.patel@intelledu.org',
        password: 'password123',
        grade: 'Class 10 Science',
        role: 'student',
        points: 2610,
        streak: 12,
        badge: '🥉 Gold Explorer',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
        lastActiveDate: DateTime.now(),
      }
    )

    // 2. Seed Interactive Courses
    const course1 = await Course.firstOrCreate(
      { title: 'Class 10 Science: Chemical Reactions & Equations' },
      {
        title: 'Class 10 Science: Chemical Reactions & Equations',
        description: 'Master types of reactions, oxidation & reduction, and balancing equations with AI step-by-step guidance.',
        category: 'Chemistry',
        grade: 'Class 10',
        imageUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=600&q=80',
        totalLessons: 12,
        rating: 4.9,
        isPublished: true,
        createdBy: student1.id,
      }
    )

    const course2 = await Course.firstOrCreate(
      { title: 'Introduction to AI & Python Machine Learning' },
      {
        title: 'Introduction to AI & Python Machine Learning',
        description: 'Hands-on programming with NumPy, scikit-learn, and neural network foundations for students.',
        category: 'Computer Science',
        grade: 'AI & Coding Essentials',
        imageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80',
        totalLessons: 16,
        rating: 4.9,
        isPublished: true,
        createdBy: student1.id,
      }
    )

    const course3 = await Course.firstOrCreate(
      { title: 'Interactive Physics: Electricity & Magnetism' },
      {
        title: 'Interactive Physics: Electricity & Magnetism',
        description: 'Understand Ohm law, magnetic circuits, and electromagnetic induction with visual simulations.',
        category: 'Physics',
        grade: 'Class 10',
        imageUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=600&q=80',
        totalLessons: 10,
        rating: 4.8,
        isPublished: true,
        createdBy: student1.id,
      }
    )

    // Enroll Alex in course1 & course2
    try {
      await student1.related('courses').attach({
        [course1.id]: {
          enrolled_at: DateTime.now().toSQL(),
          completed_lessons: 9,
          progress_percent: 75,
          is_completed: false,
        },
        [course2.id]: {
          enrolled_at: DateTime.now().toSQL(),
          completed_lessons: 7,
          progress_percent: 45,
          is_completed: false,
        },
      })
    } catch {
      // already attached
    }

    // 3. Seed Quiz
    const quiz1 = await Quiz.firstOrCreate(
      { title: 'Daily AI & Chemistry Challenge' },
      {
        title: 'Daily AI & Chemistry Challenge',
        description: 'Test your grasp on chemical reaction types and foundational AI concepts.',
        xpReward: 100,
        timeLimitMinutes: 5,
        isPublished: true,
        courseId: course1.id,
      }
    )

    // Seed Questions
    const existingQuestions = await QuizQuestion.query().where('quiz_id', quiz1.id)
    if (existingQuestions.length === 0) {
      await QuizQuestion.createMany([
        {
          quizId: quiz1.id,
          question: 'What type of reaction is 2Mg + O2 -> 2MgO?',
          options: ['Combination Reaction', 'Decomposition Reaction', 'Displacement Reaction', 'Double Displacement'],
          correctOption: 0,
          explanation: 'Two reactants combine to form a single product MgO, making it a Combination Reaction.',
          sortOrder: 1,
        },
        {
          quizId: quiz1.id,
          question: 'Which machine learning paradigm uses labeled input-output pairs?',
          options: ['Unsupervised Learning', 'Supervised Learning', 'Reinforcement Learning', 'Evolutionary Learning'],
          correctOption: 1,
          explanation: 'Supervised learning trains models on labeled datasets where the true targets are known.',
          sortOrder: 2,
        },
      ])
    }
  }
}

