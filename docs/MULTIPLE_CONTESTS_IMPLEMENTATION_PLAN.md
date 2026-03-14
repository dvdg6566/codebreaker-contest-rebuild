# Multiple Contests Per User - Implementation Plan

**Feature:** Allow users to participate in multiple contests simultaneously
**Status:** Planning Phase
**Estimated Timeline:** 2-3 weeks
**Risk Level:** Medium (requires data migration)

---

## Table of Contents

- [1. Overview](#1-overview)
- [2. Database Schema Changes](#2-database-schema-changes)
- [3. Backend Implementation](#3-backend-implementation)
- [4. Frontend Changes](#4-frontend-changes)
- [5. Data Migration Strategy](#5-data-migration-strategy)
- [6. Testing Plan](#6-testing-plan)
- [7. Deployment Strategy](#7-deployment-strategy)
- [8. Rollback Plan](#8-rollback-plan)

---

## 1. Overview

### 1.1 Current State
- Users can only be assigned to one contest at a time (`user.contest: string`)
- Contest assignments are stored in both users table and contests table (dual ownership)
- Contest access is determined by single contest assignment

### 1.2 Target State
- Users can participate in multiple contests simultaneously
- Contest context becomes explicit in URLs/UI
- Backward compatible migration from single to multiple contests
- No performance degradation

### 1.3 Success Criteria
- ✅ Users can join multiple overlapping contests
- ✅ Existing functionality continues to work
- ✅ No data loss during migration
- ✅ Performance remains comparable
- ✅ URL structure is clean and shareable

---

## 2. Database Schema Changes

### 2.1 Users Table Schema Evolution

#### Phase 1: Extend Schema (Backward Compatible)
```typescript
interface User {
  username: string;                    // PK (unchanged)
  role: UserRole;                     // unchanged

  // Legacy field - keep for backward compatibility
  contest: string;                    // DEPRECATED but maintained

  // New multi-contest fields
  activeContests?: Record<string, {   // NEW - multiple contest participation
    status: "invited" | "started" | "completed";
    joinedAt: string;                 // When user was added to contest
    startedAt?: string;               // When user started (self-timer mode)
  }>;

  // Migrate scores to be per-contest
  contestScores?: Record<string, Record<string, number>>;  // NEW
  contestSubmissions?: Record<string, Record<string, number>>;  // NEW
  contestLatestSubmissions?: Record<string, Record<string, string>>;  // NEW

  // Legacy fields - keep for backward compatibility
  problemScores: Record<string, number>;        // DEPRECATED
  problemSubmissions: Record<string, number>;   // DEPRECATED
  latestSubmissions: Record<string, string>;    // DEPRECATED
  latestScoreChange: string;                    // DEPRECATED
}
```

#### Phase 2: Migration Complete (Future)
```typescript
interface User {
  username: string;
  role: UserRole;

  // Multi-contest fields (primary)
  activeContests: Record<string, ContestParticipation>;
  contestScores: Record<string, Record<string, number>>;
  contestSubmissions: Record<string, Record<string, number>>;
  contestLatestSubmissions: Record<string, Record<string, string>>;

  // Remove legacy fields after migration
  // contest: string;                    // REMOVED
  // problemScores: Record<string, number>;  // REMOVED
}
```

### 2.2 Contest Participation Type
```typescript
interface ContestParticipation {
  status: "invited" | "started" | "completed";
  joinedAt: string;                   // ISO timestamp
  startedAt?: string;                 // For self-timer mode
  completedAt?: string;               // When contest ended for user
  finalScore?: number;                // Final score achieved
}
```

### 2.3 No Additional Tables Required
- Contest table schema remains unchanged
- No GSIs required (dual ownership pattern continues)
- Submission and other tables unchanged

---

## 3. Backend Implementation

### 3.1 Database Service Updates

#### 3.1.1 New User Functions (`app/lib/db/users.server.ts`)
```typescript
// Get user's active contests
export async function getUserActiveContests(username: string): Promise<Contest[]>

// Add user to a contest
export async function addUserToContest(
  username: string,
  contestId: string,
  status: "invited" | "started" = "invited"
): Promise<void>

// Remove user from a contest
export async function removeUserFromContest(
  username: string,
  contestId: string
): Promise<void>

// Update user's contest participation status
export async function updateUserContestStatus(
  username: string,
  contestId: string,
  updates: Partial<ContestParticipation>
): Promise<void>

// Get user's contest-specific scores
export async function getUserContestScores(
  username: string,
  contestId: string
): Promise<Record<string, number>>

// Update user's score for a specific contest
export async function updateUserContestScore(
  username: string,
  contestId: string,
  problemName: string,
  score: number,
  submissionTime: string
): Promise<void>

// Migration helper - convert legacy user to multi-contest format
export async function migrateUserToMultiContest(username: string): Promise<User>
```

#### 3.1.2 Updated Contest Functions (`app/lib/db/contests.server.ts`)
```typescript
// Existing functions remain unchanged - dual ownership pattern preserved
// addUserToContest() - existing function works as-is
// removeUserFromContest() - existing function works as-is
// markUserStarted() - existing function works as-is
```

#### 3.1.3 Contest Service Updates (`app/lib/contest.server.ts`)
```typescript
// Replace single contest functions with multi-contest versions

// NEW: Get all active contests for a user
export async function getUserActiveContests(username: string): Promise<Contest[]>

// UPDATED: Check if user can access specific contest
export async function canUserAccessContest(
  username: string,
  contestId: string
): Promise<boolean>

// UPDATED: Start user's contest (multi-contest aware)
export async function startUserContest(
  username: string,
  contestId: string  // Now requires explicit contest ID
): Promise<UserParticipation>

// UPDATED: Check active contest status for specific contest
export async function isUserInActiveContest(
  username: string,
  contestId: string  // Now requires explicit contest ID
): Promise<{
  active: boolean;
  contest: Contest | null;
  participation: UserParticipation | null;
  timeRemaining: number;
}>

// NEW: Get user's primary/default contest (for backward compatibility)
export async function getUserPrimaryContest(username: string): Promise<Contest | null>
```

### 3.2 Authentication & Authorization Updates

#### 3.2.1 Auth Middleware (`app/lib/auth.server.ts`)
```typescript
// NEW: Require contest access for contest-specific routes
export async function requireContestAccess(
  request: Request,
  contestId: string
): Promise<User> {
  const user = await requireAuth(request);
  const hasAccess = await canUserAccessContest(user.username, contestId);

  if (!hasAccess) {
    throw new Response("Contest access denied", { status: 403 });
  }

  return user;
}

// UPDATED: Add contest context to user session
export async function getUserWithContestContext(
  request: Request,
  contestId?: string
): Promise<{ user: User; contest: Contest | null }> {
  const user = await requireAuth(request);

  if (contestId) {
    const contest = await getContest(contestId);
    const hasAccess = await canUserAccessContest(user.username, contestId);

    return {
      user,
      contest: hasAccess ? contest : null
    };
  }

  // Return user's primary contest for backward compatibility
  const primaryContest = await getUserPrimaryContest(user.username);
  return { user, contest: primaryContest };
}
```

### 3.3 API Route Updates

#### 3.3.1 New Contest-Specific Routes (`app/routes.ts`)
```typescript
// Add new contest-specific routes
...prefix("contests", [
  route(":contestId", "routes/contests.$contestId.tsx"),
  route(":contestId/problems", "routes/contests.$contestId.problems.tsx"),
  route(":contestId/problems/:problemId", "routes/contests.$contestId.problems.$problemId.tsx"),
  route(":contestId/submissions", "routes/contests.$contestId.submissions.tsx"),
  route(":contestId/scoreboard", "routes/contests.$contestId.scoreboard.tsx"),
  route(":contestId/clarifications", "routes/contests.$contestId.clarifications.tsx"),
]),

// Keep existing routes for backward compatibility
route("problems", "routes/problems.tsx"),           // Redirects to default contest
route("submissions", "routes/submissions.tsx"),     // Shows all contests or default
route("scoreboard", "routes/scoreboard.tsx"),       // Redirects to default contest
```

#### 3.3.2 Route Implementations

**New Contest Problems Route** (`routes/contests.$contestId.problems.tsx`)
```typescript
export async function loader({ request, params }: LoaderFunctionArgs) {
  const { contestId } = params;
  const { user, contest } = await getUserWithContestContext(request, contestId);

  if (!contest) {
    throw new Response("Contest not found or access denied", { status: 404 });
  }

  const problems = await getProblemsForContest(contest.problems);
  const userScores = await getUserContestScores(user.username, contestId);

  return { user, contest, problems, userScores };
}

export async function action({ request, params }: ActionFunctionArgs) {
  // Handle contest-specific actions (start contest, submit solutions)
  const { contestId } = params;
  const formData = await request.formData();
  const intent = formData.get("intent");

  switch (intent) {
    case "start-contest":
      return handleStartContest(request, contestId);
    case "submit-solution":
      return handleSubmitSolution(request, contestId);
    default:
      throw new Response("Invalid action", { status: 400 });
  }
}
```

**Backward Compatible Problems Route** (`routes/problems.tsx`)
```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  const activeContests = await getUserActiveContests(user.username);

  // If user has only one contest, redirect to contest-specific route
  if (activeContests.length === 1) {
    throw redirect(`/contests/${activeContests[0].contestId}/problems`);
  }

  // If user has multiple contests, show contest selector
  // If user has no contests, show appropriate message
  return { user, activeContests };
}
```

---

## 4. Frontend Changes

### 4.1 URL Structure

#### 4.1.1 New URL Patterns
```
/contests                              # List of user's contests
/contests/:contestId                   # Contest overview
/contests/:contestId/problems          # Contest problems
/contests/:contestId/problems/:problemId  # Specific problem
/contests/:contestId/submissions       # Contest submissions
/contests/:contestId/scoreboard        # Contest scoreboard
/contests/:contestId/clarifications    # Contest clarifications
```

#### 4.1.2 Backward Compatible URLs
```
/problems          # Redirects to default contest or shows contest selector
/submissions       # Shows submissions from all contests or default contest
/scoreboard        # Redirects to default contest scoreboard
/clarifications    # Shows clarifications from all contests
```

### 4.2 UI Components

#### 4.2.1 New Components
```typescript
// Contest selector component
function ContestSelector({
  contests,
  selectedContest,
  onContestChange
}: ContestSelectorProps) {
  return (
    <select value={selectedContest} onChange={onContestChange}>
      {contests.map(contest => (
        <option key={contest.contestId} value={contest.contestId}>
          {contest.contestName}
        </option>
      ))}
    </select>
  );
}

// Contest breadcrumb component
function ContestBreadcrumb({ contest, currentPage }: BreadcrumbProps) {
  return (
    <nav>
      <Link to={`/contests/${contest.contestId}`}>{contest.contestName}</Link>
      <span> / </span>
      <span>{currentPage}</span>
    </nav>
  );
}

// Contest status indicator
function ContestStatus({ contest, userParticipation }: StatusProps) {
  return (
    <div className={`status ${userParticipation.status}`}>
      {userParticipation.status === "invited" && "Not Started"}
      {userParticipation.status === "started" && "In Progress"}
      {userParticipation.status === "completed" && "Completed"}
    </div>
  );
}
```

#### 4.2.2 Updated Page Components

**Contest Problems Page** (`routes/contests.$contestId.problems.tsx`)
```typescript
export default function ContestProblems() {
  const { user, contest, problems, userScores } = useLoaderData<typeof loader>();

  return (
    <div>
      <ContestBreadcrumb contest={contest} currentPage="Problems" />
      <ContestStatus contest={contest} userParticipation={user.activeContests[contest.contestId]} />

      <ProblemsTable
        problems={problems}
        userScores={userScores}
        contestId={contest.contestId}
      />
    </div>
  );
}
```

**Contest List Page** (`routes/contests.tsx`)
```typescript
export default function Contests() {
  const { user, activeContests } = useLoaderData<typeof loader>();

  return (
    <div>
      <h1>My Contests</h1>

      {activeContests.map(contest => (
        <ContestCard
          key={contest.contestId}
          contest={contest}
          participation={user.activeContests[contest.contestId]}
        />
      ))}
    </div>
  );
}
```

### 4.3 State Management
```typescript
// Contest context for managing current contest
export const ContestContext = createContext<{
  currentContest: Contest | null;
  userParticipation: ContestParticipation | null;
  switchContest: (contestId: string) => void;
}>({
  currentContest: null,
  userParticipation: null,
  switchContest: () => {}
});

// Hook for accessing contest context
export function useContest() {
  const context = useContext(ContestContext);
  if (!context) {
    throw new Error("useContest must be used within ContestProvider");
  }
  return context;
}
```

---

## 5. Data Migration Strategy

### 5.1 Migration Script (`scripts/migrate-to-multi-contest.ts`)

```typescript
#!/usr/bin/env bun
/**
 * Migrate users from single contest to multi-contest format
 */

export async function migrateUsersToMultiContest() {
  console.log("Starting migration to multi-contest format...");

  const users = await listUsers();
  const migrated: string[] = [];
  const errors: Array<{ username: string; error: string }> = [];

  for (const user of users) {
    try {
      // Skip users already migrated
      if (user.activeContests) {
        console.log(`User ${user.username} already migrated`);
        continue;
      }

      // Migrate user to new format
      const updates: Partial<User> = {
        activeContests: {},
        contestScores: {},
        contestSubmissions: {},
        contestLatestSubmissions: {}
      };

      // Convert single contest assignment to multi-contest
      if (user.contest) {
        updates.activeContests = {
          [user.contest]: {
            status: "started",  // Assume existing assignments are started
            joinedAt: user.latestScoreChange || new Date().toISOString(),
            startedAt: user.latestScoreChange || new Date().toISOString()
          }
        };

        // Migrate scores to contest-specific format
        updates.contestScores = {
          [user.contest]: user.problemScores || {}
        };
        updates.contestSubmissions = {
          [user.contest]: user.problemSubmissions || {}
        };
        updates.contestLatestSubmissions = {
          [user.contest]: user.latestSubmissions || {}
        };
      }

      await updateUser(user.username, updates);
      migrated.push(user.username);

      console.log(`✓ Migrated user: ${user.username}`);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push({ username: user.username, error: errorMsg });
      console.error(`✗ Failed to migrate user ${user.username}: ${errorMsg}`);
    }
  }

  console.log("\nMigration Summary:");
  console.log(`✓ Successfully migrated: ${migrated.length} users`);
  console.log(`✗ Failed migrations: ${errors.length} users`);

  if (errors.length > 0) {
    console.log("\nFailed migrations:");
    errors.forEach(({ username, error }) => {
      console.log(`  - ${username}: ${error}`);
    });
  }

  return { migrated, errors };
}

// Run migration
if (import.meta.main) {
  migrateUsersToMultiContest()
    .then(() => process.exit(0))
    .catch(error => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}
```

### 5.2 Migration Validation Script (`scripts/validate-migration.ts`)

```typescript
#!/usr/bin/env bun
/**
 * Validate multi-contest migration results
 */

export async function validateMigration() {
  console.log("Validating multi-contest migration...");

  const users = await listUsers();
  const issues: Array<{ username: string; issue: string }> = [];

  for (const user of users) {
    // Check if user has new multi-contest fields
    if (!user.activeContests) {
      issues.push({ username: user.username, issue: "Missing activeContests field" });
      continue;
    }

    // Check data consistency
    if (user.contest && !user.activeContests[user.contest]) {
      issues.push({
        username: user.username,
        issue: `Legacy contest ${user.contest} not found in activeContests`
      });
    }

    // Check contest scores migration
    if (user.contest && user.problemScores) {
      const contestScores = user.contestScores?.[user.contest];
      const scoresMismatch = JSON.stringify(contestScores) !== JSON.stringify(user.problemScores);

      if (scoresMismatch) {
        issues.push({
          username: user.username,
          issue: "Contest scores don't match legacy problemScores"
        });
      }
    }
  }

  console.log("\nValidation Summary:");
  if (issues.length === 0) {
    console.log("✅ All users successfully migrated!");
  } else {
    console.log(`⚠️  Found ${issues.length} validation issues:`);
    issues.forEach(({ username, issue }) => {
      console.log(`  - ${username}: ${issue}`);
    });
  }

  return issues;
}
```

---

## 6. Testing Plan

### 6.1 Unit Tests

#### 6.1.1 Database Function Tests (`app/lib/db/users.server.test.ts`)
```typescript
describe("Multi-Contest User Functions", () => {
  test("addUserToContest adds user to contest", async () => {
    await addUserToContest("testuser", "contest1", "invited");
    const user = await getUser("testuser");

    expect(user?.activeContests).toHaveProperty("contest1");
    expect(user?.activeContests.contest1.status).toBe("invited");
  });

  test("removeUserFromContest removes user from contest", async () => {
    await addUserToContest("testuser", "contest1", "started");
    await removeUserFromContest("testuser", "contest1");
    const user = await getUser("testuser");

    expect(user?.activeContests).not.toHaveProperty("contest1");
  });

  test("getUserActiveContests returns correct contests", async () => {
    await addUserToContest("testuser", "contest1", "started");
    await addUserToContest("testuser", "contest2", "invited");

    const contests = await getUserActiveContests("testuser");
    expect(contests).toHaveLength(2);
    expect(contests.map(c => c.contestId)).toContain("contest1", "contest2");
  });
});
```

#### 6.1.2 Contest Access Tests (`app/lib/contest.server.test.ts`)
```typescript
describe("Multi-Contest Access Control", () => {
  test("canUserAccessContest returns true for active contest", async () => {
    await addUserToContest("testuser", "contest1", "started");

    const hasAccess = await canUserAccessContest("testuser", "contest1");
    expect(hasAccess).toBe(true);
  });

  test("canUserAccessContest returns false for non-member", async () => {
    const hasAccess = await canUserAccessContest("testuser", "contest1");
    expect(hasAccess).toBe(false);
  });

  test("isUserInActiveContest works with contest ID", async () => {
    await addUserToContest("testuser", "contest1", "started");

    const status = await isUserInActiveContest("testuser", "contest1");
    expect(status.active).toBe(true);
    expect(status.contest?.contestId).toBe("contest1");
  });
});
```

### 6.2 Integration Tests

#### 6.2.1 Route Tests (`app/routes/contests.$contestId.problems.test.tsx`)
```typescript
describe("Contest Problems Route", () => {
  test("loads problems for user's contest", async () => {
    // Setup user with contest access
    await addUserToContest("testuser", "contest1", "started");

    const request = new Request("http://localhost:3000/contests/contest1/problems");
    // Add authentication headers

    const response = await loader({ request, params: { contestId: "contest1" } });

    expect(response.contest.contestId).toBe("contest1");
    expect(response.problems).toBeDefined();
    expect(response.userScores).toBeDefined();
  });

  test("denies access for unauthorized contest", async () => {
    const request = new Request("http://localhost:3000/contests/contest1/problems");
    // Add authentication headers for user without access

    await expect(
      loader({ request, params: { contestId: "contest1" } })
    ).rejects.toThrow("Contest not found or access denied");
  });
});
```

### 6.3 End-to-End Tests

#### 6.3.1 User Flow Tests (`e2e/multi-contest-flows.test.ts`)
```typescript
describe("Multi-Contest User Flows", () => {
  test("user can join and participate in multiple contests", async () => {
    // Admin adds user to multiple contests
    await adminAddUserToContest("testuser", "contest1");
    await adminAddUserToContest("testuser", "contest2");

    // User can see both contests in contest list
    await page.goto("/contests");
    await expect(page.locator('[data-testid="contest-card"]')).toHaveCount(2);

    // User can access problems in each contest
    await page.click('[data-testid="contest1-link"]');
    await expect(page).toHaveURL(/\/contests\/contest1\/problems/);

    await page.goto("/contests");
    await page.click('[data-testid="contest2-link"]');
    await expect(page).toHaveURL(/\/contests\/contest2\/problems/);
  });

  test("contest scores are isolated per contest", async () => {
    // User submits solutions to different contests
    await submitSolution("testuser", "contest1", "problem1", "solution1");
    await submitSolution("testuser", "contest2", "problem1", "solution2");

    // Check scores are isolated
    const contest1Scores = await getUserContestScores("testuser", "contest1");
    const contest2Scores = await getUserContestScores("testuser", "contest2");

    expect(contest1Scores.problem1).toBe(100);
    expect(contest2Scores.problem1).toBe(50);
  });
});
```

---

## 7. Deployment Strategy

### 7.1 Phase 1: Schema Extension (Week 1)

**Goals:**
- Add new fields to User interface
- Maintain 100% backward compatibility
- No user-facing changes

**Steps:**
1. Deploy schema changes to database types
2. Update database functions to handle both old and new formats
3. Add migration scripts (don't run yet)
4. Deploy backend changes with feature flag disabled

**Validation:**
- All existing functionality continues to work
- New fields are properly initialized
- No performance degradation

### 7.2 Phase 2: Backend Migration (Week 2)

**Goals:**
- Run data migration
- Enable new multi-contest functions
- Maintain API compatibility

**Steps:**
1. Run migration script on staging environment
2. Validate migration results
3. Enable multi-contest features for admin users only
4. Test all new backend functions
5. Run migration script on production during maintenance window

**Validation:**
- All users successfully migrated
- Legacy API endpoints continue to work
- New API endpoints function correctly

### 7.3 Phase 3: Frontend Rollout (Week 3)

**Goals:**
- Deploy new UI components
- Enable multi-contest features for all users
- Provide smooth user experience

**Steps:**
1. Deploy new contest-specific routes
2. Update navigation to include contest context
3. Enable multi-contest features for all users
4. Monitor user adoption and feedback

**Validation:**
- Users can access multiple contests
- URL structure works correctly
- No JavaScript errors or performance issues

### 7.4 Monitoring & Metrics

**Database Metrics:**
- Query performance for new functions
- Migration success rate
- Data consistency checks

**User Metrics:**
- Multi-contest adoption rate
- Page load times
- Error rates on new routes

**Alerts:**
- Migration failures
- Authentication errors
- Performance degradation

---

## 8. Rollback Plan

### 8.1 Immediate Rollback (UI Issues)

**If:** Frontend issues or user confusion

**Action:**
1. Disable new routes via feature flag
2. Redirect users to legacy routes
3. Maintain new backend functionality
4. Fix issues and re-deploy UI

**Impact:** Minimal - users continue with single-contest experience

### 8.2 Partial Rollback (Backend Issues)

**If:** Backend function errors or performance issues

**Action:**
1. Disable new multi-contest functions
2. Fall back to legacy single-contest logic
3. Maintain new schema (don't reverse migration)
4. Fix backend issues and re-enable

**Impact:** Users lose multi-contest features but retain functionality

### 8.3 Full Rollback (Migration Issues)

**If:** Data corruption or severe migration problems

**Action:**
1. Stop all traffic to new features
2. Restore database from pre-migration backup
3. Re-run migration with fixes
4. Gradual re-deployment with extensive testing

**Impact:** Significant - requires maintenance window and data restoration

### 8.4 Rollback Testing

**Before deployment:**
- Test rollback procedures on staging
- Verify backup restoration process
- Document rollback decision criteria
- Train team on rollback procedures

---

## 9. Success Metrics

### 9.1 Technical Metrics
- ✅ Migration success rate > 99%
- ✅ API response time increase < 10%
- ✅ Zero data loss during migration
- ✅ Error rate on new routes < 0.1%

### 9.2 User Experience Metrics
- ✅ Multi-contest adoption rate > 20% within first month
- ✅ User satisfaction score maintained
- ✅ Support tickets related to contest confusion < 5% increase

### 9.3 Feature Metrics
- ✅ Average contests per active user > 1.2
- ✅ Contest completion rate maintained
- ✅ Time spent per contest maintained

---

## 10. Risk Assessment & Mitigation

### 10.1 High Risk: Data Migration
**Risk:** Data loss or corruption during migration
**Mitigation:**
- Comprehensive backup before migration
- Extensive testing on staging data
- Rollback procedures tested and documented
- Migration validation scripts

### 10.2 Medium Risk: Performance Impact
**Risk:** Slower queries due to new data structures
**Mitigation:**
- Performance testing with realistic data volumes
- Database query optimization
- Monitoring and alerting for performance regressions

### 10.3 Medium Risk: User Confusion
**Risk:** Users confused by multiple contest UI
**Mitigation:**
- Clear UI design with contest context
- User documentation and tutorials
- Gradual rollout with user feedback collection

### 10.4 Low Risk: API Compatibility
**Risk:** Breaking changes to existing API
**Mitigation:**
- Maintain backward compatibility during transition
- Comprehensive API testing
- Clear deprecation timeline for old APIs

---

## Next Steps

1. **Review and approve this implementation plan**
2. **Set up feature branch and development environment**
3. **Begin Phase 1: Schema extension and migration scripts**
4. **Schedule team review of database changes**
5. **Start unit test development in parallel**

**Estimated Start Date:** Next sprint
**Estimated Completion:** 3 weeks from start
**Review Checkpoints:** End of each phase

---

*This implementation plan provides a comprehensive roadmap for safely migrating from single-contest to multi-contest user support while maintaining system stability and user experience.*