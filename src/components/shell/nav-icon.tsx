import {
  Activity,
  BadgeDollarSign,
  Calendar,
  Home,
  LayoutDashboard,
  Library,
  type LucideIcon,
  MessageCircle,
  Settings,
  Sparkles,
  User,
  Users,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  home: Home,
  sparkles: Sparkles,
  calendar: Calendar,
  library: Library,
  user: User,
  users: Users,
  "layout-dashboard": LayoutDashboard,
  "badge-dollar-sign": BadgeDollarSign,
  "message-circle": MessageCircle,
  activity: Activity,
  settings: Settings,
};

export function NavIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Home;
  return <Icon className={className} aria-hidden />;
}
