import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { X, Megaphone, MessageSquare, CheckCircle } from "lucide-react";
import { cn } from "~/lib/utils";
import { useNotifications, type Notification } from "~/context/websocket-context";

/**
 * Auto-dismiss duration in milliseconds
 */
const AUTO_DISMISS_DURATION = 5000;

/**
 * Get toast styling based on notification type
 */
function getToastStyles(type: Notification["type"]) {
  switch (type) {
    case "announce":
      return {
        borderColor: "border-l-emerald-500",
        bgColor: "bg-emerald-50",
        iconBg: "bg-emerald-100",
        iconColor: "text-emerald-600",
        Icon: Megaphone,
      };
    case "postClarification":
      return {
        borderColor: "border-l-amber-500",
        bgColor: "bg-amber-50",
        iconBg: "bg-amber-100",
        iconColor: "text-amber-600",
        Icon: MessageSquare,
      };
    case "answerClarification":
      return {
        borderColor: "border-l-blue-500",
        bgColor: "bg-blue-50",
        iconBg: "bg-blue-100",
        iconColor: "text-blue-600",
        Icon: CheckCircle,
      };
    default:
      return {
        borderColor: "border-l-gray-500",
        bgColor: "bg-gray-50",
        iconBg: "bg-gray-100",
        iconColor: "text-gray-600",
        Icon: Megaphone,
      };
  }
}

interface ToastItemProps {
  notification: Notification;
  onDismiss: (id: string) => void;
  onClick: (notification: Notification) => void;
}

function ToastItem({ notification, onDismiss, onClick }: ToastItemProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const styles = getToastStyles(notification.type);
  const { Icon } = styles;

  // Animate in on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // Auto-dismiss after duration
  useEffect(() => {
    const timer = setTimeout(() => {
      handleDismiss();
    }, AUTO_DISMISS_DURATION);

    return () => clearTimeout(timer);
  }, [notification.id]);

  const handleDismiss = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onDismiss(notification.id);
    }, 300);
  };

  const handleClick = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onClick(notification);
    }, 300);
  };

  return (
    <div
      className={cn(
        "relative flex items-start gap-3 w-80 rounded-lg border border-l-4 bg-white p-4 shadow-lg cursor-pointer",
        "transition-all duration-300 ease-out",
        styles.borderColor,
        isVisible && !isLeaving
          ? "translate-x-0 opacity-100"
          : "translate-x-full opacity-0"
      )}
      onClick={handleClick}
    >
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
          styles.iconBg
        )}
      >
        <Icon className={cn("h-4 w-4", styles.iconColor)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{notification.title}</p>
        <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">
          {notification.message}
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleDismiss();
        }}
        className="shrink-0 rounded p-1 hover:bg-gray-100 transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4 text-gray-400" />
      </button>
    </div>
  );
}

/**
 * Toast container that displays new notifications in the bottom-right corner
 */
export function NotificationToast() {
  const { notifications, markAsRead } = useNotifications();
  const navigate = useNavigate();
  const [displayedIds, setDisplayedIds] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Notification[]>([]);

  // Track new notifications and add them to toasts
  useEffect(() => {
    const unreadNotifications = notifications.filter(
      (n) => !n.read && !displayedIds.has(n.id)
    );

    if (unreadNotifications.length > 0) {
      // Add new notifications to toasts
      setToasts((prev) => [...unreadNotifications, ...prev].slice(0, 3));
      // Mark these IDs as displayed so we don't show them again
      setDisplayedIds((prev) => {
        const updated = new Set(prev);
        unreadNotifications.forEach((n) => updated.add(n.id));
        return updated;
      });
    }
  }, [notifications, displayedIds]);

  const handleDismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    markAsRead(id);
  };

  const handleClick = (notification: Notification) => {
    setToasts((prev) => prev.filter((t) => t.id !== notification.id));
    markAsRead(notification.id);
    if (notification.href) {
      navigate(notification.href);
    }
  };

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          notification={toast}
          onDismiss={handleDismiss}
          onClick={handleClick}
        />
      ))}
    </div>
  );
}
