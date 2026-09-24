import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiPapel } from "@/lib/api-auth";

// POST /api/licenca/recibos/[id]/enviar  -> marca o recibo como enviado ao dono
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await apiPapel("dono");
  if (r.response) return r.response;
  const { id } = await params;

  const upd = await pool.query(
    `UPDATE licenca_pagamento
     SET recibo_enviado = true, data_envio_recibo = now()
     WHERE id = $1 AND loja_id = $2
       AND status = 'pago' AND recibo_numero IS NOT NULL
       AND COALESCE(recibo_enviado, false) = false
     RETURNING recibo_numero`,
    [id, r.sessao.lojaId]
  );
  if (upd.rows.length === 0) {
    return NextResponse.json(
      { error: "Recibo não encontrado ou já enviado." },
      { status: 400 }
    );
  }
  return NextResponse.json({
    ok: true,
    recibo_numero: upd.rows[0].recibo_numero,
  });
}