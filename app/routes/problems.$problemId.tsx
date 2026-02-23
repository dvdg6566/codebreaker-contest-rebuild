import type { Route } from "./+types/problems.$problemId";
import { Link, useParams } from "react-router";
import {
  FileText,
  Clock,
  HardDrive,
  Upload,
  ChevronLeft,
  Download,
  Code2,
  FileCode,
  CheckCircle2,
  AlertCircle,
  XCircle,
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
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Separator } from "~/components/ui/separator";

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `Problem ${params.problemId} - Codebreaker Contest` },
    { name: "description", content: "View problem details and submit solution" },
  ];
}

// Mock problem data
const problemData = {
  id: "graph-traversal",
  name: "Graph Traversal",
  title: "Graph Traversal",
  author: "admin",
  source: "IOI 2024",
  difficulty: "Medium",
  timeLimit: 1.0,
  memoryLimit: 256,
  score: 75,
  maxScore: 100,
  type: "Batch",
  subtasks: [
    { id: 1, score: 20, constraints: "N ≤ 100" },
    { id: 2, score: 30, constraints: "N ≤ 1000" },
    { id: 3, score: 25, constraints: "N ≤ 10000" },
    { id: 4, score: 25, constraints: "N ≤ 100000" },
  ],
  statement: `
## Problem Statement

You are given a directed graph with **N** nodes and **M** edges. Each edge has a weight associated with it.

Your task is to find the shortest path from node 1 to node N.

## Input Format

The first line contains two integers **N** and **M** — the number of nodes and edges.

Each of the next **M** lines contains three integers **u**, **v**, and **w** — indicating an edge from node **u** to node **v** with weight **w**.

## Output Format

Print a single integer — the length of the shortest path from node 1 to node N. If no path exists, print **-1**.

## Constraints

- 1 ≤ N ≤ 100,000
- 1 ≤ M ≤ 200,000
- 1 ≤ w ≤ 1,000,000,000

## Sample Input

\`\`\`
4 5
1 2 1
1 3 4
2 3 2
2 4 5
3 4 1
\`\`\`

## Sample Output

\`\`\`
4
\`\`\`

## Explanation

The shortest path is 1 → 2 → 3 → 4 with total weight 1 + 2 + 1 = 4.
`,
  recentSubmissions: [
    { id: 1234, verdict: "AC", score: 100, time: "0.05s", language: "C++ 17" },
    { id: 1233, verdict: "WA", score: 75, time: "0.03s", language: "C++ 17" },
    { id: 1232, verdict: "TLE", score: 50, time: "2.00s", language: "Python 3" },
  ],
};

const languages = [
  "C++ 17",
  "C++ 14",
  "C++ 11",
  "C",
  "Python 3",
  "Java 11",
];

export default function ProblemDetail() {
  const params = useParams();

  const verdictIcon = (verdict: string) => {
    switch (verdict) {
      case "AC":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "WA":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "TLE":
        return <Clock className="h-4 w-4 text-orange-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/problems">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {problemData.title}
              </h1>
              <Badge
                variant="outline"
                className="bg-amber-100 text-amber-700"
              >
                {problemData.difficulty}
              </Badge>
              {problemData.type === "Communication" && (
                <Badge variant="secondary">Communication</Badge>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <span>Author: {problemData.author}</span>
              {problemData.source && <span>Source: {problemData.source}</span>}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">
            {problemData.score}{" "}
            <span className="text-base font-normal text-muted-foreground">
              / {problemData.maxScore}
            </span>
          </div>
          <div className="text-sm text-muted-foreground">Your Score</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Problem Statement */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Problem Statement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <div
                  className="[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-3 [&_p]:mb-3 [&_ul]:mb-3 [&_li]:mb-1 [&_pre]:bg-muted [&_pre]:p-4 [&_pre]:rounded-lg [&_code]:text-sm"
                  dangerouslySetInnerHTML={{
                    __html: problemData.statement
                      .replace(/## /g, "<h2>")
                      .replace(/\n\n/g, "</h2>\n\n")
                      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                      .replace(/```\n?([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
                      .replace(/`([^`]+)`/g, "<code class='bg-muted px-1 py-0.5 rounded'>$1</code>")
                      .replace(/- (.*)/g, "<li>$1</li>")
                      .replace(/\n/g, "<br />"),
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit Solution */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Submit Solution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select defaultValue="C++ 17">
                    <SelectTrigger>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map((lang) => (
                        <SelectItem key={lang} value={lang}>
                          {lang}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Upload File</Label>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1">
                      <Upload className="h-4 w-4 mr-2" />
                      Choose File
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Code</Label>
                <Textarea
                  placeholder="Paste your code here..."
                  className="font-mono text-sm min-h-[200px]"
                />
              </div>

              <div className="flex justify-end">
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  <Upload className="h-4 w-4 mr-2" />
                  Submit Solution
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Constraints */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Constraints</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Time Limit
                  </div>
                  <span className="font-medium">{problemData.timeLimit}s</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <HardDrive className="h-4 w-4" />
                    Memory Limit
                  </div>
                  <span className="font-medium">{problemData.memoryLimit} MB</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subtasks */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Subtasks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {problemData.subtasks.map((subtask) => (
                  <div
                    key={subtask.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <div>
                      <div className="font-medium text-sm">
                        Subtask {subtask.id}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {subtask.constraints}
                      </div>
                    </div>
                    <Badge variant="outline">{subtask.score} pts</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Submissions */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Your Submissions</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link to={`/submissions?problem=${params.problemId}`}>
                    View All
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {problemData.recentSubmissions.map((sub) => (
                  <Link
                    key={sub.id}
                    to={`/submissions/${sub.id}`}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {verdictIcon(sub.verdict)}
                      <div>
                        <div className="text-sm font-medium">#{sub.id}</div>
                        <div className="text-xs text-muted-foreground">
                          {sub.language}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{sub.score}</div>
                      <div className="text-xs text-muted-foreground">
                        {sub.time}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Attachments */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Attachments</CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Download Sample Files
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
