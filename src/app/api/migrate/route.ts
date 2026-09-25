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
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS auditoria (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        loja_id uuid NOT NULL REFERENCES loja(id),
        utilizador_id uuid REFERENCES utilizador(id),
        acao text NOT NULL,
        entidade text NOT NULL,
        entidade_id text,
        detalhes jsonb,
        data_criacao timestamptz DEFAULT now()
      );
    `);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
