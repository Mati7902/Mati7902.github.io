import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import type { Database } from "@/types/database";

export type UserRole = Database["public"]["Enums"]["user_role"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Patient = Database["public"]["Tables"]["patients"]["Row"];

export type SessionContext = {
  userId: string;
  email: string | null;
  profile: Profile;
  patient: Patient | null;
  role: UserRole;
  isAdmin: boolean;
};

export const ADMIN_ROLES: UserRole[] = ["admin", "professional"];

/**
 * Obtiene el usuario autenticado verificado por el servidor de Auth (getUser), su perfil y,
 * si es paciente, su ficha. Memoizado por request.
 */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile || !profile.is_active) return null;

  let patient: Patient | null = null;
  if (profile.role === "patient") {
    const { data } = await supabase.from("patients").select("*").eq("profile_id", user.id).maybeSingle();
    patient = data ?? null;
  }

  return {
    userId: user.id,
    email: user.email ?? profile.email,
    profile,
    patient,
    role: profile.role,
    isAdmin: ADMIN_ROLES.includes(profile.role),
  };
});

/** Exige sesión; redirige a /login si no la hay. */
export async function requireSession(nextPath?: string): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  return session;
}

/** Exige rol administrador/profesional. */
export async function requireAdmin(): Promise<SessionContext> {
  const session = await requireSession("/admin");
  if (!session.isAdmin) redirect("/app");
  return session;
}

/** Exige rol paciente con ficha vinculada. */
export async function requirePatient(): Promise<SessionContext & { patient: Patient }> {
  const session = await requireSession("/app");
  if (session.isAdmin) redirect("/admin");
  if (!session.patient) redirect("/sin-ficha");
  return { ...session, patient: session.patient };
}

/** Versión para server actions: lanza AppError en vez de redirigir. */
export async function assertSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) throw new AppError("UNAUTHENTICATED", "Tu sesión expiró. Volvé a iniciar sesión.");
  return session;
}

export async function assertAdmin(): Promise<SessionContext> {
  const session = await assertSession();
  if (!session.isAdmin) throw new AppError("FORBIDDEN", "Esta acción requiere permisos de administrador.");
  return session;
}

export async function assertPatient(): Promise<SessionContext & { patient: Patient }> {
  const session = await assertSession();
  if (!session.patient) throw new AppError("FORBIDDEN", "Tu cuenta no tiene una ficha de paciente vinculada.");
  return { ...session, patient: session.patient };
}
