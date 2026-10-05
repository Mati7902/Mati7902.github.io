#!/usr/bin/env node
// ============================================================================
// VISTA PREVIA LOCAL · NO USAR EN PRODUCCIÓN
//
// Pasarela mínima que imita la API de Supabase para ver la app sin crear un
// proyecto: reenvía /rest/v1 a PostgREST y emula lo justo de Auth y Storage
// (inicio de sesión con contraseña, sesión, usuario, cierre de sesión).
// No envía emails, no guarda archivos y usa un secreto JWT fijo de desarrollo.
// ============================================================================
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.env.PREVIEW_GATEWAY_PORT ?? 54321);
const POSTGREST_URL = process.env.PREVIEW_POSTGREST_URL ?? "http://127.0.0.1:3001";
export const JWT_SECRET = process.env.PREVIEW_JWT_SECRET ?? "preview-local-jwt-secret-solo-para-desarrollo-0001";
const ACCESS_TTL_SECONDS = 3600;

/* ------------------------------------------------------------------------ */
/* JWT HS256                                                                 */
/* ------------------------------------------------------------------------ */
const b64url = (input) => Buffer.from(input).toString("base64url");

export function signJwt(payload, secret = JWT_SECRET) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

function verifyJwt(token) {
  const parts = typeof token === "string" ? token.split(".") : [];
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expected = createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest();
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

export const ANON_KEY = signJwt({ role: "anon", iss: "preview-local", iat: 1_760_000_000 });
export const SERVICE_ROLE_KEY = signJwt({ role: "service_role", iss: "preview-local", iat: 1_760_000_000 });

/* ------------------------------------------------------------------------ */
/* Auth                                                                      */
/* ------------------------------------------------------------------------ */
const refreshTokens = new Map(); // refresh_token → user id (en memoria)

async function rpc(fn, args) {
  const res = await fetch(`${POSTGREST_URL}/rpc/${fn}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${SERVICE_ROLE_KEY}`, "content-profile": "preview", "accept-profile": "preview" },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`rpc ${fn} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function issueSession(userId) {
  const user = await rpc("get_user", { p_id: userId });
  if (!user) return null;
  const now = Math.floor(Date.now() / 1000);
  const accessToken = signJwt({
    sub: user.id,
    aud: "authenticated",
    role: "authenticated",
    email: user.email,
    app_metadata: user.app_metadata,
    user_metadata: user.user_metadata,
    session_id: randomBytes(8).toString("hex"),
    aal: "aal1",
    iss: "preview-local",
    iat: now,
    exp: now + ACCESS_TTL_SECONDS,
  });
  const refreshToken = randomBytes(24).toString("base64url");
  refreshTokens.set(refreshToken, user.id);
  return { access_token: accessToken, token_type: "bearer", expires_in: ACCESS_TTL_SECONDS, expires_at: now + ACCESS_TTL_SECONDS, refresh_token: refreshToken, user };
}

const authError = (status, code, message) => ({ status, body: { code: status, error_code: code, msg: message, error: code, error_description: message } });

async function handleAuth(req, url, body) {
  const path = url.pathname.replace(/^\/auth\/v1/, "");
  const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");

  if (path === "/token" && req.method === "POST") {
    const grant = url.searchParams.get("grant_type");
    if (grant === "password") {
      const userId = await rpc("verify_password", { p_email: String(body?.email ?? ""), p_password: String(body?.password ?? "") });
      if (!userId) return authError(400, "invalid_credentials", "Invalid login credentials");
      return { status: 200, body: await issueSession(userId) };
    }
    if (grant === "refresh_token") {
      const userId = refreshTokens.get(String(body?.refresh_token ?? ""));
      if (!userId) return authError(400, "refresh_token_not_found", "Invalid Refresh Token: Refresh Token Not Found");
      refreshTokens.delete(body.refresh_token);
      return { status: 200, body: await issueSession(userId) };
    }
    return authError(400, "unsupported_grant_type", "Grant no soportado en la vista previa");
  }

  if (path === "/user") {
    const claims = verifyJwt(bearer);
    if (!claims?.sub) return authError(401, "bad_jwt", "invalid JWT");
    const user = await rpc("get_user", { p_id: claims.sub });
    if (!user) return authError(404, "user_not_found", "User not found");
    // PUT /user (cambio de contraseña): en la vista previa no se persiste.
    return { status: 200, body: user };
  }

  if (path === "/logout") return { status: 204, body: null };
  if (path === "/recover" || path === "/otp" || path === "/verify") return { status: 200, body: {} };
  if (path === "/settings") return { status: 200, body: { external: { email: true }, disable_signup: true, mailer_autoconfirm: false } };
  if (path === "/health") return { status: 200, body: { name: "preview-gateway" } };
  return authError(501, "not_available_in_preview", "Función no disponible en la vista previa local");
}

/* ------------------------------------------------------------------------ */
/* Storage (stub sin persistencia)                                           */
/* ------------------------------------------------------------------------ */
function handleStorage(req, url) {
  const path = url.pathname.replace(/^\/storage\/v1/, "");
  if (path.startsWith("/object/sign/") && req.method === "POST") {
    return { status: 200, body: { signedURL: `${path}?token=preview` } };
  }
  if (req.method === "POST" || req.method === "PUT") return { status: 200, body: { Key: path.replace(/^\/object\//, ""), Id: randomBytes(8).toString("hex") } };
  if (req.method === "DELETE") return { status: 200, body: [] };
  return { status: 404, body: { statusCode: "404", error: "not_found", message: "Archivo no disponible en la vista previa local" } };
}

/* ------------------------------------------------------------------------ */
/* REST → PostgREST                                                          */
/* ------------------------------------------------------------------------ */
const HOP_BY_HOP = new Set(["connection", "keep-alive", "transfer-encoding", "upgrade", "host", "content-length", "accept-encoding"]);

async function proxyRest(req, url, rawBody) {
  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (!HOP_BY_HOP.has(key) && typeof value === "string") headers[key] = value;
  }
  // Como Kong en Supabase: sin un JWT válido la petición viaja como anon (nunca sin claims).
  const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  headers.authorization = `Bearer ${verifyJwt(bearer) ? bearer : ANON_KEY}`;
  const target = `${POSTGREST_URL}${url.pathname.replace(/^\/rest\/v1/, "") || "/"}${url.search}`;
  const res = await fetch(target, { method: req.method, headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : rawBody });
  const outHeaders = {};
  res.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key) && key !== "content-encoding") outHeaders[key] = value;
  });
  return { status: res.status, raw: Buffer.from(await res.arrayBuffer()), headers: outHeaders };
}

/* ------------------------------------------------------------------------ */
/* Servidor                                                                  */
/* ------------------------------------------------------------------------ */
function corsHeaders(req) {
  return {
    "access-control-allow-origin": req.headers.origin ?? "*",
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": req.headers["access-control-request-headers"] ?? "*",
    "access-control-expose-headers": "content-range, x-total-count",
  };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders(req));
    return res.end();
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks);
  try {
    let result;
    if (url.pathname.startsWith("/rest/v1")) {
      result = await proxyRest(req, url, rawBody);
    } else if (url.pathname.startsWith("/auth/v1")) {
      let body = null;
      try {
        body = rawBody.length ? JSON.parse(rawBody.toString("utf8")) : null;
      } catch {
        body = null;
      }
      result = await handleAuth(req, url, body);
    } else if (url.pathname.startsWith("/storage/v1")) {
      result = handleStorage(req, url);
    } else {
      result = { status: 404, body: { error: "not_found" } };
    }
    const headers = { ...corsHeaders(req), ...(result.headers ?? {}) };
    if (result.raw) {
      res.writeHead(result.status, headers);
      return res.end(result.raw);
    }
    if (result.body === null) {
      res.writeHead(result.status, headers);
      return res.end();
    }
    res.writeHead(result.status, { ...headers, "content-type": "application/json" });
    res.end(JSON.stringify(result.body));
  } catch (error) {
    console.error("[gateway]", req.method, url.pathname, error);
    res.writeHead(502, { ...corsHeaders(req), "content-type": "application/json" });
    res.end(JSON.stringify({ error: "gateway_error", message: String(error?.message ?? error) }));
  }
});

if (process.argv.includes("--print-keys")) {
  console.log(`PREVIEW_ANON_KEY=${ANON_KEY}`);
  console.log(`PREVIEW_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}`);
} else {
  server.listen(PORT, "127.0.0.1", () => console.log(`[gateway] Supabase de vista previa en http://127.0.0.1:${PORT} → PostgREST ${POSTGREST_URL}`));
}
