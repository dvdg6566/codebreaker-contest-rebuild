/**
 * App Initialization
 *
 * Runs on first request to initialize sample data if the system is empty.
 * Checks:
 * 1. Are there any problems? If not, upload sample problems.
 * 2. Are there any users in DynamoDB? If not, create test users.
 * 3. Is there a sample contest? If not, create one.
 */

import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

// Initialization state
let initialized = false;
let initializing = false;

/**
 * Check if initialization is needed and run it if so.
 * Safe to call on every request - uses flags to prevent duplicate runs.
 */
export async function ensureInitialized(): Promise<void> {
  if (initialized || initializing) return;

  initializing = true;

  try {
    const needsInit = await checkNeedsInitialization();

    if (needsInit) {
      console.log("[init] System needs initialization, starting...");
      await runInitialization();
      console.log("[init] Initialization complete!");
    } else {
      console.log("[init] System already initialized");
    }

    initialized = true;
  } catch (error) {
    console.error("[init] Initialization failed:", error);
    // Don't set initialized=true so it retries on next request
  } finally {
    initializing = false;
  }
}

/**
 * Check if initialization is needed by looking for existing data.
 */
async function checkNeedsInitialization(): Promise<boolean> {
  try {
    const { listProblems } = await import("~/lib/db/problems.server");
    const problems = await listProblems();

    // If there are any problems, assume system is initialized
    return problems.length === 0;
  } catch (error) {
    console.error("[init] Error checking initialization state:", error);
    // If we can't check, assume not initialized
    return true;
  }
}

/**
 * Run full initialization.
 */
async function runInitialization(): Promise<void> {
  // 1. Create Cognito users (admin gets email, test users get known password)
  await createUsers();

  // 2. Upload sample problems
  await uploadProblems();

  // 3. Compile checkers
  await compileCheckers();

  // 4. Create sample contest and submissions
  await createContestData();
}

// ============================================================================
// User Creation
// ============================================================================

const DEFAULT_PASSWORD = "P@55w0rd";

const TEST_USERS = [
  { username: "alice", email: "alice@example.com", fullname: "Alice Chen" },
  { username: "bob", email: "bob@example.com", fullname: "Bob Smith" },
  { username: "charlie", email: "charlie@example.com", fullname: "Charlie Brown" },
  { username: "diana", email: "diana@example.com", fullname: "Diana Prince" },
];

async function createUsers(): Promise<void> {
  const cognito = await import("~/lib/cognito.server");
  const { createUser: createDbUser, getUser: getDbUser } = await import("~/lib/db/users.server");

  // Create admin user if ADMIN_EMAIL is set
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    try {
      const existingAdmin = await cognito.getUser("admin");
      if (!existingAdmin) {
        await cognito.createUser("admin", DEFAULT_PASSWORD, "admin", adminEmail);
        await createDbUser("admin", "admin", { fullname: "Admin User", email: adminEmail });
      }
    } catch (error) {
      console.error("[init] Error creating admin:", error);
    }
  }

  // Create test users
  for (const user of TEST_USERS) {
    try {
      const existing = await cognito.getUser(user.username);
      if (!existing) {
        await cognito.createUser(user.username, DEFAULT_PASSWORD, "member", user.email);
        await createDbUser(user.username, "member", { fullname: user.fullname, email: user.email });
      }
    } catch (error) {
      console.error(`[init] Error creating user ${user.username}:`, error);
    }
  }
}

// ============================================================================
// Problem Upload
// ============================================================================

async function uploadProblems(): Promise<void> {
  const problemsDir = getProblemsDir();

  if (!problemsDir || !existsSync(problemsDir)) {
    return;
  }

  const { createProblem, updateProblem } = await import("~/lib/db/problems.server");
  const { uploadFile } = await import("~/lib/s3.server");

  const judgeName = process.env.JUDGE_NAME || "codebreakercontest01";

  const buckets = {
    statements: `${judgeName}-statements`,
    testdata: `${judgeName}-testdata`,
    checkers: `${judgeName}-checkers`,
    graders: `${judgeName}-graders`,
    attachments: `${judgeName}-attachments`,
  };

  const problemConfigs: Record<string, {
    type: string;
    subtaskScores: number[];
    subtaskDependency: string[];
    customChecker: boolean;
    attachments: boolean;
    nameA?: string;
    nameB?: string;
  }> = {
    addition: {
      type: "Batch",
      subtaskScores: [0, 36, 64],
      subtaskDependency: ["1", "1-3", "1-4"],
      customChecker: false,
      attachments: false,
    },
    ping: {
      type: "Interactive",
      subtaskScores: [10, 30, 60],
      subtaskDependency: ["1-20", "1-73", "74-152"],
      customChecker: true,
      attachments: true,
    },
    prisoners: {
      type: "Communication",
      subtaskScores: [27, 29, 44, 0],
      subtaskDependency: ["1-10", "11-20", "1-30", "31"],
      customChecker: true,
      attachments: true,
      nameA: "swapper",
      nameB: "prisoner",
    },
  };

  for (const problemName of Object.keys(problemConfigs)) {
    const problemDir = join(problemsDir, problemName);

    if (!existsSync(problemDir)) {
      continue;
    }


    try {
      // Create problem record
      await createProblem(problemName);

      const config = problemConfigs[problemName];

      // Upload statement
      for (const ext of ["html", "pdf"]) {
        const statementPath = join(problemDir, `statement.${ext}`);
        if (existsSync(statementPath)) {
          const content = await readFile(statementPath);
          await uploadFile(
            buckets.statements,
            `${problemName}.${ext}`,
            content,
            ext === "html" ? "text/html" : "application/pdf"
          );
          break;
        }
      }

      // Upload attachments
      const attachmentsPath = join(problemDir, "attachments.zip");
      if (existsSync(attachmentsPath)) {
        const content = await readFile(attachmentsPath);
        await uploadFile(buckets.attachments, `${problemName}.zip`, content, "application/zip");
      }

      // Upload checker
      const checkerPath = join(problemDir, "checker.cpp");
      if (existsSync(checkerPath)) {
        const content = await readFile(checkerPath);
        await uploadFile(buckets.checkers, `source/${problemName}.cpp`, content, "text/x-c++src");
      }

      // Upload grader and headers
      const graderPath = join(problemDir, "grader.cpp");
      if (existsSync(graderPath)) {
        const content = await readFile(graderPath);
        await uploadFile(buckets.graders, `${problemName}/grader.cpp`, content, "text/x-c++src");
      }

      // Upload header files
      const files = await readdir(problemDir);
      for (const file of files) {
        if (file.endsWith(".h")) {
          const content = await readFile(join(problemDir, file));
          await uploadFile(buckets.graders, `${problemName}/${file}`, content, "text/x-c");
        }
      }

      // Upload testdata
      const testdataDir = join(problemDir, "testdata");
      let testcaseCount = 0;
      if (existsSync(testdataDir)) {
        const testFiles = await readdir(testdataDir);
        for (const file of testFiles) {
          const content = await readFile(join(testdataDir, file));
          await uploadFile(buckets.testdata, `${problemName}/${file}`, content, "text/plain");
          if (file.endsWith(".in")) testcaseCount++;
        }
      }

      // Update problem settings
      await updateProblem(problemName, {
        problem_type: config.type as "Batch" | "Interactive" | "Communication",
        testcaseCount,
        subtaskScores: config.subtaskScores,
        subtaskDependency: config.subtaskDependency,
        customChecker: config.customChecker,
        attachments: config.attachments,
        ...(config.nameA && { nameA: config.nameA }),
        ...(config.nameB && { nameB: config.nameB }),
        validated: true,
      });

    } catch (error) {
      console.error(`[init] Error uploading problem ${problemName}:`, error);
    }
  }
}

function getProblemsDir(): string | null {
  // Check common locations for bundled problems
  const candidates = [
    join(process.cwd(), "problems"),
    join(process.cwd(), "build", "problems"),
    join(process.cwd(), "scripts", "init", "problems"),
  ];

  for (const dir of candidates) {
    if (existsSync(dir)) {
      return dir;
    }
  }

  return null;
}

// ============================================================================
// Checker Compilation
// ============================================================================

async function compileCheckers(): Promise<void> {
  const { LambdaClient, InvokeCommand } = await import("@aws-sdk/client-lambda");

  const region = process.env.AWS_REGION || "ap-southeast-1";
  const judgeName = process.env.JUDGE_NAME || "codebreakercontest01";

  const lambdaClient = new LambdaClient({ region });
  const compilerName = `${judgeName}-compiler`;

  for (const problemName of ["ping", "prisoners"]) {
    try {

      const response = await lambdaClient.send(
        new InvokeCommand({
          FunctionName: compilerName,
          InvocationType: "RequestResponse",
          Payload: JSON.stringify({
            problemName,
            eventType: "CHECKER",
          }),
        })
      );

      const result = JSON.parse(new TextDecoder().decode(response.Payload));

      if (result.status === 200) {
      } else {
        console.error(`[init] Checker compilation failed for ${problemName}:`, result.error);
      }
    } catch (error) {
      console.error(`[init] Error compiling checker for ${problemName}:`, error);
    }
  }
}

// ============================================================================
// Contest Data Creation
// ============================================================================

async function createContestData(): Promise<void> {
  const { createContest, getContest } = await import("~/lib/db/contests.server");
  const { updateUser } = await import("~/lib/db/users.server");

  const contestId = "contest-1";

  try {
    // Check if contest already exists
    const existing = await getContest(contestId);
    if (existing) {
      return;
    }


    const now = new Date();
    const startTime = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    const endTime = new Date(now.getTime() - 1 * 60 * 60 * 1000);

    const formatDt = (d: Date) => d.toISOString().replace("T", " ").slice(0, 19);

    await createContest(contestId, {
      contestName: "IOI Practice Round 2024",
      description: "Practice contest demonstrating IOI-style subtask scoring",
      problems: ["addition", "ping", "prisoners"],
      startTime: formatDt(startTime),
      endTime: formatDt(endTime),
      duration: 300,
      mode: "centralized",
      public: true,
      publicScoreboard: true,
    });

    // Add users to contest with scores
    const userScores: Record<string, Record<string, number[]>> = {
      alice: {
        addition: [0, 36, 64],
        ping: [10, 30, 0],
        prisoners: [27, 0, 0, 0],
      },
      bob: {
        addition: [0, 36, 0],
      },
      charlie: {
        addition: [0, 36, 64],
        ping: [10, 30, 60],
        prisoners: [27, 29, 0, 0],
      },
      diana: {},
    };

    for (const [username, scores] of Object.entries(userScores)) {
      try {
        await updateUser(username, {
          activeContests: {
            [contestId]: {
              status: username === "diana" ? "invited" : "started",
              joinedAt: formatDt(startTime),
              ...(username !== "diana" && { startedAt: formatDt(startTime) }),
            },
          },
          contestScores: {
            [contestId]: Object.fromEntries(
              Object.entries(scores).map(([p, s]) => [p, s.reduce((a, b) => a + b, 0)])
            ),
          },
        });
      } catch (error) {
        console.error(`[init] Error updating user ${username}:`, error);
      }
    }

  } catch (error) {
    console.error("[init] Error creating contest:", error);
  }
}
