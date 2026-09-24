import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiPapel } from "@/lib/api-auth";

export async function GET() {
  const r = await apiPapel("dono", "gestor", "caixa", "stock");
  if (r.response) return r.response;
  const result = await pool.query(
    `SELECT id, nome, contacto, email, endereco, ativo
     FROM fornecedor WHERE loja_id = $1 ORDER BY nome ASC`,
    [r.sessao.lojaId]
  );
  return NextResponse.json(result.rows);
}

export async function POST(req: Request) {
  const r = await apiPapel("dono", "gestor", "stock");
  if (r.response) return r.response;
  const { nome, contacto, email, endereco } = await req.json();
  if (!nome?.trim()) {
    return NextResponse.json({ error: "O nome é obrigatório" }, { status: 400 });
  }
  const result = await pool.query(
    `INSERT INTO fornecedor (loja_id, nome, contacto, email, endereco)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [r.sessao.lojaId, nome.trim(), contacto ?? null, email ?? null, endereco ?? null]
  );
  return NextResponse.json(result.rows[0], { status: 201 });
}

export async function PUT(req: Request) {
  const r = await apiPapel("dono", "gestor", "stock");
  if (r.response) return r.response;
  const { id, nome, contacto, email, endereco, ativo } = await req.json();
  const existente = await pool.query(
    "SELECT id FROM fornecedor WHERE id = $1 AND loja_id = $2",
    [id, r.sessao.lojaId]
  );
  if (existente.rows.length === 0) {
    return NextResponse.json({ error: "Fornecedor não encontrado" }, { status: 404 });
  }
  const result = await pool.query(
    `UPDATE fornecedor
     SET nome = $1, contacto = $2, email = $3, endereco = $4, ativo = $5
     WHERE id = $6 RETURNING *`,
    [nome.trim(), contacto ?? null, email ?? null, endereco ?? null, ativo ?? true, id]
  );
  return NextResponse.json(result.rows[0]);
}