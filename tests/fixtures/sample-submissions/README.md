# Sample Submissions for Testing

This directory contains sample submissions for testing the contest system, particularly for subtask stitching functionality.

## Directory Structure

```
sample-submissions/
├── addition/          # Batch problem submissions
├── ping/              # Interactive problem submissions  
├── prisoners/         # Communication problem submissions
│   └── partial/
│       ├── swapper.cpp    # Swapper component (28.42 points)
│       └── prisoner.cpp   # Prisoner component (28.42 points)
└── test-solutions.ts  # TypeScript metadata for all submissions
```

## Current Submissions

### Prisoners Problem - Partial Solutions

#### Solution 1: Strategic Approach
- **Location**: `prisoners/partial/`
- **Files**: `swapper.cpp`, `prisoner.cpp`
- **Score**: 28.42/100 points
- **Subtask breakdown**: [0, 0, 28.42, 0] (gets partial points on subtask 3 only)

#### Solution 2: Random Strategy  
- **Location**: `prisoners/partial/`
- **Files**: `swapper-random.cpp`, `prisoner-random.cpp`
- **Score**: 15.42/100 points
- **Subtask breakdown**: [4.32, 4.41, 6.69, 0] (partial points across subtasks 1-3)

#### Perfect Subtask Stitching Test Case
When both solutions are submitted by the same user:
- **Submission 1**: [0, 0, 28.42, 0] = 28.42 points
- **Submission 2**: [4.32, 4.41, 6.69, 0] = 15.42 points  
- **Expected Stitched**: [4.32, 4.41, 28.42, 0] = **39.43 points**

This tests the core IOI-style scoring where the system takes the best score from each subtask across all submissions.

## Usage in Tests

```typescript
import { SAMPLE_SUBMISSIONS, getSubmissionContent } from './test-solutions'

// Find the prisoners partial submission
const prisonersPartial = SAMPLE_SUBMISSIONS.find(s => 
  s.problemName === 'prisoners' && s.expectedScore === 28.42
)

// Get file contents for submission
const swapperCode = getSubmissionContent(prisonersPartial, 'secondary')
const prisonerCode = getSubmissionContent(prisonersPartial, 'main')

// Submit both files in contest simulation
await submitCommunicationSolution('alice', contestId, 'prisoners', {
  swapper: swapperCode,
  prisoner: prisonerCode
})
```

## Adding New Submissions

1. Create appropriate directory: `{problem}/{category}/`
2. Add source files with descriptive names
3. Update `test-solutions.ts` with metadata:
   - Expected verdict and score
   - Subtask breakdown (if partial)
   - Description of what the solution tests

## Categories

- **correct/**: Full AC solutions (100 points)
- **partial/**: Partial scoring solutions (useful for subtask stitching)
- **wrong/**: Wrong answer solutions (0 points, specific failure modes)
- **errors/**: Compilation errors, runtime errors, TLE solutions