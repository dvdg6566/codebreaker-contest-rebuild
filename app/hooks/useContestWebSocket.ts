import { useEffect } from "react";
import { useWebSocketContext } from "~/context/websocket-context";

/**
 * Hook to register the current contest with WebSocket context.
 * Call this in any contest route to enable contest-specific notifications.
 */
export function useContestWebSocket(contestId: string) {
  const { setContestId } = useWebSocketContext();

  useEffect(() => {
    setContestId(contestId);
    return () => setContestId("");
  }, [contestId, setContestId]);
}
