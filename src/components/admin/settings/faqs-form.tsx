"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { deleteFaqAction, saveFaqAction } from "@/server/actions/admin-settings";
import type { Faq } from "@/types/domain";

type Draft = { id?: string; question: string; answer: string; sort_order: number; is_published: boolean };

export function FaqsEditor({ faqs }: { faqs: Faq[] }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>(faqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer, sort_order: f.sort_order, is_published: f.is_published })));
  const [pending, startTransition] = useTransition();
  const update = (i: number, patch: Partial<Draft>) => setDrafts((d) => d.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const saveRow = (i: number) =>
    startTransition(async () => {
      const row = drafts[i];
      if (!row) return;
      const res = await saveFaqAction(row);
      if (!res.ok) return void toast.error(res.fieldErrors ? Object.values(res.fieldErrors)[0] ?? res.error : res.error);
      toast.success("Pregunta guardada.");
      router.refresh();
    });

  const removeRow = (i: number) =>
    startTransition(async () => {
      const row = drafts[i];
      if (!row) return;
      if (row.id) {
        const res = await deleteFaqAction(row.id);
        if (!res.ok) return void toast.error(res.error);
      }
      setDrafts((d) => d.filter((_, idx) => idx !== i));
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {drafts.map((f, i) => (
          <li key={f.id ?? `new-${i}`} className="space-y-3 rounded-2xl border border-border/70 bg-card p-4">
            <Input value={f.question} onChange={(e) => update(i, { question: e.target.value })} placeholder="Pregunta" aria-label="Pregunta" />
            <Textarea value={f.answer} onChange={(e) => update(i, { answer: e.target.value })} placeholder="Respuesta" aria-label="Respuesta" className="min-h-20" />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-2">Orden <Input type="number" min={0} value={f.sort_order} onChange={(e) => update(i, { sort_order: Number(e.target.value) })} className="h-9 w-20" /></label>
                <label className="flex items-center gap-2"><Switch checked={f.is_published} onCheckedChange={(v) => update(i, { is_published: v })} aria-label="Publicada" /> Publicada</label>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => saveRow(i)} disabled={pending}>Guardar</Button>
                <Button size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => removeRow(i)} disabled={pending} aria-label="Eliminar"><Trash2 /></Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <Button variant="outline" onClick={() => setDrafts((d) => [...d, { question: "", answer: "", sort_order: d.length + 1, is_published: true }])} disabled={pending}>
        <Plus aria-hidden /> Agregar pregunta
      </Button>
    </div>
  );
}
