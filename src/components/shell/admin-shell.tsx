import Link from "next/link";
import { Bell } from "lucide-react";

import { AdminMobileNav } from "@/components/shell/admin-mobile-nav";
import { BrandMark } from "@/components/shell/brand-mark";
import { NavIcon } from "@/components/shell/nav-icon";
import { NavLink } from "@/components/shell/nav-link";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { adminNav } from "@/lib/config/site";
import { getInitials } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  platformName: string;
  logoUrl?: string | null;
  userName: string;
  avatarUrl?: string | null;
  unreadCount: number;
  pendingRequests: number;
};

export function AdminShell({ children, platformName, logoUrl, userName, avatarUrl, unreadCount, pendingRequests }: Props) {
  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border/70 bg-sidebar px-4 py-6 lg:flex">
        <Link href="/admin" className="px-3">
          <BrandMark name={platformName} logoUrl={logoUrl} className="text-lg" />
          <span className="block text-xs text-muted-foreground">Panel profesional</span>
        </Link>
        <nav aria-label="Navegación administrativa" className="mt-8 flex flex-1 flex-col gap-1">
          {adminNav.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              exact={item.href === "/admin"}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
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
        <div className="mt-auto flex items-center gap-3 rounded-2xl border border-border/70 p-3">
          <Avatar className="size-9">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
            <AvatarFallback>{getInitials(userName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="text-xs text-muted-foreground">Administrador</p>
          </div>
          <SignOutButton size="icon-sm" className="text-muted-foreground">
            <span className="sr-only">Cerrar sesión</span>
          </SignOutButton>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border/60 bg-background/85 px-4 backdrop-blur-md lg:h-16 lg:px-8">
          <div className="flex items-center gap-2">
            <AdminMobileNav platformName={platformName} pendingRequests={pendingRequests} />
            <Link href="/admin" className="min-w-0 text-base lg:hidden">
              <BrandMark name={platformName} logoUrl={logoUrl} logoClassName="h-7" />
            </Link>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/admin/notificaciones"
              className="relative inline-flex size-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
              aria-label={unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : "Notificaciones"}
            >
              <Bell className="size-5" aria-hidden />
              {unreadCount > 0 ? (
                <span className="absolute top-2 right-2 flex min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
