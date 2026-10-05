import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
  size?: "default" | "lg";
};

export function PageHeader({ title, description, eyebrow, actions, className, size = "default" }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="space-y-1.5">
        {eyebrow ? <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{eyebrow}</p> : null}
        <h1 className={cn("font-display font-medium text-foreground", size === "lg" ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl")}>
          {title}
        </h1>
        {description ? <p className="max-w-2xl text-base text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
