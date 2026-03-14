import { ChevronDown, Clock, Users, Trophy } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useContestContext } from "~/contexts/contest-context";
import { parseDateTime, isDateTimeNotSet } from "~/types/database";
import { useNavigate } from "react-router";

interface ContestSelectorProps {
  variant?: "sidebar" | "header";
  showTimeRemaining?: boolean;
}

export function ContestSelector({
  variant = "sidebar",
  showTimeRemaining = false
}: ContestSelectorProps) {
  const { currentContest, availableContests, switchContest } = useContestContext();
  const navigate = useNavigate();

  // Calculate time remaining for current contest
  const getTimeRemaining = (contest: typeof currentContest) => {
    if (!contest || isDateTimeNotSet(contest.endTime)) return null;

    const endTime = parseDateTime(contest.endTime);
    const now = new Date();
    const remaining = Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000));

    if (remaining === 0) return null;

    const h = Math.floor(remaining / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const handleContestSwitch = (contestId: string) => {
    switchContest(contestId);
    // Navigate to the contest's main page
    navigate(`/contests/${contestId}`);
  };

  const timeRemaining = showTimeRemaining && currentContest ? getTimeRemaining(currentContest) : null;

  if (availableContests.length === 0) {
    return (
      <div className="px-3 py-2 text-center">
        <p className="text-sm text-muted-foreground">No active contests</p>
        <Button variant="link" size="sm" onClick={() => navigate("/contests")}>
          Browse Contests
        </Button>
      </div>
    );
  }

  if (availableContests.length === 1 && currentContest) {
    // Single contest - show name without dropdown
    return (
      <div className="px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {currentContest.contestName}
            </p>
            {timeRemaining && (
              <p className="text-xs text-emerald-600">
                <Clock className="w-3 h-3 inline mr-1" />
                {timeRemaining} left
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Multiple contests - show dropdown selector
  return (
    <div className="px-3 py-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between h-auto p-2 text-left"
          >
            <div className="min-w-0 flex-1">
              {currentContest ? (
                <>
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {currentContest.contestName}
                  </p>
                  {timeRemaining && (
                    <p className="text-xs text-emerald-600">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {timeRemaining} left
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Choose Contest</p>
              )}
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground ml-2 shrink-0" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-64" align="start">
          <DropdownMenuLabel>Switch Contest</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {availableContests.map((contest) => {
            const isActive = currentContest?.contestId === contest.contestId;
            const contestTimeRemaining = getTimeRemaining(contest);

            return (
              <DropdownMenuItem
                key={contest.contestId}
                onClick={() => handleContestSwitch(contest.contestId)}
                className={isActive ? "bg-emerald-50" : ""}
              >
                <div className="flex items-start gap-3 w-full">
                  <div className="flex-shrink-0 mt-1">
                    {isActive ? (
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    ) : (
                      <div className="w-2 h-2 rounded-full border border-gray-300" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {contest.contestName}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Users className="w-3 h-3" />
                      <span>{contest.problems?.length || 0} problems</span>
                      {contestTimeRemaining && (
                        <>
                          <Clock className="w-3 h-3 ml-1" />
                          <span className="text-emerald-600">{contestTimeRemaining}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </DropdownMenuItem>
            );
          })}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate("/contests")}>
            <Trophy className="w-4 h-4 mr-2" />
            View All Contests
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}