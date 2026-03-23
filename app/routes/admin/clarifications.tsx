import type { Route } from "./+types/clarifications";
import { useState } from "react";
import { Link, data, useSubmit } from "react-router";
import {
  MessageSquare,
  Clock,
  CheckCircle2,
  Circle,
  User,
  FileText,
  Filter,
  Search,
  AlertCircle,
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
import { UserAvatar } from "~/components/ui/user-avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ClientOnly } from "~/components/ui/client-only";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Manage Clarifications - Admin" },
    { name: "description", content: "Answer clarification requests" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { requireAdmin } = await import("~/lib/auth.server");
  const { listClarifications } = await import("~/lib/db/clarifications.server");
  const { listContests } = await import("~/lib/db/contests.server");
  const { getUser } = await import("~/lib/db/users.server");
  const { getProblem } = await import("~/lib/db/problems.server");

  await requireAdmin(request);

  const [dbClarifications, contests] = await Promise.all([
    listClarifications(),
    listContests(),
  ]);

  // Map database clarifications to display format
  const clarifications = await Promise.all(
    dbClarifications.map(async (c) => {
      const user = await getUser(c.askedBy);
      const problem = c.problemName ? await getProblem(c.problemName) : null;
      const contest = contests.find(contest => contest.contestId === c.contestId);

      return {
        id: `${c.askedBy}:${c.clarificationTime}`,
        username: c.askedBy,
        displayName: user?.fullname || c.askedBy,
        problem: problem?.title || null,
        problemId: c.problemName || null,
        question: c.question,
        answer: c.answer || null,
        answeredBy: c.answeredBy || null,
        status: c.answer ? "answered" : "pending",
        time: c.clarificationTime,
        contestId: c.contestId,
        contestName: contest?.contestName || c.contestId,
      };
    })
  );

  return { clarifications, contests };
}

export async function action({ request }: Route.ActionArgs) {
  const { getClarification, answerClarification } = await import("~/lib/db/clarifications.server");
  const { answerClarification: broadcastAnswerClarification } = await import("~/lib/websocket-broadcast.server");

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "answer") {
    const id = formData.get("id") as string;
    const answer = formData.get("answer") as string;

    if (!id || !answer) {
      return data({ error: "Missing required fields" }, { status: 400 });
    }

    // Parse the composite ID (split only on first colon since timestamp contains colons)
    const colonIndex = id.indexOf(":");
    const askedBy = id.substring(0, colonIndex);
    const clarificationTime = id.substring(colonIndex + 1);

    // Get the clarification to find the problemName for the notification
    const clarification = await getClarification(askedBy, clarificationTime);

    await answerClarification(askedBy, clarificationTime, answer, "admin");

    // Notify the user that their question was answered
    // Try both member and admin roles since user role isn't passed
    await broadcastAnswerClarification("member", askedBy);
    await broadcastAnswerClarification("admin", askedBy);

    return { success: true };
  }

  return data({ error: "Unknown action" }, { status: 400 });
}

// Possible answers for admins
const clarificationAnswers = [
  "Yes",
  "No",
  "Answered in task description",
  "No comment",
  "Investigating",
  "Invalid question",
];

export default function AdminClarifications({ loaderData }: Route.ComponentProps) {
  const { clarifications } = loaderData;
  const submit = useSubmit();
  const [answerDialogOpen, setAnswerDialogOpen] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedAnswer, setSelectedAnswer] = useState("");

  const pendingClarifications = clarifications.filter((c) => c.status === "pending");
  const answeredClarifications = clarifications.filter((c) => c.status === "answered");

  const displayedClarifications =
    activeTab === "pending" ? pendingClarifications : answeredClarifications;

  const handleAnswer = () => {
    if (!answerDialogOpen || !selectedAnswer) return;
    const formData = new FormData();
    formData.set("intent", "answer");
    formData.set("id", answerDialogOpen);
    formData.set("answer", selectedAnswer);
    submit(formData, { method: "POST" });
    setAnswerDialogOpen(null);
    setSelectedAnswer("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clarifications</h1>
          <p className="text-muted-foreground">
            Answer clarification requests from contestants
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                <MessageSquare className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{clarifications.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-amber-600">
                  {pendingClarifications.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <CheckCircle2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Answered</p>
                <p className="text-2xl font-bold">{answeredClarifications.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <ClientOnly fallback={<div className="animate-pulse h-[400px] bg-muted rounded-lg" />}>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            Pending
            {pendingClarifications.length > 0 && (
              <Badge variant="destructive" className="text-xs px-1.5 py-0">
                {pendingClarifications.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="answered">Answered</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {/* Clarifications List */}
          <div className="space-y-4">
            {displayedClarifications.map((clarification) => (
              <Card key={clarification.id} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <UserAvatar name={clarification.displayName} size="sm" />
                        <div>
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/admin/users`}
                              className="text-sm font-medium hover:underline"
                            >
                              {clarification.displayName}
                            </Link>
                            <span className="text-xs text-muted-foreground">
                              @{clarification.username}
                            </span>
                            {clarification.problem && (
                              <>
                                <span className="text-muted-foreground">•</span>
                                <Link
                                  to={`/admin/problems`}
                                  className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                  {clarification.problem}
                                </Link>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            {clarification.time}
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant={
                          clarification.status === "answered" ? "success" : "warning"
                        }
                      >
                        {clarification.status === "answered" ? "Answered" : "Pending"}
                      </Badge>
                    </div>

                    {/* Question */}
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Question
                      </p>
                      <p className="text-sm">{clarification.question}</p>
                    </div>

                    {/* Answer */}
                    {clarification.status === "answered" && clarification.answer && (
                      <div className="rounded-lg bg-emerald-50 p-3 border-l-4 border-l-emerald-500">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-emerald-700">
                            Answer
                          </p>
                          <p className="text-xs text-muted-foreground">
                            by {clarification.answeredBy}
                          </p>
                        </div>
                        <p className="text-sm">{clarification.answer}</p>
                      </div>
                    )}

                    {/* Answer Button for Pending */}
                    {clarification.status === "pending" && (
                      <Dialog
                        open={answerDialogOpen === clarification.id}
                        onOpenChange={(open) => {
                          setAnswerDialogOpen(open ? clarification.id : null);
                          if (!open) setSelectedAnswer("");
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button className="bg-emerald-600 hover:bg-emerald-700">
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Answer Clarification
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Answer Clarification</DialogTitle>
                            <DialogDescription>
                              Select a response for this clarification from{" "}
                              <strong>{clarification.displayName}</strong>.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="rounded-lg bg-muted/50 p-3">
                              <p className="text-sm font-medium text-muted-foreground mb-1">
                                Question
                              </p>
                              <p className="text-sm">{clarification.question}</p>
                            </div>
                            <div className="space-y-2">
                              <Label>Select Answer</Label>
                              <Select
                                value={selectedAnswer}
                                onValueChange={setSelectedAnswer}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Choose a response..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {clarificationAnswers.map((answer) => (
                                    <SelectItem key={answer} value={answer}>
                                      {answer}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => setAnswerDialogOpen(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              className="bg-emerald-600 hover:bg-emerald-700"
                              onClick={handleAnswer}
                            >
                              Submit Answer
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Empty State */}
          {displayedClarifications.length === 0 && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-8 text-center">
                {activeTab === "pending" ? (
                  <>
                    <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-4" />
                    <h3 className="font-semibold mb-2">All Caught Up!</h3>
                    <p className="text-sm text-muted-foreground">
                      There are no pending clarifications to answer.
                    </p>
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">No Answered Clarifications</h3>
                    <p className="text-sm text-muted-foreground">
                      No clarifications have been answered yet.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      </ClientOnly>
    </div>
  );
}
