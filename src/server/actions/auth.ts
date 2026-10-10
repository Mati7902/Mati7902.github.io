"use server";

import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { publicEnv } from "@/lib/env";
import { type ActionResult, fail, ok, validationFail, AppError } from "@/lib/errors";
import { createLogger, errorMeta } from "@/lib/logger";
import { SESSION_ONLY_COOKIE } from "@/lib/supabase/cookies";
import { createClient } from "@/lib/supabase/server";
import { parseForm } from "@/lib/validation";
import { getSession } from "@/lib/auth/session";
import { safeInternalPath } from "@/lib/safe-redirect";
import { audit } from "@/server/services/audit";
import { allowAttempt } from "@/server/services/rate-limit";

const log = createLogger("auth");

const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres.")
  .max(128, "La contraseña es demasiado larga.")
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "Combiná letras y números.");

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ingresá un email válido."),
  password: z.string().min(1, "Ingresá tu contraseña."),
  remember: z.coerce.boolean().default(false),
  next: z.string().optional(),
});


async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}


export async function signInAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(signInSchema, formData);
  if (parsed.errors) return validationFail(parsed.errors);
  const { email, password, remember, next } = parsed.data;

  const ip = await clientIp();
  if (!(await allowAttempt(`login:${ip}`, 20, 15 * 60)) || !(await allowAttempt(`login:${email}`, 10, 15 * 60))) {
    return fail(new AppError("RATE_LIMITED", "Demasiados intentos. Esperá unos minutos e intentá de nuevo."));
  }

  const cookieStore = await cookies();
  if (remember) {
    cookieStore.delete(SESSION_ONLY_COOKIE);
  } else {
    cookieStore.set(SESSION_ONLY_COOKIE, "1", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    log.info("Inicio de sesión fallido", { ip });
    return fail(new AppError("UNAUTHENTICATED", "Email o contraseña incorrectos."));
  }

  const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", data.user.id).maybeSingle();
  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    return fail(new AppError("FORBIDDEN", "Tu cuenta está desactivada. Escribinos para reactivarla."));
  }

  await audit(supabase, "auth.sign_in", { type: "profile", id: data.user.id }, { ip });
  const isAdmin = profile.role === "admin" || profile.role === "professional";
  redirect(safeInternalPath(next, isAdmin ? "/admin" : "/app"));
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  const session = await getSession();
  if (session) await audit(supabase, "auth.sign_out", { type: "profile", id: session.userId });
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_ONLY_COOKIE);
  redirect("/login");
}

const resetSchema = z.object({ email: z.string().trim().toLowerCase().email("Ingresá un email válido.") });

export async function requestPasswordResetAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(resetSchema, formData);
  if (parsed.errors) return validationFail(parsed.errors);

  const ip = await clientIp();
  if (!(await allowAttempt(`reset:${ip}`, 5, 15 * 60))) {
    return fail(new AppError("RATE_LIMITED", "Demasiados intentos. Esperá unos minutos e intentá de nuevo."));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.appUrl}/auth/callback?next=/restablecer`,
  });
  if (error) log.warn("resetPasswordForEmail falló", errorMeta(error));
  // Respuesta idéntica exista o no la cuenta: evita enumeración de usuarios.
  return ok(undefined);
}

const updatePasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Las contraseñas no coinciden.", path: ["confirm"] });

export async function updatePasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(updatePasswordSchema, formData);
  if (parsed.errors) return validationFail(parsed.errors);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(new AppError("UNAUTHENTICATED", "El enlace expiró o ya fue usado. Pedí uno nuevo."));

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    const msg = /same password/i.test(error.message) ? "Elegí una contraseña distinta a la anterior." : "No pudimos actualizar la contraseña. Pedí un enlace nuevo.";
    return fail(new AppError("VALIDATION", msg));
  }
  await audit(supabase, "auth.password_updated", { type: "profile", id: user.id });
  const session = await getSession();
  redirect(session?.isAdmin ? "/admin" : "/app");
}

const completeInvitationSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string(),
    consent: z.coerce.boolean().refine((v) => v, "Necesitamos tu aceptación para continuar."),
  })
  .refine((v) => v.password === v.confirm, { message: "Las contraseñas no coinciden.", path: ["confirm"] });

const consentSchema = z.object({
  consent: z.coerce.boolean().refine((v) => v, "Necesitamos tu aceptación para continuar."),
});

/** Versión vigente del consentimiento según la configuración (`legal.consent_version`). */
async function currentConsentVersion(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const { data: legal } = await supabase.from("settings").select("value").eq("key", "legal").maybeSingle();
  return (legal?.value as { consent_version?: string } | null)?.consent_version ?? "draft";
}

/** Re-aceptación cuando cambian los textos legales (la pide el layout del paciente). */
export async function acceptConsentAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(consentSchema, formData);
  if (parsed.errors) return validationFail(parsed.errors);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(new AppError("UNAUTHENTICATED", "Tu sesión expiró. Volvé a ingresar."));
  const version = await currentConsentVersion(supabase);
  const { error } = await supabase
    .from("patients")
    .update({ consent_accepted_at: new Date().toISOString(), consent_version: version })
    .eq("profile_id", user.id);
  if (error) {
    log.warn("No se pudo registrar el consentimiento", errorMeta(error));
    return fail(new AppError("UNKNOWN", "No pudimos guardar tu aceptación. Intentá de nuevo."));
  }
  await audit(supabase, "auth.consent_accepted", { type: "profile", id: user.id }, { consent_version: version });
  redirect("/app");
}

export async function completeInvitationAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(completeInvitationSchema, formData);
  if (parsed.errors) return validationFail(parsed.errors);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(new AppError("UNAUTHENTICATED", "La invitación expiró o ya fue usada. Pedile al profesional una nueva."));

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail(new AppError("VALIDATION", "No pudimos guardar la contraseña. Intentá de nuevo."));

  const version = await currentConsentVersion(supabase);
  await supabase
    .from("patients")
    .update({ consent_accepted_at: new Date().toISOString(), consent_version: version })
    .eq("profile_id", user.id);

  await audit(supabase, "auth.invitation_completed", { type: "profile", id: user.id }, { consent_version: version });
  // Recién creada la cuenta, lo primero es la ficha de ingreso (se puede dejar para más tarde).
  redirect("/app/ingreso?bienvenida=1");
}
