import type { Route } from "./+types/clarifications";
import { useState } from "react";
import { Link } from "react-router";
import {
  MessageSquare,
  Plus,
  Clock,
  CheckCircle2,
  Circle,
  Send,
  FileText,
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
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
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

export function meta({}: Route.MetaArgs) {
  return [
    { title: "My Clarifications - Codebreaker Contest" },
    { name: "description", content: "Ask and view your clarifications" },
  ];
}

// Mock current user
const currentUser = {
  username: "alice_chen",
  displayName: "Alice Chen",
};

// Mock problems for dropdown
const problems = [
  { id: "graph-traversal", name: "A - Graph Traversal" },
  { id: "dynamic-array", name: "B - Dynamic Array" },
  { id: "segment-tree", name: "C - Segment Tree" },
  { id: "shortest-path", name: "D - Shortest Path" },
  { id: "string-matching", name: "E - String Matching" },
];

// Mock clarifications data - filtered to current user only
const allClarifications = [
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

export default function Clarifications() {
  const [askDialogOpen, setAskDialogOpen] = useState(false);

  // Filter to current user's clarifications only
  const clarifications = allClarifications.filter(
    (c) => c.username === currentUser.username
  );

  const pendingCount = clarifications.filter((c) => c.status === "pending").length;
  const answeredCount = clarifications.filter((c) => c.status === "answered").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Clarifications</h1>
          <p className="text-muted-foreground">
            Ask questions and get answers from administrators
          </p>
        </div>
        <Dialog open={askDialogOpen} onOpenChange={setAskDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-2" />
              Ask Question
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>Ask a Clarification</DialogTitle>
              <DialogDescription>
                Submit a question to the contest administrators. Please check existing
                clarifications before asking.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="problem">Problem (optional)</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a problem..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General Question</SelectItem>
                    {problems.map((problem) => (
                      <SelectItem key={problem.id} value={problem.id}>
                        {problem.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="question">Your Question</Label>
                <Textarea
                  id="question"
                  placeholder="Enter your question..."
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAskDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => setAskDialogOpen(false)}
              >
                <Send className="h-4 w-4 mr-2" />
                Submit Question
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <Circle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{pendingCount}</p>
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
                <p className="text-2xl font-bold">{answeredCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Clarifications List */}
      <div className="space-y-4">
        {clarifications.map((clarification) => (
          <Card key={clarification.id} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {clarification.problem ? (
                      <Link
                        to={`/problems/${clarification.problemId}`}
                        className="flex items-center gap-1 text-sm font-medium hover:underline"
                      >
                        <FileText className="h-4 w-4" />
                        {clarification.problem}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium text-muted-foreground">
                        General Question
                      </span>
                    )}
                    <span className="text-muted-foreground">•</span>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {clarification.time}
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
                    Your Question
                  </p>
                  <p className="text-sm">{clarification.question}</p>
                </div>

                {/* Answer */}
                {clarification.status === "answered" && clarification.answer && (
                  <div className="rounded-lg bg-emerald-50 p-3 border-l-4 border-l-emerald-500">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-emerald-700">
                        Administrator's Answer
                      </p>
                    </div>
                    <p className="text-sm">{clarification.answer}</p>
                  </div>
                )}

                {/* Pending Message */}
                {clarification.status === "pending" && (
                  <div className="rounded-lg bg-amber-50 p-3 border-l-4 border-l-amber-500">
                    <p className="text-sm text-amber-700">
                      Waiting for administrator's response...
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {clarifications.length === 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No Clarifications Yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              You haven't asked any questions yet. If you have a question about
              a problem, feel free to ask!
            </p>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setAskDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Ask Question
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
