import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils";

/**
 * Verdict configuration following competitive programming conventions:
 * - Green: Success (AC)
 * - Red: Wrong/Runtime errors (WA, RTE)
 * - Yellow/Orange: Resource limits exceeded (TLE, MLE, OLE)
 * - Gray: Compile/System errors (CE, SE)
 * - Amber: Partial score (PS)
 * - Blue: Pending/In queue
 */

export type VerdictType =
  | "AC"   // Accepted
  | "WA"   // Wrong Answer
  | "TLE"  // Time Limit Exceeded
  | "MLE"  // Memory Limit Exceeded
  | "OLE"  // Output Limit Exceeded
  | "RTE"  // Runtime Error
  | "CE"   // Compile Error
  | "PE"   // Presentation Error
  | "PS"   // Partial Score
  | "SE"   // System/Submission Error
  | "RF"   // Restricted Function
  | "IE"   // Internal Error
  | "pending"
  | "judging"
  | "none"
  | "N/A"; // Not available (skipped testcase)

interface VerdictConfig {
  label: string;
  fullName: string;
}

const VERDICT_CONFIG: Record<VerdictType, VerdictConfig> = {
  AC:      { label: "AC",  fullName: "Accepted" },
  WA:      { label: "WA",  fullName: "Wrong Answer" },
  TLE:     { label: "TLE", fullName: "Time Limit Exceeded" },
  MLE:     { label: "MLE", fullName: "Memory Limit Exceeded" },
  OLE:     { label: "OLE", fullName: "Output Limit Exceeded" },
  RTE:     { label: "RTE", fullName: "Runtime Error" },
  CE:      { label: "CE",  fullName: "Compile Error" },
  PE:      { label: "PE",  fullName: "Presentation Error" },
  PS:      { label: "PS",  fullName: "Partial Score" },
  SE:      { label: "SE",  fullName: "System Error" },
  RF:      { label: "RF",  fullName: "Restricted Function" },
  IE:      { label: "IE",  fullName: "Internal Error" },
  pending: { label: "...", fullName: "Pending" },
  judging: { label: "...", fullName: "Judging" },
  none:    { label: "-",   fullName: "Not Attempted" },
  "N/A":   { label: "N/A", fullName: "Not Available" },
};

const scoreBadgeVariants = cva(
  "inline-flex items-center justify-center rounded-md px-2 py-1 text-xs font-semibold min-w-[2.5rem]",
  {
    variants: {
      verdict: {
        // Success - Green
        AC: "bg-green-500 text-white",

        // Wrong - Red
        WA: "bg-red-500 text-white",
        RTE: "bg-red-400 text-white",

        // Limits - Orange/Yellow
        TLE: "bg-yellow-500 text-yellow-950",
        MLE: "bg-orange-500 text-white",
        OLE: "bg-orange-400 text-white",

        // Partial - Amber
        PS: "bg-amber-400 text-amber-950",
        PE: "bg-amber-300 text-amber-900",

        // Errors - Gray
        CE: "bg-slate-700 text-white",
        SE: "bg-gray-500 text-white",
        RF: "bg-gray-500 text-white",
        IE: "bg-gray-500 text-white",

        // Pending - Blue
        pending: "bg-blue-400 text-white",
        judging: "bg-blue-400 text-white animate-pulse",

        // None/N/A - Light gray
        none: "bg-gray-200 text-gray-500",
        "N/A": "bg-gray-200 text-gray-500",
      },
    },
    defaultVariants: {
      verdict: "none",
    },
  }
);

export interface ScoreBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof scoreBadgeVariants> {
  score?: number | string;
  showFullName?: boolean;
}

export function ScoreBadge({
  className,
  verdict,
  score,
  showFullName = false,
  ...props
}: ScoreBadgeProps) {
  const verdictKey = verdict ?? "none";
  const config = VERDICT_CONFIG[verdictKey as VerdictType] ?? VERDICT_CONFIG.none;

  return (
    <span
      className={cn(scoreBadgeVariants({ verdict: verdictKey as VerdictType }), className)}
      title={config.fullName}
      {...props}
    >
      {score !== undefined ? score : (showFullName ? config.fullName : config.label)}
    </span>
  );
}

export { VERDICT_CONFIG };
export type { VerdictConfig };
