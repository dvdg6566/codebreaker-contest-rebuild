import type { Route } from "./+types/index";
import { Link } from "react-router";
import { Users, Trophy, Code2, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Admin Dashboard - Codebreaker" },
    { name: "description", content: "Codebreaker Contest Manager Admin Dashboard" },
  ];
}

const adminSections = [
  {
    title: "User Management",
    description: "Manage user accounts, roles, and permissions",
    href: "/admin/users",
    icon: Users,
    stats: "8 users",
  },
  {
    title: "Contest Management",
    description: "Create and manage programming contests",
    href: "/admin/contests",
    icon: Trophy,
    stats: "3 contests",
  },
  {
    title: "Problem Management",
    description: "Add, edit, and organize contest problems",
    href: "/admin/problems",
    icon: Code2,
    stats: "24 problems",
  },
];

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Manage contests, problems, and users from the admin panel.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {adminSections.map((section) => (
          <Link key={section.href} to={section.href}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {section.title}
                </CardTitle>
                <section.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{section.stats}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {section.description}
                </p>
                <div className="mt-4 flex items-center text-sm text-primary">
                  Manage
                  <ArrowRight className="ml-1 h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
