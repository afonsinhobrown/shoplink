import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiPapel } from "@/lib/api-auth";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await apiPapel("dono", "gestor");
  if (r.response) return r.response;
  const { id } = await params;
  const existente = await pool.query(
    "SELECT id FROM cliente WHERE id = $1 AND loja_id = $2",
    [id, r.sessao.lojaId]
  );
  if (existente.rows.length === 0) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }
  await pool.query("UPDATE cliente SET ativo = false WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}