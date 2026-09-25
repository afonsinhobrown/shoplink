import pg from "pg";

const url = "postgresql://neondb_owner:npg_bKgz8Pi9CDul@ep-green-pond-al24ne9d-pooler.c-3.eu-central-1.aws.neon.tech/cafepoint-db?sslmode=require&channel_binding=require";

const pool = new pg.Pool({ connectionString: url });
async function main() {
  try {
    await pool.query(`ALTER TABLE loja ADD COLUMN IF NOT EXISTS logotipo_url varchar(500);`);
    await pool.query(`ALTER TABLE loja ADD COLUMN IF NOT EXISTS imposto_padrao numeric(5,2) DEFAULT 0;`);
    await pool.query(`ALTER TABLE produto ADD COLUMN IF NOT EXISTS isento_imposto boolean DEFAULT false;`);
    await pool.query(`ALTER TABLE venda ADD COLUMN IF NOT EXISTS imposto_total numeric(12,2) DEFAULT 0;`);
    await pool.query(`ALTER TABLE venda_item ADD COLUMN IF NOT EXISTS imposto_linha numeric(12,2) DEFAULT 0;`);
    console.log("Colunas adicionadas com sucesso!");
  } catch (error) {
    console.error("Erro:", error);
  } finally {
    process.exit(0);
  }
}
main();
