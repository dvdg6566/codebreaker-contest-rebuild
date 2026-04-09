/**
 * Verdict Icon Utilities
 *
 * Centralized logic for rendering verdict icons across the application.
 */

import {
  CheckCircle2,
  XCircle,
  Timer,
  HardDrive,
  AlertCircle,
  Code2,
} from "lucide-react";

/**
 * Returns the appropriate icon component for a given verdict
 */
export function getVerdictIcon(verdict: string) {
  switch (verdict) {
    case "AC":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "WA":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "TLE":
      return <Timer className="h-4 w-4 text-orange-500" />;
    case "MLE":
      return <HardDrive className="h-4 w-4 text-purple-500" />;
    case "RTE":
      return <AlertCircle className="h-4 w-4 text-rose-500" />;
    case "PS":
      return <AlertCircle className="h-4 w-4 text-amber-500" />;
    case "CE":
      return <Code2 className="h-4 w-4 text-gray-500" />;
    default:
      return <AlertCircle className="h-4 w-4 text-gray-400" />;
  }
}