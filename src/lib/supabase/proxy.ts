import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { publicEnv } from "@/lib/env";
import { applySessionOnly, SESSION_ONLY_COOKIE } from "@/lib/supabase/cookies";

const PATIENT_PREFIX = "/app";
const ADMIN_PREFIX = "/admin";
const AUTH_PAGES = ["/login", "/recuperar", "/restablecer", "/bienvenida"];

type Claims = { sub?: string; user_role?: string; app_metadata?: { role?: string } } | null;

/**
 * Refresca la sesión de Supabase en cada request y protege las rutas privadas.
 * El rol se vuelve a verificar en el servidor (layouts) porque el proxy solo tiene las claims del JWT.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (!publicEnv.supabaseUrl || !publicEnv.supabaseKey) {
    return supabaseResponse;
  }

  const sessionOnly = request.cookies.get(SESSION_ONLY_COOKIE)?.value === "1";

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, applySessionOnly(options, sessionOnly)),
        );
        Object.entries(headers ?? {}).forEach(([key, value]) => supabaseResponse.headers.set(key, value));
      },
    },
  });

  // No ejecutar lógica entre createServerClient y getClaims(): evita cierres de sesión aleatorios.
  const { data } = await supabase.auth.getClaims();
  const claims = (data?.claims ?? null) as Claims;
  const isAuthenticated = Boolean(claims?.sub);
  const pathname = request.nextUrl.pathname;

  const isPrivate = pathname.startsWith(PATIENT_PREFIX) || pathname.startsWith(ADMIN_PREFIX);
  const isAuthPage = AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!isAuthenticated && isPrivate) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return withCookies(NextResponse.redirect(url), supabaseResponse);
  }

  if (isAuthenticated && isAuthPage && pathname !== "/restablecer" && pathname !== "/bienvenida") {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return withCookies(NextResponse.redirect(url), supabaseResponse);
  }

  return supabaseResponse;
}

/** Copia las cookies (posiblemente refrescadas) de la respuesta de Supabase a una redirección. */
function withCookies(target: NextResponse, source: NextResponse): NextResponse {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  for (const header of ["Cache-Control", "Expires", "Pragma"]) {
    const value = source.headers.get(header);
    if (value) target.headers.set(header, value);
  }
  return target;
}
