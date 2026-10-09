"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveSettingsAction } from "@/server/actions/admin-settings";
import type { SettingsKey, SettingsValue } from "@/server/services/settings";

/** Hook compartido por los formularios de Configuración: guarda una clave y muestra feedback. */
export function useSettingsSave<K extends SettingsKey>(key: K) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const save = (value: SettingsValue<K>, successMessage = "Configuración guardada.") =>
    startTransition(async () => {
      const result = await saveSettingsAction(key, value);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      setFieldErrors({});
      toast.success(successMessage);
      router.refresh();
    });

  return { save, pending, fieldErrors };
}
