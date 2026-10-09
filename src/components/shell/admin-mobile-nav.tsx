"use client";

import { Menu } from "lucide-react";
import { useState } from "react";

import { NavIcon } from "@/components/shell/nav-icon";
import { NavLink } from "@/components/shell/nav-link";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { adminNav } from "@/lib/config/site";

export function AdminMobileNav({ platformName, pendingRequests }: { platformName: string; pendingRequests: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menú">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b border-border/60">
          <SheetTitle className="text-primary">{platformName}</SheetTitle>
          <p className="text-xs text-muted-foreground">Panel profesional</p>
        </SheetHeader>
        <nav aria-label="Navegación administrativa" className="flex flex-col gap-1 px-3">
          {adminNav.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              exact={item.href === "/admin"}
              onNavigate={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
              activeClassName="bg-sidebar-accent text-primary"
            >
              <NavIcon name={item.icon} className="size-5" />
              <span className="flex-1">{item.label}</span>
              {item.href === "/admin/agenda" && pendingRequests > 0 ? (
                <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-[#8a6418]">{pendingRequests}</span>
              ) : null}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-border/60 p-4">
          <SignOutButton variant="outline" className="w-full" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
