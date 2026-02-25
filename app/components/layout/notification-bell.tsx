import { useNavigate } from "react-router";
import { Bell, Megaphone, MessageSquare, CheckCircle, X, Check } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "~/components/ui/dropdown-menu";
import {
  useNotifications,
  useWebSocketContext,
  type Notification,
} from "~/context/websocket-context";

/**
 * Get icon and colors for notification type
 */
function getNotificationStyles(type: Notification["type"]) {
  switch (type) {
    case "announce":
      return {
        bgColor: "bg-emerald-100",
        iconColor: "text-emerald-600",
        Icon: Megaphone,
      };
    case "postClarification":
      return {
        bgColor: "bg-amber-100",
        iconColor: "text-amber-600",
        Icon: MessageSquare,
      };
    case "answerClarification":
      return {
        bgColor: "bg-blue-100",
        iconColor: "text-blue-600",
        Icon: CheckCircle,
      };
    default:
      return {
        bgColor: "bg-gray-100",
        iconColor: "text-gray-600",
        Icon: Bell,
      };
  }
}

/**
 * Format timestamp to relative time
 */
function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onClick: () => void;
}

function NotificationItem({
  notification,
  onMarkAsRead,
  onClick,
}: NotificationItemProps) {
  const styles = getNotificationStyles(notification.type);
  const { Icon } = styles;

  return (
    <DropdownMenuItem
      className={cn(
        "flex items-start gap-3 p-3 cursor-pointer",
        !notification.read && "bg-muted/50"
      )}
      onClick={onClick}
    >
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
          styles.bgColor
        )}
      >
        <Icon className={cn("h-4 w-4", styles.iconColor)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              "text-sm truncate",
              !notification.read ? "font-medium" : "text-muted-foreground"
            )}
          >
            {notification.title}
          </p>
          {!notification.read && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMarkAsRead(notification.id);
              }}
              className="shrink-0 rounded p-0.5 hover:bg-gray-200 transition-colors"
              title="Mark as read"
            >
              <Check className="h-3 w-3 text-gray-500" />
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatRelativeTime(notification.timestamp)}
        </p>
      </div>
    </DropdownMenuItem>
  );
}

/**
 * Notification bell icon with unread count badge and dropdown
 */
export function NotificationBell() {
  const { isConnected } = useWebSocketContext();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } =
    useNotifications();
  const navigate = useNavigate();

  // Show only the 10 most recent notifications
  const displayedNotifications = notifications.slice(0, 10);

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.href) {
      navigate(notification.href);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          {/* Connection status indicator */}
          <span
            className={cn(
              "absolute bottom-0 right-0 h-2 w-2 rounded-full border border-white",
              isConnected ? "bg-emerald-500" : "bg-gray-400"
            )}
            title={isConnected ? "Connected" : "Disconnected"}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-medium">Notifications</span>
          {notifications.length > 0 && (
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={markAllAsRead}
                >
                  Mark all read
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2 text-muted-foreground"
                onClick={clearAll}
              >
                Clear
              </Button>
            </div>
          )}
        </div>

        {/* Notifications list */}
        {displayedNotifications.length > 0 ? (
          <div className="max-h-80 overflow-y-auto">
            {displayedNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={markAsRead}
                onClick={() => handleNotificationClick(notification)}
              />
            ))}
          </div>
        ) : (
          <div className="p-6 text-center">
            <Bell className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No notifications</p>
          </div>
        )}

        {/* Footer */}
        {notifications.length > 10 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2 text-center">
              <span className="text-xs text-muted-foreground">
                Showing 10 of {notifications.length} notifications
              </span>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
