import type { Route } from "./+types/submissions.$subId";
import { Link, useParams } from "react-router";
import {
  ChevronLeft,
  Clock,
  HardDrive,
  Code2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Timer,
  RotateCcw,
  Copy,
  Download,
  User,
  Calendar,
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
import { ScoreBadge, type VerdictType } from "~/components/ui/score-badge";
import { UserAvatar } from "~/components/ui/user-avatar";
import { Separator } from "~/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `Submission #${params.subId} - Codebreaker Contest` },
    { name: "description", content: "View submission details" },
  ];
}

// Mock submission data
const submissionData = {
  id: 1245,
  username: "alice_chen",
  displayName: "Alice Chen",
  problem: "Graph Traversal",
  problemId: "graph-traversal",
  language: "C++ 17",
  verdict: "PS",
  totalScore: 75,
  maxScore: 100,
  maxTime: "0.08",
  maxMemory: 14.2,
  submissionTime: "2024-02-23 14:32:15 (GMT+8)",
  gradingCompleteTime: "2024-02-23 14:32:18 (GMT+8)",
  compileError: null,
  code: `#include <bits/stdc++.h>
using namespace std;

const int INF = 1e9;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n, m;
    cin >> n >> m;

    vector<vector<pair<int, int>>> adj(n + 1);
    for (int i = 0; i < m; i++) {
        int u, v, w;
        cin >> u >> v >> w;
        adj[u].push_back({v, w});
    }

    vector<int> dist(n + 1, INF);
    priority_queue<pair<int, int>, vector<pair<int, int>>, greater<>> pq;

    dist[1] = 0;
    pq.push({0, 1});

    while (!pq.empty()) {
        auto [d, u] = pq.top();
        pq.pop();

        if (d > dist[u]) continue;

        for (auto [v, w] : adj[u]) {
            if (dist[u] + w < dist[v]) {
                dist[v] = dist[u] + w;
                pq.push({dist[v], v});
            }
        }
    }

    cout << (dist[n] == INF ? -1 : dist[n]) << endl;

    return 0;
}`,
  subtasks: [
    {
      id: 1,
      maxScore: 20,
      yourScore: 20,
      verdict: "AC",
      testcases: [
        { id: 1, verdict: "AC", score: 100, time: 0.01, memory: 8.2 },
        { id: 2, verdict: "AC", score: 100, time: 0.01, memory: 8.4 },
        { id: 3, verdict: "AC", score: 100, time: 0.02, memory: 8.6 },
      ],
    },
    {
      id: 2,
      maxScore: 30,
      yourScore: 30,
      verdict: "AC",
      testcases: [
        { id: 4, verdict: "AC", score: 100, time: 0.03, memory: 9.2 },
        { id: 5, verdict: "AC", score: 100, time: 0.04, memory: 10.1 },
        { id: 6, verdict: "AC", score: 100, time: 0.05, memory: 11.4 },
        { id: 7, verdict: "AC", score: 100, time: 0.05, memory: 11.8 },
      ],
    },
    {
      id: 3,
      maxScore: 25,
      yourScore: 25,
      verdict: "AC",
      testcases: [
        { id: 8, verdict: "AC", score: 100, time: 0.06, memory: 12.4 },
        { id: 9, verdict: "AC", score: 100, time: 0.07, memory: 13.2 },
        { id: 10, verdict: "AC", score: 100, time: 0.08, memory: 14.2 },
      ],
    },
    {
      id: 4,
      maxScore: 25,
      yourScore: 0,
      verdict: "WA",
      testcases: [
        { id: 11, verdict: "WA", score: 0, time: 0.05, memory: 12.8 },
        { id: 12, verdict: "WA", score: 0, time: 0.06, memory: 13.4 },
        { id: 13, verdict: "N/A", score: "-", time: "N/A", memory: "N/A" },
        { id: 14, verdict: "N/A", score: "-", time: "N/A", memory: "N/A" },
      ],
    },
  ],
};

const verdictIcon = (verdict: string) => {
  switch (verdict) {
    case "AC":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "WA":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "TLE":
      return <Timer className="h-4 w-4 text-orange-500" />;
    case "MLE":
      return <HardDrive className="h-4 w-4 text-purple-500" />;
    case "RTE":
      return <AlertCircle className="h-4 w-4 text-rose-500" />;
    case "PS":
      return <AlertCircle className="h-4 w-4 text-amber-500" />;
    default:
      return <AlertCircle className="h-4 w-4 text-gray-400" />;
  }
};

export default function SubmissionDetail() {
  const params = useParams();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/submissions">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                Submission #{submissionData.id}
              </h1>
              <ScoreBadge
                verdict={submissionData.verdict as VerdictType}
                className="text-sm px-3 py-1"
              />
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <Link
                to={`/problems/${submissionData.problemId}`}
                className="hover:underline"
              >
                {submissionData.problem}
              </Link>
              <span>•</span>
              <span>{submissionData.language}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <RotateCcw className="h-4 w-4 mr-2" />
            Resubmit
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Subtask Results */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Subtask Results</CardTitle>
                <div className="text-lg font-bold">
                  {submissionData.totalScore}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    / {submissionData.maxScore}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {submissionData.subtasks.map((subtask) => (
                <Collapsible key={subtask.id}>
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      <div className="flex items-center gap-3">
                        {verdictIcon(subtask.verdict)}
                        <span className="font-medium">Subtask {subtask.id}</span>
                        <Badge variant="outline" className="text-xs">
                          {subtask.testcases.length} testcases
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4">
                        <ScoreBadge
                          verdict={subtask.verdict as VerdictType}
                          score={subtask.yourScore}
                        />
                        <span className="text-sm text-muted-foreground">
                          / {subtask.maxScore}
                        </span>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 ml-4 border-l-2 border-muted pl-4">
                      <div className="grid grid-cols-5 gap-2 py-2 text-xs text-muted-foreground font-medium">
                        <span>Test</span>
                        <span className="text-center">Verdict</span>
                        <span className="text-center">Score</span>
                        <span className="text-center">Time</span>
                        <span className="text-center">Memory</span>
                      </div>
                      {subtask.testcases.map((tc) => (
                        <div
                          key={tc.id}
                          className="grid grid-cols-5 gap-2 py-2 text-sm border-t border-muted/50"
                        >
                          <span className="text-muted-foreground">#{tc.id}</span>
                          <span className="text-center">
                            <ScoreBadge verdict={tc.verdict as VerdictType} />
                          </span>
                          <span className="text-center">{tc.score}</span>
                          <span className="text-center text-muted-foreground">
                            {tc.time === "N/A" ? "N/A" : `${tc.time}s`}
                          </span>
                          <span className="text-center text-muted-foreground">
                            {tc.memory === "N/A" ? "N/A" : `${tc.memory} MB`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </CardContent>
          </Card>

          {/* Source Code */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Source Code</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono">
                    {submissionData.language}
                  </Badge>
                  <Button variant="ghost" size="sm">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                <code className="font-mono">{submissionData.code}</code>
              </pre>
            </CardContent>
          </Card>

          {/* Compile Error (if any) */}
          {submissionData.compileError && (
            <Card className="border-0 shadow-sm border-l-4 border-l-red-500">
              <CardHeader>
                <CardTitle className="text-base text-red-600">
                  Compilation Error
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-red-50 text-red-800 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{submissionData.compileError}</code>
                </pre>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Submission Info */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Submission Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Submitted by</p>
                  <Link
                    to={`/profile/${submissionData.username}`}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <UserAvatar
                      name={submissionData.displayName}
                      size="sm"
                    />
                    <span className="text-sm font-medium">
                      {submissionData.displayName}
                    </span>
                  </Link>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Submitted at</p>
                  <p className="text-sm">{submissionData.submissionTime}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Grading completed</p>
                  <p className="text-sm">{submissionData.gradingCompleteTime}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Performance */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Max Time
                </div>
                <span className="font-medium">{submissionData.maxTime}s</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <HardDrive className="h-4 w-4" />
                  Max Memory
                </div>
                <span className="font-medium">{submissionData.maxMemory} MB</span>
              </div>
            </CardContent>
          </Card>

          {/* Related Links */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Related</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to={`/problems/${submissionData.problemId}`}>
                  <Code2 className="h-4 w-4 mr-2" />
                  View Problem
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link
                  to={`/submissions?username=${submissionData.username}&problem=${submissionData.problemId}`}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  All Submissions
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
