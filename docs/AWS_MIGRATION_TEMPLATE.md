# AWS Tools Migration Template

This document maps every function from the reference `awstools/` folder to its replacement strategy in the new React Router 7 application.

## Overview

| AWS Service | Files Using It | Migration Strategy |
|-------------|----------------|-------------------|
| **DynamoDB** | 10 files | Mock data → DynamoDB SDK |
| **S3** | 4 files | Mock data → S3 SDK |
| **Lambda** | 2 files | Keep as-is (grading infrastructure) |
| **Step Functions** | 3 files | Keep as-is (grading pipeline) |
| **IAM/STS** | 1 file | Keep as-is (testdata upload) |
| **Cognito** | 1 file | Mock auth → Cognito SDK |

---

## File-by-File Migration Plan

### 1. `awshelper.py` → `app/lib/aws/dynamodb.server.ts`

| Function | Purpose | New Location | Status |
|----------|---------|--------------|--------|
| `scan(table, ...)` | Paginated DynamoDB scan | `dynamodb.server.ts` | 🔲 TODO |
| `batchGetItems(tableName, items, primaryKeyName)` | Batch get with chunking | `dynamodb.server.ts` | 🔲 TODO |

```typescript
// app/lib/aws/dynamodb.server.ts
import { DynamoDBClient, ScanCommand, BatchGetItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

export async function scan<T>(tableName: string, options?: ScanOptions): Promise<T[]> {
  // Implement paginated scan
}

export async function batchGetItems<T>(
  tableName: string,
  keys: Record<string, any>[],
  primaryKeyName: string
): Promise<T[]> {
  // Implement with 100-item chunking
}
```

---

### 2. `cognito.py` → `app/lib/aws/cognito.server.ts`

| Function | Purpose | New Location | Status |
|----------|---------|--------------|--------|
| `generateSecurePassword()` | Random password generator | `auth-service.server.ts` | ✅ Implemented |
| `authenticate(username, password)` | User login | `auth-service.server.ts` | ✅ Mock implemented |
| `createUser(username, role, password)` | Create Cognito user | `auth-service.server.ts` | ✅ Mock implemented |
| `resetPassword(username, password)` | Reset password | `auth-service.server.ts` | 🔲 TODO |

```typescript
// app/lib/aws/cognito.server.ts
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
} from "@aws-sdk/client-cognito-identity-provider";

export async function authenticate(username: string, password: string) {
  // Use InitiateAuthCommand with USER_PASSWORD_AUTH flow
}

export async function createUser(username: string, role: UserRole, password?: string) {
  // Use AdminCreateUserCommand + AdminSetUserPasswordCommand
}

export async function resetPassword(username: string, newPassword?: string) {
  // Use AdminSetUserPasswordCommand
}
```

---

### 3. `users.py` → `app/lib/services/users.server.ts`

| Function | Purpose | New Location | Status |
|----------|---------|--------------|--------|
| `getAllUsers()` | List all users | `users.server.ts` | ✅ Mock: `mockUsers` |
| `getAllUsernames()` | List usernames only | `users.server.ts` | 🔲 TODO |
| `getAllUserContests()` | User-contest mapping | `users.server.ts` | 🔲 TODO |
| `getUserInfo(username)` | Get single user | `users.server.ts` | ✅ Mock implemented |
| `getCurrentUserInfo()` | Get session user | `auth.server.ts` | ✅ Implemented |
| `createUser(username, role, ...)` | Create user record | `auth-service.server.ts` | ✅ Mock implemented |
| `judgeAccess(userInfo)` | Check admin access | `auth.server.ts` | ✅ `requireAdmin()` |

```typescript
// app/lib/services/users.server.ts
export async function getAllUsers(): Promise<User[]> {
  // DynamoDB scan on users table
}

export async function getUserInfo(username: string): Promise<User | null> {
  // DynamoDB get item
}

export async function updateUserContest(username: string, contestId: string) {
  // DynamoDB update item
}
```

---

### 4. `contests.py` → `app/lib/services/contests.server.ts`

| Function | Purpose | New Location | Status |
|----------|---------|--------------|--------|
| `getContestStatus(contest)` | Calculate status | `mock-data.ts` | ✅ `getContestStatus()` |
| `getAllContestIds()` | List contest IDs | `mock-data.ts` | ✅ Via `mockContests` |
| `getAllContestInfo()` | List all contests | `mock-data.ts` | ✅ `getContestsWithStatus()` |
| `getAllContestTimes()` | Contest times lookup | `contests.server.ts` | 🔲 TODO |
| `getContestInfo(contestId)` | Get single contest | `mock-data.ts` | ✅ `getContestById()` |
| `updateContestInfo(contestId, info)` | Update contest | `mock-data.ts` | ✅ `updateContest()` |
| `updateContestTable(contestId, info)` | Update times only | `contests.server.ts` | 🔲 TODO |
| `setContest(usernames, contestId)` | Assign users to contest | `contests.server.ts` | 🔲 TODO |
| `createContest(contestId)` | Create new contest | `mock-data.ts` | ✅ `createContest()` |

```typescript
// app/lib/services/contests.server.ts
export async function setContestForUsers(
  usernames: string[],
  contestId: string
): Promise<{ success: string[]; failed: string[] }> {
  // Batch update users, check for conflicts
}

export async function getContestScoreboard(contestId: string): Promise<ScoreboardEntry[]> {
  // Build scoreboard from contest.scores
}
```

---

### 5. `problems.py` → `app/lib/services/problems.server.ts`

| Function | Purpose | New Location | Status |
|----------|---------|--------------|--------|
| `getAllProblems()` | List all problems | `mock-data.ts` | ✅ `mockProblems` |
| `getAllProblemNames()` | Problem names only | `problems.server.ts` | 🔲 TODO |
| `getAllProblemsLimited()` | Limited fields | `problems.server.ts` | 🔲 TODO |
| `getProblemInfo(problemName)` | Get single problem | `mock-data.ts` | ✅ Via array find |
| `updateProblemInfo(problemName, info)` | Update problem | `problems.server.ts` | 🔲 TODO |
| `validateProblem(problemName)` | Invoke Lambda | `problems.server.ts` | 🔲 TODO (Lambda) |
| `createProblemWithId(problemName)` | Create problem | `problems.server.ts` | 🔲 TODO |
| `updateCommunicationFileNames(...)` | Communication type | `problems.server.ts` | 🔲 TODO |
| `deleteStatement(statementName)` | Delete from S3 | `problems.server.ts` | 🔲 TODO (S3) |
| `uploadStatement(statement, s3Name)` | Upload to S3 | `problems.server.ts` | 🔲 TODO (S3) |
| `updateSubtaskInfo(problemName, info)` | Update subtasks | `problems.server.ts` | 🔲 TODO |
| `uploadChecker(checker, s3Name)` | Upload checker | `problems.server.ts` | 🔲 TODO (S3) |
| `compileChecker(problemName)` | Invoke Lambda | `problems.server.ts` | 🔲 TODO (Lambda) |
| `uploadGrader(sourceName, target)` | Upload grader | `problems.server.ts` | 🔲 TODO (S3) |
| `getTestcase(path)` | Download testcase | `problems.server.ts` | 🔲 TODO (S3) |
| `getAttachment(path)` | Download attachment | `problems.server.ts` | 🔲 TODO (S3) |
| `getProblemStatementHTML(problemName)` | Get statement | `problems.server.ts` | 🔲 TODO (S3) |
| `regradeProblem(problemName, type)` | Invoke Lambda | `problems.server.ts` | 🔲 TODO (Lambda) |

```typescript
// app/lib/services/problems.server.ts
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

export async function uploadStatement(file: File, problemName: string) {
  // Upload to S3 statements bucket
}

export async function validateProblem(problemName: string) {
  // Invoke validation Lambda
}

export async function regradeProblem(problemName: string, type: "NORMAL" | "AC" | "NONZERO") {
  // Invoke regrade Lambda asynchronously
}
```

---

### 6. `grading.py` → `app/lib/services/grading.server.ts`

| Function | Purpose | New Location | Status |
|----------|---------|--------------|--------|
| `getNextSubmissionId()` | Atomic counter | `grading.server.ts` | 🔲 TODO |
| `uploadSubmission(code, s3path)` | Upload to S3 | `grading.server.ts` | 🔲 TODO (S3) |
| `startGrading(...)` | Invoke Step Functions | `grading.server.ts` | 🔲 TODO (Step Functions) |
| `registerSubmission(...)` | Track submission | `grading.server.ts` | 🔲 TODO |
| `checkSubmission(...)` | Validate limits | `grading.server.ts` | 🔲 TODO |
| `gradeSubmission(form, ...)` | Main entry point | `grading.server.ts` | 🔲 TODO |

```typescript
// app/lib/services/grading.server.ts
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";

export async function submitSolution(
  username: string,
  problemId: string,
  code: string,
  language: Language
): Promise<{ submissionId: string } | { error: string }> {
  // 1. Check submission limits
  // 2. Get next submission ID
  // 3. Upload code to S3
  // 4. Start Step Functions execution
  // 5. Register submission in DynamoDB
}
```

---

### 7. `submissions.py` → `app/lib/services/submissions.server.ts`

| Function | Purpose | New Location | Status |
|----------|---------|--------------|--------|
| `getSubmission(subId)` | Get single submission | `mock-data.ts` | ✅ `mockSubmissions` |
| `getNumberOfSubmissions()` | Total count | `submissions.server.ts` | 🔲 TODO |
| `batchGetSubmissions(start, end)` | Batch get by range | `submissions.server.ts` | 🔲 TODO |
| `getSubmissionsList(pageNo, problem, username)` | Paginated list | `mock-data.ts` | ✅ `getSubmissionsForUser()` |

```typescript
// app/lib/services/submissions.server.ts
export async function getSubmissionWithCode(subId: string): Promise<Submission | null> {
  // Get from DynamoDB + fetch code from S3
}

export async function getSubmissionsList(options: {
  page: number;
  problem?: string;
  username?: string;
}): Promise<{ submissions: Submission[]; total: number }> {
  // Use GSI for filtering, paginate
}
```

---

### 8. `announcements.py` → `app/lib/services/announcements.server.ts`

| Function | Purpose | New Location | Status |
|----------|---------|--------------|--------|
| `getAllAnnouncements()` | List announcements | `mock-data.ts` | ✅ `mockAnnouncements` |
| `createAnnouncement(title, text)` | Create + notify | `announcements.server.ts` | 🔲 TODO |

```typescript
// app/lib/services/announcements.server.ts
export async function createAnnouncement(title: string, content: string, author: string) {
  // 1. Create in DynamoDB
  // 2. Trigger WebSocket notification (optional for MVP)
}
```

---

### 9. `clarifications.py` → `app/lib/services/clarifications.server.ts`

| Function | Purpose | New Location | Status |
|----------|---------|--------------|--------|
| `createClarification(username, problem, question)` | Ask question | `clarifications.server.ts` | 🔲 TODO |
| `answerClarification(askedBy, time, answer, answeredBy)` | Answer question | `clarifications.server.ts` | 🔲 TODO |
| `getClarificationsByUser(username)` | User's questions | `mock-data.ts` | ✅ `mockClarifications` |
| `getAllClarifications()` | All questions | `mock-data.ts` | ✅ `mockClarifications` |

```typescript
// app/lib/services/clarifications.server.ts
export async function createClarification(
  username: string,
  problemId: string | null,
  question: string
): Promise<Clarification> {
  // Create in DynamoDB with pending status
}

export async function answerClarification(
  clarificationId: string,
  answer: string,
  answeredBy: string
): Promise<Clarification> {
  // Update DynamoDB, optionally notify user
}
```

---

### 10. `websocket.py` → `app/lib/services/websocket.server.ts` (Optional)

| Function | Purpose | New Location | Status |
|----------|---------|--------------|--------|
| `announce()` | Broadcast to all | `websocket.server.ts` | 🔲 TODO (Phase 2) |
| `postClarification()` | Notify admins | `websocket.server.ts` | 🔲 TODO (Phase 2) |
| `answerClarification(role, username)` | Notify user | `websocket.server.ts` | 🔲 TODO (Phase 2) |
| `invoke(items, type)` | Step Functions helper | `websocket.server.ts` | 🔲 TODO (Phase 2) |

> **Note:** WebSocket notifications are optional for MVP. Can be added later for real-time updates.

---

### 11. `sts.py` → `app/lib/aws/sts.server.ts`

| Function | Purpose | New Location | Status |
|----------|---------|--------------|--------|
| `createRole(problemName)` | Create IAM role | `sts.server.ts` | 🔲 TODO |
| `getTokens(problemName)` | Get temp credentials | `sts.server.ts` | 🔲 TODO |

```typescript
// app/lib/aws/sts.server.ts
import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import { IAMClient, CreateRoleCommand } from "@aws-sdk/client-iam";

export async function getTestdataUploadCredentials(problemName: string) {
  // Create role if needed, then assume role for temp credentials
}
```

---

## Implementation Phases

### Phase 1: Core Functionality (Current)
- ✅ Authentication (mock + Cognito ready)
- ✅ Users management (mock data)
- ✅ Contests management (mock data)
- ✅ Problems display (mock data)
- ✅ Submissions display (mock data)

### Phase 2: AWS Integration
- 🔲 Connect DynamoDB for persistence
- 🔲 Connect S3 for file storage
- 🔲 Connect Cognito for real auth
- 🔲 Implement grading pipeline

### Phase 3: Grading System
- 🔲 Submission upload to S3
- 🔲 Step Functions integration
- 🔲 Real-time verdict updates

### Phase 4: Advanced Features
- 🔲 WebSocket notifications
- 🔲 Problem validation
- 🔲 Custom checkers
- 🔲 Communication problems

---

## Environment Variables Required

```bash
# AWS Configuration
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx

# Cognito
COGNITO_USER_POOL_ID=ap-southeast-1_xxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxx

# DynamoDB Table Names (using judge name prefix)
JUDGE_NAME=codebreaker
# Tables: {JUDGE_NAME}-users, {JUDGE_NAME}-contests, {JUDGE_NAME}-problems, etc.

# S3 Buckets
S3_SUBMISSIONS_BUCKET={JUDGE_NAME}-submissions
S3_TESTDATA_BUCKET={JUDGE_NAME}-testdata
S3_STATEMENTS_BUCKET={JUDGE_NAME}-statements

# Step Functions
GRADING_STATE_MACHINE_ARN=arn:aws:states:...
WEBSOCKET_STATE_MACHINE_ARN=arn:aws:states:...

# Lambda Functions
VALIDATE_LAMBDA_ARN=arn:aws:lambda:...
REGRADE_LAMBDA_ARN=arn:aws:lambda:...
COMPILE_CHECKER_LAMBDA_ARN=arn:aws:lambda:...
```

---

## File Structure for AWS Integration

```
app/lib/
├── aws/
│   ├── config.server.ts      # AWS SDK configuration
│   ├── dynamodb.server.ts    # DynamoDB helpers
│   ├── s3.server.ts          # S3 helpers
│   ├── cognito.server.ts     # Cognito auth
│   ├── lambda.server.ts      # Lambda invocation
│   ├── stepfunctions.server.ts # Step Functions
│   └── sts.server.ts         # STS for temp credentials
├── services/
│   ├── users.server.ts       # User operations
│   ├── contests.server.ts    # Contest operations
│   ├── problems.server.ts    # Problem operations
│   ├── submissions.server.ts # Submission operations
│   ├── grading.server.ts     # Grading pipeline
│   ├── announcements.server.ts
│   ├── clarifications.server.ts
│   └── websocket.server.ts   # (Optional) Real-time
└── mock-data.ts              # Current mock data (dev mode)
```

---

## Migration Checklist

- [ ] Set up AWS SDK v3 packages
- [ ] Create DynamoDB helper functions
- [ ] Create S3 helper functions
- [ ] Implement Cognito authentication
- [ ] Connect users service to DynamoDB
- [ ] Connect contests service to DynamoDB
- [ ] Connect problems service to DynamoDB
- [ ] Connect submissions service to DynamoDB
- [ ] Implement file uploads (statements, attachments)
- [ ] Implement grading submission flow
- [ ] Test end-to-end submission → grading → result
- [ ] Add WebSocket notifications (optional)
