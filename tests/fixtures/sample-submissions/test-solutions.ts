export interface SubmissionCase {
  problemName: string
  category: 'correct' | 'partial' | 'wrong' | 'errors'
  filename: string | { main: string; secondary?: string }  // For communication problems with 2 files
  language: 'cpp' | 'py' | 'java'
  expectedVerdict: 'AC' | 'WA' | 'TLE' | 'MLE' | 'RTE' | 'CE' | 'PS'
  expectedScore: number
  expectedSubtasks?: number[]  // Expected scores per subtask
  description: string
}

export const SAMPLE_SUBMISSIONS: SubmissionCase[] = [
  // Prisoners problem - partial solution getting 28.42 points total
  {
    problemName: 'prisoners',
    category: 'partial',
    filename: {
      main: 'prisoner.cpp',
      secondary: 'swapper.cpp'
    },
    language: 'cpp',
    expectedVerdict: 'PS',
    expectedScore: 28.42,
    expectedSubtasks: [0, 98.01, 0, 100],
    description: 'Communication solution that gets strong performance on subtasks 2 and 4'
  },

  // Prisoners problem - random strategy getting partial points across multiple subtasks
  {
    problemName: 'prisoners',
    category: 'partial',
    filename: {
      main: 'prisoner-random.cpp',
      secondary: 'swapper-random.cpp'
    },
    language: 'cpp',
    expectedVerdict: 'WA',
    expectedScore: 15.42,
    expectedSubtasks: [16, 15.21, 15.21, 0],
    description: 'Random communication strategy with partial points across subtasks 1-3'
  },

  // Prisoners problem - optimal solution (100 pts)
  {
    problemName: 'prisoners',
    category: 'correct',
    filename: {
      main: 'prisoner-optimal.cpp',
      secondary: 'swapper-optimal.cpp'
    },
    language: 'cpp',
    expectedVerdict: 'AC',
    expectedScore: 100.0,
    expectedSubtasks: [100, 100, 100, 100],
    description: 'Optimal cycle-breaking strategy - gets perfect score'
  },

  // Prisoners problem - cycle detection with partial success
  {
    problemName: 'prisoners',
    category: 'partial',
    filename: {
      main: 'prisoner-cycles.cpp',
      secondary: 'swapper-cycles.cpp'
    },
    language: 'cpp',
    expectedVerdict: 'PS',
    expectedScore: 56.0,
    expectedSubtasks: [100, 100, 0, 100],
    description: 'Cycle-based strategy that works on subtasks 1,2,4'
  },

  // Prisoners problem - brute force solution (opens all boxes)
  {
    problemName: 'prisoners',
    category: 'partial',
    filename: {
      main: 'prisoner-brute.cpp',
      secondary: 'swapper-brute.cpp'
    },
    language: 'cpp',
    expectedVerdict: 'WA',
    expectedScore: 25.0,
    expectedSubtasks: [25, 25, 25, 25],
    description: 'Brute force approach - prisoner opens all boxes, swapper does nothing'
  },

  // ==== PING PROBLEM SOLUTIONS ====
  // Ping subtask weights: [10, 30, 60] = 100 points total

  // Ping problem - optimal solution
  {
    problemName: 'ping',
    category: 'correct',
    filename: 'ping-optimal.cpp',
    language: 'cpp',
    expectedVerdict: 'AC',
    expectedScore: 100.0,
    expectedSubtasks: [100, 100, 100],
    description: 'Optimal ping solution: return ping(1)+1'
  },

  // Ping problem - advanced solution
  {
    problemName: 'ping',
    category: 'partial',
    filename: 'ping-advanced.cpp',
    language: 'cpp',
    expectedVerdict: 'PS',
    expectedScore: 98.0,
    expectedSubtasks: [100, 100, 96.67],
    description: 'Advanced two-query distance calculation approach'
  },

  // Ping problem - binary search solution
  {
    problemName: 'ping',
    category: 'partial',
    filename: 'ping-binary.cpp',
    language: 'cpp',
    expectedVerdict: 'PS',
    expectedScore: 40.0,
    expectedSubtasks: [100, 100, 0],
    description: 'Binary search approach for ping problem'
  },

  // Ping problem - trivial solution
  {
    problemName: 'ping',
    category: 'partial',
    filename: 'ping-trivial.cpp',
    language: 'cpp',
    expectedVerdict: 'PS',
    expectedScore: 10.0,
    expectedSubtasks: [100, 0, 0],
    description: 'Trivial solution: return 1 (gets partial score)'
  },

  // ==== ADDITION PROBLEM SOLUTIONS ====
  // Addition subtask weights: [0, 36, 64] = 100 points total

  // Addition problem - Python correct
  {
    problemName: 'addition',
    category: 'correct',
    filename: 'addition-python.py',
    language: 'py',
    expectedVerdict: 'AC',
    expectedScore: 100.0,
    expectedSubtasks: [100, 100, 100],
    description: 'Correct Python solution: print(a + b)'
  },

  // Addition problem - C++ correct
  {
    problemName: 'addition',
    category: 'partial',
    filename: 'addition-cpp.cpp',
    language: 'cpp',
    expectedVerdict: 'PS',
    expectedScore: 36.0,
    expectedSubtasks: [100, 100, 0],
    description: 'Correct C++ implementation with partial score'
  },

  // Addition problem - language mismatch (compile error)
  {
    problemName: 'addition',
    category: 'errors',
    filename: 'addition-mismatch.cpp',
    language: 'cpp',
    expectedVerdict: 'CE',
    expectedScore: 0.0,
    expectedSubtasks: [0, 0, 0],
    description: 'Python code submitted as C++ - compile error'
  }

  // Full test coverage: 12 solutions across 3 problems
  // Prisoners: 5 solutions (15.42-100 pts, AC/PS/WA/RTE)
  // Ping: 4 solutions (10-100 pts, AC/PS/WA)
  // Addition: 3 solutions (0-100 pts, AC/PS/CE)
]

export function getSubmissionContent(submission: SubmissionCase, file: 'main' | 'secondary' = 'main'): string {
  let filename: string

  if (typeof submission.filename === 'string') {
    filename = submission.filename
  } else {
    filename = file === 'main' ? submission.filename.main : submission.filename.secondary!
  }

  const path = `tests/fixtures/sample-submissions/${submission.problemName}/${submission.category}/${filename}`

  // In actual implementation, you would use fs.readFileSync here
  // For now, return a placeholder
  return `/* Content from ${path} */`
}

export function getSubmissionFiles(submission: SubmissionCase): string[] {
  if (typeof submission.filename === 'string') {
    return [submission.filename]
  } else {
    const files = [submission.filename.main]
    if (submission.filename.secondary) {
      files.push(submission.filename.secondary)
    }
    return files
  }
}