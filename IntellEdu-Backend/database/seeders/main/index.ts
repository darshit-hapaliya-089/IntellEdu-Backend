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

    // 3. Seed Comprehensive Quizzes Catalogue
    const quizzesToSeed = [
      {
        title: 'Chemical Reactions & Balancing Challenge',
        description: 'Test your grasp on chemical reaction types, balancing equations, and oxidation-reduction.',
        grade: 'Class 10',
        subject: 'Science',
        xpReward: 80,
        timeLimitMinutes: 5,
        courseId: course1.id,
        questions: [
          {
            question: 'What type of reaction is 2Mg + O2 -> 2MgO?',
            options: ['Combination Reaction', 'Decomposition Reaction', 'Displacement Reaction', 'Double Displacement'],
            correctOption: 0,
            explanation: 'Two reactants combine to form a single product MgO, making it a Combination Reaction.',
            sortOrder: 1,
          },
          {
            question: 'What is the color change of copper oxide when reduced with hydrogen gas?',
            options: ['Black to Brown', 'Brown to Blue', 'White to Black', 'Green to Yellow'],
            correctOption: 0,
            explanation: 'Black copper(II) oxide is reduced to reddish-brown elemental copper.',
            sortOrder: 2,
          },
          {
            question: 'Which of the following is a balanced equation for the decomposition of water?',
            options: ['2H2O -> 2H2 + O2', 'H2O -> H2 + O2', '2H2O -> H2 + 2O2', 'H2O2 -> H2 + O2'],
            correctOption: 0,
            explanation: '2 molecules of water decompose into 2 molecules of hydrogen gas and 1 of oxygen gas.',
            sortOrder: 3,
          },
        ],
      },
      {
        title: 'Python Machine Learning & AI Foundations',
        description: 'Test your grasp on supervised learning, algorithms, and Python data handling.',
        grade: null,
        subject: 'Computer Science',
        xpReward: 100,
        timeLimitMinutes: 6,
        courseId: course2.id,
        questions: [
          {
            question: 'Which machine learning paradigm uses labeled input-output pairs?',
            options: ['Unsupervised Learning', 'Supervised Learning', 'Reinforcement Learning', 'Evolutionary Learning'],
            correctOption: 1,
            explanation: 'Supervised learning trains models on labeled datasets where true answers are known.',
            sortOrder: 1,
          },
          {
            question: 'Which Python library is primary for numerical array operations in machine learning?',
            options: ['NumPy', 'Flask', 'Django', 'BeautifulSoup'],
            correctOption: 0,
            explanation: 'NumPy provides high-performance n-dimensional array manipulation.',
            sortOrder: 2,
          },
          {
            question: 'What is the function of an activation function in a neural network?',
            options: ['Introduce non-linearity', 'Normalize the file size', 'Compress database records', 'Encrypt weights'],
            correctOption: 0,
            explanation: 'Activation functions introduce non-linearity so networks can learn complex patterns.',
            sortOrder: 3,
          },
        ],
      },
      {
        title: 'Physics: Electricity & Ohm’s Law Challenge',
        description: 'Ohm’s law, resistance in series and parallel, and magnetic effects of electric current.',
        grade: 'Class 10',
        subject: 'Science',
        xpReward: 90,
        timeLimitMinutes: 5,
        courseId: course3.id,
        questions: [
          {
            question: 'According to Ohm’s Law, which relationship is true for an ohmic conductor at constant temperature?',
            options: ['V = I * R', 'V = I / R', 'I = V * R', 'R = V * I'],
            correctOption: 0,
            explanation: 'V = IR (Potential Difference = Current * Resistance).',
            sortOrder: 1,
          },
          {
            question: 'What is the SI unit of electrical resistance?',
            options: ['Volt', 'Ampere', 'Ohm', 'Watt'],
            correctOption: 2,
            explanation: 'The SI unit of resistance is Ohm (Ω).',
            sortOrder: 2,
          },
          {
            question: 'Two resistors of 6Ω each connected in parallel have an equivalent resistance of:',
            options: ['12Ω', '6Ω', '3Ω', '1.5Ω'],
            correctOption: 2,
            explanation: '1/Req = 1/6 + 1/6 = 2/6 = 1/3, so Req = 3Ω.',
            sortOrder: 3,
          },
        ],
      },
      {
        title: 'Mathematics: Algebra & Geometry Sprint',
        description: 'Linear equations, quadratic roots, and triangle geometry essentials.',
        grade: 'Class 10',
        subject: 'Mathematics',
        xpReward: 85,
        timeLimitMinutes: 5,
        courseId: null,
        questions: [
          {
            question: 'If 2x + 5 = 17, what is the value of x?',
            options: ['5', '6', '7', '11'],
            correctOption: 1,
            explanation: '2x = 12 implies x = 6.',
            sortOrder: 1,
          },
          {
            question: 'What is the sum of interior angles of a triangle?',
            options: ['90°', '180°', '270°', '360°'],
            correctOption: 1,
            explanation: 'The interior angles of any triangle always add up to 180°.',
            sortOrder: 2,
          },
        ],
      },
      {
        title: 'English Language & Vocabulary Power',
        description: 'Grammar mechanics, vocabulary, and sentence structures.',
        grade: 'Class 10',
        subject: 'English',
        xpReward: 70,
        timeLimitMinutes: 5,
        courseId: null,
        questions: [
          {
            question: 'Choose the correct synonym for "Meticulous":',
            options: ['Careless', 'Thorough and precise', 'Speedy', 'Ancient'],
            correctOption: 1,
            explanation: 'Meticulous means showing great attention to detail; very careful and precise.',
            sortOrder: 1,
          },
          {
            question: 'Identify the conjunction in: "She studied hard, yet she felt anxious."',
            options: ['studied', 'yet', 'felt', 'hard'],
            correctOption: 1,
            explanation: '"yet" is a coordinating conjunction linking the two clauses.',
            sortOrder: 2,
          },
        ],
      },
    ]

    const q = (question: string, options: string[], correctOption: number, explanation: string, sortOrder: number) => ({
      question, options, correctOption, explanation, sortOrder,
    })
    const gradedContent: Array<{
      grade: number
      subject: string
      title: string
      description: string
      xpReward: number
      questions: ReturnType<typeof q>[]
    }> = [
      { grade: 5, subject: 'Mathematics', title: 'Fractions and Measurement', description: 'Practice equivalent fractions and perimeter.', xpReward: 50, questions: [
        q('What is 3/4 of 20?', ['10', '12', '15', '16'], 2, '20 ÷ 4 = 5, and 5 × 3 = 15.', 1),
        q('A rectangle is 8 cm long and 5 cm wide. What is its perimeter?', ['13 cm', '26 cm', '40 cm', '80 cm'], 1, 'Perimeter = 2 × (8 + 5) = 26 cm.', 2),
      ] },
      { grade: 5, subject: 'Science', title: 'Plants and States of Matter', description: 'Explore photosynthesis and changes of state.', xpReward: 50, questions: [
        q('Which plant part mainly absorbs sunlight to make food?', ['Root', 'Leaf', 'Flower', 'Seed'], 1, 'Leaves contain chlorophyll, which captures light energy for photosynthesis.', 1),
        q('At what temperature does pure water freeze at standard atmospheric pressure?', ['0°C', '10°C', '32°C', '100°C'], 0, 'Pure water freezes at 0°C (32°F) at standard atmospheric pressure.', 2),
      ] },
      { grade: 6, subject: 'Mathematics', title: 'Fractions and Equations', description: 'Add fractions and solve one-step equations.', xpReward: 55, questions: [
        q('What is 3/4 + 1/8?', ['4/12', '5/8', '7/8', '1'], 2, '3/4 is 6/8, and 6/8 + 1/8 = 7/8.', 1),
        q('Solve x + 7 = 19.', ['10', '11', '12', '26'], 2, 'Subtract 7 from both sides: x = 19 − 7 = 12.', 2),
      ] },
      { grade: 6, subject: 'Science', title: 'Changes and Forces', description: 'Review changes of state and the measurement of force.', xpReward: 55, questions: [
        q('What is the change from a liquid to a gas called?', ['Freezing', 'Condensation', 'Evaporation', 'Melting'], 2, 'Evaporation changes a liquid into a gas at its surface.', 1),
        q('What is the SI unit of force?', ['Joule', 'Newton', 'Watt', 'Pascal'], 1, 'Force is measured in newtons (N) in the SI system.', 2),
      ] },
      { grade: 7, subject: 'Mathematics', title: 'Ratios and Powers', description: 'Solve proportional sharing problems and evaluate powers.', xpReward: 60, questions: [
        q('A total of 25 is divided in the ratio 2:3. What is the smaller share?', ['5', '10', '12', '15'], 1, 'There are 5 equal parts, each worth 5; the smaller share is 2 × 5 = 10.', 1),
        q('What is 2³?', ['6', '8', '9', '12'], 1, '2³ means 2 × 2 × 2 = 8.', 2),
      ] },
      { grade: 7, subject: 'Science', title: 'Life Processes', description: 'Check understanding of photosynthesis and circulation.', xpReward: 60, questions: [
        q('Which raw materials do green plants use in photosynthesis?', ['Oxygen and glucose', 'Carbon dioxide and water', 'Nitrogen and oxygen', 'Protein and water'], 1, 'Plants use carbon dioxide and water, with light energy, to make glucose and release oxygen.', 1),
        q('What is the main function of the human heart?', ['Digest food', 'Pump blood', 'Filter air', 'Produce bile'], 1, 'The heart pumps blood through the circulatory system.', 2),
      ] },
      { grade: 8, subject: 'Mathematics', title: 'Percentages and Angles', description: 'Apply percentages and angle relationships.', xpReward: 65, questions: [
        q('What is 15% of 200?', ['15', '20', '30', '35'], 2, '0.15 × 200 = 30.', 1),
        q('Two angles on a straight line are 65° and x°. What is x?', ['25°', '65°', '115°', '125°'], 2, 'Angles on a straight line sum to 180°, so x = 180° − 65° = 115°.', 2),
      ] },
      { grade: 8, subject: 'Science', title: 'Atoms and Sound', description: 'Learn about elements and how sound travels.', xpReward: 65, questions: [
        q('Which is the smallest unit of an element that retains its chemical properties?', ['Cell', 'Atom', 'Compound', 'Tissue'], 1, 'An atom is the smallest unit of an element that retains its chemical identity.', 1),
        q('Why can sound not travel through a vacuum?', ['It is too loud', 'It needs particles in a medium to carry vibrations', 'Vacuum absorbs all energy', 'Sound only travels in water'], 1, 'Sound is a mechanical wave and needs particles to transmit vibrations.', 2),
      ] },
      { grade: 9, subject: 'Mathematics', title: 'Linear Equations and Right Triangles', description: 'Solve a linear equation and use the Pythagorean theorem.', xpReward: 70, questions: [
        q('Solve 3x + 4 = 19.', ['3', '4', '5', '6'], 2, '3x = 15, so x = 5.', 1),
        q('A right triangle has legs of lengths 5 and 12. What is the hypotenuse?', ['13', '15', '17', '25'], 0, 'By the Pythagorean theorem, c² = 5² + 12² = 169, so c = 13.', 2),
      ] },
      { grade: 9, subject: 'Science', title: 'Motion and Atomic Structure', description: 'Review acceleration and atomic number.', xpReward: 70, questions: [
        q('What does acceleration measure?', ['Distance per unit time', 'Change in velocity per unit time', 'Mass per unit volume', 'Force per unit area'], 1, 'Acceleration is the rate of change of velocity with time.', 1),
        q('The atomic number of an element equals its number of:', ['Neutrons only', 'Protons', 'Protons plus neutrons', 'Electron shells'], 1, 'Atomic number is the number of protons in an atom’s nucleus.', 2),
      ] },
      { grade: 10, subject: 'Mathematics', title: 'Quadratics and Trigonometry', description: 'Find quadratic roots and recall a standard trigonometric value.', xpReward: 80, questions: [
        q('What are the roots of x² − 5x + 6 = 0?', ['1 and 6', '2 and 3', '−2 and −3', '−1 and −6'], 1, 'x² − 5x + 6 factors as (x − 2)(x − 3), so the roots are 2 and 3.', 1),
        q('What is sin 30°?', ['0', '1/2', '√3/2', '1'], 1, 'The standard value of sin 30° is 1/2.', 2),
      ] },
      { grade: 10, subject: 'Science', title: 'Circuits and Acids', description: 'Use Ohm’s law and identify acidic solutions by pH.', xpReward: 80, questions: [
        q('A 12 V potential difference is applied across a 3 Ω resistor. What current flows?', ['0.25 A', '3 A', '4 A', '36 A'], 2, 'Ohm’s law gives I = V/R = 12/3 = 4 A.', 1),
        q('At 25°C, which pH value indicates an acidic solution?', ['3', '7', '8', '12'], 0, 'At 25°C, pH below 7 is acidic, pH 7 is neutral, and pH above 7 is basic.', 2),
      ] },
      { grade: 11, subject: 'Mathematics', title: 'Sequences and Differentiation', description: 'Calculate an arithmetic-sequence term and a basic derivative.', xpReward: 85, questions: [
        q('An arithmetic sequence begins 4, 7, 10, … What is its 10th term?', ['28', '31', '34', '40'], 1, 'The nth term is 4 + (n − 1)×3; the 10th term is 4 + 27 = 31.', 1),
        q('What is the derivative of x³ with respect to x?', ['x²', '2x', '3x²', '3x³'], 2, 'By the power rule, d(xⁿ)/dx = n·xⁿ⁻¹, so the derivative is 3x².', 2),
      ] },
      { grade: 11, subject: 'Science', title: 'Mole and Mechanics', description: 'Review the mole and the SI unit of force.', xpReward: 85, questions: [
        q('Approximately how many specified entities are in one mole?', ['6.022 × 10²³', '3.00 × 10⁸', '9.81 × 10²', '1.60 × 10⁻¹⁹'], 0, 'The Avogadro constant is approximately 6.022 × 10²³ entities per mole.', 1),
        q('What is the SI unit of force?', ['Joule', 'Newton', 'Watt', 'Coulomb'], 1, 'The SI unit of force is the newton (N), equal to kg·m/s².', 2),
      ] },
      { grade: 12, subject: 'Mathematics', title: 'Calculus and Probability', description: 'Practice polynomial differentiation and simple probability.', xpReward: 90, questions: [
        q('What is the derivative of x² with respect to x?', ['x', '2x', 'x²', '2'], 1, 'The power rule gives d(x²)/dx = 2x.', 1),
        q('A fair standard deck has 52 cards. What is the probability of drawing an ace?', ['1/52', '1/26', '1/13', '4/13'], 2, 'There are 4 aces among 52 cards, so the probability is 4/52 = 1/13.', 2),
      ] },
      { grade: 12, subject: 'Science', title: 'Electromagnetic Induction and Genetics', description: 'Review electromagnetic induction and complementary DNA base pairs.', xpReward: 90, questions: [
        q('What change induces an emf in a circuit according to Faraday’s law?', ['Constant resistance', 'Changing magnetic flux through the circuit', 'Constant temperature', 'Changing mass of the wire'], 1, 'An emf is induced when magnetic flux linked with a circuit changes.', 1),
        q('Which are the complementary base pairs in DNA?', ['A–G and C–T', 'A–T and G–C', 'A–C and G–T', 'A–U and G–C'], 1, 'In DNA, adenine pairs with thymine and guanine pairs with cytosine.', 2),
      ] },
    ]
    const gradeQuizzes = gradedContent.map((item) => ({
      ...item,
      grade: `Class ${item.grade}`,
      timeLimitMinutes: 5,
      courseId: null,
    }))

    for (const qData of [...quizzesToSeed, ...gradeQuizzes]) {
      const quiz = await Quiz.firstOrCreate(
        { title: qData.title },
        {
          title: qData.title,
          description: qData.description,
          grade: qData.grade,
          subject: qData.subject,
          xpReward: qData.xpReward,
          timeLimitMinutes: qData.timeLimitMinutes,
          isPublished: true,
          courseId: qData.courseId,
        }
      )
      if (qData.grade !== undefined) {
        quiz.grade = qData.grade
        quiz.subject = qData.subject
        await quiz.save()
      }

      const existing = await QuizQuestion.query().where('quiz_id', quiz.id)
      if (existing.length === 0) {
        await QuizQuestion.createMany(
          qData.questions.map((item) => ({
            quizId: quiz.id,
            question: item.question,
            options: item.options,
            correctOption: item.correctOption,
            explanation: item.explanation,
            sortOrder: item.sortOrder,
          }))
        )
      }
    }
  }
}

