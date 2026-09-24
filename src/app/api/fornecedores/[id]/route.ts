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

  const fornecedor = await pool.query(
    "SELECT id FROM fornecedor WHERE id = $1 AND loja_id = $2",
    [id, r.sessao.lojaId]
  );
  if (fornecedor.rows.length === 0) {
    return NextResponse.json({ error: "Fornecedor não encontrado" }, { status: 404 });
  }

  const temCompras = await pool.query(
    "SELECT id FROM compra WHERE fornecedor_id = $1 LIMIT 1",
    [id]
  );
  if (temCompras.rows.length > 0) {
    return NextResponse.json(
      { error: "Fornecedor tem compras registadas — não pode ser removido" },
      { status: 409 }
    );
  }

  await pool.query("DELETE FROM fornecedor WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}