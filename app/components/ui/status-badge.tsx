import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      status: {
        active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
        inactive: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
        pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
        error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      },
    },
    defaultVariants: {
      status: "active",
    },
  }
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  label?: string;
}

export function StatusBadge({
  className,
  status,
  label,
  ...props
}: StatusBadgeProps) {
  const statusLabels = {
    active: "Active",
    inactive: "Inactive",
    pending: "Pending",
    error: "Error",
  };

  return (
    <span
      className={cn(statusBadgeVariants({ status }), className)}
      {...props}
    >
      {label ?? statusLabels[status ?? "active"]}
    </span>
  );
}
