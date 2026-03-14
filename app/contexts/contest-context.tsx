import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import type { Contest } from "~/types/database";

interface ContestContextType {
  currentContest: Contest | null;
  availableContests: Contest[];
  isLoading: boolean;
  switchContest: (contestId: string) => void;
  setAvailableContests: (contests: Contest[]) => void;
  getLastViewedContest: () => string | null;
}

const ContestContext = createContext<ContestContextType | undefined>(undefined);

interface ContestProviderProps {
  children: ReactNode;
  initialContests?: Contest[];
  currentContestId?: string;
}

export function ContestProvider({
  children,
  initialContests = [],
  currentContestId
}: ContestProviderProps) {
  const [currentContest, setCurrentContest] = useState<Contest | null>(null);
  const [availableContests, setAvailableContests] = useState<Contest[]>(initialContests);
  const [isLoading, setIsLoading] = useState(false);

  // Get last viewed contest from localStorage
  const getLastViewedContest = (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("lastViewedContest");
  };

  // Save last viewed contest to localStorage
  const saveLastViewedContest = (contestId: string) => {
    if (typeof window === "undefined") return;
    localStorage.setItem("lastViewedContest", contestId);
  };

  // Switch to a different contest
  const switchContest = (contestId: string) => {
    const contest = availableContests.find(c => c.contestId === contestId);
    if (contest) {
      setCurrentContest(contest);
      saveLastViewedContest(contestId);
    }
  };

  // Set current contest based on URL or smart default
  useEffect(() => {
    if (availableContests.length === 0) return;

    let targetContest: Contest | null = null;

    // 1. First priority: URL-based contest (if provided)
    if (currentContestId) {
      targetContest = availableContests.find(c => c.contestId === currentContestId) || null;
    }

    // 2. Second priority: Last viewed contest (from localStorage)
    if (!targetContest) {
      const lastViewed = getLastViewedContest();
      if (lastViewed) {
        targetContest = availableContests.find(c => c.contestId === lastViewed) || null;
      }
    }

    // 3. Third priority: Most recently active contest
    if (!targetContest && availableContests.length > 0) {
      // Find most recently started contest
      targetContest = availableContests
        .filter(contest => contest.startTime !== "9999-12-31 23:59:59")
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0]
        || availableContests[0];
    }

    if (targetContest && targetContest.contestId !== currentContest?.contestId) {
      setCurrentContest(targetContest);
      saveLastViewedContest(targetContest.contestId);
    }
  }, [availableContests, currentContestId, currentContest?.contestId]);

  const contextValue: ContestContextType = {
    currentContest,
    availableContests,
    isLoading,
    switchContest,
    setAvailableContests,
    getLastViewedContest,
  };

  return (
    <ContestContext.Provider value={contextValue}>
      {children}
    </ContestContext.Provider>
  );
}

export function useContestContext(): ContestContextType {
  const context = useContext(ContestContext);
  if (context === undefined) {
    throw new Error("useContestContext must be used within a ContestProvider");
  }
  return context;
}

// Utility hook for getting contest-aware navigation
export function useContestNavigation() {
  const { currentContest } = useContestContext();

  const getContestPath = (path: string): string => {
    if (!currentContest) return path;
    return `/contests/${currentContest.contestId}${path}`;
  };

  const isInContestContext = (): boolean => {
    return currentContest !== null;
  };

  return {
    currentContest,
    getContestPath,
    isInContestContext,
  };
}