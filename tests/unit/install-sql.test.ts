// @vitest-environment node
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildInstallSql,
  buildUpdateSql,
  FIRST_RELEASE_LAST_MIGRATION,
  INSTALL_SQL_PATH,
  UPDATE_SQL_PATH,
  // @ts-expect-error: módulo JavaScript de scripts/ sin tipos
} from "../../scripts/build-install-sql.mjs";

describe("supabase/instalar.sql", () => {
  it("está al día con las migraciones (si falla: pnpm db:instalar)", () => {
    expect(readFileSync(INSTALL_SQL_PATH, "utf8")).toBe(buildInstallSql());
  });

  it("incluye todas las migraciones en orden y dentro de una transacción", () => {
    const sql = buildInstallSql() as string;
    const order = [...sql.matchAll(/^-- >>> supabase\/migrations\/(\S+)$/gm)].map((m) => m[1]);
    expect(order.length).toBeGreaterThanOrEqual(6);
    expect(order).toEqual([...order].sort());
    expect(sql.indexOf("\nbegin;\n")).toBeLessThan(sql.indexOf("-- >>> "));
    expect(sql.trimEnd().endsWith("commit;")).toBe(true);
    expect(sql).not.toContain("-- >>> supabase/seed.sql");
  });
});

describe("supabase/actualizar.sql", () => {
  const sections = (sql: string) =>
    [...sql.matchAll(/^-- >>> supabase\/migrations\/(\S+)$/gm)].map((m) => m[1] ?? "");

  it("está al día con las migraciones (si falla: pnpm db:instalar)", () => {
    expect(readFileSync(UPDATE_SQL_PATH, "utf8")).toBe(buildUpdateSql());
  });

  it("trae, en orden, las migraciones posteriores a la primera versión y nada de antes", () => {
    const sql = buildUpdateSql() as string;
    const all = sections(buildInstallSql() as string);
    const later = all.filter((f) => f > FIRST_RELEASE_LAST_MIGRATION);
    expect(later.length).toBeGreaterThan(0);
    expect(sections(sql)).toEqual(["20261005000000_default_privileges.sql", ...later]);
    expect(sql).not.toContain("create table public.patients ");
    expect(sql.indexOf("\nbegin;\n")).toBeLessThan(sql.indexOf("-- >>> "));
    expect(sql.trimEnd().endsWith("commit;")).toBe(true);
  });
});
