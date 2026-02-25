import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useWebSocket, type WebSocketMessage } from "~/hooks/use-websocket";
import { useAuth } from "~/context/auth-context";

/**
 * Notification item stored in context
 */
export interface Notification {
  id: string;
  type: "announce" | "postClarification" | "answerClarification";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  /** Navigation path when clicked */
  href?: string;
}

/**
 * WebSocket context value
 */
interface WebSocketContextType {
  /** Whether the WebSocket is connected */
  isConnected: boolean;
  /** All notifications */
  notifications: Notification[];
  /** Count of unread notifications */
  unreadCount: number;
  /** Count of unread announcements */
  unreadAnnouncementsCount: number;
  /** Count of unread clarifications (for users: answered, for admins: new questions) */
  unreadClarificationsCount: number;
  /** Mark a notification as read */
  markAsRead: (id: string) => void;
  /** Mark all notifications as read */
  markAllAsRead: () => void;
  /** Clear all notifications */
  clearAll: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(
  undefined
);

interface WebSocketProviderProps {
  /** WebSocket endpoint URL (from env var API_GATEWAY_LINK) */
  wsEndpoint: string | null;
  children: ReactNode;
}

/**
 * Maximum number of notifications to keep
 */
const MAX_NOTIFICATIONS = 50;

/**
 * Generate notification content from WebSocket message
 */
function createNotificationFromMessage(
  message: WebSocketMessage,
  isAdmin: boolean
): Notification | null {
  const id = `${message.messageType}-${message.timestamp}-${Math.random().toString(36).slice(2)}`;
  const timestamp = message.timestamp;

  switch (message.messageType) {
    case "announce": {
      const { title, announcementId, priority } = message.payload as {
        title?: string;
        announcementId?: string;
        priority?: string;
      };
      return {
        id,
        type: "announce",
        title: priority === "high" ? "Important Announcement" : "New Announcement",
        message: title || "A new announcement has been posted",
        timestamp,
        read: false,
        href: "/announcements",
      };
    }

    case "postClarification": {
      // Only admins receive this
      if (!isAdmin) return null;
      const { askedBy, question } = message.payload as {
        askedBy?: string;
        question?: string;
      };
      return {
        id,
        type: "postClarification",
        title: "New Clarification Question",
        message: `${askedBy}: ${question?.slice(0, 100)}${(question?.length || 0) > 100 ? "..." : ""}`,
        timestamp,
        read: false,
        href: "/admin/clarifications",
      };
    }

    case "answerClarification": {
      // Only the target user receives this
      const { answer, problemName } = message.payload as {
        answer?: string;
        problemName?: string;
      };
      return {
        id,
        type: "answerClarification",
        title: "Clarification Answered",
        message: problemName
          ? `Your question about ${problemName} has been answered: ${answer}`
          : `Your question has been answered: ${answer}`,
        timestamp,
        read: false,
        href: "/clarifications",
      };
    }

    default:
      return null;
  }
}

export function WebSocketProvider({
  wsEndpoint,
  children,
}: WebSocketProviderProps) {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Handle incoming WebSocket messages
  const handleMessage = useCallback(
    (message: WebSocketMessage) => {
      const notification = createNotificationFromMessage(message, isAdmin);
      if (!notification) return;

      setNotifications((prev) => {
        // Add new notification at the beginning
        const updated = [notification, ...prev];
        // Keep only the most recent notifications
        return updated.slice(0, MAX_NOTIFICATIONS);
      });
    },
    [isAdmin]
  );

  // Connect to WebSocket only when authenticated
  const { isConnected } = useWebSocket({
    url: wsEndpoint,
    accountRole: user?.role || "user",
    username: user?.username || "",
    enabled: isAuthenticated && !!wsEndpoint,
    onMessage: handleMessage,
  });

  // Mark a single notification as read
  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Computed values
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const unreadAnnouncementsCount = useMemo(
    () => notifications.filter((n) => !n.read && n.type === "announce").length,
    [notifications]
  );

  const unreadClarificationsCount = useMemo(
    () =>
      notifications.filter(
        (n) =>
          !n.read &&
          (n.type === "postClarification" || n.type === "answerClarification")
      ).length,
    [notifications]
  );

  const value: WebSocketContextType = {
    isConnected,
    notifications,
    unreadCount,
    unreadAnnouncementsCount,
    unreadClarificationsCount,
    markAsRead,
    markAllAsRead,
    clearAll,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

/**
 * Hook to access WebSocket context
 */
export function useWebSocketContext(): WebSocketContextType {
  const context = useContext(WebSocketContext);

  if (context === undefined) {
    throw new Error(
      "useWebSocketContext must be used within a WebSocketProvider"
    );
  }

  return context;
}

/**
 * Hook to access just the notifications
 */
export function useNotifications() {
  const {
    notifications,
    unreadCount,
    unreadAnnouncementsCount,
    unreadClarificationsCount,
    markAsRead,
    markAllAsRead,
    clearAll,
  } = useWebSocketContext();

  return {
    notifications,
    unreadCount,
    unreadAnnouncementsCount,
    unreadClarificationsCount,
    markAsRead,
    markAllAsRead,
    clearAll,
  };
}
