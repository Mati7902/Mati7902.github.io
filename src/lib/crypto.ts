import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { getServerEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

/**
 * Cifrado simétrico AES-256-GCM para secretos guardados en la base (tokens OAuth).
 * La clave vive únicamente en APP_ENCRYPTION_KEY (32 bytes en base64).
 */
function key(): Buffer {
  const raw = getServerEnv().APP_ENCRYPTION_KEY;
  if (!raw) throw new AppError("NOT_CONFIGURED", "Falta APP_ENCRYPTION_KEY (openssl rand -base64 32).");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new AppError("NOT_CONFIGURED", "APP_ENCRYPTION_KEY debe ser de 32 bytes en base64.");
  return buf;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(".");
  if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) throw new AppError("UNKNOWN", "Formato de secreto cifrado inválido.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}
