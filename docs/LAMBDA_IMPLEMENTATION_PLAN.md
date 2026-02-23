# Lambda Functions Implementation Plan

## Overview

The Codebreaker Contest system uses AWS Lambda functions and Step Functions for:
1. **Grading submissions** - Compiling and executing user code against test cases
2. **Problem validation** - Verifying all required files exist
3. **Checker compilation** - Compiling custom checkers
4. **Regrading** - Bulk re-evaluating submissions

## Current Architecture (Reference)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Web Application                         │
│                      (React Router SSR)                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        ▼                                       ▼
┌───────────────────┐                   ┌───────────────────────┐
│   Step Function   │                   │     API Gateway       │
│  (Grading Flow)   │                   │   (WebSocket Only)    │
└───────┬───────────┘                   │                       │
        │                               │  Used for real-time   │
        ▼                               │  announcements only   │
┌───────────────────────────────────────┴───────────────────────┐
│                       Lambda Functions                         │
│                                                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐ │
│  │ grader-problem  │  │ testcase-grader │  │  websocket-    │ │
│  │     -init       │  │                 │  │  connections   │ │
│  └────────┬────────┘  └────────┬────────┘  └────────────────┘ │
│           │                    │                              │
│           ▼                    ▼           ┌────────────────┐ │
│  ┌─────────────────┐  ┌─────────────────┐  │  websocket-    │ │
│  │ grader-problem  │  │    compiler     │  │    invoke      │ │
│  │    -scorer      │  │                 │  │ (announcements)│ │
│  └─────────────────┘  └─────────────────┘  └────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

> **Note:** API Gateway is used **only** for WebSocket connections to push real-time
> announcements to connected clients. The web application calls Step Functions and
> Lambda directly for grading submissions - there is no REST API Gateway.

## Lambda Functions to Implement

### 1. Grader Problem Init (`grader-problem-init`)

**Purpose:** Initialize a submission for grading

**Trigger:** Step Function start

**Input:**
```json
{
  "problemName": "addition",
  "submissionId": 123,
  "username": "user1",
  "submissionTime": "2024-01-01 12:00:00",
  "language": "cpp",
  "problemType": "Batch"
}
```

**Actions:**
1. Fetch problem info from DynamoDB
2. Create submission record with pending status
3. Generate testcase payloads for parallel execution
4. Return payloads to Step Function

**Output:**
```json
{
  "status": 200,
  "payloads": [
    {
      "problemName": "addition",
      "submissionId": 123,
      "testcaseNumber": 1,
      "memoryLimit": 1024,
      "timeLimit": 1.0,
      "customChecker": 0,
      "language": "cpp"
    }
    // ... more testcases
  ],
  "username": "user1"
}
```

---

### 2. Testcase Grader (`testcase-grader`)

**Purpose:** Execute user code against a single testcase

**Trigger:** Step Function Map state (parallel execution)

**Input:**
```json
{
  "problemName": "addition",
  "submissionId": 123,
  "testcaseNumber": 1,
  "memoryLimit": 1024,
  "timeLimit": 1.0,
  "customChecker": 0,
  "language": "cpp"
}
```

**Actions:**
1. Download compiled binary from S3 (`submissions/compiled/{subId}`)
2. Download testcase input from S3 (`testdata/{problem}/{n}.in`)
3. Execute code with resource limits (ulimit)
4. Compare output with expected (`testdata/{problem}/{n}.out`)
5. If custom checker, run checker binary

**Output:**
```json
{
  "verdict": "AC",
  "score": 100,
  "time": 0.05,
  "memory": 1234,
  "returnCode": 0
}
```

**Verdict Types:**
- `AC` - Accepted (score = 100)
- `WA` - Wrong Answer (score = 0)
- `PS` - Partial Score (0 < score < 100)
- `TLE` - Time Limit Exceeded
- `MLE` - Memory Limit Exceeded
- `RTE` - Runtime Error

---

### 3. Testcase Grader Wrapper (`testcase-grader-wrapper`)

**Purpose:** Handle Interactive/Communication problems

**Trigger:** Step Function (for non-Batch problems)

**Additional Actions:**
1. Download grader from S3
2. Compile user code with grader
3. Execute combined binary
4. Parse grader output for verdict

---

### 4. Grader Problem Scorer (`grader-problem-scorer`)

**Purpose:** Calculate final score after all testcases complete

**Trigger:** Step Function after Map completes

**Input:**
```json
{
  "submissionId": 123,
  "problemName": "addition",
  "results": [
    { "verdict": "AC", "score": 100, "time": 50, "memory": 1234 },
    { "verdict": "WA", "score": 0, "time": 45, "memory": 1000 }
  ],
  "username": "user1"
}
```

**Actions:**
1. Group testcases by subtask
2. Calculate subtask scores (min score in subtask)
3. Apply subtask dependencies
4. Update submission in DynamoDB
5. Update user's best score if improved

**Output:**
```json
{
  "totalScore": 36,
  "subtaskScores": [0, 36, 0],
  "maxTime": 50,
  "maxMemory": 1234
}
```

---

### 5. Problem Validation (`problem-validation`)

**Purpose:** Validate problem has all required files

**Trigger:** API call from admin panel

**Input:**
```json
{
  "problemName": "addition"
}
```

**Actions:**
1. Check statement exists (HTML or PDF)
2. Check testdata files exist
3. Verify subtask configuration
4. Check checker if `customChecker: true`
5. Check grader if Interactive/Communication
6. Check attachments if `attachments: true`
7. Update problem validation status

**Output:**
```json
{
  "statusCode": 200,
  "verdicts": {
    "statement": 1,
    "testdata": 1,
    "subtasks": 1,
    "checker": 1,
    "grader": 1,
    "attachments": 1,
    "scoring": 1
  },
  "remarks": {
    "statement": "Ok, HTML statement found!",
    "testdata": "Ok, 4 testcases found!"
  }
}
```

---

### 6. Compiler (`compiler`)

**Purpose:** Compile source code

**Trigger:**
- Step Function (compile submissions)
- API call (compile checkers)

**Input:**
```json
{
  "problemName": "ping",
  "eventType": "CHECKER"  // or "SUBMISSION"
}
```

**For Submissions:**
1. Download source from S3
2. Compile with language-specific compiler
3. Upload binary to S3

**For Checkers:**
1. Download checker source
2. Compile with testlib.h
3. Upload compiled checker

---

### 7. Regrade Problem (`regrade-problem`)

**Purpose:** Regrade submissions for a problem

**Trigger:** Admin API call

**Input:**
```json
{
  "problemName": "addition",
  "regradeType": "NORMAL"  // "NORMAL", "AC", "NONZERO"
}
```

**Actions:**
1. Query submissions for problem
2. Filter by regradeType
3. Start Step Function for each submission

---

### 8. WebSocket Connections (`websocket-connections`)

**Purpose:** Manage WebSocket connections for real-time announcements

**Trigger:** API Gateway WebSocket `$connect` / `$disconnect` routes

**Actions:**
- On connect: Store connection ID in DynamoDB (`websocket-connections` table)
- On disconnect: Remove connection ID from DynamoDB
- Associate connections with contest ID for targeted broadcasts

**DynamoDB Schema:**
```json
{
  "connectionId": "abc123",
  "contestId": "weekly-42",
  "connectedAt": "2024-01-01T12:00:00Z"
}
```

---

### 9. WebSocket Invoke (`websocket-invoke`)

**Purpose:** Broadcast announcements to connected clients in real-time

**Trigger:** Called when admin creates/updates an announcement

**Input:**
```json
{
  "type": "ANNOUNCEMENT",
  "contestId": "weekly-42",
  "announcement": {
    "id": "ann-123",
    "title": "Clarification on Problem A",
    "text": "The input constraints have been updated.",
    "priority": "high",
    "timestamp": "2024-01-01T12:30:00Z"
  }
}
```

**Actions:**
1. Query all connections for the given contest ID
2. For each connection, push announcement via API Gateway Management API
3. Handle stale connections (remove if send fails)

**Client Message Format:**
```json
{
  "type": "NEW_ANNOUNCEMENT",
  "data": {
    "id": "ann-123",
    "title": "Clarification on Problem A",
    "text": "The input constraints have been updated.",
    "priority": "high"
  }
}
```

---

## Step Function Definition

```json
{
  "Comment": "Grading Step Function",
  "StartAt": "Initialize",
  "States": {
    "Initialize": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:...:grader-problem-init",
      "Next": "CompileChoice"
    },
    "CompileChoice": {
      "Type": "Choice",
      "Choices": [
        {
          "Variable": "$.language",
          "StringEquals": "cpp",
          "Next": "Compile"
        }
      ],
      "Default": "GradeTestcases"
    },
    "Compile": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:...:compiler",
      "Next": "GradeTestcases",
      "Catch": [
        {
          "ErrorEquals": ["CompileError"],
          "Next": "HandleCompileError"
        }
      ]
    },
    "GradeTestcases": {
      "Type": "Map",
      "ItemsPath": "$.payloads",
      "MaxConcurrency": 10,
      "Iterator": {
        "StartAt": "GradeOne",
        "States": {
          "GradeOne": {
            "Type": "Task",
            "Resource": "arn:aws:lambda:...:testcase-grader",
            "End": true
          }
        }
      },
      "Next": "Score"
    },
    "Score": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:...:grader-problem-scorer",
      "End": true
    },
    "HandleCompileError": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:...:handle-compile-error",
      "End": true
    }
  }
}
```

---

## Implementation Phases

### Phase 1: Core Grading (MVP)

1. **Create Lambda execution environment**
   - Docker image with g++, python3
   - Testlib.h for checkers
   - Resource limiting utilities

2. **Implement `compiler` Lambda**
   - C++ compilation with g++17
   - Python (no compilation needed)
   - Error handling and reporting

3. **Implement `testcase-grader` Lambda**
   - Secure code execution (sandboxing)
   - Resource limits (time, memory)
   - Output comparison

4. **Implement Step Function**
   - Basic flow for Batch problems
   - Compile → Grade → Score

5. **Implement `grader-problem-scorer`**
   - Subtask scoring
   - DynamoDB updates

### Phase 2: Advanced Features

1. **Interactive/Communication problems**
   - Grader integration
   - Two-file Communication support

2. **WebSocket integration (Announcements only)**
   - API Gateway WebSocket API for real-time announcements
   - Connection management Lambda
   - Broadcast Lambda triggered on announcement create/update
   - Client-side WebSocket handler in React app

3. **Problem validation**
   - Automated validation Lambda
   - Admin API integration

### Phase 3: Admin Tools

1. **Regrade functionality**
   - Bulk regrade
   - Selective regrade (AC only, non-zero)

2. **Checker compilation**
   - Admin UI integration
   - Compilation status tracking

---

## Security Considerations

1. **Code Execution Sandbox**
   - Use isolated execution environment
   - No network access for user code
   - Limited filesystem access
   - Resource limits enforced

2. **S3 Access**
   - Lambda execution role with minimal permissions
   - Separate buckets for different data types

3. **DynamoDB Access**
   - Row-level access control
   - No direct user access to tables

---

## API Integration

### Submission Endpoint

The web app triggers grading via:

```typescript
// app/routes/api/submit.ts
export async function action({ request }) {
  const { problemName, code, language } = await request.json();

  // 1. Create submission record
  const submission = await createSubmissionWithSource(
    username, problemName, language, code
  );

  // 2. Start Step Function
  await startGrading({
    problemName,
    submissionId: submission.subId,
    username,
    language,
    problemType: problem.problem_type,
  });

  return { subId: submission.subId };
}
```

### Grading Trigger

```typescript
// app/lib/grading.server.ts
export async function startGrading(params: {
  problemName: string;
  submissionId: number;
  username: string;
  language: string;
  problemType: string;
}) {
  const sfClient = new SFNClient({ region: REGION });

  await sfClient.send(new StartExecutionCommand({
    stateMachineArn: STEP_FUNCTION_ARN,
    input: JSON.stringify(params),
  }));
}
```

### Announcement WebSocket Broadcast

When an admin creates or updates an announcement, the web app triggers the WebSocket broadcast:

```typescript
// app/lib/announcements.server.ts
export async function createAnnouncement(
  title: string,
  text: string,
  author: string,
  priority: string,
  contestId?: string
) {
  // 1. Create announcement in DynamoDB
  const announcement = await saveAnnouncement({ title, text, author, priority });

  // 2. Broadcast to connected clients via Lambda
  if (contestId) {
    await broadcastAnnouncement(contestId, announcement);
  }

  return announcement;
}

async function broadcastAnnouncement(contestId: string, announcement: Announcement) {
  const lambdaClient = new LambdaClient({ region: REGION });

  await lambdaClient.send(new InvokeCommand({
    FunctionName: 'websocket-invoke',
    InvocationType: 'Event', // Async invocation
    Payload: JSON.stringify({
      type: 'ANNOUNCEMENT',
      contestId,
      announcement,
    }),
  }));
}
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `app/lib/grading.server.ts` | Grading orchestration |
| `app/routes/api/submit.ts` | Submission endpoint |
| `lambda/compiler/` | Compilation Lambda |
| `lambda/testcase-grader/` | Grading Lambda |
| `lambda/grader-problem-init/` | Init Lambda |
| `lambda/grader-problem-scorer/` | Scoring Lambda |
| `lambda/problem-validation/` | Validation Lambda |
| `infra/step-function.json` | Step Function definition |
| `infra/lambda-iam.json` | IAM policies |

---

## Next Steps

1. Set up AWS Lambda deployment pipeline (SAM or CDK)
2. Create Docker image for Lambda execution
3. Implement compiler Lambda first (required for all other functions)
4. Test with simple Batch problem (addition)
5. Add Step Function orchestration
6. Implement testcase grader
7. Add WebSocket support for real-time updates
