import { cn } from "@/lib/utils";
import { Fuel, Circle } from "lucide-react";

interface DecisionBadgeProps {
  decision: "FILL" | "NO_ACTION";
  className?: string;
}

export function DecisionBadge({ decision, className }: DecisionBadgeProps) {
  const isFill = decision === "FILL";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-lg font-bold",
        isFill
          ? "bg-decision-fill text-decision-fill-foreground"
          : "bg-decision-no-action text-decision-no-action-foreground",
        className
      )}
    >
      {isFill ? <Fuel className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
      {isFill ? "FILL UP" : "NO ACTION"}
    </div>
  );
}
