import { Link, useLocation, useFetcher, useParams } from "react-router";
import {
  Home,
  Users,
  Trophy,
  FileText,
  Send,
  BarChart3,
  Megaphone,
  MessageSquare,
  Settings,
  ChevronDown,
  Shield,
  Code2,
  LogOut,
  FileCode,
  Play,
  Clock,
} from "lucide-react";
import { useAuth } from "~/context/auth-context";
import { useNotifications } from "~/context/websocket-context";
import { useContestNavigation } from "~/contexts/contest-context";
import { ContestSelector } from "~/components/contest/contest-selector";
import { getInitials } from "~/lib/utils";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "~/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

const mainNavItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
  },
];

const contestNavItems = [
  {
    title: "Problems",
    path: "problems",
    icon: FileText,
  },
  {
    title: "Submissions",
    path: "submissions",
    icon: Send,
  },
  {
    title: "Scoreboard",
    path: "scoreboard",
    icon: BarChart3,
  },
  {
    title: "Announcements",
    path: "announcements",
    icon: Megaphone,
  },
  {
    title: "Clarifications",
    path: "clarifications",
    icon: MessageSquare,
  },
];

const adminNavItems = [
  {
    title: "Users",
    url: "/admin/users",
    icon: Users,
  },
  {
    title: "Problems",
    url: "/admin/problems",
    icon: Code2,
  },
  {
    title: "Submissions",
    url: "/admin/submissions",
    icon: FileCode,
  },
  {
    title: "Contests",
    url: "/admin/contests",
    icon: Trophy,
  },
  {
    title: "Announcements",
    url: "/admin/announcements",
    icon: Megaphone,
  },
  {
    title: "Clarifications",
    url: "/admin/clarifications",
    icon: MessageSquare,
  },
];

export function AppSidebar() {
  const location = useLocation();
  const pathname = location.pathname;
  const { user, isAdmin } = useAuth();
  const fetcher = useFetcher();
  const { unreadAnnouncementsCount, unreadClarificationsCount } = useNotifications();

  const isActive = (url: string) => {
    if (url === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(url);
  };

  const isAdminSection = pathname.startsWith("/admin");


  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-emerald-500 text-white">
                  <Trophy className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Codebreaker</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Contest Manager
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <ContestSection
          pathname={pathname}
          unreadAnnouncementsCount={unreadAnnouncementsCount}
          unreadClarificationsCount={unreadClarificationsCount}
        />

        {isAdmin && (
          <SidebarGroup>
            <Collapsible defaultOpen={isAdminSection} className="group/collapsible">
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center">
                  <Shield className="mr-2 size-4" />
                  Admin
                  <ChevronDown className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {adminNavItems.map((item) => {
                      // Determine badge count for admin items
                      let badgeCount = 0;
                      if (item.url === "/admin/clarifications") {
                        badgeCount = unreadClarificationsCount;
                      }

                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive(item.url)}
                            tooltip={item.title}
                          >
                            <Link to={item.url}>
                              <item.icon />
                              <span>{item.title}</span>
                              {badgeCount > 0 && (
                                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                                  {badgeCount > 9 ? "9+" : badgeCount}
                                </span>
                              )}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-violet-500 text-white">
                      {user ? getInitials(user.username) : "??"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {user?.username ?? "Guest"}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user?.role ?? "Unknown"}
                    </span>
                  </div>
                  <ChevronDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem asChild>
                  <Link to={`/profile/${user?.username}`}>
                    <Users className="mr-2 size-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings">
                    <Settings className="mr-2 size-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive cursor-pointer"
                  onClick={() => {
                    fetcher.submit(null, {
                      method: "post",
                      action: "/api/auth/logout",
                    });
                  }}
                >
                  <LogOut className="mr-2 size-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

// Contest Section Component for Multi-Contest Support
function ContestSection({
  pathname,
  unreadAnnouncementsCount,
  unreadClarificationsCount,
}: {
  pathname: string;
  unreadAnnouncementsCount: number;
  unreadClarificationsCount: number;
}) {
  const params = useParams();
  const contestId = params.contestId;
  const { currentContest, getContestPath, isInContestContext } = useContestNavigation();

  const isActive = (url: string) => {
    if (url === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(url);
  };

  const getContestUrl = (path: string) => {
    if (currentContest) {
      return `/contests/${currentContest.contestId}/${path}`;
    }
    return `/${path}`; // Fallback to legacy routes
  };

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="flex items-center justify-between">
        <span>Contest</span>
        {currentContest && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Active</span>
          </div>
        )}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        {/* Contest Selector */}
        <ContestSelector variant="sidebar" showTimeRemaining />

        <SidebarMenu>
          {/* My Contests Link */}
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive("/contests")}
              tooltip="My Contests"
            >
              <Link to="/contests">
                <Trophy />
                <span>My Contests</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Contest-specific navigation (show when contest is selected) */}
          {currentContest && (
            <>
              {contestNavItems.map((item) => {
                const fullUrl = getContestUrl(item.path);
                let badgeCount = 0;

                if (item.path === "announcements") {
                  badgeCount = unreadAnnouncementsCount;
                } else if (item.path === "clarifications") {
                  badgeCount = unreadClarificationsCount;
                }

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(fullUrl)}
                      tooltip={item.title}
                    >
                      <Link to={fullUrl}>
                        <item.icon />
                        <span>{item.title}</span>
                        {badgeCount > 0 && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                            {badgeCount > 9 ? "9+" : badgeCount}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </>
          )}

          {/* Show global navigation when no contest is selected */}
          {!currentContest && (
            <>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/submissions")}
                  tooltip="All Submissions"
                >
                  <Link to="/submissions">
                    <Send />
                    <span>All Submissions</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/announcements")}
                  tooltip="Announcements"
                >
                  <Link to="/announcements">
                    <Megaphone />
                    <span>Announcements</span>
                    {unreadAnnouncementsCount > 0 && (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                        {unreadAnnouncementsCount > 9 ? "9+" : unreadAnnouncementsCount}
                      </span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/clarifications")}
                  tooltip="Clarifications"
                >
                  <Link to="/clarifications">
                    <MessageSquare />
                    <span>Clarifications</span>
                    {unreadClarificationsCount > 0 && (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                        {unreadClarificationsCount > 9 ? "9+" : unreadClarificationsCount}
                      </span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
