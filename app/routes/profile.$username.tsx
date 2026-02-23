import type { Route } from "./+types/profile.$username";
import { Link, useParams } from "react-router";
import {
  User,
  Mail,
  Calendar,
  Trophy,
  FileText,
  Send,
  Award,
  Clock,
  CheckCircle2,
  ChevronLeft,
  Edit,
  Settings,
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
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Separator } from "~/components/ui/separator";
import { ScoreBadge, type VerdictType } from "~/components/ui/score-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `${params.username}'s Profile - Codebreaker Contest` },
    { name: "description", content: "View user profile" },
  ];
}

// Mock user data
const userData = {
  username: "alice_chen",
  displayName: "Alice Chen",
  email: "alice@example.com",
  role: "admin",
  joinedDate: "2023-06-15",
  contest: "IOI Practice Round 2024",
  contestId: "ioi-practice-2024",
  stats: {
    totalSubmissions: 156,
    acceptedSubmissions: 89,
    problemsSolved: 42,
    contestsParticipated: 12,
  },
  problemScores: {
    "graph-traversal": 100,
    "dynamic-array": 75,
    "segment-tree": 30,
    "shortest-path": 50,
    "string-matching": 0,
  },
  recentSubmissions: [
    {
      id: 1245,
      problem: "Graph Traversal",
      problemId: "graph-traversal",
      verdict: "AC",
      score: 100,
      language: "C++ 17",
      time: "2024-02-23 14:32:15",
    },
    {
      id: 1243,
      problem: "Segment Tree",
      problemId: "segment-tree",
      verdict: "WA",
      score: 30,
      language: "C++ 17",
      time: "2024-02-23 14:15:20",
    },
    {
      id: 1241,
      problem: "Dynamic Array",
      problemId: "dynamic-array",
      verdict: "PS",
      score: 75,
      language: "C++ 17",
      time: "2024-02-23 13:58:30",
    },
    {
      id: 1239,
      problem: "Shortest Path",
      problemId: "shortest-path",
      verdict: "TLE",
      score: 50,
      language: "Python 3",
      time: "2024-02-23 13:30:00",
    },
  ],
};

export default function Profile() {
  const params = useParams();
  const isCurrentUser = true; // Mock - would check against logged in user

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const totalScore = Object.values(userData.problemScores).reduce(
    (sum, score) => sum + score,
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
        {isCurrentUser && (
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        )}
      </div>

      {/* Profile Header */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={`/avatars/${userData.username}.jpg`} />
              <AvatarFallback className="bg-violet-500 text-white text-2xl">
                {getInitials(userData.displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{userData.displayName}</h1>
                <Badge
                  variant={userData.role === "admin" ? "admin" : "contestant"}
                >
                  {userData.role.charAt(0).toUpperCase() + userData.role.slice(1)}
                </Badge>
              </div>
              <p className="text-muted-foreground">@{userData.username}</p>
              <div className="mt-4 flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {userData.email}
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Joined {userData.joinedDate}
                </div>
                {userData.contest && (
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4" />
                    <Link
                      to={`/scoreboard`}
                      className="hover:underline"
                    >
                      {userData.contest}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-lg bg-blue-100 mb-2">
              <Send className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold">{userData.stats.totalSubmissions}</p>
            <p className="text-sm text-muted-foreground">Submissions</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-lg bg-emerald-100 mb-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold">{userData.stats.acceptedSubmissions}</p>
            <p className="text-sm text-muted-foreground">Accepted</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-lg bg-violet-100 mb-2">
              <FileText className="h-5 w-5 text-violet-600" />
            </div>
            <p className="text-2xl font-bold">{userData.stats.problemsSolved}</p>
            <p className="text-sm text-muted-foreground">Problems Solved</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-lg bg-amber-100 mb-2">
              <Trophy className="h-5 w-5 text-amber-600" />
            </div>
            <p className="text-2xl font-bold">{userData.stats.contestsParticipated}</p>
            <p className="text-sm text-muted-foreground">Contests</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Problem Scores */}
        <div className="col-span-2">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Current Contest Scores</CardTitle>
                <Badge variant="outline" className="text-base px-3 py-1">
                  Total: {totalScore} / 500
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(userData.problemScores).map(
                  ([problemId, score], index) => {
                    const problemName = problemId
                      .split("-")
                      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                      .join(" ");
                    return (
                      <div
                        key={problemId}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded bg-muted font-semibold text-sm">
                            {String.fromCharCode(65 + index)}
                          </div>
                          <Link
                            to={`/problems/${problemId}`}
                            className="font-medium hover:underline"
                          >
                            {problemName}
                          </Link>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                score === 100
                                  ? "bg-emerald-500"
                                  : score >= 50
                                    ? "bg-amber-500"
                                    : score > 0
                                      ? "bg-orange-500"
                                      : "bg-gray-300"
                              }`}
                              style={{ width: `${score}%` }}
                            />
                          </div>
                          <span className="font-semibold w-12 text-right">
                            {score}
                          </span>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Submissions */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Submissions</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to={`/submissions?username=${userData.username}`}>
                  View All
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {userData.recentSubmissions.map((sub) => (
                <Link
                  key={sub.id}
                  to={`/submissions/${sub.id}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <ScoreBadge verdict={sub.verdict as VerdictType} />
                    <div>
                      <p className="text-sm font-medium">{sub.problem}</p>
                      <p className="text-xs text-muted-foreground">
                        {sub.language}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{sub.score}</p>
                    <p className="text-xs text-muted-foreground">
                      #{sub.id}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
