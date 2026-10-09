// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
  setSession: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));

import { GET } from "@/app/auth/callback/route";
import { POST } from "@/app/auth/callback/session/route";
import { parseEmailOtpType, resolveAuthNext } from "@/lib/auth/callback";

const BASE = "https://psicologia.example";

function get(path: string) {
  return GET(new NextRequest(`${BASE}${path}`));
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new NextRequest(`${BASE}/auth/callback/session`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE, host: "psicologia.example", ...headers },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.verifyOtp.mockResolvedValue({ error: null });
  auth.exchangeCodeForSession.mockResolvedValue({ error: null });
  auth.setSession.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
});

describe("destino después de un enlace de email", () => {
  it("la invitación lleva a definir la contraseña y la recuperación a cambiarla", () => {
    expect(resolveAuthNext("/app/agenda", "invite")).toBe("/bienvenida");
    expect(resolveAuthNext(null, "recovery")).toBe("/restablecer");
    expect(resolveAuthNext("/bienvenida", "magiclink")).toBe("/bienvenida");
  });

  it("nunca redirige fuera del sitio", () => {
    expect(resolveAuthNext("https://otro.sitio", "magiclink")).toBe("/app");
    expect(resolveAuthNext("//otro.sitio", null)).toBe("/app");
  });

  it("solo acepta tipos de enlace conocidos", () => {
    expect(parseEmailOtpType("invite")).toBe("invite");
    expect(parseEmailOtpType("admin")).toBeNull();
    expect(parseEmailOtpType(null)).toBeNull();
  });
});

describe("GET /auth/callback", () => {
  it("token_hash de invitación: verifica y lleva a /bienvenida", async () => {
    const res = await get("/auth/callback?token_hash=abc&type=invite");
    expect(auth.verifyOtp).toHaveBeenCalledWith({ type: "invite", token_hash: "abc" });
    expect(res.headers.get("location")).toBe(`${BASE}/bienvenida`);
  });

  it("token_hash vencido: enlace inválido", async () => {
    auth.verifyOtp.mockResolvedValue({ error: { message: "expired" } });
    const res = await get("/auth/callback?token_hash=abc&type=recovery");
    expect(res.headers.get("location")).toBe(`${BASE}/login?error=enlace-invalido`);
  });

  it("código PKCE: canjea y respeta next", async () => {
    const res = await get("/auth/callback?code=xyz&next=/app/agenda");
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("xyz");
    expect(res.headers.get("location")).toBe(`${BASE}/app/agenda`);
  });

  it("error informado por Supabase: enlace inválido", async () => {
    const res = await get("/auth/callback?error=access_denied&error_code=otp_expired");
    expect(res.headers.get("location")).toBe(`${BASE}/login?error=enlace-invalido`);
  });

  it("sin parámetros (sesión en el fragmento): responde la página que lo lee", async () => {
    const res = await get("/auth/callback?next=/bienvenida");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const html = await res.text();
    expect(html).toContain("/auth/callback/session");
    expect(html).toContain("history.replaceState");
  });
});

describe("POST /auth/callback/session", () => {
  const tokens = { access_token: "a.b.c", refresh_token: "r1", type: "invite", next: "/app" };

  it("crea la sesión con los tokens del fragmento y devuelve el destino", async () => {
    const res = await post(tokens);
    expect(res.status).toBe(200);
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: "a.b.c", refresh_token: "r1" });
    expect(await res.json()).toEqual({ next: "/bienvenida" });
  });

  it("rechaza pedidos de otro sitio (login CSRF)", async () => {
    const res = await post(tokens, { origin: "https://malicioso.example" });
    expect(res.status).toBe(403);
    expect(auth.setSession).not.toHaveBeenCalled();
  });

  it("rechaza pedidos sin Origin", async () => {
    const req = new NextRequest(`${BASE}/auth/callback/session`, {
      method: "POST",
      headers: { "content-type": "application/json", host: "psicologia.example" },
      body: JSON.stringify(tokens),
    });
    expect((await POST(req)).status).toBe(403);
  });

  it("rechaza formularios (solo JSON)", async () => {
    const res = await post(tokens, { "content-type": "application/x-www-form-urlencoded" });
    expect(res.status).toBe(415);
  });

  it("tokens inválidos: no hay sesión", async () => {
    auth.setSession.mockResolvedValue({ data: { user: null }, error: { message: "invalid JWT" } });
    const res = await post(tokens);
    expect(res.status).toBe(401);
  });

  it("cuerpo incompleto: 400", async () => {
    const res = await post({ access_token: "a.b.c" });
    expect(res.status).toBe(400);
  });
});
