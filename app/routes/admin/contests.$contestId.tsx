import type { Route } from "./+types/contests.$contestId";
import { Form, Link, useNavigation, redirect } from "react-router";
import { format } from "date-fns";
import { useState } from "react";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Users,
  FileText,
  Clock,
  Globe,
  Lock,
  Timer,
  GripVertical,
  X,
  Loader2,
  AlertCircle,
  Settings,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Checkbox } from "~/components/ui/checkbox";
import { Switch } from "~/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";
import type { Contest, ContestMode } from "~/types/database";
import { parseDateTime, formatDateTime, isDateTimeNotSet } from "~/types/database";
import {
  getContest,
  updateContest,
  getContestStatus,
  listProblems,
  listUsers,
} from "~/lib/db/index.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { requireAdmin } = await import("~/lib/auth.server");
  await requireAdmin(request);

  const contest = await getContest(params.contestId);
  if (!contest) {
    throw new Response("Contest not found", { status: 404 });
  }

  const status = getContestStatus(contest);

  // Get all available problems
  const problems = await listProblems();
  const allProblems = problems.map((p) => ({
    problemName: p.problemName,
    title: p.title,
    difficulty: p.difficulty,
  }));

  // Get all users for adding to contest
  const users = await listUsers();
  const allUsers = users.map((u) => ({
    username: u.username,
    role: u.role,
  }));

  return {
    contest,
    status,
    allProblems,
    allUsers,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { requireAdmin } = await import("~/lib/auth.server");
  await requireAdmin(request);

  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const contestId = params.contestId;

  const contest = await getContest(contestId);
  if (!contest) {
    return { error: "Contest not found" };
  }

  if (intent === "update_details") {
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const mode = formData.get("mode") as ContestMode;
    const duration = parseInt(formData.get("duration") as string) || 0;
    const startTime = formData.get("startTime") as string;
    const endTime = formData.get("endTime") as string;

    const updates: Partial<Contest> = {
      contestName: name || contest.contestName,
      description: description || "",
      mode: mode || contest.mode,
      duration,
    };

    if (startTime) {
      updates.startTime = formatDateTime(new Date(startTime));
    }
    if (endTime) {
      updates.endTime = endTime ? formatDateTime(new Date(endTime)) : "9999-12-31 23:59:59";
    }

    await updateContest(contestId, updates);
    return { success: true, message: "Contest details updated" };
  }

  if (intent === "update_settings") {
    const subLimit = parseInt(formData.get("subLimit") as string);
    const subDelay = parseInt(formData.get("subDelay") as string);
    const isPublic = formData.get("public") === "on";
    const publicScoreboard = formData.get("publicScoreboard") === "on";

    if (subDelay < 5) {
      return { error: "Submission delay must be at least 5 seconds" };
    }

    if (subLimit < -1) {
      return { error: "Submission limit must be -1 (unlimited) or a positive number" };
    }

    await updateContest(contestId, {
      subLimit,
      subDelay,
      public: isPublic,
      publicScoreboard,
    });
    return { success: true, message: "Settings updated" };
  }

  if (intent === "add_problem") {
    const problemName = formData.get("problemId") as string;
    if (!problemName) {
      return { error: "Please select a problem" };
    }
    if (contest.problems.includes(problemName)) {
      return { error: "Problem already in contest" };
    }
    await updateContest(contestId, {
      problems: [...contest.problems, problemName],
    });
    return { success: true, message: "Problem added" };
  }

  if (intent === "remove_problem") {
    const problemName = formData.get("problemId") as string;
    await updateContest(contestId, {
      problems: contest.problems.filter((p) => p !== problemName),
    });
    return { success: true, message: "Problem removed" };
  }

  if (intent === "add_user") {
    const username = formData.get("username") as string;
    if (!username) {
      return { error: "Please enter a username" };
    }
    if (contest.users?.[username]) {
      return { error: "User already in contest" };
    }
    const { getUser } = await import("~/lib/db/index.server");
    const user = await getUser(username);
    if (!user) {
      return { error: "User not found" };
    }
    await updateContest(contestId, {
      users: { ...contest.users, [username]: "0" },
    });
    return { success: true, message: "User added" };
  }

  if (intent === "remove_user") {
    const username = formData.get("username") as string;
    const newUsers = { ...contest.users };
    delete newUsers[username];
    const newScores = { ...contest.scores };
    delete newScores[username];
    await updateContest(contestId, {
      users: newUsers,
      scores: newScores,
    });
    return { success: true, message: "User removed" };
  }

  if (intent === "freeze_user") {
    const username = formData.get("username") as string;
    // In a real app, this would mark the user as frozen
    // For now, we just mark them as completed
    await updateContest(contestId, {
      users: { ...contest.users, [username]: "1" },
    });
    return { success: true, message: "User score frozen" };
  }

  return { error: "Unknown action" };
}

export function meta({ data }: Route.MetaArgs) {
  return [
    { title: `Edit ${data?.contest?.contestName || "Contest"} - Codebreaker Admin` },
    { name: "description", content: "Edit contest details" },
  ];
}

function formatDateTimeLocal(dateStr: string): string {
  if (!dateStr || isDateTimeNotSet(dateStr)) return "";
  const date = parseDateTime(dateStr);
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

export default function EditContestPage({ loaderData, actionData }: Route.ComponentProps) {
  const { contest, status, allProblems, allUsers } = loaderData;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [selectedMode, setSelectedMode] = useState<ContestMode>(contest.mode || "centralized");

  // Get problem details for the contest
  const contestProblems = contest.problems.map((problemName) => {
    const problem = allProblems.find((p) => p.problemName === problemName);
    return problem || { problemName, title: "Unknown", difficulty: "easy" as const };
  });

  // Get available problems (not already in contest)
  const availableProblems = allProblems.filter(
    (p) => !contest.problems.includes(p.problemName)
  );

  // Get contest users with their status
  const contestUsers = Object.entries(contest.users || {}).map(([username, userStatus]) => {
    const user = allUsers.find((u) => u.username === username);
    const scores = contest.scores?.[username] || {};
    const totalScore = Object.values(scores).reduce((sum, s) => sum + s, 0);
    return {
      username,
      role: user?.role || "member",
      status: userStatus,
      totalScore,
    };
  });

  // Available users (not already in contest)
  const availableUsers = allUsers.filter(
    (u) => !contest.users?.[u.username]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin/contests">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{contest.contestName}</h1>
            <p className="text-muted-foreground">
              Contest ID: <code className="text-sm bg-muted px-1 rounded">{contest.contestId}</code>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              status === "ONGOING"
                ? "success"
                : status === "ENDED"
                  ? "secondary"
                  : "warning"
            }
          >
            {status === "ONGOING" ? "Ongoing" : status === "ENDED" ? "Ended" : "Not Started"}
          </Badge>
          <Badge variant="outline">
            {contest.mode === "centralized" ? (
              <>
                <Clock className="mr-1 h-3 w-3" />
                Centralized Timer
              </>
            ) : (
              <>
                <Timer className="mr-1 h-3 w-3" />
                Self-Timer
              </>
            )}
          </Badge>
        </div>
      </div>

      {/* Action feedback */}
      {actionData?.error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {actionData.error}
        </div>
      )}
      {actionData?.success && (
        <div className="p-4 bg-emerald-50 text-emerald-700 rounded-lg">
          {actionData.message}
        </div>
      )}

      {/* Tabs for different sections */}
      <Tabs defaultValue="details" className="space-y-6">
        <TabsList>
          <TabsTrigger value="details">
            <Settings className="mr-2 h-4 w-4" />
            Details
          </TabsTrigger>
          <TabsTrigger value="problems">
            <FileText className="mr-2 h-4 w-4" />
            Problems ({contest.problems.length})
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="mr-2 h-4 w-4" />
            Participants ({Object.keys(contest.users || {}).length})
          </TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Basic Info */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>
                  Contest name, description, and timing settings.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form method="post" className="space-y-4">
                  <input type="hidden" name="intent" value="update_details" />

                  <div className="space-y-2">
                    <Label htmlFor="name">Contest Name</Label>
                    <Input
                      id="name"
                      name="name"
                      defaultValue={contest.contestName}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      name="description"
                      defaultValue={contest.description}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mode">Contest Mode</Label>
                    <Select name="mode" value={selectedMode} onValueChange={(value) => setSelectedMode(value as ContestMode)}>
                      <SelectTrigger>
                        <SelectValue>
                          <span className="flex items-center">
                            {selectedMode === "centralized" ? (
                              <>
                                <Clock className="mr-2 h-4 w-4" />
                                Centralized Timer
                              </>
                            ) : (
                              <>
                                <Timer className="mr-2 h-4 w-4" />
                                Self-Timer (Individual)
                              </>
                            )}
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="centralized">
                          <div className="flex items-center">
                            <Clock className="mr-2 h-4 w-4" />
                            Centralized Timer
                          </div>
                        </SelectItem>
                        <SelectItem value="self-timer">
                          <div className="flex items-center">
                            <Timer className="mr-2 h-4 w-4" />
                            Self-Timer (Individual)
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      {selectedMode === "centralized"
                        ? "All participants share the same start/end time."
                        : "Each participant has their own timer starting when they begin."}
                    </p>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startTime">Start Time</Label>
                      <Input
                        id="startTime"
                        name="startTime"
                        type="datetime-local"
                        defaultValue={formatDateTimeLocal(contest.startTime)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endTime">End Time</Label>
                      <Input
                        id="endTime"
                        name="endTime"
                        type="datetime-local"
                        defaultValue={formatDateTimeLocal(contest.endTime)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration (minutes)</Label>
                    <Input
                      id="duration"
                      name="duration"
                      type="number"
                      min={0}
                      defaultValue={contest.duration}
                    />
                    <p className="text-sm text-muted-foreground">
                      For self-timer mode: how long each participant has after starting.
                      Set to 0 for unlimited.
                    </p>
                  </div>

                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </Form>
              </CardContent>
            </Card>

            {/* Settings */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Contest Settings</CardTitle>
                <CardDescription>
                  Submission limits, visibility, and access control.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form method="post" className="space-y-4">
                  <input type="hidden" name="intent" value="update_settings" />

                  <div className="space-y-2">
                    <Label htmlFor="subLimit">Submission Limit per Problem</Label>
                    <Input
                      id="subLimit"
                      name="subLimit"
                      type="number"
                      min={-1}
                      defaultValue={contest.subLimit}
                    />
                    <p className="text-sm text-muted-foreground">
                      -1 for unlimited submissions
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subDelay">Submission Delay (seconds)</Label>
                    <Input
                      id="subDelay"
                      name="subDelay"
                      type="number"
                      min={5}
                      defaultValue={contest.subDelay}
                    />
                    <p className="text-sm text-muted-foreground">
                      Minimum 5 seconds between submissions
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Public Contest</Label>
                        <p className="text-sm text-muted-foreground">
                          Visible to all authenticated users
                        </p>
                      </div>
                      <Switch
                        name="public"
                        defaultChecked={contest.public}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Public Scoreboard</Label>
                        <p className="text-sm text-muted-foreground">
                          Anyone can view the scoreboard
                        </p>
                      </div>
                      <Switch
                        name="publicScoreboard"
                        defaultChecked={contest.publicScoreboard}
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Settings
                      </>
                    )}
                  </Button>
                </Form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Problems Tab */}
        <TabsContent value="problems" className="space-y-6">
          <div className="grid grid-cols-3 gap-6">
            {/* Add Problem */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Add Problem</CardTitle>
                <CardDescription>
                  Select a problem to add to this contest.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form method="post" className="space-y-4">
                  <input type="hidden" name="intent" value="add_problem" />
                  <Select name="problemId">
                    <SelectTrigger>
                      <SelectValue placeholder="Select a problem..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProblems.length === 0 ? (
                        <SelectItem value="" disabled>
                          No problems available
                        </SelectItem>
                      ) : (
                        availableProblems.map((problem) => (
                          <SelectItem key={problem.problemName} value={problem.problemName}>
                            <div className="flex items-center gap-2">
                              <span>{problem.title}</span>
                              <Badge variant="outline" className="text-xs">
                                {problem.difficulty}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting || availableProblems.length === 0}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Problem
                  </Button>
                </Form>
              </CardContent>
            </Card>

            {/* Problem List */}
            <Card className="border-0 shadow-sm col-span-2">
              <CardHeader>
                <CardTitle>Contest Problems</CardTitle>
                <CardDescription>
                  Problems in this contest. Drag to reorder.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {contestProblems.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No problems added yet. Add problems from the left panel.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">#</TableHead>
                        <TableHead>Problem</TableHead>
                        <TableHead>Difficulty</TableHead>
                        <TableHead className="w-[100px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contestProblems.map((problem, index) => (
                        <TableRow key={problem.problemName}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                              <span className="font-semibold">
                                {String.fromCharCode(65 + index)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Link
                              to={`/admin/problems/${problem.problemName}`}
                              className="font-medium hover:underline"
                            >
                              {problem.title}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                problem.difficulty === "easy" && "text-emerald-600 border-emerald-200 bg-emerald-50",
                                problem.difficulty === "medium" && "text-amber-600 border-amber-200 bg-amber-50",
                                problem.difficulty === "hard" && "text-red-600 border-red-200 bg-red-50"
                              )}
                            >
                              {problem.difficulty}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Form method="post">
                              <input type="hidden" name="intent" value="remove_problem" />
                              <input type="hidden" name="problemId" value={problem.problemName} />
                              <Button
                                type="submit"
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </Form>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          <div className="grid grid-cols-3 gap-6">
            {/* Add User */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Add Participant</CardTitle>
                <CardDescription>
                  Add a user to this contest.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form method="post" className="space-y-4">
                  <input type="hidden" name="intent" value="add_user" />
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Select name="username">
                      <SelectTrigger>
                        <SelectValue placeholder="Select a user..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableUsers.length === 0 ? (
                          <SelectItem value="" disabled>
                            No users available
                          </SelectItem>
                        ) : (
                          availableUsers.map((user) => (
                            <SelectItem key={user.username} value={user.username}>
                              <div className="flex items-center gap-2">
                                <span>{user.username}</span>
                                <Badge variant="outline" className="text-xs">
                                  {user.role}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting || availableUsers.length === 0}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add User
                  </Button>
                </Form>
              </CardContent>
            </Card>

            {/* User List */}
            <Card className="border-0 shadow-sm col-span-2">
              <CardHeader>
                <CardTitle>Participants</CardTitle>
                <CardDescription>
                  Users participating in this contest.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {contestUsers.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No participants yet. Add users from the left panel.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                        <TableHead className="w-[150px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contestUsers.map((user) => (
                        <TableRow key={user.username}>
                          <TableCell>
                            <Link
                              to={`/profile/${user.username}`}
                              className="font-medium hover:underline"
                            >
                              {user.username}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{user.role}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={user.status === "1" ? "success" : "secondary"}
                            >
                              {user.status === "1" ? "Started" : "Invited"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {user.totalScore}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 justify-end">
                              {user.status === "0" && (
                                <Form method="post">
                                  <input type="hidden" name="intent" value="freeze_user" />
                                  <input type="hidden" name="username" value={user.username} />
                                  <Button
                                    type="submit"
                                    variant="outline"
                                    size="sm"
                                    title="Freeze user's score"
                                  >
                                    Freeze
                                  </Button>
                                </Form>
                              )}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remove Participant?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will remove {user.username} from the contest
                                      and clear their scores.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <Form method="post">
                                      <input type="hidden" name="intent" value="remove_user" />
                                      <input type="hidden" name="username" value={user.username} />
                                      <AlertDialogAction
                                        type="submit"
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Remove
                                      </AlertDialogAction>
                                    </Form>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
