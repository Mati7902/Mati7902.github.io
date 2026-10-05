import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
};

export function EmptyState({ icon: Icon, title, description, action, className, compact }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 text-center",
        compact ? "gap-2 px-5 py-8" : "gap-3 px-6 py-12",
        className,
      )}
    >
      {Icon ? (
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Icon className="size-6" aria-hidden />
        </span>
      ) : null}
      <h3 className="font-display text-lg font-medium text-foreground">{title}</h3>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
