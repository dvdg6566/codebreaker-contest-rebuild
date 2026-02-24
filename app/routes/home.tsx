import type { Route } from "./+types/home";
import { Link } from "react-router";
import {
  Trophy,
  FileText,
  Send,
  Users,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Calendar,
  MoreHorizontal,
  ChevronDown,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ClientOnly } from "~/components/ui/client-only";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Dashboard - Codebreaker Contest Manager" },
    {
      name: "description",
      content: "Codebreaker Contest Manager Dashboard",
    },
  ];
}

const stats = [
  {
    title: "Problems Assigned",
    value: "24",
    icon: FileText,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  {
    title: "Solved",
    value: "78%",
    icon: CheckCircle2,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
  },
  {
    title: "Pending Submissions",
    value: "12",
    icon: Clock,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  {
    title: "Active Contests",
    value: "3",
    icon: Trophy,
    color: "text-violet-600",
    bgColor: "bg-violet-50",
  },
  {
    title: "Success Rate",
    value: "85%",
    icon: TrendingUp,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
  },
];

const ongoingContests = [
  {
    name: "IOI Practice Round",
    progress: 65,
    daysLeft: 2,
    status: "active",
    color: "bg-violet-500",
  },
  {
    name: "Weekly Algorithm Challenge",
    progress: 30,
    daysLeft: 5,
    status: "active",
    color: "bg-emerald-500",
  },
  {
    name: "Data Structures Sprint",
    progress: 0,
    daysLeft: 7,
    status: "upcoming",
    color: "bg-amber-500",
  },
];

const milestones = [
  { name: "Contest Registration Opens", date: "Nov 25, 2024", icon: Calendar },
  { name: "Problem Set Released", date: "Dec 1, 2024", icon: FileText },
  { name: "Submission Deadline", date: "Dec 5, 2024", icon: Clock },
  { name: "Results Announced", date: "Dec 10, 2024", icon: Trophy },
  { name: "Awards Ceremony", date: "Dec 15, 2024", icon: Users },
];

const clarifications = [
  {
    user: "Alice Chen",
    initials: "AC",
    message: "Clarification on Problem 3: Need to discuss time complexity requirements.",
    time: "10:30 AM",
    color: "bg-violet-500",
  },
  {
    user: "Bob Smith",
    initials: "BS",
    message: "Question about input format for the Graph Traversal problem.",
    time: "9:45 AM",
    color: "bg-blue-500",
  },
  {
    user: "Carol Davis",
    initials: "CD",
    message: "Reviewed initial design concepts for the competition interface.",
    time: "8:30 AM",
    color: "bg-emerald-500",
  },
];

const leaderboard = [
  { rank: 1, name: "Emma Wilson", username: "emma_w", solved: 18, score: 1850, change: "+2" },
  { rank: 2, name: "James Chen", username: "jchen", solved: 17, score: 1720, change: "+1" },
  { rank: 3, name: "Sofia Garcia", username: "sofia_g", solved: 16, score: 1680, change: "-1" },
  { rank: 4, name: "Liam Johnson", username: "liam_j", solved: 15, score: 1550, change: "0" },
];

const notifications = [
  { type: "deadline", title: "Submission Deadline", user: "IOI Practice", time: "2 hrs", priority: "high" },
  { type: "workload", title: "High Workload", user: "Weekly Challenge", time: "Today", priority: "medium" },
  { type: "alert", title: "New Clarification", user: "Problem 5", time: "1 hr", priority: "low" },
  { type: "deadline", title: "Contest Starting", user: "Algorithm Sprint", time: "Tomorrow", priority: "medium" },
];

export default function Home() {
  return (
    <div className="space-y-6">
      {/* Header with Search */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        </div>
        <div className="flex items-center gap-4">
          <Input
            placeholder="Search here something..."
            className="w-64 bg-muted/50"
          />
          <Avatar className="h-8 w-8">
            <AvatarFallback>JD</AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{stat.title}</p>
                  <p className="text-xl font-bold">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Three Column Section */}
      <div className="grid grid-cols-3 gap-4">
        {/* Ongoing Contests */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Ongoing Contests</CardTitle>
              <ClientOnly fallback={<div className="h-8" />}>
                <Tabs defaultValue="all" className="h-8">
                  <TabsList className="h-7 p-0.5">
                    <TabsTrigger value="all" className="h-6 px-2 text-xs">All contests</TabsTrigger>
                    <TabsTrigger value="upcoming" className="h-6 px-2 text-xs">Upcoming</TabsTrigger>
                  </TabsList>
                </Tabs>
              </ClientOnly>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {ongoingContests.map((contest, i) => (
              <div key={i} className="rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-lg ${contest.color} flex items-center justify-center`}>
                    <Trophy className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{contest.name}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-muted">
                        <div
                          className={`h-1.5 rounded-full ${contest.color}`}
                          style={{ width: `${contest.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {contest.progress}%
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{contest.daysLeft} days remaining</span>
                  <Badge variant={contest.status === "active" ? "success" : "secondary"} className="text-[10px]">
                    {contest.status}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Milestones */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Milestones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {milestones.map((milestone, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    <milestone.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{milestone.name}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{milestone.date}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Clarifications */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Clarifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {clarifications.map((item, i) => (
                <div key={i} className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className={item.color}>{item.initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{item.user}</p>
                      <span className="text-xs text-muted-foreground">{item.time}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                      {item.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* About Task Card */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-start gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">About contest</span>
                <Badge variant="destructive" className="text-[10px]">High priority</Badge>
                <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200 bg-emerald-50">42% complete</Badge>
              </div>
              <h3 className="mt-2 text-lg font-semibold">IOI Practice Round 2024</h3>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Assigned to</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="bg-blue-500 text-[10px]">JS</AvatarFallback>
                    </Avatar>
                    <span className="text-sm">Jonas Stanton</span>
                    <span className="text-xs text-muted-foreground">+95 hrs, Yesterday</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Contest Reviewers</p>
                  <div className="mt-1 flex -space-x-2">
                    {["AC", "BS", "CD", "EW"].map((initials, i) => (
                      <Avatar key={i} className="h-6 w-6 border-2 border-background">
                        <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                      </Avatar>
                    ))}
                    <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px]">
                      +3
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Two Column Section */}
      <div className="grid grid-cols-2 gap-4">
        {/* Leaderboard */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Contestant Leaderboard</CardTitle>
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
                <span>View all</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="grid grid-cols-5 gap-4 py-2 text-xs text-muted-foreground">
                <span>Rank</span>
                <span className="col-span-2">Contestant</span>
                <span>Solved</span>
                <span>Score</span>
              </div>
              {leaderboard.map((user) => (
                <div key={user.rank} className="grid grid-cols-5 gap-4 py-2 items-center">
                  <span className="text-sm font-medium">#{user.rank}</span>
                  <div className="col-span-2 flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-xs">{user.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">@{user.username}</p>
                    </div>
                  </div>
                  <span className="text-sm">{user.solved}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium">{user.score}</span>
                    <span className={`text-xs ${user.change.startsWith("+") ? "text-emerald-600" : user.change.startsWith("-") ? "text-red-600" : "text-muted-foreground"}`}>
                      {user.change !== "0" && user.change}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Notifications and Alerts */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Notifications and Alerts</CardTitle>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="h-7 text-xs">Deadline Tracker</Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs">Workload Alerts</Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs">Contest Alerts</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {notifications.map((notif, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className={`rounded-full p-2 ${
                    notif.priority === "high" ? "bg-red-50" :
                    notif.priority === "medium" ? "bg-amber-50" : "bg-blue-50"
                  }`}>
                    {notif.type === "deadline" ? (
                      <Clock className={`h-4 w-4 ${notif.priority === "high" ? "text-red-600" : "text-amber-600"}`} />
                    ) : notif.type === "workload" ? (
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                    ) : (
                      <MessageSquare className="h-4 w-4 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{notif.title}</p>
                    <p className="text-xs text-muted-foreground">{notif.user}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={
                      notif.priority === "high" ? "destructive" :
                      notif.priority === "medium" ? "warning" : "secondary"
                    } className="text-[10px]">
                      {notif.priority}
                    </Badge>
                    <p className="mt-1 text-xs text-muted-foreground">{notif.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
