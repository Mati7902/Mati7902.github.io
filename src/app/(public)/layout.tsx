import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { getPublicSettingsSafe } from "@/server/services/public-settings";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const { "site.identity": identity } = await getPublicSettingsSafe();
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader platformName={identity.platform_name} logoUrl={identity.logo_url} />
      <main className="flex-1">{children}</main>
      <SiteFooter identity={identity} />
    </div>
  );
}
