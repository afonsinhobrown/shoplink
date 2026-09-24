import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getNetShopCharge } from "@/lib/netshop";

// GET /api/publico/[slug]/pedidos/[numero] -> estado público do pedido (polling)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; numero: string }> }
) {
  const { slug, numero } = await params;

  const loja = await pool.query(
    `SELECT id FROM loja WHERE slug_publico = $1 AND ativo = true`,
    [slug]
  );
  if (loja.rows.length === 0) {
    return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
  }

  const pedido = await pool.query(
    `SELECT po.id, po.numero_pedido, po.tipo, po.status, po.status_pagamento,
            po.metodo_pagamento, po.tipo_entrega, po.endereco_entrega,
            po.subtotal, po.total, po.cobranca_id, po.data_criacao, po.data_expiracao,
            co.nome, co.telefone, co.email
     FROM pedido_online po
     JOIN cliente_online co ON co.id = po.cliente_online_id
     WHERE po.loja_id = $1 AND po.numero_pedido = $2`,
    [loja.rows[0].id, numero]
  );
  if (pedido.rows.length === 0) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }
  const p = pedido.rows[0];

  // Confirmação por polling como segurança (webhook pode atrasar ou não chegar)
  if (p.status_pagamento === "pendente" && p.cobranca_id) {
    const check = await getNetShopCharge(p.cobranca_id);
    if (check.paid) {
      await pool.query(
        `UPDATE pedido_online
         SET status_pagamento = 'pago',
             status = CASE WHEN tipo = 'compra_online' THEN 'confirmado' ELSE status END,
             data_atualizacao = now()
         WHERE id = $1 AND status_pagamento = 'pendente'`,
        [p.id]
      );
      p.status = p.tipo === "compra_online" ? "confirmado" : p.status;
      p.status_pagamento = "pago";
    } else if (check.failed) {
      await pool.query(
        `UPDATE pedido_online SET status_pagamento = 'falhou', data_atualizacao = now()
         WHERE id = $1 AND status_pagamento = 'pendente'`,
        [p.id]
      );
      p.status_pagamento = "falhou";
    }
  }

  const itens = await pool.query(
    `SELECT poi.produto_id, pr.nome, poi.quantidade, poi.preco_unitario, poi.subtotal_linha
     FROM pedido_online_item poi
     JOIN produto pr ON pr.id = poi.produto_id
     WHERE poi.pedido_online_id = $1`,
    [p.id]
  );

  return NextResponse.json({
    pedido: {
      numero_pedido: p.numero_pedido,
      tipo: p.tipo,
      status: p.status,
      status_pagamento: p.status_pagamento,
      metodo_pagamento: p.metodo_pagamento,
      tipo_entrega: p.tipo_entrega,
      endereco_entrega: p.endereco_entrega,
      subtotal: Number(p.subtotal),
      total: Number(p.total),
      data_criacao: p.data_criacao,
      data_expiracao: p.data_expiracao,
    },
    cliente: { nome: p.nome, telefone: p.telefone, email: p.email },
    itens: itens.rows.map((i) => ({
      produto_id: i.produto_id,
      nome: i.nome,
      quantidade: Number(i.quantidade),
      preco_unitario: Number(i.preco_unitario),
      subtotal_linha: Number(i.subtotal_linha),
    })),
  });
}