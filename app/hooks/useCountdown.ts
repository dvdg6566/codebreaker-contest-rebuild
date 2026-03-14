import { useState, useEffect } from "react";

/**
 * Hook for creating a countdown timer that ticks every second
 * @param initialSeconds Initial time remaining in seconds
 * @returns Current time remaining in seconds
 */
export function useCountdown(initialSeconds: number): number {
  const [timeRemaining, setTimeRemaining] = useState(initialSeconds);

  useEffect(() => {
    // Don't start countdown if already at 0
    if (initialSeconds <= 0) {
      setTimeRemaining(0);
      return;
    }

    // Set initial value
    setTimeRemaining(initialSeconds);

    // Create interval to countdown
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        const newTime = prev - 1;
        if (newTime <= 0) {
          clearInterval(interval);
          return 0;
        }
        return newTime;
      });
    }, 1000);

    // Cleanup interval on unmount or when initialSeconds changes
    return () => clearInterval(interval);
  }, [initialSeconds]);

  return timeRemaining;
}

/**
 * Format seconds into HH:MM:SS format
 */
export function formatTime(seconds: number): string {
  // Ensure we work with integers to avoid floating point display issues
  const totalSeconds = Math.floor(seconds);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}