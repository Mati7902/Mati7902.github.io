// @vitest-environment node
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// @ts-expect-error: módulo JavaScript de scripts/ sin tipos
import { buildInstallSql, INSTALL_SQL_PATH } from "../../scripts/build-install-sql.mjs";

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
