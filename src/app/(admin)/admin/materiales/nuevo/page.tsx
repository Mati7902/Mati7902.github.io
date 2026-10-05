import type { Metadata } from "next";

import { MaterialForm } from "@/components/admin/materials/material-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listCategories } from "@/server/services/materials";

export const metadata: Metadata = { title: "Nuevo material" };

export default async function NewMaterialPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [categories, { data: exercises }] = await Promise.all([listCategories(supabase), supabase.from("exercise_templates").select("id, title").order("sort_order")]);
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader eyebrow="Materiales" title="Nuevo material" />
      <MaterialForm categories={categories} exercises={exercises ?? []} />
    </div>
  );
}
