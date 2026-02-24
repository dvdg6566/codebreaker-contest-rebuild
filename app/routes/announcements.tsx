import type { Route } from "./+types/announcements";
import {
  Megaphone,
  Clock,
  AlertTriangle,
  Info,
  Bell,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Announcements - Codebreaker Contest" },
    { name: "description", content: "View contest announcements" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { requireAuth } = await import("~/lib/auth.server");
  const { listAnnouncements } = await import("~/lib/db/announcements.server");

  await requireAuth(request);

  const dbAnnouncements = await listAnnouncements();

  // Map DB fields to component format
  const announcements = dbAnnouncements.map((a) => ({
    id: a.announcementId,
    title: a.title,
    text: a.text,
    time: a.announcementTime,
    type: a.priority === "high" ? "important" : a.priority === "normal" ? "update" : "info",
    author: a.author || "admin",
  }));

  return { announcements };
}

const typeConfig = {
  important: {
    icon: AlertTriangle,
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-l-red-500",
    badge: "destructive",
  },
  update: {
    icon: Bell,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-l-amber-500",
    badge: "warning",
  },
  info: {
    icon: Info,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-l-blue-500",
    badge: "secondary",
  },
};

export default function Announcements({ loaderData }: Route.ComponentProps) {
  const { announcements } = loaderData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
        <p className="text-muted-foreground">
          Official contest announcements and updates
        </p>
      </div>

      {/* Announcements Count */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
              <Megaphone className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Announcements</p>
              <p className="text-2xl font-bold">{announcements.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Announcements List */}
      <div className="space-y-4">
        {announcements.map((announcement) => {
          const config = typeConfig[announcement.type as keyof typeof typeConfig];
          const Icon = config.icon;

          return (
            <Card
              key={announcement.id}
              className={`border-0 shadow-sm border-l-4 ${config.borderColor}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-2 ${config.bgColor}`}>
                      <Icon className={`h-5 w-5 ${config.color}`} />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        {announcement.title}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={config.badge as any} className="text-xs">
                          {announcement.type.charAt(0).toUpperCase() +
                            announcement.type.slice(1)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {announcement.time}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-line">{announcement.text}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {announcements.length === 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center">
            <Megaphone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No Announcements Yet</h3>
            <p className="text-sm text-muted-foreground">
              There are no announcements at this time. Check back later for
              updates from the contest organizers.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
