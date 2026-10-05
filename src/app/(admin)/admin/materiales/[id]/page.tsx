import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MaterialForm } from "@/components/admin/materials/material-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listCategories } from "@/server/services/materials";

export const metadata: Metadata = { title: "Editar material" };

export default async function EditMaterialPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: material }, categories, { data: exercises }] = await Promise.all([
    supabase.from("materials").select("*").eq("id", id).maybeSingle(),
    listCategories(supabase),
    supabase.from("exercise_templates").select("id, title").order("sort_order"),
  ]);
  if (!material) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader eyebrow="Materiales" title={material.title} />
      <MaterialForm material={material} categories={categories} exercises={exercises ?? []} />
    </div>
  );
}
