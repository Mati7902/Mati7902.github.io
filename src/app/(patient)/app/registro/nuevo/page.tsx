import type { Metadata } from "next";

import { EmotionalLogForm } from "@/components/emotions/emotional-log-form";
import { requirePatient } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Registrar cómo me siento" };

export default async function NewEmotionalLogPage() {
  await requirePatient();
  return <EmotionalLogForm />;
}
