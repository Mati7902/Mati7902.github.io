import Link from "next/link";
import { Bell } from "lucide-react";

import { BrandMark } from "@/components/shell/brand-mark";
import { NavIcon } from "@/components/shell/nav-icon";
import { NavLink } from "@/components/shell/nav-link";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { patientNav } from "@/lib/config/site";
import { getInitials } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  platformName: string;
  logoUrl?: string | null;
  brandName?: string;
  brandSubtitle?: string | null;
  userName: string;
  avatarUrl?: string | null;
  unreadCount: number;
};

export function PatientShell({ children, platformName, logoUrl, brandName, brandSubtitle, userName, avatarUrl, unreadCount }: Props) {
  return (
    <div className="flex min-h-dvh bg-background">
      {/* Sidebar escritorio */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border/70 bg-sidebar px-4 py-6 md:flex">
        <Link href="/app" className="flex min-w-0 px-3 text-lg">
          <BrandMark name={brandName ?? platformName} subtitle={brandSubtitle} logoUrl={logoUrl} wrap />
        </Link>
        <nav aria-label="Navegación principal" className="mt-8 flex flex-1 flex-col gap-1">
          {patientNav.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              exact={item.href === "/app"}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
              activeClassName="bg-sidebar-accent text-primary"
            >
              <NavIcon name={item.icon} className="size-5" />
              {item.label}
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
            <p className="text-xs text-muted-foreground">Paciente</p>
          </div>
          <SignOutButton size="icon-sm" className="text-muted-foreground">
            <span className="sr-only">Cerrar sesión</span>
          </SignOutButton>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border/60 bg-background/85 px-4 pt-safe backdrop-blur-md md:px-8">
          <div className="flex h-14 min-w-0 items-center md:h-16">
            <Link href="/app" className="flex min-w-0 text-base md:hidden">
              <BrandMark name={brandName ?? platformName} logoUrl={logoUrl} logoClassName="h-8" />
            </Link>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/app/notificaciones"
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
            <Link href="/app/perfil" className="flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 md:hidden" aria-label="Mi perfil">
              <Avatar className="size-9">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
                <AvatarFallback>{getInitials(userName)}</AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-28 md:px-8 md:pb-12">{children}</main>

        {/* Bottom navigation móvil */}
        <nav
          aria-label="Navegación principal"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-card/95 pb-safe backdrop-blur-md md:hidden"
        >
          <ul className="mx-auto grid max-w-lg grid-cols-5">
            {patientNav.map((item) => (
              <li key={item.href}>
                <NavLink
                  href={item.href}
                  exact={item.href === "/app"}
                  className="flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors"
                  activeClassName="text-primary"
                >
                  <span className="flex h-7 w-12 items-center justify-center rounded-full transition-colors [a[data-active]_&]:bg-primary-soft">
                    <NavIcon name={item.icon} className="size-5" />
                  </span>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
