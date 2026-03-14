import {
  type RouteConfig,
  index,
  layout,
  route,
  prefix,
} from "@react-router/dev/routes";

export default [
  // Login page (outside main layout)
  route("login", "routes/login.tsx"),

  // API routes (outside main layout)
  ...prefix("api", [
    ...prefix("auth", [
      route("login", "routes/api/auth.login.ts"),
      route("logout", "routes/api/auth.logout.ts"),
      route("me", "routes/api/auth.me.ts"),
    ]),
    ...prefix("admin", [
      route("users", "routes/api/admin/users.ts"),
      route("users/:username", "routes/api/admin/users.$username.ts"),
      route("upload", "routes/api/admin/upload.ts"),
      route(
        "problems/:problemId/testdata",
        "routes/api/admin/problems.$problemId.testdata.ts"
      ),
      route(
        "problems/:problemId/download",
        "routes/api/admin/problems.$problemId.download.ts"
      ),
    ]),
    // Problem statement API (authenticated)
    route(
      "problems/:problemId/statement",
      "routes/api/problems.$problemId.statement.ts"
    ),
    // Submission source API (authenticated)
    route(
      "submissions/:subId/source",
      "routes/api/submissions.$subId.source.ts"
    ),
  ]),

  layout("routes/layout.tsx", [
    index("routes/home.tsx"),

    // Contest routes
    route("contests", "routes/contests.tsx"),

    // Contest-specific routes
    ...prefix("contests/:contestId", [
      index("routes/contests.$contestId.index.tsx"),
      route("problems", "routes/contests.$contestId.problems.tsx"),
      route("problems/:problemId", "routes/contests.$contestId.problems.$problemId.tsx"),
      route("submissions", "routes/contests.$contestId.submissions.tsx"),
      route("scoreboard", "routes/contests.$contestId.scoreboard.tsx"),
      route("announcements", "routes/contests.$contestId.announcements.tsx"),
      route("clarifications", "routes/contests.$contestId.clarifications.tsx"),
    ]),

    // Profile and general routes
    route("profile/:username", "routes/profile.$username.tsx"),

    // Global problems (admin-only)
    route("problems", "routes/problems.tsx"),
    route("problems/:problemId", "routes/problems.$problemId.tsx"),

    // Submission detail view
    route("submissions/:subId", "routes/submissions.$subId.tsx"),

    // Admin routes
    ...prefix("admin", [
      index("routes/admin/index.tsx"),
      route("users", "routes/admin/users.tsx"),
      route("contests", "routes/admin/contests.tsx"),
      route("contests/:contestId", "routes/admin/contests.$contestId.tsx"),
      route("problems", "routes/admin/problems.tsx"),
      route("problems/:problemId", "routes/admin/problems.$problemId.tsx"),
      route(
        "problems/:problemId/testdata",
        "routes/admin/problems.$problemId.testdata.tsx"
      ),
      route("clarifications", "routes/admin/clarifications.tsx"),
      route("announcements", "routes/admin/announcements.tsx"),
      route("submissions", "routes/admin/submissions.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
