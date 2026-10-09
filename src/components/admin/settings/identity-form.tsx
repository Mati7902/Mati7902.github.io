"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSettingsSave } from "@/hooks/use-settings-save";
import { uploadBrandingImageAction } from "@/server/actions/admin-settings";
import type { SiteIdentity } from "@/server/services/settings";

export function IdentityForm({ initial }: { initial: SiteIdentity }) {
  const [value, setValue] = useState(initial);
  const { save, pending, fieldErrors } = useSettingsSave("site.identity");
  const [uploading, startUpload] = useTransition();
  const [uploadingLogo, startLogoUpload] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof SiteIdentity>(key: K, v: SiteIdentity[K]) => setValue((s) => ({ ...s, [key]: v }));
  const nullable = (v: string) => (v.trim() === "" ? null : v.trim());

  const upload = (kind: "photo" | "logo") => {
    const file = (kind === "logo" ? logoRef : fileRef).current?.files?.[0];
    if (!file) return void toast.error("Elegí una imagen.");
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("file", file);
    (kind === "logo" ? startLogoUpload : startUpload)(async () => {
      const res = await uploadBrandingImageAction(fd);
      if (!res.ok) return void toast.error(res.error);
      set(kind === "logo" ? "logo_url" : "photo_url", res.data.url);
      toast.success(kind === "logo" ? "Logo actualizado." : "Foto actualizada.");
    });
  };

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        save(value);
      }}
    >
      <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-border/70 bg-card p-5">
        <div className="relative size-24 overflow-hidden rounded-2xl bg-primary-soft">
          {value.photo_url ? <Image src={value.photo_url} alt="" fill sizes="96px" className="object-cover" /> : null}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Fotografía profesional</p>
          <div className="flex flex-wrap items-center gap-2">
            <Input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="max-w-xs" aria-label="Elegir foto" />
            <Button type="button" variant="outline" size="sm" onClick={() => upload("photo")} loading={uploading}>Subir</Button>
          </div>
          <p className="text-xs text-muted-foreground">PNG, JPG o WebP, hasta 5 MB. Se muestra en la página pública.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-border/70 bg-card p-5">
        <div className="flex h-24 w-36 items-center justify-center overflow-hidden rounded-2xl bg-primary-soft p-3">
          {value.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.logo_url} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-xs text-muted-foreground">Sin logo</span>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Logo</p>
          <div className="flex flex-wrap items-center gap-2">
            <Input ref={logoRef} type="file" accept="image/svg+xml,image/png,image/webp,image/jpeg" className="max-w-xs" aria-label="Elegir logo" />
            <Button type="button" variant="outline" size="sm" onClick={() => upload("logo")} loading={uploadingLogo}>Subir</Button>
            {value.logo_url ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => set("logo_url", null)}>Quitar</Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">SVG o PNG con fondo transparente, hasta 5 MB. Aparece junto al nombre en la página, el ingreso y los paneles. Si lo quitás, guardá los cambios.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="id-platform" label="Nombre de la plataforma" error={fieldErrors.platform_name}>
          <Input id="id-platform" value={value.platform_name} onChange={(e) => set("platform_name", e.target.value)} />
        </FormField>
        <FormField id="id-professional" label="Nombre profesional" error={fieldErrors.professional_name}>
          <Input id="id-professional" value={value.professional_name} onChange={(e) => set("professional_name", e.target.value)} />
        </FormField>
        <FormField id="id-title" label="Título">
          <Input id="id-title" value={value.professional_title} onChange={(e) => set("professional_title", e.target.value)} />
        </FormField>
        <FormField id="id-license" label="Matrícula">
          <Input id="id-license" value={value.license} onChange={(e) => set("license", e.target.value)} />
        </FormField>
        <FormField id="id-brand-sub" label="Bajada del logo" className="sm:col-span-2" hint="Aparece debajo de tu nombre junto al emblema, por ejemplo: Psicología · Neurociencia aplicada.">
          <Input id="id-brand-sub" value={value.brand_subtitle} onChange={(e) => set("brand_subtitle", e.target.value)} />
        </FormField>
        <FormField id="id-tagline" label="Frase principal" className="sm:col-span-2">
          <Input id="id-tagline" value={value.tagline} onChange={(e) => set("tagline", e.target.value)} />
        </FormField>
        <FormField id="id-bio" label="Biografía" className="sm:col-span-2" hint="Podés separar párrafos con una línea en blanco.">
          <Textarea id="id-bio" value={value.bio} onChange={(e) => set("bio", e.target.value)} className="min-h-36" />
        </FormField>
        <FormField id="id-email" label="Email de contacto" error={fieldErrors.email}>
          <Input id="id-email" type="email" value={value.email ?? ""} onChange={(e) => set("email", nullable(e.target.value))} />
        </FormField>
        <FormField id="id-phone" label="Teléfono">
          <Input id="id-phone" value={value.phone ?? ""} onChange={(e) => set("phone", nullable(e.target.value))} />
        </FormField>
        <FormField id="id-wa" label="WhatsApp (con código de país)" hint="Ej.: +595981123456. Se usa en la web y en el protocolo de emergencia.">
          <Input id="id-wa" value={value.whatsapp ?? ""} onChange={(e) => set("whatsapp", nullable(e.target.value))} />
        </FormField>
        <FormField id="id-locname" label="Nombre del lugar">
          <Input id="id-locname" value={value.location_name ?? ""} onChange={(e) => set("location_name", nullable(e.target.value))} />
        </FormField>
        <FormField id="id-address" label="Dirección" className="sm:col-span-2">
          <Input id="id-address" value={value.location_address ?? ""} onChange={(e) => set("location_address", nullable(e.target.value))} />
        </FormField>
        <FormField id="id-map" label="Enlace de mapa" error={fieldErrors.location_map_url} className="sm:col-span-2">
          <Input id="id-map" type="url" value={value.location_map_url ?? ""} onChange={(e) => set("location_map_url", nullable(e.target.value))} placeholder="https://maps.google.com/…" />
        </FormField>
        <FormField id="id-ig" label="Instagram" error={fieldErrors["links.instagram"]}>
          <Input id="id-ig" type="url" value={value.links.instagram ?? ""} onChange={(e) => set("links", { ...value.links, instagram: nullable(e.target.value) })} />
        </FormField>
        <FormField id="id-li" label="LinkedIn" error={fieldErrors["links.linkedin"]}>
          <Input id="id-li" type="url" value={value.links.linkedin ?? ""} onChange={(e) => set("links", { ...value.links, linkedin: nullable(e.target.value) })} />
        </FormField>
      </div>
      <Button type="submit" loading={pending}>Guardar identidad</Button>
    </form>
  );
}
