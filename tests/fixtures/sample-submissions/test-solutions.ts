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
    expectedScore: 100.0,
    expectedSubtasks: [25, 25, 25, 25],
    description: 'Brute force approach - prisoner opens all boxes, swapper does nothing'
  },

  // Perfect for subtask stitching test:
  // Submission 1: [0, 98.01, 0, 100] = 28.42 points
  // Submission 2: [16, 15.21, 15.21, 0] = 15.42 points
  // Submission 3: [6.75, 7.25, 11, 0] = 25.0 points
  // Stitched: [16, 98.01, 15.21, 100] = max scores per subtask

  // Add more submissions as needed...
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