# Database Queries Documentation

> Last updated: 2026-02-23

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

### Problems (`/problems`)
**Route:** `app/routes/problems.tsx`

Contest problems list for participants.

| Phase | Queries |
|-------|---------|
| Loader | `requireAuth()`, `isUserInActiveContest(username)`, `getScoreboard(contestId)`, `getProblemsForContest(problemNames)` |
| Action | `startUserContest(username, contestId)` |

---

### Submissions (`/submissions`)
**Route:** `app/routes/submissions.tsx`

User's submission history.

| Phase | Queries |
|-------|---------|
| Loader | `requireAuth()`, `isUserInActiveContest(username)`, `getSubmissionsByUser(username)`, `getProblemsForContest(problemNames)` |

---

### Scoreboard (`/scoreboard`)
**Route:** `app/routes/scoreboard.tsx`

Contest scoreboard/rankings.

| Phase | Queries |
|-------|---------|
| Loader | `requireAuth()`, `isUserInActiveContest(username)`, `getProblemsForContest(problemNames)`, `getScoreboard(contestId)` |

---

### Clarifications (`/clarifications`)
**Route:** `app/routes/clarifications.tsx`

User's clarification requests.

| Phase | Queries |
|-------|---------|
| Loader | `getCurrentUser()`, `getClarificationsByUser(username)`, `listValidatedProblems()` |
| Action | `createClarification(username, question, problemName)` |

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

| Function | Description | Used By |
|----------|-------------|---------|
| `listAnnouncements()` | List all | admin/announcements |
| `createAnnouncement(...)` | Create new | admin/announcements |
| `updateAnnouncement(id, updates)` | Update by ID | admin/announcements |
| `deleteAnnouncement(id)` | Delete by ID | admin/announcements |

### Clarifications
**File:** `app/lib/db/clarifications.server.ts`
**Table:** `{JudgeName}-clarifications`

| Function | Description | Used By |
|----------|-------------|---------|
| `listClarifications()` | List all | admin/clarifications |
| `getClarificationsByUser(username)` | List by user | clarifications |
| `createClarification(...)` | Create new | clarifications |
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

| Function | Description | Used By |
|----------|-------------|---------|
| `getSubmissionsByUser(username)` | Get user's submissions | submissions |
| `formatSubmissionForDisplay(sub)` | Transform for UI | submissions |

### Scoreboard
**File:** `app/lib/db/scoreboard.server.ts`
**Table:** `{JudgeName}-contests` (scores field)

| Function | Description | Used By |
|----------|-------------|---------|
| `getScoreboard(contestId)` | Build scoreboard | problems, scoreboard |

### Contest Helper
**File:** `app/lib/contest.server.ts`
**Table:** `{JudgeName}-contests`

| Function | Description | Used By |
|----------|-------------|---------|
| `isUserInActiveContest(username)` | Check active session | problems, submissions, scoreboard |
| `startUserContest(username, contestId)` | Start timer (self-timer) | problems |

### Auth
**File:** `app/lib/auth.server.ts`
**Table:** `{JudgeName}-users`

| Function | Description | Used By |
|----------|-------------|---------|
| `getCurrentUser()` | Get user from session | login, clarifications, layout |
| `requireAuth()` | Require authenticated user | layout, problems, submissions, scoreboard |
| `requireAdmin()` | Require admin role | layout (/admin/*), admin pages |
| `login(username, password)` | Authenticate user | login |

---

## DynamoDB Tables

| Table | Primary Key | Description |
|-------|-------------|-------------|
| `{JudgeName}-users` | `username` | User accounts |
| `{JudgeName}-problems` | `problemName` | Problem definitions |
| `{JudgeName}-contests` | `contestId` | Contest configurations and scores |
| `{JudgeName}-submissions` | `subId` (GSI: `username-index`) | User submissions |
| `{JudgeName}-announcements` | `announcementId` | Contest announcements |
| `{JudgeName}-clarifications` | `askedBy` + `clarificationTime` | Clarification requests |
| `{JudgeName}-global-counters` | `counterId` | Auto-increment counters |
