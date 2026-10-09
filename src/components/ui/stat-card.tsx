import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
  tone?: "default" | "success" | "warning" | "destructive" | "info";
  className?: string;
};

const toneClasses: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "bg-primary-soft text-primary",
  success: "bg-success-soft text-mint-700",
  warning: "bg-warning-soft text-[#8a6418]",
  destructive: "bg-destructive/10 text-destructive",
  info: "bg-info-soft text-[#2b5f80]",
};

export function StatCard({ label, value, icon: Icon, hint, tone = "default", className }: StatCardProps) {
  return (
    <div className={cn("surface-card flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5", className)}>
      {Icon ? (
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", toneClasses[tone])}>
          <Icon className="size-5" aria-hidden />
        </span>
      ) : null}
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-display text-2xl font-medium leading-tight text-foreground">{value}</p>
        {hint ? <p className="text-xs text-subtle-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}
