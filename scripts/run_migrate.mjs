// Executa um script SQL de migração contra a base (Neon) de forma idempotente.
// Uso:  node scripts/run_migrate.mjs [ficheiro]
//       (padrão: scripts/migrate_v2.sql)
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const { Pool } = require("pg");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nomeFicheiro = process.argv[2] || "migrate_v2.sql";

function carregarEnv() {
  const envFile = join(root, ".env.local");
  if (!existsSync(envFile)) return {};
  return Object.fromEntries(
    readFileSync(envFile, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
      })
  );
}

const DATABASE_URL = carregarEnv().DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL nao encontrada em .env.local");
  process.exit(1);
}

const raw = readFileSync(join(root, "scripts", nomeFicheiro), "utf8")
  .split("\n")
  .filter((l) => l.trim() && !l.trim().startsWith("--"))
  .join("\n");

const statements = raw.split(";").map((s) => s.trim()).filter(Boolean);

const pool = new Pool({ connectionString: DATABASE_URL });
let ok = 0, errs = 0;

for (const stmt of statements) {
  try {
    await pool.query(stmt);
    ok++;
    const preview = stmt.replace(/\s+/g, " ").slice(0, 90);
    console.log(`OK  ${preview}${preview.length === 90 ? "..." : ""}`);
  } catch (e) {
    errs++;
    console.error(`ERRO  ${stmt.replace(/\s+/g, " ").slice(0, 90)}`);
    console.error(`      ${e.message}`);
  }
}

console.log(`\nMigracao ${nomeFicheiro}: ${ok} ok, ${errs} erros.`);
await pool.end();
process.exit(errs ? 1 : 0);