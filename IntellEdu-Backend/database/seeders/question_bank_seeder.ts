import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Quiz, { QuizQuestion } from '#models/quiz'

interface QuestionSeed {
  question: string
  options: string[]
  correctOption: number
  explanation: string
  sortOrder: number
}

interface QuizSeed {
  slug: string
  title: string
  description: string
  grade: string
  subject: string
  difficulty: 'easy' | 'medium' | 'hard'
  xpReward: number
  timeLimitMinutes: number
  iconKey: string
  questions: QuestionSeed[]
}

const SEED_QUIZZES: QuizSeed[] = [
  // ── MATHEMATICS (Grades 6, 8, 10, 11, 12) ──────────────────────────
  {
    slug: 'maths-foundations-integers-g6',
    title: 'Integers & Number Systems Mastery',
    description: 'Master positive & negative integers, absolute values, and order of operations.',
    grade: 'Class 6',
    subject: 'Mathematics',
    difficulty: 'easy',
    xpReward: 40,
    timeLimitMinutes: 5,
    iconKey: 'maths',
    questions: [
      {
        question: 'What is the result of (-15) + (+23)?',
        options: ['-8', '8', '38', '-38'],
        correctOption: 1,
        explanation: 'Adding positive 23 to negative 15 yields +8.',
        sortOrder: 1,
      },
      {
        question: 'Which of the following numbers is the smallest?',
        options: ['-12', '-5', '0', '-2'],
        correctOption: 0,
        explanation: 'On the number line, numbers furthest to the left are smallest, so -12 is smallest.',
        sortOrder: 2,
      },
      {
        question: 'What is the absolute value of -47, written as |-47|?',
        options: ['-47', '0', '47', '1'],
        correctOption: 2,
        explanation: 'The absolute value represents distance from zero on the number line, which is always non-negative: 47.',
        sortOrder: 3,
      },
      {
        question: 'Evaluate the expression: (-6) × (-7)',
        options: ['-42', '42', '-13', '13'],
        correctOption: 1,
        explanation: 'The product of two negative numbers is always positive: (-6) × (-7) = 42.',
        sortOrder: 4,
      },
      {
        question: 'What integer precedes -99 on the number line (one less than -99)?',
        options: ['-98', '-100', '98', '-101'],
        correctOption: 1,
        explanation: '-99 - 1 = -100.',
        sortOrder: 5,
      },
    ],
  },
  {
    slug: 'maths-linear-equations-g8',
    title: 'Linear Equations in One Variable',
    description: 'Solve single-variable algebraic equations with brackets and fractions.',
    grade: 'Class 8',
    subject: 'Mathematics',
    difficulty: 'medium',
    xpReward: 75,
    timeLimitMinutes: 6,
    iconKey: 'maths',
    questions: [
      {
        question: 'Solve for x: 3x - 7 = 14',
        options: ['5', '6', '7', '8'],
        correctOption: 2,
        explanation: '3x = 14 + 7 = 21, hence x = 21 / 3 = 7.',
        sortOrder: 1,
      },
      {
        question: 'If 2(y + 3) = 18, what is the value of y?',
        options: ['4', '5', '6', '9'],
        correctOption: 2,
        explanation: 'Divide both sides by 2: y + 3 = 9, so y = 6.',
        sortOrder: 2,
      },
      {
        question: 'Solve: x/4 + 5 = 11',
        options: ['24', '16', '36', '44'],
        correctOption: 0,
        explanation: 'x/4 = 11 - 5 = 6; therefore x = 6 × 4 = 24.',
        sortOrder: 3,
      },
      {
        question: 'Two consecutive integers add up to 55. What is the smaller integer?',
        options: ['26', '27', '28', '29'],
        correctOption: 1,
        explanation: 'Let integers be n and n+1. 2n + 1 = 55 => 2n = 54 => n = 27.',
        sortOrder: 4,
      },
      {
        question: 'Solve for p: 5p - 3 = 2p + 12',
        options: ['3', '4', '5', '6'],
        correctOption: 2,
        explanation: '5p - 2p = 12 + 3 => 3p = 15 => p = 5.',
        sortOrder: 5,
      },
    ],
  },
  {
    slug: 'maths-trigonometry-class10',
    title: 'Trigonometry Ratios & Standard Angles',
    description: 'Master sin, cos, tan, standard angle values, and Pythagorean trigonometric identities.',
    grade: 'Class 10',
    subject: 'Mathematics',
    difficulty: 'hard',
    xpReward: 120,
    timeLimitMinutes: 7,
    iconKey: 'maths',
    questions: [
      {
        question: 'What is the exact value of sin 60°?',
        options: ['1/2', '1/√2', '√3/2', '1'],
        correctOption: 2,
        explanation: 'The standard trigonometric value for sin 60° is √3/2.',
        sortOrder: 1,
      },
      {
        question: 'Which of the following is equal to sin²θ + cos²θ?',
        options: ['0', '1', 'tan²θ', 'sec²θ'],
        correctOption: 1,
        explanation: 'The fundamental Pythagorean trigonometric identity states sin²θ + cos²θ = 1.',
        sortOrder: 2,
      },
      {
        question: 'If tan A = 4/3, what is the value of sec A in the first quadrant?',
        options: ['3/5', '5/3', '5/4', '4/5'],
        correctOption: 1,
        explanation: 'sec²A = 1 + tan²A = 1 + 16/9 = 25/9. Taking the square root gives sec A = 5/3.',
        sortOrder: 3,
      },
      {
        question: 'What is the value of (cos 0° + sin 90° + tan 45°)?',
        options: ['1', '2', '3', '0'],
        correctOption: 2,
        explanation: 'cos 0° = 1, sin 90° = 1, tan 45° = 1. Sum = 1 + 1 + 1 = 3.',
        sortOrder: 4,
      },
      {
        question: 'Evaluate: sin 30° × cos 60° + cos 30° × sin 60°',
        options: ['0', '1/2', '1', '√3/4'],
        correctOption: 2,
        explanation: 'This matches sin(30° + 60°) = sin 90° = 1. (Or (1/2)(1/2) + (√3/2)(√3/2) = 1/4 + 3/4 = 1).',
        sortOrder: 5,
      },
    ],
  },
  {
    slug: 'maths-calculus-limits-class11',
    title: 'Limits & Derivatives Primer',
    description: 'Foundations of differential calculus, standard limit rules, and power rule derivatives.',
    grade: 'Class 11',
    subject: 'Mathematics',
    difficulty: 'hard',
    xpReward: 130,
    timeLimitMinutes: 7,
    iconKey: 'maths',
    questions: [
      {
        question: 'Evaluate lim(x→0) [sin(x) / x]:',
        options: ['0', '1', 'Undefined', 'Infinity'],
        correctOption: 1,
        explanation: 'The standard limit of sin(x)/x as x approaches 0 in radians is 1.',
        sortOrder: 1,
      },
      {
        question: 'What is the derivative of f(x) = 4x³ - 5x + 7 with respect to x?',
        options: ['12x² - 5', '12x² - 5x', '4x² - 5', '12x³ - 5'],
        correctOption: 0,
        explanation: 'Using the power rule: d/dx(4x³) = 12x², d/dx(-5x) = -5, d/dx(7) = 0.',
        sortOrder: 2,
      },
      {
        question: 'What is the derivative of g(x) = e^(2x)?',
        options: ['e^(2x)', '2e^(2x)', '2e^x', 'e^(2x) / 2'],
        correctOption: 1,
        explanation: 'By the chain rule, d/dx[e^(2x)] = 2 × e^(2x).',
        sortOrder: 3,
      },
      {
        question: 'Evaluate lim(x→2) [(x² - 4) / (x - 2)]:',
        options: ['0', '2', '4', 'Infinity'],
        correctOption: 2,
        explanation: '(x² - 4)/(x - 2) factors into (x - 2)(x + 2)/(x - 2) = x + 2. When x = 2, 2 + 2 = 4.',
        sortOrder: 4,
      },
      {
        question: 'What is the derivative of ln(x) for x > 0?',
        options: ['1/x', 'e^x', 'x', '1/x²'],
        correctOption: 0,
        explanation: 'The derivative of natural logarithm ln(x) is 1/x.',
        sortOrder: 5,
      },
    ],
  },

  // ── PHYSICS (Grades 9, 10, 11, 12) ──────────────────────────
  {
    slug: 'physics-kinematics-class9',
    title: 'Laws of Motion & Gravitation',
    description: 'Speed, velocity, acceleration, Newton laws, and universal gravitation.',
    grade: 'Class 9',
    subject: 'Physics',
    difficulty: 'medium',
    xpReward: 70,
    timeLimitMinutes: 6,
    iconKey: 'physics',
    questions: [
      {
        question: 'Which equation correctly expresses Newton second law of motion?',
        options: ['F = m / a', 'F = m × a', 'F = m × v', 'F = a / m'],
        correctOption: 1,
        explanation: 'Newton second law states that Force equals mass multiplied by acceleration (F = ma).',
        sortOrder: 1,
      },
      {
        question: 'What is the SI unit of universal gravitational constant (G)?',
        options: ['N m² kg⁻²', 'N kg m⁻²', 'm s⁻²', 'N m kg⁻¹'],
        correctOption: 0,
        explanation: 'From F = G m₁m₂/r², G = F r²/(m₁m₂), giving units N·m²/kg² (N m² kg⁻²).',
        sortOrder: 2,
      },
      {
        question: 'An object travels 100 meters in 4 seconds at constant velocity. What is its velocity?',
        options: ['20 m/s', '25 m/s', '40 m/s', '400 m/s'],
        correctOption: 1,
        explanation: 'Velocity = displacement / time = 100 m / 4 s = 25 m/s.',
        sortOrder: 3,
      },
      {
        question: 'The inertia of a moving body depends directly on its:',
        options: ['Speed', 'Volume', 'Mass', 'Shape'],
        correctOption: 2,
        explanation: 'Mass is the quantitative measure of an object inertia.',
        sortOrder: 4,
      },
      {
        question: 'When a car rounds a curve, passengers lean outward due to:',
        options: ['Gravitational pull', 'Inertia of direction', 'Friction force', 'Air resistance'],
        correctOption: 1,
        explanation: 'Inertia of direction causes bodies to tend to maintain their original straight-line path.',
        sortOrder: 5,
      },
    ],
  },
  {
    slug: 'physics-optics-light-class10',
    title: 'Light: Reflection & Refraction',
    description: 'Concave and convex mirrors, Snell law, lens formula, and optical power.',
    grade: 'Class 10',
    subject: 'Physics',
    difficulty: 'medium',
    xpReward: 85,
    timeLimitMinutes: 6,
    iconKey: 'physics',
    questions: [
      {
        question: 'The power of a lens with focal length +0.5 meters is:',
        options: ['+0.5 D', '+1.0 D', '+2.0 D', '-2.0 D'],
        correctOption: 2,
        explanation: 'Power P = 1 / f(in meters). 1 / 0.5 = +2.0 Diopters.',
        sortOrder: 1,
      },
      {
        question: 'Which mirror is commonly used by dentists to view enlarged teeth images?',
        options: ['Plane mirror', 'Convex mirror', 'Concave mirror', 'Cylindrical mirror'],
        correctOption: 2,
        explanation: 'Concave mirrors produce a magnified virtual upright image when the object is between pole and focus.',
        sortOrder: 2,
      },
      {
        question: 'Snell law relates angles of incidence and refraction through which formula?',
        options: ['sin(i) / sin(r) = constant', 'sin(i) × sin(r) = constant', 'tan(i) / tan(r) = constant', 'cos(i) / cos(r) = constant'],
        correctOption: 0,
        explanation: 'Snell law states sin(i) / sin(r) = n₂ / n₁ (refractive index ratio).',
        sortOrder: 3,
      },
      {
        question: 'What is the speed of light in a vacuum?',
        options: ['3 × 10⁶ m/s', '3 × 10⁸ m/s', '3 × 10¹⁰ m/s', '3 × 10⁵ km/s only in air'],
        correctOption: 1,
        explanation: 'The speed of light in vacuum is approximately 3 × 10⁸ m/s (300,000 km/s).',
        sortOrder: 4,
      },
      {
        question: 'A convex mirror always produces an image that is:',
        options: ['Real and inverted', 'Virtual, erect, and diminished', 'Virtual, erect, and magnified', 'Real and enlarged'],
        correctOption: 1,
        explanation: 'Convex mirrors always form virtual, erect, and diminished images regardless of object distance.',
        sortOrder: 5,
      },
    ],
  },
  {
    slug: 'physics-current-circuits-class12',
    title: 'Current Electricity & Kirchhoff Rules',
    description: 'Drift velocity, Wheatstone bridge, internal resistance, and Kirchhoff network laws.',
    grade: 'Class 12',
    subject: 'Physics',
    difficulty: 'hard',
    xpReward: 140,
    timeLimitMinutes: 7,
    iconKey: 'physics',
    questions: [
      {
        question: 'Kirchhoff Junction Rule (First Rule) is based on the conservation of:',
        options: ['Energy', 'Linear momentum', 'Electric charge', 'Mass'],
        correctOption: 2,
        explanation: 'The junction rule states that current entering a node equals current leaving, conserving electric charge.',
        sortOrder: 1,
      },
      {
        question: 'Kirchhoff Loop Rule (Second Rule) is based on the conservation of:',
        options: ['Electric charge', 'Energy', 'Angular momentum', 'Magnetic field'],
        correctOption: 1,
        explanation: 'The sum of potential differences around any closed circuit loop is zero, conserving energy.',
        sortOrder: 2,
      },
      {
        question: 'In a balanced Wheatstone bridge with resistors P, Q, R, S, the condition is:',
        options: ['P × Q = R × S', 'P / Q = R / S', 'P + Q = R + S', 'P - Q = R - S'],
        correctOption: 1,
        explanation: 'A Wheatstone bridge is balanced when P / Q = R / S, causing zero galvanometer current.',
        sortOrder: 3,
      },
      {
        question: 'How does the electrical resistance of a metallic conductor change with increasing temperature?',
        options: ['Decreases', 'Increases', 'Remains unchanged', 'Becomes zero'],
        correctOption: 1,
        explanation: 'In metals, higher temperature increases electron-ion collision frequency, increasing resistance.',
        sortOrder: 4,
      },
      {
        question: 'The terminal potential difference V of a discharging cell with emf E, internal resistance r, and current I is:',
        options: ['V = E + Ir', 'V = E - Ir', 'V = E / Ir', 'V = Ir - E'],
        correctOption: 1,
        explanation: 'During discharge, terminal voltage is V = E - Ir due to the internal voltage drop across r.',
        sortOrder: 5,
      },
    ],
  },

  // ── CHEMISTRY (Grades 9, 10, 11, 12) ────────────────────────
  {
    slug: 'chem-matter-atoms-class9',
    title: 'Matter in Our Surroundings & Atoms',
    description: 'States of matter, sublimation, Dalton atomic theory, and chemical symbols.',
    grade: 'Class 9',
    subject: 'Chemistry',
    difficulty: 'easy',
    xpReward: 45,
    timeLimitMinutes: 5,
    iconKey: 'chemistry',
    questions: [
      {
        question: 'The direct transition from solid phase to gas phase without becoming liquid is:',
        options: ['Evaporation', 'Sublimation', 'Condensation', 'Fusion'],
        correctOption: 1,
        explanation: 'Sublimation is the direct change from solid to gas, seen in dry ice and camphor.',
        sortOrder: 1,
      },
      {
        question: 'What is the chemical symbol for the element Sodium?',
        options: ['So', 'Sd', 'Na', 'Sm'],
        correctOption: 2,
        explanation: 'Sodium chemical symbol is Na, derived from the Latin Natrium.',
        sortOrder: 2,
      },
      {
        question: 'Which of the following is an example of a homogeneous mixture?',
        options: ['Sand and water', 'Salt dissolved in water', 'Chalk powder in water', 'Oil and water'],
        correctOption: 1,
        explanation: 'Salt water forms a uniform single-phase solution, making it homogeneous.',
        sortOrder: 3,
      },
      {
        question: 'What is the standard boiling point of pure water at 1 atmosphere pressure on the Kelvin scale?',
        options: ['100 K', '273 K', '373 K', '473 K'],
        correctOption: 2,
        explanation: '0°C = 273.15 K, so 100°C = 373.15 K (approx. 373 K).',
        sortOrder: 4,
      },
      {
        question: 'The atomic mass unit (amu or u) is standardly defined as 1/12th the mass of an atom of:',
        options: ['Hydrogen-1', 'Carbon-12', 'Oxygen-16', 'Nitrogen-14'],
        correctOption: 1,
        explanation: 'By IUPAC definition, 1 unified atomic mass unit is 1/12th of the mass of an unbound neutral Carbon-12 atom.',
        sortOrder: 5,
      },
    ],
  },
  {
    slug: 'chem-periodic-table-bonding-class10',
    title: 'Periodic Classification & Chemical Bonding',
    description: 'Modern periodic law, valence electrons, ionic vs covalent bonds, and electronegativity trends.',
    grade: 'Class 10',
    subject: 'Chemistry',
    difficulty: 'medium',
    xpReward: 80,
    timeLimitMinutes: 6,
    iconKey: 'chemistry',
    questions: [
      {
        question: 'According to Moseley Modern Periodic Law, properties of elements are periodic functions of their:',
        options: ['Atomic masses', 'Atomic numbers', 'Neutron counts', 'Density'],
        correctOption: 1,
        explanation: 'The Modern Periodic Table arranges elements in order of increasing atomic number (Z).',
        sortOrder: 1,
      },
      {
        question: 'What type of chemical bond is formed by mutual sharing of electron pairs between two atoms?',
        options: ['Ionic bond', 'Covalent bond', 'Metallic bond', 'Hydrogen bond'],
        correctOption: 1,
        explanation: 'Covalent bonds form when atoms share one or more pairs of valence electrons.',
        sortOrder: 2,
      },
      {
        question: 'Which element in the periodic table has the highest electronegativity?',
        options: ['Oxygen', 'Chlorine', 'Fluorine', 'Nitrogen'],
        correctOption: 2,
        explanation: 'Fluorine has the highest Pauling electronegativity value (approx. 3.98).',
        sortOrder: 3,
      },
      {
        question: 'Noble gases in Group 18 are chemically unreactive primarily because they have:',
        options: ['Incomplete inner shells', 'Complete valence octets', 'Only one electron', 'Zero mass'],
        correctOption: 1,
        explanation: 'Group 18 elements have complete outer electron shells (duplet for He, octet for others), giving high chemical stability.',
        sortOrder: 4,
      },
      {
        question: 'What is the pH of a neutral aqueous solution at 25°C?',
        options: ['0', '1', '7', '14'],
        correctOption: 2,
        explanation: 'At 25°C, [H⁺] = 10⁻⁷ M in neutral water, corresponding to pH = 7.',
        sortOrder: 5,
      },
    ],
  },
  {
    slug: 'chem-organic-hydrocarbons-class12',
    title: 'Hydrocarbons & Functional Groups',
    description: 'Alkanes, alkenes, alkynes, isomerism, and identification of key organic functional groups.',
    grade: 'Class 12',
    subject: 'Chemistry',
    difficulty: 'hard',
    xpReward: 135,
    timeLimitMinutes: 7,
    iconKey: 'chemistry',
    questions: [
      {
        question: 'What is the general chemical formula for non-cyclic saturated alkanes?',
        options: ['CnH2n', 'CnH2n+2', 'CnH2n-2', 'CnHn'],
        correctOption: 1,
        explanation: 'Alkanes have the general molecular formula CnH2n+2.',
        sortOrder: 1,
      },
      {
        question: 'Which functional group characterizes carboxylic acids?',
        options: ['-CHO', '-OH', '-COOH', '-CO-'],
        correctOption: 2,
        explanation: 'The carboxyl group -COOH defines carboxylic acids like ethanoic acid.',
        sortOrder: 2,
      },
      {
        question: 'What type of hybridization is present in the carbon atoms of ethyne (acetylene, C₂H₂)?',
        options: ['sp³', 'sp²', 'sp', 'dsp²'],
        correctOption: 2,
        explanation: 'Carbon atoms in triple-bonded alkynes like ethyne undergo sp hybridization (linear 180° geometry).',
        sortOrder: 3,
      },
      {
        question: 'Markovnikov rule is standardly applied during which type of reaction on unsymmetrical alkenes?',
        options: ['Electrophilic addition', 'Nucleophilic substitution', 'Free radical substitution', 'Esterification'],
        correctOption: 0,
        explanation: 'Markovnikov rule predicts the regiochemistry of electrophilic additions (like HX) across unsymmetrical C=C bonds.',
        sortOrder: 4,
      },
      {
        question: 'Which reagent is famously used in Tollens test to distinguish aldehydes from ketones?',
        options: ['Acidified K₂Cr₂O₇', 'Ammoniacal silver nitrate solution', 'Copper sulfate and sodium hydroxide', 'Bromine water'],
        correctOption: 1,
        explanation: 'Tollens reagent is ammoniacal silver nitrate; it oxidizes aldehydes producing a reflective silver mirror.',
        sortOrder: 5,
      },
    ],
  },

  // ── BIOLOGY (Grades 8, 10, 11, 12) ──────────────────────────
  {
    slug: 'bio-cell-structure-class8',
    title: 'Cell: The Unit of Life',
    description: 'Plant and animal cells, cell organelles, nucleus, and mitochondria.',
    grade: 'Class 8',
    subject: 'Biology',
    difficulty: 'easy',
    xpReward: 40,
    timeLimitMinutes: 5,
    iconKey: 'biology',
    questions: [
      {
        question: 'Which organelle is universally referred to as the powerhouse of the eukaryotic cell?',
        options: ['Ribosome', 'Mitochondria', 'Golgi apparatus', 'Lysosome'],
        correctOption: 1,
        explanation: 'Mitochondria produce cellular ATP through aerobic cellular respiration.',
        sortOrder: 1,
      },
      {
        question: 'Which of the following cellular structures is present in plant cells but absent in animal cells?',
        options: ['Cell membrane', 'Cell wall', 'Cytoplasm', 'Ribosome'],
        correctOption: 1,
        explanation: 'Plant cells have a rigid cellulose cell wall outside the plasma membrane.',
        sortOrder: 2,
      },
      {
        question: 'Which green pigment in chloroplasts is essential for capturing solar energy in photosynthesis?',
        options: ['Hemoglobin', 'Chlorophyll', 'Melanin', 'Carotene'],
        correctOption: 1,
        explanation: 'Chlorophyll absorbs blue and red wavelengths of light for photosynthetic energy capture.',
        sortOrder: 3,
      },
      {
        question: 'The control center containing the genetic material (DNA) in a eukaryotic cell is the:',
        options: ['Vacuole', 'Centrosome', 'Nucleus', 'Endoplasmic reticulum'],
        correctOption: 2,
        explanation: 'The nucleus houses eukaryotic genomic chromosomes and coordinates cell activities.',
        sortOrder: 4,
      },
      {
        question: 'Who first discovered and named cells under a microscope in 1665?',
        options: ['Robert Hooke', 'Antonie van Leeuwenhoek', 'Louis Pasteur', 'Gregor Mendel'],
        correctOption: 0,
        explanation: 'Robert Hooke coined the term cell after observing cork tissue compartments.',
        sortOrder: 5,
      },
    ],
  },
  {
    slug: 'bio-life-processes-class10',
    title: 'Life Processes & Human Physiology',
    description: 'Human digestive, circulatory, respiratory, and excretory systems.',
    grade: 'Class 10',
    subject: 'Biology',
    difficulty: 'medium',
    xpReward: 85,
    timeLimitMinutes: 6,
    iconKey: 'biology',
    questions: [
      {
        question: 'In humans, the primary site of nutrient absorption is the:',
        options: ['Stomach', 'Large intestine', 'Small intestine', 'Esophagus'],
        correctOption: 2,
        explanation: 'The small intestine (jejunum & ileum) possesses millions of microvilli that absorb digested nutrients.',
        sortOrder: 1,
      },
      {
        question: 'The structural and functional filtration unit of the human kidney is the:',
        options: ['Neuron', 'Nephron', 'Alveolus', 'Hepatocyte'],
        correctOption: 1,
        explanation: 'Each kidney contains around 1 million nephrons that filter blood and produce urine.',
        sortOrder: 2,
      },
      {
        question: 'Oxygenated blood from the lungs enters which chamber of the human heart?',
        options: ['Right atrium', 'Right ventricle', 'Left atrium', 'Left ventricle'],
        correctOption: 2,
        explanation: 'Pulmonary veins carry oxygen-rich blood directly into the left atrium of the heart.',
        sortOrder: 3,
      },
      {
        question: 'Which gas is produced as a primary byproduct of human aerobic respiration?',
        options: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Hydrogen'],
        correctOption: 1,
        explanation: 'Glucose + O₂ produces CO₂ + H₂O + ATP during cellular aerobic respiration.',
        sortOrder: 4,
      },
      {
        question: 'What is the role of bile juice produced by the liver in digestion?',
        options: ['Digest starch into glucose', 'Emulsify large fat globules', 'Synthesize proteins', 'Kill friendly bacteria'],
        correctOption: 1,
        explanation: 'Bile salts break large fat droplets into small micelles for pancreatic lipase digestion.',
        sortOrder: 5,
      },
    ],
  },
  {
    slug: 'bio-genetics-heredity-class12',
    title: 'Genetics, DNA & Molecular Inheritance',
    description: 'Mendelian ratios, DNA double helix structure, transcription, and translation.',
    grade: 'Class 12',
    subject: 'Biology',
    difficulty: 'hard',
    xpReward: 140,
    timeLimitMinutes: 7,
    iconKey: 'biology',
    questions: [
      {
        question: 'What is the classic phenotypic ratio expected in the F2 generation of a Mendelian monohybrid cross?',
        options: ['1:1', '3:1', '9:3:3:1', '1:2:1'],
        correctOption: 1,
        explanation: 'A heterozygous monohybrid cross (Tt × Tt) produces a 3:1 dominant to recessive phenotypic ratio.',
        sortOrder: 1,
      },
      {
        question: 'In a double-stranded DNA molecule, which nitrogenous base forms two hydrogen bonds with Adenine?',
        options: ['Guanine', 'Cytosine', 'Thymine', 'Uracil'],
        correctOption: 2,
        explanation: 'Adenine pairs specifically with Thymine via two hydrogen bonds (A=T) in DNA.',
        sortOrder: 2,
      },
      {
        question: 'The process of synthesizing messenger RNA (mRNA) from a DNA template strand is known as:',
        options: ['Replication', 'Transcription', 'Translation', 'Translocation'],
        correctOption: 1,
        explanation: 'Transcription is the enzymatic synthesis of RNA by RNA polymerase using a DNA template.',
        sortOrder: 3,
      },
      {
        question: 'Which codon acts as the universal start codon in protein translation?',
        options: ['UAA', 'AUG', 'UGA', 'UAG'],
        correctOption: 1,
        explanation: 'AUG codes for methionine and initiates translation in eukaryotes and prokaryotes.',
        sortOrder: 4,
      },
      {
        question: 'Who proposed the famous semi-conservative double-helix model of DNA in 1953?',
        options: ['Gregor Mendel', 'James Watson and Francis Crick', 'Charles Darwin', 'Thomas Hunt Morgan'],
        correctOption: 1,
        explanation: 'James Watson and Francis Crick deciphered the antiparallel double-helix structure of DNA.',
        sortOrder: 5,
      },
    ],
  },

  // ── COMPUTER SCIENCE (Grades 9, 10, 11, 12) ─────────────────
  {
    slug: 'cs-python-basics-class9',
    title: 'Python Programming Essentials',
    description: 'Variables, datatypes, loops, conditions, and basic string manipulation in Python.',
    grade: 'Class 9',
    subject: 'Computer Science',
    difficulty: 'easy',
    xpReward: 50,
    timeLimitMinutes: 5,
    iconKey: 'cs',
    questions: [
      {
        question: 'What is the output of print(type([1, 2, 3])) in Python?',
        options: ["<class 'tuple'>", "<class 'list'>", "<class 'set'>", "<class 'dict'>"],
        correctOption: 1,
        explanation: 'Square brackets define a list object in Python.',
        sortOrder: 1,
      },
      {
        question: 'Which keyword is used to define a function in Python?',
        options: ['function', 'func', 'def', 'define'],
        correctOption: 2,
        explanation: 'Python uses the def keyword to define functions.',
        sortOrder: 2,
      },
      {
        question: 'What is the result of 17 // 5 in Python (integer floor division)?',
        options: ['3.4', '3', '2', '3.0'],
        correctOption: 1,
        explanation: 'The double slash // performs floor division, rounding down to integer 3.',
        sortOrder: 3,
      },
      {
        question: 'Which data structure in Python is immutable (cannot be altered after creation)?',
        options: ['List', 'Dictionary', 'Set', 'Tuple'],
        correctOption: 3,
        explanation: 'Tuples are immutable sequences in Python; their elements cannot be reassigned.',
        sortOrder: 4,
      },
      {
        question: 'How do you insert a single-line comment in Python code?',
        options: ['// this is comment', '/* this is comment */', '# this is comment', '<!-- this is comment -->'],
        correctOption: 2,
        explanation: 'The hash symbol # denotes single-line comments in Python.',
        sortOrder: 5,
      },
    ],
  },
  {
    slug: 'cs-networking-web-class10',
    title: 'Computer Networks & Internet Protocols',
    description: 'IP addresses, DNS, HTTP/HTTPS, topology, and client-server web architectures.',
    grade: 'Class 10',
    subject: 'Computer Science',
    difficulty: 'medium',
    xpReward: 80,
    timeLimitMinutes: 6,
    iconKey: 'cs',
    questions: [
      {
        question: 'What does the abbreviation HTTP stand for in web browsing?',
        options: ['Hyperlink Transfer Text Protocol', 'HyperText Transfer Protocol', 'High Technical Transfer Program', 'Hyper Terminal Tracking Process'],
        correctOption: 1,
        explanation: 'HTTP stands for HyperText Transfer Protocol, the protocol of the World Wide Web.',
        sortOrder: 1,
      },
      {
        question: 'Which network system translates human-friendly domain names (e.g., intelledu.org) into IP addresses?',
        options: ['DHCP', 'DNS', 'FTP', 'SMTP'],
        correctOption: 1,
        explanation: 'The Domain Name System (DNS) maps human-readable hostnames to numeric IP addresses.',
        sortOrder: 2,
      },
      {
        question: 'Which network topology connects every computer to a single central hub or switch?',
        options: ['Bus topology', 'Ring topology', 'Star topology', 'Mesh topology'],
        correctOption: 2,
        explanation: 'In a Star topology, all nodes are individually connected to a central device (switch/hub).',
        sortOrder: 3,
      },
      {
        question: 'What is the standard port number for secure HTTPS communication?',
        options: ['80', '21', '443', '25'],
        correctOption: 2,
        explanation: 'Port 80 is HTTP, while port 443 is the standard port for encrypted HTTPS traffic.',
        sortOrder: 4,
      },
      {
        question: 'A unique hardware identifier permanently assigned to a network interface card (NIC) is the:',
        options: ['IP address', 'MAC address', 'Subnet mask', 'Gateway'],
        correctOption: 1,
        explanation: 'The Media Access Control (MAC) address is the 48-bit physical identifier burnt into network hardware.',
        sortOrder: 5,
      },
    ],
  },
  {
    slug: 'cs-sql-databases-class12',
    title: 'Relational Databases & SQL Queries',
    description: 'Keys, normalization, SELECT statements, WHERE filters, aggregate functions, and JOINs.',
    grade: 'Class 12',
    subject: 'Computer Science',
    difficulty: 'hard',
    xpReward: 130,
    timeLimitMinutes: 7,
    iconKey: 'cs',
    questions: [
      {
        question: 'Which SQL clause is used to eliminate duplicate rows from the query output?',
        options: ['UNIQUE', 'DISTINCT', 'DIFFERENT', 'GROUP'],
        correctOption: 1,
        explanation: 'SELECT DISTINCT returns only unique values across the selected columns.',
        sortOrder: 1,
      },
      {
        question: 'Which key uniquely identifies each record in a relational database table?',
        options: ['Foreign Key', 'Primary Key', 'Candidate Key only', 'Secondary Key'],
        correctOption: 1,
        explanation: 'A Primary Key uniquely identifies every tuple in a table and cannot contain null values.',
        sortOrder: 2,
      },
      {
        question: 'Which SQL aggregate function computes the total sum of numeric values in a column?',
        options: ['COUNT()', 'TOTAL()', 'SUM()', 'ADD()'],
        correctOption: 2,
        explanation: 'The SUM() aggregate function calculates the total sum of values in a column.',
        sortOrder: 3,
      },
      {
        question: 'Which clause in SQL is used to filter the output groups created by the GROUP BY clause?',
        options: ['WHERE', 'ORDER BY', 'HAVING', 'FILTER BY'],
        correctOption: 2,
        explanation: 'WHERE filters individual records before grouping, while HAVING filters aggregated groups.',
        sortOrder: 4,
      },
      {
        question: 'Which command in SQL belongs to Data Definition Language (DDL)?',
        options: ['INSERT', 'UPDATE', 'CREATE', 'DELETE'],
        correctOption: 2,
        explanation: 'CREATE, ALTER, and DROP define and modify table structures (DDL); INSERT/UPDATE/DELETE are DML.',
        sortOrder: 5,
      },
    ],
  },

  // ── ENGLISH (Grades 6, 8, 10) ───────────────────────────────
  {
    slug: 'english-grammar-mechanics-class8',
    title: 'Grammar Essentials: Parts of Speech',
    description: 'Nouns, pronouns, adjectives, tenses, and subject-verb agreement.',
    grade: 'Class 8',
    subject: 'English',
    difficulty: 'easy',
    xpReward: 40,
    timeLimitMinutes: 5,
    iconKey: 'english',
    questions: [
      {
        question: 'Choose the correct form: "Neither of the two students ___ submitted the homework."',
        options: ['have', 'has', 'are', 'were'],
        correctOption: 1,
        explanation: '"Neither" is a singular distributive pronoun, so it takes the singular verb "has".',
        sortOrder: 1,
      },
      {
        question: 'Identify the adverb in: "The clever cheetah ran extremely fast across the savannah."',
        options: ['clever', 'extremely', 'cheetah', 'across'],
        correctOption: 1,
        explanation: '"Extremely" modifies the adverb "fast", functioning as an adverb of degree.',
        sortOrder: 2,
      },
      {
        question: 'What is the antonym of the word "Meticulous"?',
        options: ['Careful', 'Careless', 'Diligent', 'Accurate'],
        correctOption: 1,
        explanation: 'Meticulous means showing great attention to detail; its opposite is careless.',
        sortOrder: 3,
      },
      {
        question: 'Identify the figure of speech: "The wind whispered through the dark trees."',
        options: ['Simile', 'Metaphor', 'Personification', 'Hyperbole'],
        correctOption: 2,
        explanation: 'Attributing human traits like "whispering" to the wind is personification.',
        sortOrder: 4,
      },
      {
        question: 'Which sentence is written in the passive voice?',
        options: [
          'The chef cooked an incredible meal.',
          'An incredible meal was cooked by the chef.',
          'The children played outside all day.',
          'She wrote three letters to her family.',
        ],
        correctOption: 1,
        explanation: 'In "An incredible meal was cooked by the chef", the grammatical subject receives the action.',
        sortOrder: 5,
      },
    ],
  },
  {
    slug: 'english-vocabulary-comprehension-class10',
    title: 'Advanced Vocabulary & Literary Terms',
    description: 'Context clues, rhetorical devices, idioms, and reading comprehension mechanics.',
    grade: 'Class 10',
    subject: 'English',
    difficulty: 'medium',
    xpReward: 75,
    timeLimitMinutes: 6,
    iconKey: 'english',
    questions: [
      {
        question: 'What does the idiom "burn the midnight oil" mean?',
        options: ['Start a dangerous fire', 'Work or study late into the night', 'Waste fuel unnecessarily', 'Wake up early at dawn'],
        correctOption: 1,
        explanation: 'Burning the midnight oil means working or studying very late into the night.',
        sortOrder: 1,
      },
      {
        question: 'A story with a hidden symbolic meaning beneath the surface is known as an:',
        options: ['Anecdote', 'Allegory', 'Alliteration', 'Assonance'],
        correctOption: 1,
        explanation: 'An allegory is a narrative with a double meaning where characters/events represent larger ideas.',
        sortOrder: 2,
      },
      {
        question: 'Which word best means "existing everywhere at the same time"?',
        options: ['Ephemeral', 'Ubiquitous', 'Obsolete', 'Ambiguous'],
        correctOption: 1,
        explanation: 'Ubiquitous means present, appearing, or found everywhere.',
        sortOrder: 3,
      },
      {
        question: 'Identify the oxymoron among the following phrases:',
        options: ['Crystal clear', 'Deafening silence', 'Running fast', 'Dark shadow'],
        correctOption: 1,
        explanation: 'An oxymoron juxtaposes contradictory terms; "deafening" and "silence" contradict each other.',
        sortOrder: 4,
      },
      {
        question: 'What is the meaning of the prefix "bene-" as in benefit or benevolent?',
        options: ['Bad', 'Good / Well', 'Against', 'Before'],
        correctOption: 1,
        explanation: 'The Latin prefix "bene-" signifies good, well, or favorable.',
        sortOrder: 5,
      },
    ],
  },

  // ── COMMERCE & ACCOUNTANCY (Grades 11, 12) ───────────────────
  {
    slug: 'commerce-accounting-basics-class11',
    title: 'Financial Accounting Fundamentals',
    description: 'Accounting equation, debit/credit rules, double-entry bookkeeping, and ledger balances.',
    grade: 'Class 11',
    subject: 'Commerce',
    difficulty: 'medium',
    xpReward: 85,
    timeLimitMinutes: 6,
    iconKey: 'commerce',
    questions: [
      {
        question: 'What is the fundamental accounting equation?',
        options: [
          'Assets = Liabilities + Capital',
          'Assets = Liabilities - Capital',
          'Capital = Assets + Liabilities',
          'Liabilities = Assets + Revenue',
        ],
        correctOption: 0,
        explanation: 'The foundation of double-entry accounting is Assets = Liabilities + Owner Equity (Capital).',
        sortOrder: 1,
      },
      {
        question: 'Under modern accounting rules, an increase in an asset account is recorded as a:',
        options: ['Credit', 'Debit', 'Liability', 'Provision'],
        correctOption: 1,
        explanation: 'Assets have normal debit balances; increases in assets are recorded as debits.',
        sortOrder: 2,
      },
      {
        question: 'The book of original entry where financial transactions are first chronologically recorded is the:',
        options: ['Ledger', 'Journal', 'Trial Balance', 'Balance Sheet'],
        correctOption: 1,
        explanation: 'Transactions are first recorded chronologically in the Journal before posting to Ledgers.',
        sortOrder: 3,
      },
      {
        question: 'Which financial statement summarizes revenues and expenses over a specific accounting period?',
        options: ['Balance Sheet', 'Trial Balance', 'Profit and Loss Account', 'Cash Book'],
        correctOption: 2,
        explanation: 'The Profit and Loss Account (Income Statement) shows operating revenues, costs, and net profit.',
        sortOrder: 4,
      },
      {
        question: 'What is goodwill classified as in a company balance sheet?',
        options: ['Tangible Fixed Asset', 'Intangible Fixed Asset', 'Current Asset', 'Fictitious Asset'],
        correctOption: 1,
        explanation: 'Goodwill represents business reputation/brand equity and is an intangible non-current asset.',
        sortOrder: 5,
      },
    ],
  },
  {
    slug: 'commerce-business-finance-class12',
    title: 'Business Studies & Financial Markets',
    description: 'Principles of management, marketing mix, stock exchanges, and capital structure.',
    grade: 'Class 12',
    subject: 'Commerce',
    difficulty: 'hard',
    xpReward: 125,
    timeLimitMinutes: 7,
    iconKey: 'commerce',
    questions: [
      {
        question: 'Who is recognized as the father of General Management and author of the 14 principles of management?',
        options: ['F.W. Taylor', 'Henri Fayol', 'Peter Drucker', 'Adam Smith'],
        correctOption: 1,
        explanation: 'Henri Fayol developed the 14 administrative principles of management.',
        sortOrder: 1,
      },
      {
        question: 'Which regulatory body governs and oversees securities and stock markets in India?',
        options: ['RBI', 'SEBI', 'IRDAI', 'CCI'],
        correctOption: 1,
        explanation: 'The Securities and Exchange Board of India (SEBI) regulates capital and stock markets.',
        sortOrder: 2,
      },
      {
        question: 'The 4 Ps of the classic marketing mix are Product, Price, Promotion, and:',
        options: ['Profit', 'People', 'Place', 'Planning'],
        correctOption: 2,
        explanation: 'E. Jerome McCarthy defined the 4 Ps as Product, Price, Place (distribution), and Promotion.',
        sortOrder: 3,
      },
      {
        question: 'Working capital is defined as the difference between:',
        options: [
          'Total Assets and Total Liabilities',
          'Current Assets and Current Liabilities',
          'Fixed Assets and Current Assets',
          'Share Capital and Reserves',
        ],
        correctOption: 1,
        explanation: 'Net Working Capital = Current Assets - Current Liabilities.',
        sortOrder: 4,
      },
      {
        question: 'Treasury bills (T-bills) in the money market are issued on behalf of the government by:',
        options: ['Commercial Banks', 'Reserve Bank of India (RBI)', 'State Governments', 'SEBI'],
        correctOption: 1,
        explanation: 'The Reserve Bank of India issues short-term sovereign Treasury bills on behalf of the Central Government.',
        sortOrder: 5,
      },
    ],
  },

  // ── GENERAL KNOWLEDGE (All Grades / Cross-Curricular) ─────────
  {
    slug: 'gk-world-geography-class8',
    title: 'World Geography & Oceans',
    description: 'Continents, major mountain ranges, ocean trenches, and equator geography.',
    grade: 'Class 8',
    subject: 'General Knowledge',
    difficulty: 'easy',
    xpReward: 40,
    timeLimitMinutes: 5,
    iconKey: 'gk',
    questions: [
      {
        question: 'Which is the largest and deepest ocean on planet Earth?',
        options: ['Atlantic Ocean', 'Indian Ocean', 'Pacific Ocean', 'Arctic Ocean'],
        correctOption: 2,
        explanation: 'The Pacific Ocean covers over 30% of Earth surface and contains the Mariana Trench.',
        sortOrder: 1,
      },
      {
        question: 'Which African river is recognized as the longest river in the world?',
        options: ['Amazon River', 'Nile River', 'Congo River', 'Yangtze River'],
        correctOption: 1,
        explanation: 'The Nile River spans approximately 6,650 km through northeastern Africa.',
        sortOrder: 2,
      },
      {
        question: 'Mount Everest, Earth highest peak above sea level, is located in which mountain range?',
        options: ['Andes', 'Alps', 'Himalayas', 'Rockies'],
        correctOption: 2,
        explanation: 'Mount Everest (8,848.86 m) rises in the Mahalangur Himal sub-range of the Himalayas.',
        sortOrder: 3,
      },
      {
        question: 'Which continent contains the largest hot desert in the world, the Sahara?',
        options: ['Asia', 'Africa', 'Australia', 'South America'],
        correctOption: 1,
        explanation: 'The Sahara Desert spans across northern Africa.',
        sortOrder: 4,
      },
      {
        question: 'Through which of the following continents does the Equator NOT pass?',
        options: ['South America', 'Africa', 'Europe', 'Asia'],
        correctOption: 2,
        explanation: 'Europe is located entirely in the Northern Hemisphere well north of the Equator.',
        sortOrder: 5,
      },
    ],
  },
  {
    slug: 'gk-science-inventions-class10',
    title: 'Science Pioneers & Great Inventions',
    description: 'Historical scientific breakthroughs, space exploration, and major technological milestones.',
    grade: 'Class 10',
    subject: 'General Knowledge',
    difficulty: 'medium',
    xpReward: 70,
    timeLimitMinutes: 6,
    iconKey: 'gk',
    questions: [
      {
        question: 'Who invented the modern World Wide Web (WWW) at CERN in 1989?',
        options: ['Steve Jobs', 'Tim Berners-Lee', 'Bill Gates', 'Alan Turing'],
        correctOption: 1,
        explanation: 'Sir Tim Berners-Lee invented the World Wide Web, HTML, and HTTP in 1989.',
        sortOrder: 1,
      },
      {
        question: 'Who discovered the wonder antibiotic penicillin in 1928?',
        options: ['Alexander Fleming', 'Edward Jenner', 'Louis Pasteur', 'Robert Koch'],
        correctOption: 0,
        explanation: 'Sir Alexander Fleming discovered antibacterial penicillin from Penicillium notatum mold.',
        sortOrder: 2,
      },
      {
        question: 'Which mission carried the first humans to land on the Moon in July 1969?',
        options: ['Apollo 8', 'Apollo 11', 'Apollo 13', 'Gemini 4'],
        correctOption: 1,
        explanation: 'NASA Apollo 11 landed Neil Armstrong and Buzz Aldrin on the Moon on July 20, 1969.',
        sortOrder: 3,
      },
      {
        question: 'Who was awarded the 1921 Nobel Prize in Physics for explaining the Photoelectric Effect?',
        options: ['Niels Bohr', 'Albert Einstein', 'Max Planck', 'Marie Curie'],
        correctOption: 1,
        explanation: 'Albert Einstein won the 1921 Nobel Prize in Physics specifically for his discovery of the law of the photoelectric effect.',
        sortOrder: 4,
      },
      {
        question: 'What is the full expansion of the navigation technology acronym GPS?',
        options: ['General Positioning System', 'Global Positioning System', 'Geographic Placement Satellite', 'Global Point Sensor'],
        correctOption: 1,
        explanation: 'GPS stands for Global Positioning System, providing satellite-based geolocation.',
        sortOrder: 5,
      },
    ],
  },
  {
    slug: 'gk-indian-polity-constitution-class12',
    title: 'Indian Polity & Constitutional Framework',
    description: 'Preamble, Fundamental Rights, Parliament, judiciary, and constitutional institutions.',
    grade: 'Class 12',
    subject: 'General Knowledge',
    difficulty: 'hard',
    xpReward: 120,
    timeLimitMinutes: 7,
    iconKey: 'gk',
    questions: [
      {
        question: 'Who served as the Chairman of the Drafting Committee of the Indian Constitution?',
        options: ['Dr. Rajendra Prasad', 'Dr. B.R. Ambedkar', 'Jawaharlal Nehru', 'Sardar Vallabhbhai Patel'],
        correctOption: 1,
        explanation: 'Dr. Bhimrao Ramji Ambedkar chaired the Drafting Committee that formulated the Constitution of India.',
        sortOrder: 1,
      },
      {
        question: 'Which Article of the Constitution of India guarantees the Right to Equality before law?',
        options: ['Article 14', 'Article 19', 'Article 21', 'Article 32'],
        correctOption: 0,
        explanation: 'Article 14 states that the State shall not deny to any person equality before the law.',
        sortOrder: 2,
      },
      {
        question: 'The minimum age required to contest election for the office of the President of India is:',
        options: ['25 years', '30 years', '35 years', '40 years'],
        correctOption: 2,
        explanation: 'Article 58 specifies that a candidate for President must have completed 35 years of age.',
        sortOrder: 3,
      },
      {
        question: 'Who acts as the ex-officio Chairman of the Rajya Sabha (Council of States)?',
        options: ['Prime Minister of India', 'Speaker of Lok Sabha', 'Vice-President of India', 'Chief Justice of India'],
        correctOption: 2,
        explanation: 'Article 64 states that the Vice-President of India is the ex-officio Chairman of Rajya Sabha.',
        sortOrder: 4,
      },
      {
        question: 'Which constitutional amendment added the words "Socialist, Secular, and Integrity" to the Preamble?',
        options: ['42nd Amendment (1976)', '44th Amendment (1978)', '86th Amendment (2002)', '73rd Amendment (1992)'],
        correctOption: 0,
        explanation: 'The 42nd Constitutional Amendment Act of 1976 amended the Preamble.',
        sortOrder: 5,
      },
    ],
  },
]

export default class extends BaseSeeder {
  async run() {
    for (const item of SEED_QUIZZES) {
      // Upsert by stable slug so re-running the seeder is idempotent
      let quiz = await Quiz.findBy('slug', item.slug)

      if (!quiz) {
        // Fallback check by title in case title already existed without slug
        quiz = await Quiz.findBy('title', item.title)
      }

      if (!quiz) {
        quiz = await Quiz.create({
          slug: item.slug,
          title: item.title,
          description: item.description,
          grade: item.grade,
          subject: item.subject,
          difficulty: item.difficulty,
          xpReward: item.xpReward,
          timeLimitMinutes: item.timeLimitMinutes,
          iconKey: item.iconKey,
          isPublished: true,
        })
      } else {
        quiz.slug = item.slug
        quiz.title = item.title
        quiz.description = item.description
        quiz.grade = item.grade
        quiz.subject = item.subject
        quiz.difficulty = item.difficulty
        quiz.xpReward = item.xpReward
        quiz.timeLimitMinutes = item.timeLimitMinutes
        quiz.iconKey = item.iconKey
        quiz.isPublished = true
        await quiz.save()
      }

      const existingCount = await QuizQuestion.query().where('quiz_id', quiz.id).count('* as total')
      if (Number(existingCount[0].$extras.total) === 0) {
        await QuizQuestion.createMany(
          item.questions.map((q) => ({
            quizId: quiz.id,
            question: q.question,
            options: q.options,
            correctOption: q.correctOption,
            explanation: q.explanation,
            sortOrder: q.sortOrder,
          }))
        )
      }
    }
  }
}

