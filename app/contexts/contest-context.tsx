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
  // Smart initial contest selection to prevent loading flash
  const getInitialContest = (): Contest | null => {
    if (initialContests.length === 0) return null;

    // 1. URL-based contest
    if (currentContestId) {
      return initialContests.find(c => c.contestId === currentContestId) || null;
    }

    // 2. Single contest - auto-select it
    if (initialContests.length === 1) {
      return initialContests[0];
    }

    // 3. Multiple contests - try localStorage
    if (typeof window !== "undefined") {
      const lastViewed = localStorage.getItem("lastViewedContest");
      if (lastViewed) {
        const contest = initialContests.find(c => c.contestId === lastViewed);
        if (contest) return contest;
      }
    }

    // 4. Fallback to most recent contest
    const recentContest = initialContests
      .filter(contest => contest.startTime !== "9999-12-31 23:59:59")
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0];

    return recentContest || initialContests[0];
  };

  const [currentContest, setCurrentContest] = useState<Contest | null>(getInitialContest());
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

  // Update contest when contests change or URL changes
  useEffect(() => {
    if (availableContests.length === 0) {
      setCurrentContest(null);
      return;
    }

    // If URL-based contest changes, update accordingly
    if (currentContestId) {
      const urlContest = availableContests.find(c => c.contestId === currentContestId);
      if (urlContest && urlContest.contestId !== currentContest?.contestId) {
        setCurrentContest(urlContest);
        saveLastViewedContest(urlContest.contestId);
      }
    }

    // Ensure current contest is still in available contests
    if (currentContest && !availableContests.find(c => c.contestId === currentContest.contestId)) {
      const newContest = availableContests.length > 0 ? availableContests[0] : null;
      setCurrentContest(newContest);
      if (newContest) {
        saveLastViewedContest(newContest.contestId);
      }
    }
  }, [availableContests, currentContestId]);

  // Save to localStorage when contest changes
  useEffect(() => {
    if (currentContest) {
      saveLastViewedContest(currentContest.contestId);
    }
  }, [currentContest?.contestId]);

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