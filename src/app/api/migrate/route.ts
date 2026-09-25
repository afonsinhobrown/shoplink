import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    await pool.query(`ALTER TABLE loja ADD COLUMN IF NOT EXISTS logotipo_url varchar(500);`);
    await pool.query(`ALTER TABLE loja ADD COLUMN IF NOT EXISTS imposto_padrao numeric(5,2) DEFAULT 0;`);
    await pool.query(`ALTER TABLE produto ADD COLUMN IF NOT EXISTS isento_imposto boolean DEFAULT false;`);
    await pool.query(`ALTER TABLE venda ADD COLUMN IF NOT EXISTS imposto_total numeric(12,2) DEFAULT 0;`);
    await pool.query(`ALTER TABLE venda_item ADD COLUMN IF NOT EXISTS imposto_linha numeric(12,2) DEFAULT 0;`);
    await pool.query(`ALTER TABLE loja ADD COLUMN IF NOT EXISTS tempo_inatividade integer DEFAULT 60;`);
    await pool.query(`ALTER TABLE loja ADD COLUMN IF NOT EXISTS nuit varchar(50);`);
    await pool.query(`ALTER TABLE loja ADD COLUMN IF NOT EXISTS endereco text;`);
    await pool.query(`ALTER TABLE loja ADD COLUMN IF NOT EXISTS telefone varchar(50);`);
    await pool.query(`ALTER TABLE tenant ADD COLUMN IF NOT EXISTS nuit varchar(50);`);
    await pool.query(`ALTER TABLE tenant ADD COLUMN IF NOT EXISTS telefone varchar(50);`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
