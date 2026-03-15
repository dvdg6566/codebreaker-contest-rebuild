# Database Queries Documentation

> Last updated: 2026-03-15

This document lists all DynamoDB queries performed per page in the Codebreaker Contest application.

---

## User-Facing Pages

### Layout (`/*`)
**Route:** `app/routes/layout.tsx`

Main app layout wrapper - authenticates all protected routes.

| Phase | Queries |
|-------|---------|
| Loader | `requireAuth()`, `requireAdmin()` (for /admin/* paths) |

---

### Login (`/login`)
**Route:** `app/routes/login.tsx`

User login page.

| Phase | Queries |
|-------|---------|
| Loader | `getCurrentUser()` |
| Action | `login()` → `getUser()` + password validation |

---

### Contests (`/contests`)
**Route:** `app/routes/contests.tsx`

Contest listing for user.

| Phase | Queries |
|-------|---------|
| Loader | `requireAuth()`, `getUserContests(username)` |

---

### Contest Overview (`/contests/:contestId`)
**Route:** `app/routes/contests.$contestId.index.tsx`

Contest dashboard with overview information.

| Phase | Queries |
|-------|---------|
| Loader | `requireContestAccess(username, contestId)`, `getContest(contestId)` |

---

### Contest Problems (`/contests/:contestId/problems`)
**Route:** `app/routes/contests.$contestId.problems.tsx`

Contest problems list for participants.

| Phase | Queries |
|-------|---------|
| Loader | `requireContestAccess(username, contestId)`, `getContest(contestId)`, `getProblemsForContest(problemNames)`, `getScoreboard(contestId)` |
| Action | `startUserContest(username, contestId)` (self-timer mode) |

---

### Problem View (`/contests/:contestId/problem/:problemId`)
**Route:** `app/routes/contests.$contestId.problem.$problemId.tsx`

Problem statement and submission form.

| Phase | Queries |
|-------|---------|
| Loader | `requireContestAccess(username, contestId)`, `getContest(contestId)`, `getProblem(problemId)`, `getSubmissionsByContestAndUser(contestId, username)` |
| Action | `createSubmission(...)`, `triggerGrading(submissionId)` |

---

### Contest Submissions (`/contests/:contestId/submissions`)
**Route:** `app/routes/contests.$contestId.submissions.tsx`

User's submission history for a contest.

| Phase | Queries |
|-------|---------|
| Loader | `requireContestAccess(username, contestId)`, `getContest(contestId)`, `getSubmissionsByContestAndUser(contestId, username)` |

---

### Contest Scoreboard (`/contests/:contestId/scoreboard`)
**Route:** `app/routes/contests.$contestId.scoreboard.tsx`

Contest scoreboard/rankings.

| Phase | Queries |
|-------|---------|
| Loader | `requireAuth()`, `canUserAccessContest(username, contestId)`, `getContest(contestId)`, `getScoreboard(contestId)` |

---

### Contest Announcements (`/contests/:contestId/announcements`)
**Route:** `app/routes/contests.$contestId.announcements.tsx`

Contest announcements for participants.

| Phase | Queries |
|-------|---------|
| Loader | `requireContestAccess(username, contestId)`, `getContest(contestId)`, `getAnnouncementsByContest(contestId)` |

---

### Contest Clarifications (`/contests/:contestId/clarifications`)
**Route:** `app/routes/contests.$contestId.clarifications.tsx`

User's clarification requests for a contest.

| Phase | Queries |
|-------|---------|
| Loader | `requireContestAccess(username, contestId)`, `getContest(contestId)`, `getClarificationsByUserAndContest(username, contestId)` |
| Action | `createClarification(username, question, contestId, problemName)` |

---

### Global Problems (`/problems`)
**Route:** `app/routes/problems.tsx`

Problem archive (non-contest practice).

| Phase | Queries |
|-------|---------|
| Loader | `requireAuth()`, `listValidatedProblems()` |

---

## Admin Pages

### Users (`/admin/users`)
**Route:** `app/routes/admin/users.tsx`

User management.

| Phase | Queries |
|-------|---------|
| Loader | `listUsers()` |
| Action | `createUser(username, role, options)`, `deleteUser(username)` |

---

### Problems (`/admin/problems`)
**Route:** `app/routes/admin/problems.tsx`

Problem management.

| Phase | Queries |
|-------|---------|
| Loader | `listProblems()` |
| Action | `createProblem(problemId, options)` |

---

### Announcements (`/admin/announcements`)
**Route:** `app/routes/admin/announcements.tsx`

Announcement management.

| Phase | Queries |
|-------|---------|
| Loader | `listAnnouncements()` |
| Action | `createAnnouncement(title, text, author, priority)`, `updateAnnouncement(id, updates)`, `deleteAnnouncement(id)` |

---

### Clarifications (`/admin/clarifications`)
**Route:** `app/routes/admin/clarifications.tsx`

Clarification management.

| Phase | Queries |
|-------|---------|
| Loader | `listClarifications()`, `getUser(askedBy)` per clarification, `getProblem(problemName)` per clarification |
| Action | `answerClarification(askedBy, time, answer, answeredBy)` |

---

### Contests (`/admin/contests`)
**Route:** `app/routes/admin/contests.tsx`

Contest list management.

| Phase | Queries |
|-------|---------|
| Loader | `requireAdmin()`, `listContestsWithStatus()` |
| Action | `listContestsWithStatus()` (duplicate check), `createContest(contestId)`, `deleteContest(contestId)` |

---

### Contest Edit (`/admin/contests/:contestId`)
**Route:** `app/routes/admin/contests.$contestId.tsx`

Single contest editor.

| Phase | Queries |
|-------|---------|
| Loader | `requireAdmin()`, `getContest(contestId)`, `getContestStatus(contest)`, `listProblems()`, `listUsers()` |
| Action | `getContest(contestId)`, `updateContest(contestId, updates)`, `getUser(username)` (for add_user) |

---

### Testdata (`/admin/problems/:problemId/testdata`)
**Route:** `app/routes/admin/problems.$problemId.testdata.tsx`

Problem testdata management.

| Phase | Queries |
|-------|---------|
| Loader | `requireAdmin()`, `getProblem(problemId)`, `listTestcases(problemId)` (S3) |

---

## Database Modules

### Users
**File:** `app/lib/db/users.server.ts`
**Table:** `{JudgeName}-users`

| Function | Description | Used By |
|----------|-------------|---------|
| `listUsers()` | List all users | admin/users, admin/contests.$contestId |
| `getUser(username)` | Get single user | admin/clarifications, admin/contests.$contestId, login |
| `createUser(...)` | Create new user | admin/users |
| `deleteUser(username)` | Delete user | admin/users |

### Problems
**File:** `app/lib/db/problems.server.ts`
**Table:** `{JudgeName}-problems`

| Function | Description | Used By |
|----------|-------------|---------|
| `listProblems()` | List all problems | admin/problems, admin/contests.$contestId |
| `getProblem(problemName)` | Get single problem | admin/clarifications, admin/testdata |
| `createProblem(...)` | Create new problem | admin/problems |
| `listValidatedProblems()` | List validated problems | clarifications |
| `getProblemsForContest(names)` | Get problems by names | problems, submissions, scoreboard |

### Announcements
**File:** `app/lib/db/announcements.server.ts`
**Table:** `{JudgeName}-announcements`
**GSI:** `contestIdIndex` (PK: contestId)

| Function | Description | Used By |
|----------|-------------|---------|
| `listAnnouncements()` | List all | admin/announcements |
| `getAnnouncementsByContest(contestId)` | List by contest | contests.$contestId.announcements |
| `createAnnouncement(...)` | Create new | admin/announcements |
| `updateAnnouncement(id, updates)` | Update by ID | admin/announcements |
| `deleteAnnouncement(id)` | Delete by ID | admin/announcements |

### Clarifications
**File:** `app/lib/db/clarifications.server.ts`
**Table:** `{JudgeName}-clarifications`
**GSI:** `contestIdIndex` (PK: contestId)

| Function | Description | Used By |
|----------|-------------|---------|
| `listClarifications()` | List all | admin/clarifications |
| `getClarificationsByUserAndContest(username, contestId)` | List by user and contest | contests.$contestId.clarifications |
| `createClarification(...)` | Create new | contests.$contestId.clarifications |
| `answerClarification(...)` | Answer clarification | admin/clarifications |

### Contests
**File:** `app/lib/db/contests.server.ts`
**Table:** `{JudgeName}-contests`

| Function | Description | Used By |
|----------|-------------|---------|
| `listContestsWithStatus()` | List with computed status | admin/contests |
| `getContest(contestId)` | Get single contest | admin/contests.$contestId |
| `createContest(contestId)` | Create new | admin/contests |
| `updateContest(id, updates)` | Update by ID | admin/contests.$contestId |
| `deleteContest(contestId)` | Delete by ID | admin/contests |
| `getContestStatus(contest)` | Compute status | admin/contests.$contestId |

### Submissions
**File:** `app/lib/db/submissions.server.ts`
**Table:** `{JudgeName}-submissions`
**GSIs:** `usernameIndex` (PK: username), `problemIndex` (PK: problemName), `contestUserIndex` (PK: contestId, SK: username)

| Function | Description | Used By |
|----------|-------------|---------|
| `getSubmissionsByUser(username)` | Get user's global submissions | problems |
| `getSubmissionsByContestAndUser(contestId, username)` | Get user's contest submissions | contests.$contestId.submissions, contests.$contestId.problem.$problemId |
| `createSubmission(...)` | Create new submission | contests.$contestId.problem.$problemId |
| `formatSubmissionForDisplay(sub)` | Transform for UI | various |

### Scoreboard
**File:** `app/lib/db/scoreboard.server.ts`
**Table:** `{JudgeName}-contests` (scores field)

| Function | Description | Used By |
|----------|-------------|---------|
| `getScoreboard(contestId)` | Build scoreboard | problems, scoreboard |

### Auth
**File:** `app/lib/auth.server.ts`
**Table:** `{JudgeName}-users`

| Function | Description | Used By |
|----------|-------------|---------|
| `getCurrentUser()` | Get user from session | login, layout |
| `requireAuth()` | Require authenticated user | layout, problems |
| `requireAdmin()` | Require admin role | layout (/admin/*), admin pages |
| `requireContestAccess(username, contestId)` | Require user has access to contest | contest routes |
| `login(username, password)` | Authenticate user | login |

### Contest Helper
**File:** `app/lib/contest.server.ts`
**Table:** `{JudgeName}-contests`

| Function | Description | Used By |
|----------|-------------|---------|
| `getContest(contestId)` | Get contest by ID | contest routes |
| `canUserAccessContest(username, contestId)` | Check if user can access contest | contests.$contestId.scoreboard |
| `startUserContest(username, contestId)` | Start self-timer | contests.$contestId.problems |
| `getUserContests(username)` | Get user's active contests | contests |

---

## DynamoDB Tables

| Table | Primary Key | GSIs | Description |
|-------|-------------|------|-------------|
| `{JudgeName}-users` | `username` | - | User accounts |
| `{JudgeName}-problems` | `problemName` | - | Problem definitions |
| `{JudgeName}-contests` | `contestId` | - | Contest configurations and scores |
| `{JudgeName}-submissions` | `subId` | `usernameIndex`, `problemIndex`, `contestUserIndex` | User submissions |
| `{JudgeName}-announcements` | `announcementId` | `contestIdIndex` | Contest announcements |
| `{JudgeName}-clarifications` | `askedBy` + `clarificationTime` | `contestIdIndex` | Clarification requests |
| `{JudgeName}-websocket` | `connectionId` | `accountRoleUsernameIndex`, `contestIdUsernameIndex` | WebSocket connections |
| `{JudgeName}-global-counters` | `counterId` | - | Auto-increment counters |
