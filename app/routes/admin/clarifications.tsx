import type { Route } from "./+types/clarifications";
import { useState } from "react";
import { Link } from "react-router";
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

// Mock clarifications data - all clarifications from all users
const clarifications = [
  {
    id: 3,
    username: "alice_chen",
    displayName: "Alice Chen",
    problem: "Segment Tree",
    problemId: "segment-tree",
    question: "Can the range queries overlap?",
    answer: null,
    answeredBy: null,
    status: "pending",
    time: "2024-02-23 12:15:00",
  },
  {
    id: 6,
    username: "bob_smith",
    displayName: "Bob Smith",
    problem: "Dynamic Array",
    problemId: "dynamic-array",
    question: "What happens if the array is empty?",
    answer: null,
    answeredBy: null,
    status: "pending",
    time: "2024-02-23 12:10:00",
  },
  {
    id: 1,
    username: "alice_chen",
    displayName: "Alice Chen",
    problem: "Graph Traversal",
    problemId: "graph-traversal",
    question: "Can there be multiple edges between the same pair of nodes?",
    answer: "Yes",
    answeredBy: "admin",
    status: "answered",
    time: "2024-02-23 11:45:00",
  },
  {
    id: 2,
    username: "bob_smith",
    displayName: "Bob Smith",
    problem: "Dynamic Array",
    problemId: "dynamic-array",
    question: "Is it guaranteed that all elements are distinct?",
    answer: "Answered in task description",
    answeredBy: "admin",
    status: "answered",
    time: "2024-02-23 11:30:00",
  },
  {
    id: 4,
    username: "carol_davis",
    displayName: "Carol Davis",
    problem: null,
    problemId: null,
    question: "Is there a break during the contest?",
    answer: "No comment",
    answeredBy: "admin",
    status: "answered",
    time: "2024-02-23 10:00:00",
  },
  {
    id: 5,
    username: "alice_chen",
    displayName: "Alice Chen",
    problem: null,
    problemId: null,
    question: "What is the time limit for each problem?",
    answer: "Answered in task description",
    answeredBy: "admin",
    status: "answered",
    time: "2024-02-23 09:30:00",
  },
];

// Possible answers for admins
const clarificationAnswers = [
  "Yes",
  "No",
  "Answered in task description",
  "No comment",
  "Investigating",
  "Invalid question",
];

export default function AdminClarifications() {
  const [answerDialogOpen, setAnswerDialogOpen] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("pending");

  const pendingClarifications = clarifications.filter((c) => c.status === "pending");
  const answeredClarifications = clarifications.filter((c) => c.status === "answered");

  const displayedClarifications =
    activeTab === "pending" ? pendingClarifications : answeredClarifications;

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
                        onOpenChange={(open) =>
                          setAnswerDialogOpen(open ? clarification.id : null)
                        }
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
                              <Select>
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
                              onClick={() => setAnswerDialogOpen(null)}
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
