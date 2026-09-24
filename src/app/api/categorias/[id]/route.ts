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

  const cat = await pool.query(
    "SELECT id FROM categoria WHERE id = $1 AND loja_id = $2",
    [id, r.sessao.lojaId]
  );
  if (cat.rows.length === 0) {
    return NextResponse.json({ error: "Categoria não encontrada" }, { status: 404 });
  }

  const usada = await pool.query(
    "SELECT id FROM produto WHERE categoria_id = $1 LIMIT 1",
    [id]
  );
  if (usada.rows.length > 0) {
    return NextResponse.json(
      { error: "Categoria tem produtos associados — remova-os primeiro" },
      { status: 409 }
    );
  }

  await pool.query("DELETE FROM categoria WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}