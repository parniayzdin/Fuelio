import { cn } from "@/lib/utils";

interface SeverityBadgeProps {
  severity: "low" | "medium" | "high";
  className?: string;
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wide",
        severity === "low" && "bg-severity-low text-severity-low-foreground",
        severity === "medium" && "bg-severity-medium text-severity-medium-foreground",
        severity === "high" && "bg-severity-high text-severity-high-foreground",
        className
      )}
    >
      {severity}
    </span>
  );
}
