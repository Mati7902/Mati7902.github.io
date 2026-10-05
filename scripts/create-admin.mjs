#!/usr/bin/env node
/**
 * Crea (o promueve) el usuario ADMINISTRADOR en un proyecto Supabase real.
 * El rol se guarda en app_metadata (no editable por el usuario) y el trigger handle_new_user
 * crea el perfil con rol admin.
 *
 * Uso:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/create-admin.mjs --email admin@tu-dominio.com --name "Matías Sánchez"
 *
 * El script envía un email de invitación para que el administrador defina su contraseña.
 * Con --password "..." crea la cuenta directamente con esa contraseña (útil en staging).
 */
import { createClient } from "@supabase/supabase-js";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, arg, i, all) => {
    if (arg.startsWith("--")) acc.push([arg.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : "true"]);
    return acc;
  }, []),
);

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

if (!url || !key) {
  console.error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno.");
  process.exit(1);
}
if (!args.email) {
  console.error("Indicá --email.");
  process.exit(1);
}

const [firstName, ...rest] = String(args.name ?? "Administrador").split(" ");
const lastName = rest.join(" ");
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function main() {
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users.find((u) => u.email?.toLowerCase() === String(args.email).toLowerCase());

  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, { app_metadata: { ...existing.app_metadata, role: "admin" } });
    if (error) throw error;
    const { error: profileError } = await supabase.from("profiles").upsert({ id: existing.id, role: "admin", email: existing.email, first_name: firstName, last_name: lastName || null, is_active: true });
    if (profileError) throw profileError;
    console.log(`Usuario existente promovido a administrador: ${existing.email}`);
    return;
  }

  if (args.password && args.password !== "true") {
    const { data, error } = await supabase.auth.admin.createUser({
      email: args.email,
      password: args.password,
      email_confirm: true,
      app_metadata: { role: "admin" },
      user_metadata: { first_name: firstName, last_name: lastName },
    });
    if (error) throw error;
    console.log(`Administrador creado con contraseña: ${data.user.email}`);
    return;
  }

  // Sin contraseña: invitación por email. app_metadata.role no se puede fijar en la invitación,
  // así que creamos el usuario primero y luego enviamos el enlace de recuperación/acceso.
  const { data, error } = await supabase.auth.admin.createUser({
    email: args.email,
    email_confirm: true,
    app_metadata: { role: "admin" },
    user_metadata: { first_name: firstName, last_name: lastName },
  });
  if (error) throw error;
  const { error: linkError } = await supabase.auth.resetPasswordForEmail(args.email, { redirectTo: `${appUrl}/auth/callback?next=/restablecer` });
  if (linkError) throw linkError;
  console.log(`Administrador creado: ${data.user.email}. Se envió un email para definir la contraseña.`);
}

main().catch((error) => {
  console.error("Error:", error.message ?? error);
  process.exit(1);
});
