# Integration Testing Suite

This directory contains comprehensive integration tests for the Codebreaker contest system.

## Test Files

### Grading Verification
- **`comprehensive-grading.test.ts`** - Tests all 12 sample solutions across 3 problems (prisoners, ping, addition)
- **`grading-verification.test.ts`** - Tests individual solution grading and verification  
- **`database-connectivity.test.ts`** - Tests basic database operations
- **`basic-infrastructure.test.ts`** - Tests basic test infrastructure

### Contest Simulation
- **`contest-simulation.test.ts`** - **NEW** Comprehensive multi-user contest simulation

## Contest Simulation Testing

The `contest-simulation.test.ts` file tests realistic contest scenarios with multiple users participating simultaneously. This validates the complete contest infrastructure beyond individual submission testing.

### What It Tests

**Multi-User Participation:**
- Multiple users joining same contest concurrently
- Staggered user registration and contest start timing
- User participation status management

**Concurrent Submissions & Leaderboard:**
- Users submitting solutions simultaneously during active contests
- Real-time leaderboard updates as submissions are graded
- Ranking algorithm accuracy (score descending, time ascending)
- Leaderboard evolution throughout contest duration

**Automated Contest End (Lambda-Step Function Window):**
- EventBridge Scheduler triggering contest-end-notifier Lambda at exact endTime
- contest-end-notifier querying participants via DynamoDB GSI
- Step Function parallel broadcasting of endContest notifications
- WebSocket notification delivery to contest participants
- Automatic contest state transitions (NOT_STARTED → ONGOING → ENDED)
- Submission blocking after automated contest end

**Contest Lifecycle Management:**
- Contest state transitions based on timing
- Multi-contest participation (users in multiple contests simultaneously)  
- Contest context isolation and proper cleanup

### Key Verification Points

✅ **No Manual Contest Stopping** - Confirms users cannot manually exit contests and admins cannot manually terminate active contests  
✅ **Automated End-to-End Flow** - Tests complete EventBridge → Lambda → Step Function → WebSocket notification chain  
✅ **Concurrent User Safety** - Validates no race conditions or data inconsistencies under multi-user load  
✅ **Real-Time Updates** - Confirms leaderboard changes reflect new submissions within reasonable timeframes  
✅ **Contest Isolation** - Verifies contest-specific leaderboards and submissions remain properly separated  

### Running Tests

```bash
# Run grading verification tests (12 sample solutions)
bun run test:grading

# Run contest simulation tests (multi-user contests)
bun run test:contest

# Run all integration tests
bun run test:integration
```

### Test Duration & Timeouts

Contest simulation tests take longer than unit tests due to:
- Real AWS service integration (Step Functions, Lambda, DynamoDB)
- Actual contest duration waiting (1.5-2.5 minute test contests)
- Submission grading delays (up to 2 minutes per submission)
- Multi-user coordination and timing

**Contest Durations:**
- Main contest simulation: **2.5 minutes** (150 seconds)
- Automated end test: **1.5 minutes** (90 seconds)
- Multi-contest test: **2 minutes** (120 seconds)

**Typical execution times:**
- Contest setup: 30-45 seconds
- Individual test scenarios: 2-4 minutes each
- Full contest simulation suite: 8-12 minutes

### Infrastructure Requirements

**AWS Services Used:**
- DynamoDB (users, contests, submissions, websocket connections)
- Step Functions (grading pipeline, WebSocket broadcasting)  
- Lambda (grading, contest-end-notifier, websocket-invoke)
- EventBridge Scheduler (automated contest end timing)
- S3 (submission source code storage)
- API Gateway WebSocket (real-time notifications)

**Environment Variables Required:**
- `JUDGE_NAME` - AWS resource prefix (e.g., codebreakercontest07)
- `AWS_REGION` - AWS region (e.g., ap-southeast-1)
- `AWS_ACCOUNT_ID` - AWS account ID for ARN construction

### Test Data Cleanup

All contest simulation tests include automatic cleanup:
- Test contests are deleted after completion
- Test users are cleaned up (except protected users like "admin")
- Failed test cleanup is logged as warnings but doesn't fail tests
- Each test uses timestamp-based unique IDs to avoid conflicts