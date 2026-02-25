import type { Route } from "./+types/contests";
import { Form, Link, useNavigation, redirect } from "react-router";
import { format } from "date-fns";
import {
  Plus,
  Calendar,
  Users,
  FileText,
  Clock,
  Globe,
  Lock,
  Play,
  CheckCircle,
  Timer,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
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
import { cn } from "~/lib/utils";
import type { ContestStatus } from "~/types/database";
import { parseDateTime, isDateTimeNotSet } from "~/types/database";
import {
  listContestsWithStatus,
  createContest,
  deleteContest,
} from "~/lib/db/contests.server";

export async function loader({ request }: Route.LoaderArgs) {
  const { requireAdmin } = await import("~/lib/auth.server");
  await requireAdmin(request);

  const contests = await listContestsWithStatus();

  return {
    contests: contests.map((c) => ({
      contestId: c.contestId,
      contestName: c.contestName,
      description: c.description,
      mode: c.mode,
      startTime: c.startTime,
      endTime: c.endTime,
      duration: c.duration,
      status: c.status,
      problemCount: c.problems.length,
      userCount: Object.keys(c.users || {}).length,
      isPublic: c.public,
      publicScoreboard: c.publicScoreboard,
      subLimit: c.subLimit,
      subDelay: c.subDelay,
    })),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { requireAdmin } = await import("~/lib/auth.server");
  await requireAdmin(request);

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "create") {
    const contestId = formData.get("contestId") as string;

    if (!contestId || !/^[a-zA-Z0-9_-]+$/.test(contestId)) {
      return { error: "Contest ID must be alphanumeric (with - or _)" };
    }

    // Check if contest already exists
    const contests = await listContestsWithStatus();
    const existing = contests.find((c) => c.contestId === contestId);
    if (existing) {
      return { error: "A contest with this ID already exists" };
    }

    await createContest(contestId);
    // Redirect to edit the newly created contest
    return redirect(`/admin/contests/${contestId}`);
  }

  if (intent === "delete") {
    const contestId = formData.get("contestId") as string;
    const deleted = await deleteContest(contestId);
    if (!deleted) {
      return { error: "Contest not found" };
    }
    return { success: true, message: "Contest deleted successfully" };
  }

  return { error: "Unknown action" };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Contest Management - Codebreaker Admin" },
    { name: "description", content: "Manage contests" },
  ];
}

const statusConfig: Record<
  ContestStatus,
  { label: string; variant: "success" | "warning" | "secondary"; icon: typeof Play }
> = {
  NOT_STARTED: { label: "Not Started", variant: "secondary", icon: Clock },
  ONGOING: { label: "Ongoing", variant: "success", icon: Play },
  ENDED: { label: "Ended", variant: "warning", icon: CheckCircle },
};

function formatDateTime(dateStr: string): string {
  if (isDateTimeNotSet(dateStr)) return "Not Set";
  const date = parseDateTime(dateStr);
  return format(date, "yyyy-MM-dd HH:mm");
}

function formatDuration(minutes: number | undefined): string {
  if (!minutes || minutes === 0) return "Unlimited";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export default function AdminContestsPage({ loaderData, actionData }: Route.ComponentProps) {
  const { contests } = loaderData;
  const navigation = useNavigation();
  const isCreating = navigation.state === "submitting" && navigation.formData?.get("intent") === "create";

  // Stats
  const ongoingCount = contests.filter((c) => c.status === "ONGOING").length;
  const upcomingCount = contests.filter((c) => c.status === "NOT_STARTED").length;
  const totalParticipants = contests.reduce((sum, c) => sum + c.userCount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contest Management</h1>
          <p className="text-muted-foreground">
            Create and manage programming contests.
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Contest
            </Button>
          </DialogTrigger>
          <DialogContent>
            <Form method="post">
              <input type="hidden" name="intent" value="create" />
              <DialogHeader>
                <DialogTitle>Create New Contest</DialogTitle>
                <DialogDescription>
                  Enter a unique contest ID. You can configure details after creation.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="contestId">Contest ID</Label>
                <Input
                  id="contestId"
                  name="contestId"
                  placeholder="e.g., weekly-43, ioi-practice"
                  className="mt-2"
                  pattern="[a-zA-Z0-9_-]+"
                  required
                />
                <p className="text-sm text-muted-foreground mt-2">
                  Only letters, numbers, dashes, and underscores allowed.
                </p>
                {actionData?.error && (
                  <p className="text-sm text-destructive mt-2">{actionData.error}</p>
                )}
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Contest"
                  )}
                </Button>
              </DialogFooter>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Contests</p>
                <p className="text-2xl font-bold">{contests.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                <Play className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ongoing</p>
                <p className="text-2xl font-bold">{ongoingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Upcoming</p>
                <p className="text-2xl font-bold">{upcomingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
                <Users className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Participants</p>
                <p className="text-2xl font-bold">{totalParticipants}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contest Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>All Contests</CardTitle>
          <CardDescription>
            Click on a contest to edit its details, problems, and participants.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Contest</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start Time</TableHead>
                <TableHead>End Time</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-center">Problems</TableHead>
                <TableHead className="text-center">Users</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                    No contests yet. Create your first contest to get started.
                  </TableCell>
                </TableRow>
              ) : (
                contests.map((contest) => {
                  const statusCfg = statusConfig[contest.status];
                  const StatusIcon = statusCfg.icon;

                  return (
                    <TableRow key={contest.contestId} className="hover:bg-muted/50">
                      <TableCell>
                        <Link
                          to={`/admin/contests/${contest.contestId}`}
                          className="font-medium hover:underline"
                        >
                          {contest.contestName}
                        </Link>
                        <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                          {contest.contestId}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {contest.mode === "centralized" ? (
                            <>
                              <Clock className="mr-1 h-3 w-3" />
                              Centralized
                            </>
                          ) : (
                            <>
                              <Timer className="mr-1 h-3 w-3" />
                              Self-Timer
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusCfg.variant}>
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {statusCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatDateTime(contest.startTime)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatDateTime(contest.endTime)}
                      </TableCell>
                      <TableCell>
                        {formatDuration(contest.duration)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          {contest.problemCount}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {contest.userCount}
                        </div>
                      </TableCell>
                      <TableCell>
                        {contest.isPublic ? (
                          <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
                            <Globe className="mr-1 h-3 w-3" />
                            Public
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-600">
                            <Lock className="mr-1 h-3 w-3" />
                            Private
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to={`/admin/contests/${contest.contestId}`}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit Contest
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem
                                  onSelect={(e) => e.preventDefault()}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete Contest
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Contest?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete "{contest.contestName}" and all associated data.
                                    This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <Form method="post">
                                    <input type="hidden" name="intent" value="delete" />
                                    <input type="hidden" name="contestId" value={contest.contestId} />
                                    <AlertDialogAction
                                      type="submit"
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </Form>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
