import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiPapel } from "@/lib/api-auth";

// GET /api/pedidos  -> pedidos online da loja (painel)
export async function GET(req: Request) {
  const r = await apiPapel("dono", "gestor");
  if (r.response) return r.response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "";
  const limit = Math.min(Number(searchParams.get("limit") ?? 100), 300);

  const params: unknown[] = [r.sessao.lojaId];
  let sql = `
    SELECT po.id, po.numero_pedido, po.tipo, po.status, po.status_pagamento,
           po.metodo_pagamento, po.tipo_entrega, po.endereco_entrega,
           po.subtotal, po.total, po.data_criacao, po.data_expiracao, po.venda_id,
           co.nome AS cliente_nome, co.telefone AS cliente_telefone,
           (SELECT COUNT(*) FROM pedido_online_item poi WHERE poi.pedido_online_id = po.id) AS num_itens
    FROM pedido_online po
    JOIN cliente_online co ON co.id = po.cliente_online_id
    WHERE po.loja_id = $1`;
  if (status) {
    params.push(status);
    sql += ` AND po.status = $${params.length}`;
  }
  sql += ` ORDER BY po.data_criacao DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await pool.query(sql, params);
  return NextResponse.json(result.rows);
}