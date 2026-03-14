import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useWebSocket, type WebSocketMessage } from "~/hooks/use-websocket";
import { useAuth } from "~/context/auth-context";

/**
 * Notification item stored in context
 */
export interface Notification {
  id: string;
  type: "announce" | "postClarification" | "answerClarification" | "endContest";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  /** Navigation path when clicked */
  href?: string;
  /** Contest ID for contest-specific notifications */
  contestId?: string;
}

/**
 * Callback for contest end events
 */
export type ContestEndCallback = (contestId: string, username?: string) => void;

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
  /** Current contest ID for scoped notifications */
  contestId: string;
  /** Update current contest ID */
  setContestId: (contestId: string) => void;
  /** Register callback for contest end events */
  onContestEnd: (callback: ContestEndCallback) => () => void;
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
  isAdmin: boolean,
  currentContestId: string
): Notification | null {
  const id = `${message.notificationType}-${message.timestamp || Date.now()}-${Math.random().toString(36).slice(2)}`;
  const timestamp = message.timestamp || new Date().toISOString();

  switch (message.notificationType) {
    case "announce": {
      return {
        id,
        type: "announce",
        title: "New Announcement",
        message: "A new announcement has been posted",
        timestamp,
        read: false,
        href: "/announcements",
      };
    }

    case "postClarification": {
      // Only admins receive this
      if (!isAdmin) return null;
      return {
        id,
        type: "postClarification",
        title: "New Clarification Question",
        message: "A new clarification question has been posted",
        timestamp,
        read: false,
        href: "/admin/clarifications",
      };
    }

    case "answerClarification": {
      return {
        id,
        type: "answerClarification",
        title: "Clarification Answered",
        message: "Your question has been answered",
        timestamp,
        read: false,
        href: "/clarifications",
      };
    }

    case "endContest": {
      // Only show notification if it's for the current contest
      if (message.contestId && message.contestId !== currentContestId) {
        return null;
      }
      return {
        id,
        type: "endContest",
        title: "Contest Ended",
        message: message.username
          ? "Your contest time has ended"
          : "The contest has ended",
        timestamp,
        read: false,
        contestId: message.contestId,
        href: message.contestId ? `/contests/${message.contestId}/scoreboard` : undefined,
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
  const [contestId, setContestIdState] = useState<string>("");
  const contestEndCallbacksRef = useRef<Set<ContestEndCallback>>(new Set());

  // Handle incoming WebSocket messages
  const handleMessage = useCallback(
    (message: WebSocketMessage) => {
      // Handle contest end separately - call registered callbacks
      if (message.notificationType === "endContest" && message.contestId) {
        contestEndCallbacksRef.current.forEach((callback) => {
          callback(message.contestId!, message.username);
        });
      }

      const notification = createNotificationFromMessage(message, isAdmin, contestId);
      if (!notification) return;

      setNotifications((prev) => {
        // Add new notification at the beginning
        const updated = [notification, ...prev];
        // Keep only the most recent notifications
        return updated.slice(0, MAX_NOTIFICATIONS);
      });
    },
    [isAdmin, contestId]
  );

  // Connect to WebSocket only when authenticated
  const { isConnected, sendIdentity } = useWebSocket({
    url: wsEndpoint,
    accountRole: user?.role || "user",
    username: user?.username || "",
    contestId,
    enabled: isAuthenticated && !!wsEndpoint,
    onMessage: handleMessage,
  });

  // Update contestId and send to server
  const setContestId = useCallback((newContestId: string) => {
    setContestIdState(newContestId);
    sendIdentity(newContestId);
  }, [sendIdentity]);

  // Register contest end callback
  const onContestEnd = useCallback((callback: ContestEndCallback) => {
    contestEndCallbacksRef.current.add(callback);
    return () => {
      contestEndCallbacksRef.current.delete(callback);
    };
  }, []);

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
    contestId,
    setContestId,
    onContestEnd,
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
