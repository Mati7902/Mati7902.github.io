"use client";

import { Bot } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { resumeConversationAction } from "@/server/actions/admin-whatsapp";

export function ResumeConversationButton({ conversationId }: { conversationId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await resumeConversationAction(conversationId);
          if (res.ok) toast.success("La asistente vuelve a responder en esta conversación.");
          else toast.error(res.error);
        })
      }
    >
      <Bot aria-hidden /> Reactivar asistente
    </Button>
  );
}
