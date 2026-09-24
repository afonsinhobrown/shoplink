import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiPapel } from "@/lib/api-auth";

export async function GET(req: Request) {
  const r = await apiPapel("dono", "gestor", "caixa");
  if (r.response) return r.response;
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const params: unknown[] = [r.sessao.lojaId];
  let sql = `
    SELECT c.id, c.nome, c.telefone, c.limite_fiado, c.ativo,
           (SELECT COALESCE(SUM(total),0) FROM venda v WHERE v.cliente_id = c.id AND v.status = 'pendente_fiado') AS saldo_fiado
    FROM cliente c
    WHERE c.loja_id = $1`;
  if (q) {
    params.push(`%${q}%`);
    sql += ` AND (c.nome ILIKE $${params.length} OR COALESCE(c.telefone,'') ILIKE $${params.length})`;
  }
  sql += ` ORDER BY c.nome ASC`;
  const result = await pool.query(sql, params);
  return NextResponse.json(result.rows);
}

export async function POST(req: Request) {
  const r = await apiPapel("dono", "gestor", "caixa");
  if (r.response) return r.response;
  const { nome, telefone, limite_fiado = 0 } = await req.json();
  if (!nome?.trim()) {
    return NextResponse.json({ error: "O nome é obrigatório" }, { status: 400 });
  }
  const result = await pool.query(
    `INSERT INTO cliente (loja_id, nome, telefone, limite_fiado)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [r.sessao.lojaId, nome.trim(), telefone ?? null, Number(limite_fiado) || 0]
  );
  return NextResponse.json(result.rows[0], { status: 201 });
}

export async function PUT(req: Request) {
  const r = await apiPapel("dono", "gestor", "caixa");
  if (r.response) return r.response;
  const { id, nome, telefone, limite_fiado, ativo } = await req.json();
  const existente = await pool.query(
    "SELECT id FROM cliente WHERE id = $1 AND loja_id = $2",
    [id, r.sessao.lojaId]
  );
  if (existente.rows.length === 0) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }
  const result = await pool.query(
    `UPDATE cliente SET nome = $1, telefone = $2, limite_fiado = $3, ativo = $4
     WHERE id = $5 RETURNING *`,
    [nome?.trim(), telefone ?? null, Number(limite_fiado) || 0, ativo ?? true, id]
  );
  return NextResponse.json(result.rows[0]);
}