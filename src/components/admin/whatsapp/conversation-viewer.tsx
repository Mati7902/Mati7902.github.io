import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCompactDate, formatTime, capitalize } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { WhatsAppContact, WhatsAppConversation, WhatsAppMessage } from "@/types/domain";

export type ConversationRow = WhatsAppConversation & { whatsapp_contacts: Pick<WhatsAppContact, "phone" | "display_name" | "patient_id"> | null };

export function ConversationList({ conversations, selectedId }: { conversations: ConversationRow[]; selectedId: string | null }) {
  if (conversations.length === 0) {
    return <EmptyState icon={MessageCircle} title="Sin conversaciones" description="Cuando alguien escriba al número de WhatsApp, aparecerá acá." compact />;
  }
  return (
    <ul className="divide-y divide-divider overflow-hidden rounded-2xl border border-border/70 bg-card">
      {conversations.map((c) => (
        <li key={c.id}>
          <Link href={`/admin/whatsapp?conv=${c.id}`} className={cn("flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-surface-muted", selectedId === c.id && "bg-primary-soft/50")}>
            <div className="min-w-0">
              <p className="truncate font-medium">{c.whatsapp_contacts?.display_name ?? c.whatsapp_contacts?.phone ?? "Contacto"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {c.whatsapp_contacts?.phone}
                {c.current_intent ? ` · ${c.current_intent}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-muted-foreground">
              {c.last_message_at ? <span>{capitalize(formatCompactDate(c.last_message_at))} {formatTime(c.last_message_at)}</span> : null}
              <span className="flex gap-1">
                {c.crisis_flagged_at ? <Badge variant="destructive">Crisis</Badge> : null}
                <Badge variant={c.status === "open" ? "success" : c.status === "handed_off" ? "warning" : "muted"}>
                  {c.status === "open" ? "Abierta" : c.status === "handed_off" ? "Derivada" : "Cerrada"}
                </Badge>
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function MessageThread({ messages, contactName }: { messages: WhatsAppMessage[]; contactName: string }) {
  if (messages.length === 0) return <p className="text-sm text-muted-foreground">Elegí una conversación para ver los mensajes.</p>;
  return (
    <div className="flex max-h-[32rem] flex-col gap-2 overflow-y-auto rounded-2xl border border-border/70 bg-sand-50 p-4">
      {messages.map((m) => (
        <div key={m.id} className={cn("max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-[var(--shadow-card)]", m.direction === "inbound" ? "self-start bg-card" : "self-end bg-primary text-primary-foreground")}>
          <p className="whitespace-pre-line">{m.body ?? `[${m.message_type}]`}</p>
          <p className={cn("mt-1 text-[10px]", m.direction === "inbound" ? "text-muted-foreground" : "text-primary-foreground/70")}>
            {m.direction === "inbound" ? contactName : "Asistente"} · {formatTime(m.created_at)}
            {m.intent ? ` · ${m.intent}${m.confidence ? ` (${Math.round(Number(m.confidence) * 100)}%)` : ""}` : ""}
            {m.status === "failed" ? " · falló" : ""}
          </p>
        </div>
      ))}
    </div>
  );
}
