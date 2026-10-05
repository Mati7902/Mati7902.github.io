"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/errors";
import { saveMaterialAction } from "@/server/actions/admin-materials";
import type { Material, MaterialCategory } from "@/types/domain";

type Option = { id: string; title: string };
type Result = ActionResult<{ id: string }>;

const selectClass = "flex h-12 w-full rounded-xl border border-input bg-card px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

export function MaterialForm({ material, categories, exercises }: { material?: Material; categories: MaterialCategory[]; exercises: Option[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<Result | null, FormData>(saveMaterialAction, null);
  const [type, setType] = useState<Material["type"]>(material?.type ?? "pdf");
  const id = useId();
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};

  useEffect(() => {
    if (state?.ok) {
      toast.success(material ? "Material actualizado." : "Material creado.");
      router.push("/admin/materiales");
      router.refresh();
    }
  }, [state, material, router]);

  const isFile = ["pdf", "image", "audio", "video"].includes(type);

  return (
    <form action={action} className="space-y-8" noValidate encType="multipart/form-data">
      {material ? <input type="hidden" name="id" value={material.id} /> : null}
      {material?.storage_path ? <input type="hidden" name="existing_storage_path" value={material.storage_path} /> : null}
      {state && !state.ok && !state.fieldErrors ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={`${id}-title`} label="Título" required error={errors.title} className="sm:col-span-2">
          <Input id={`${id}-title`} name="title" defaultValue={material?.title ?? ""} required maxLength={160} />
        </FormField>
        <FormField id={`${id}-desc`} label="Descripción" optional className="sm:col-span-2">
          <Textarea id={`${id}-desc`} name="description" defaultValue={material?.description ?? ""} maxLength={2000} />
        </FormField>
        <FormField id={`${id}-type`} label="Tipo">
          <select id={`${id}-type`} name="type" value={type} onChange={(e) => setType(e.target.value as Material["type"])} className={selectClass}>
            <option value="pdf">PDF</option>
            <option value="image">Imagen</option>
            <option value="audio">Audio</option>
            <option value="video">Video</option>
            <option value="link">Enlace</option>
            <option value="exercise">Ejercicio interno</option>
          </select>
        </FormField>
        <FormField id={`${id}-cat`} label="Categoría">
          <select id={`${id}-cat`} name="category_id" defaultValue={material?.category_id ?? ""} className={selectClass}>
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </FormField>

        {isFile ? (
          <>
            <FormField id={`${id}-file`} label={material?.storage_path ? "Reemplazar archivo" : "Archivo"} error={errors.file} hint={material?.storage_path ? `Actual: ${material.storage_path.split("/").pop()}` : "Hasta 50 MB. PDF, imagen, audio o video."} className="sm:col-span-2">
              <Input id={`${id}-file`} name="file" type="file" accept="application/pdf,image/png,image/jpeg,image/webp,audio/mpeg,audio/mp4,audio/wav,audio/ogg,video/mp4,video/webm" className="file:mr-3 file:rounded-lg file:bg-primary-soft file:px-3 file:text-primary" />
            </FormField>
            <FormField id={`${id}-url`} label="O URL externa" optional error={errors.external_url} hint="Por ejemplo un video de YouTube o un audio alojado en otro sitio." className="sm:col-span-2">
              <Input id={`${id}-url`} name="external_url" type="url" defaultValue={material?.external_url ?? ""} placeholder="https://" />
            </FormField>
          </>
        ) : null}
        {type === "link" ? (
          <FormField id={`${id}-url`} label="Enlace" required error={errors.external_url} className="sm:col-span-2">
            <Input id={`${id}-url`} name="external_url" type="url" defaultValue={material?.external_url ?? ""} placeholder="https://" required />
          </FormField>
        ) : null}
        {type === "exercise" ? (
          <FormField id={`${id}-exercise`} label="Ejercicio" required error={errors.exercise_template_id} className="sm:col-span-2">
            <select id={`${id}-exercise`} name="exercise_template_id" defaultValue={material?.exercise_template_id ?? ""} className={selectClass} required>
              <option value="" disabled>Elegí un ejercicio…</option>
              {exercises.map((e) => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))}
            </select>
          </FormField>
        ) : null}

        <FormField id={`${id}-duration`} label="Duración (min)" optional error={errors.duration_minutes}>
          <Input id={`${id}-duration`} name="duration_minutes" type="number" min={1} max={600} defaultValue={material?.duration_minutes ?? ""} />
        </FormField>
        <FormField id={`${id}-vis`} label="Visibilidad">
          <select id={`${id}-vis`} name="visibility" defaultValue={material?.visibility ?? "assigned"} className={selectClass}>
            <option value="assigned">Asignado a pacientes específicos</option>
            <option value="public">Publicado para todos los pacientes</option>
          </select>
        </FormField>
      </div>

      <div className="flex items-center gap-3">
        <Checkbox id={`${id}-pub`} name="is_published" value="true" defaultChecked={material?.is_published ?? true} />
        <Label htmlFor={`${id}-pub`} className="font-normal">Publicado (visible para los pacientes según la visibilidad elegida)</Label>
      </div>

      <div className="flex gap-3">
        <Button type="submit" size="lg" loading={pending}>{material ? "Guardar cambios" : "Crear material"}</Button>
        <Button type="button" variant="ghost" size="lg" onClick={() => router.back()} disabled={pending}>Cancelar</Button>
      </div>
    </form>
  );
}
