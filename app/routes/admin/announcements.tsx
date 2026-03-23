import type { Route } from "./+types/announcements";
import { useState } from "react";
import { data, useSubmit } from "react-router";
import {
  Megaphone,
  Plus,
  Clock,
  AlertTriangle,
  Info,
  Bell,
  Edit,
  Trash2,
  Send,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
export function meta({}: Route.MetaArgs) {
  return [
    { title: "Manage Announcements - Admin" },
    { name: "description", content: "Create and manage contest announcements" },
  ];
}

// Map priority to type for display
function priorityToType(priority?: "low" | "normal" | "high"): "info" | "update" | "important" {
  if (priority === "high") return "important";
  if (priority === "low") return "info";
  return "update";
}

function typeToPriority(type: string): "low" | "normal" | "high" {
  if (type === "important") return "high";
  if (type === "info") return "low";
  return "normal";
}

export async function loader({ request }: Route.LoaderArgs) {
  const { requireAdmin } = await import("~/lib/auth.server");
  const { listAnnouncements } = await import("~/lib/db/announcements.server");
  const { listContests } = await import("~/lib/db/contests.server");

  await requireAdmin(request);

  const [dbAnnouncements, contests] = await Promise.all([
    listAnnouncements(),
    listContests(),
  ]);

  // Map database announcements to display format
  const announcements = dbAnnouncements.map((a) => ({
    id: a.announcementId,
    title: a.title,
    text: a.text,
    time: a.announcementTime,
    type: priorityToType(a.priority),
    author: a.author || "admin",
    contestId: a.contestId,
    contestName: contests.find(c => c.contestId === a.contestId)?.contestName || a.contestId,
  }));

  return { announcements, contests };
}

export async function action({ request }: Route.ActionArgs) {
  const { requireAdmin } = await import("~/lib/auth.server");
  const { createAnnouncement, updateAnnouncement, deleteAnnouncement } = await import("~/lib/db/announcements.server");
  const { announce } = await import("~/lib/websocket-broadcast.server");

  await requireAdmin(request);

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "create") {
    const title = formData.get("title") as string;
    const text = formData.get("text") as string;
    const type = formData.get("type") as string;
    const contestId = formData.get("contestId") as string;

    if (!title || !text || !contestId) {
      return data({ error: "Title, content, and contest are required" }, { status: 400 });
    }

    const priority = typeToPriority(type);
    const announcement = await createAnnouncement(title, text, contestId, "admin", priority);

    // Broadcast notification to all connected users
    await announce();

    return { success: true };
  }

  if (intent === "update") {
    const id = formData.get("id") as string;
    const title = formData.get("title") as string;
    const text = formData.get("text") as string;
    const type = formData.get("type") as string;

    await updateAnnouncement(id, { title, text, priority: typeToPriority(type) });
    return { success: true };
  }

  if (intent === "delete") {
    const id = formData.get("id") as string;
    await deleteAnnouncement(id);
    return { success: true };
  }

  return data({ error: "Unknown action" }, { status: 400 });
}

const typeConfig = {
  important: {
    icon: AlertTriangle,
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-l-red-500",
    badge: "destructive",
    label: "Important",
  },
  update: {
    icon: Bell,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-l-amber-500",
    badge: "warning",
    label: "Update",
  },
  info: {
    icon: Info,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-l-blue-500",
    badge: "secondary",
    label: "Info",
  },
};

export default function AdminAnnouncements({ loaderData }: Route.ComponentProps) {
  const { announcements, contests } = loaderData;
  const submit = useSubmit();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: "", text: "", type: "info", contestId: "" });
  const [editAnnouncement, setEditAnnouncement] = useState({ title: "", text: "", type: "info" });

  const handleCreate = () => {
    const formData = new FormData();
    formData.set("intent", "create");
    formData.set("title", newAnnouncement.title);
    formData.set("text", newAnnouncement.text);
    formData.set("type", newAnnouncement.type);
    formData.set("contestId", newAnnouncement.contestId);
    submit(formData, { method: "POST" });
    setDialogOpen(false);
    setNewAnnouncement({ title: "", text: "", type: "info", contestId: "" });
  };

  const handleUpdate = () => {
    if (!editDialogOpen) return;
    const formData = new FormData();
    formData.set("intent", "update");
    formData.set("id", editDialogOpen);
    formData.set("title", editAnnouncement.title);
    formData.set("text", editAnnouncement.text);
    formData.set("type", editAnnouncement.type);
    submit(formData, { method: "POST" });
    setEditDialogOpen(null);
  };

  const handleDelete = () => {
    if (!deleteDialogOpen) return;
    const formData = new FormData();
    formData.set("intent", "delete");
    formData.set("id", deleteDialogOpen);
    submit(formData, { method: "POST" });
    setDeleteDialogOpen(null);
  };

  const openEditDialog = (announcement: typeof announcements[0]) => {
    setEditAnnouncement({
      title: announcement.title,
      text: announcement.text,
      type: announcement.type,
    });
    setEditDialogOpen(announcement.id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
          <p className="text-muted-foreground">
            Create and manage contest announcements
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-2" />
              New Announcement
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create Announcement</DialogTitle>
              <DialogDescription>
                Create a new announcement that will be visible to all contestants.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="contest">Contest</Label>
                <Select
                  value={newAnnouncement.contestId}
                  onValueChange={(value) => setNewAnnouncement({ ...newAnnouncement, contestId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select contest" />
                  </SelectTrigger>
                  <SelectContent>
                    {contests.map((contest) => (
                      <SelectItem key={contest.contestId} value={contest.contestId}>
                        {contest.contestName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="Enter announcement title..."
                    value={newAnnouncement.title}
                    onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={newAnnouncement.type}
                    onValueChange={(value) => setNewAnnouncement({ ...newAnnouncement, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">
                        <div className="flex items-center gap-2">
                          <Info className="h-4 w-4 text-blue-600" />
                          Info
                        </div>
                      </SelectItem>
                      <SelectItem value="update">
                        <div className="flex items-center gap-2">
                          <Bell className="h-4 w-4 text-amber-600" />
                          Update
                        </div>
                      </SelectItem>
                      <SelectItem value="important">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                          Important
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  placeholder="Enter announcement content..."
                  rows={6}
                  value={newAnnouncement.text}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, text: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={handleCreate}
              >
                <Send className="h-4 w-4 mr-2" />
                Post Announcement
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                <Megaphone className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{announcements.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Important</p>
                <p className="text-2xl font-bold">
                  {announcements.filter((a) => a.type === "important").length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <Bell className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Updates</p>
                <p className="text-2xl font-bold">
                  {announcements.filter((a) => a.type === "update").length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Info className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Info</p>
                <p className="text-2xl font-bold">
                  {announcements.filter((a) => a.type === "info").length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
                          {config.label}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {announcement.contestName}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          by {announcement.author}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mr-2">
                      <Clock className="h-4 w-4" />
                      {announcement.time}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => openEditDialog(announcement)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteDialogOpen(announcement.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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

      {/* Edit Dialog */}
      <Dialog
        open={editDialogOpen !== null}
        onOpenChange={(open) => !open && setEditDialogOpen(null)}
      >
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Announcement</DialogTitle>
            <DialogDescription>
              Update the announcement details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={editAnnouncement.title}
                  onChange={(e) => setEditAnnouncement({ ...editAnnouncement, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-type">Type</Label>
                <Select
                  value={editAnnouncement.type}
                  onValueChange={(value) => setEditAnnouncement({ ...editAnnouncement, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="update">Update</SelectItem>
                    <SelectItem value="important">Important</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-content">Content</Label>
              <Textarea
                id="edit-content"
                value={editAnnouncement.text}
                onChange={(e) => setEditAnnouncement({ ...editAnnouncement, text: e.target.value })}
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(null)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleUpdate}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteDialogOpen !== null}
        onOpenChange={(open) => !open && setDeleteDialogOpen(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Announcement</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this announcement? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Empty State */}
      {announcements.length === 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center">
            <Megaphone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No Announcements Yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first announcement to notify contestants.
            </p>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Announcement
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
