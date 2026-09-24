import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiPapel } from "@/lib/api-auth";

export async function GET() {
  const r = await apiPapel("dono", "gestor", "caixa", "stock");
  if (r.response) return r.response;
  const result = await pool.query(
    `SELECT c.id, c.nome, c.ordem,
            (SELECT COUNT(*) FROM produto p WHERE p.categoria_id = c.id) AS produtos
     FROM categoria c
     WHERE c.loja_id = $1
     ORDER BY c.ordem ASC, c.nome ASC`,
    [r.sessao.lojaId]
  );
  return NextResponse.json(result.rows);
}

export async function POST(req: Request) {
  const r = await apiPapel("dono", "gestor");
  if (r.response) return r.response;
  const { nome, ordem = 0 } = await req.json();
  if (!nome?.trim()) {
    return NextResponse.json({ error: "O nome é obrigatório" }, { status: 400 });
  }
  const result = await pool.query(
    `INSERT INTO categoria (loja_id, nome, ordem) VALUES ($1, $2, $3) RETURNING id, nome, ordem`,
    [r.sessao.lojaId, nome.trim(), Number(ordem) || 0]
  );
  return NextResponse.json(result.rows[0], { status: 201 });
}

export async function PUT(req: Request) {
  const r = await apiPapel("dono", "gestor");
  if (r.response) return r.response;
  const { id, nome } = await req.json();
  if (!nome?.trim()) {
    return NextResponse.json({ error: "O nome é obrigatório" }, { status: 400 });
  }
  const existente = await pool.query(
    "SELECT id FROM categoria WHERE id = $1 AND loja_id = $2",
    [id, r.sessao.lojaId]
  );
  if (existente.rows.length === 0) {
    return NextResponse.json({ error: "Categoria não encontrada" }, { status: 404 });
  }
  const result = await pool.query(
    `UPDATE categoria SET nome = $1 WHERE id = $2 RETURNING id, nome, ordem`,
    [nome.trim(), id]
  );
  return NextResponse.json(result.rows[0]);
}