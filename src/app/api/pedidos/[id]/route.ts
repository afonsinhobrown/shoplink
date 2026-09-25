import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiPapel } from "@/lib/api-auth";

const PAD = (n: number) => String(n).padStart(4, "0");

class ApiError extends Error {}

const METODO_VENDA: Record<string, string> = {
  mpesa: "mpesa",
  emola: "emola",
  cartao: "cartao",
  na_loja: "dinheiro",
};

// POST /api/pedidos/[id]  body: { acao: 'confirmar' | 'concluir' | 'cancelar' }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await apiPapel("dono", "gestor");
  if (r.response) return r.response;
  const { id } = await params;
  const body = await req.json();
  const { acao } = body ?? {};

  if (!["confirmar", "concluir", "cancelar"].includes(acao)) {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const pedido = await client.query(
      `SELECT po.id, po.numero_pedido, po.tipo, po.status, po.status_pagamento,
              po.metodo_pagamento, po.tipo_entrega, po.endereco_entrega,
              po.subtotal, po.total, po.cliente_online_id,
              co.cliente_id
       FROM pedido_online po
       JOIN cliente_online co ON co.id = po.cliente_online_id
       WHERE po.id = $1 AND po.loja_id = $2
       FOR UPDATE`,
      [id, r.sessao.lojaId]
    );
    if (pedido.rows.length === 0) {
      throw new ApiError("Pedido não encontrado");
    }
    const p = pedido.rows[0];

    if (acao === "confirmar") {
      if (p.status !== "aguardando_confirmacao") {
        throw new ApiError("Este pedido já não está a aguardar confirmação.");
      }
      await client.query(
        `UPDATE pedido_online SET status = 'confirmado', data_atualizacao = now() WHERE id = $1`,
        [p.id]
      );
      await client.query("COMMIT");
      return NextResponse.json({ ok: true, status: "confirmado" });
    }

    if (acao === "cancelar") {
      if (["concluido", "cancelado", "expirado"].includes(p.status)) {
        throw new ApiError("Este pedido já foi finalizado.");
      }
      const upd = await client.query(
        `UPDATE pedido_online SET status = 'cancelado', data_atualizacao = now()
         WHERE id = $1 AND status NOT IN ('concluido','cancelado','expirado')`,
        [p.id]
      );
      if (upd.rowCount === 0) throw new ApiError("Não foi possível cancelar o pedido.");
      await client.query("COMMIT");
      return NextResponse.json({ ok: true, status: "cancelado" });
    }

    // ---- acao === 'concluir' : gera a venda real ----
    if (["concluido", "cancelado", "expirado"].includes(p.status)) {
      throw new ApiError("Este pedido já foi finalizado.");
    }

    const itens = await client.query(
      `SELECT poi.produto_id, poi.quantidade, poi.preco_unitario, poi.subtotal_linha,
              pr.controla_stock
       FROM pedido_online_item poi
       JOIN produto pr ON pr.id = poi.produto_id
       WHERE poi.pedido_online_id = $1`,
      [p.id]
    );

    // Numero do recibo
    const cnt = await client.query(
      `SELECT COUNT(*) AS c FROM venda WHERE loja_id = $1 AND data_venda::date = CURRENT_DATE`,
      [r.sessao.lojaId]
    );
    const recibo =
      `REC-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-` +
      PAD(Number(cnt.rows[0].c) + 1);

    const venda = await client.query(
      `INSERT INTO venda (loja_id, caixa_sessao_id, utilizador_id, cliente_id,
                          numero_recibo, subtotal, desconto_total, total, status, origem, sincronizado_em)
       VALUES ($1, NULL, $2, $3, $4, $5, 0, $6, 'concluida', 'online', now())
       RETURNING id, numero_recibo, total`,
      [
        r.sessao.lojaId,
        r.sessao.uid,
        p.cliente_id ?? null,
        recibo,
        Number(p.subtotal),
        Number(p.total),
      ]
    );
    const vendaId = venda.rows[0].id;

    for (const item of itens.rows) {
      await client.query(
        `INSERT INTO venda_item (venda_id, produto_id, quantidade, preco_unitario, desconto_linha, subtotal_linha)
         VALUES ($1, $2, $3, $4, 0, $5)`,
        [
          vendaId,
          item.produto_id,
          Number(item.quantidade),
          Number(item.preco_unitario),
          Number(item.subtotal_linha),
        ]
      );
      if (item.controla_stock) {
        await client.query(
          `INSERT INTO movimento_stock (loja_id, produto_id, utilizador_id, tipo, quantidade, referencia_id, observacao)
           VALUES ($1, $2, $3, 'saida_venda', $4, $5, $6)`,
          [
            r.sessao.lojaId,
            item.produto_id,
            r.sessao.uid,
            -Number(item.quantidade),
            vendaId,
            `Pedido online ${p.numero_pedido}`,
          ]
        );
      }
    }

    const catFinanceira = await client.query(
      `SELECT id FROM categoria_financeira WHERE loja_id = $1 AND nome = 'Vendas' LIMIT 1`,
      [r.sessao.lojaId]
    );
    const categoriaVendasId = catFinanceira.rows[0]?.id ?? null;

    const contasFin = await client.query(
      `SELECT id, tipo FROM conta_financeira WHERE loja_id = $1 AND ativo = true`,
      [r.sessao.lojaId]
    );
    
    const met = METODO_VENDA[p.metodo_pagamento] ?? "dinheiro";
    let contaDestino = null;
    if (met === 'mpesa') {
      contaDestino = contasFin.rows.find((c) => c.tipo === 'mpesa')?.id ?? null;
    } else if (met === 'emola') {
      contaDestino = contasFin.rows.find((c) => c.tipo === 'emola')?.id ?? null;
    } else if (['cartao', 'transferencia', 'cheque'].includes(met)) {
      contaDestino = contasFin.rows.find((c) => c.tipo === 'banco')?.id ?? null;
    } else {
      // Fallback para 'dinheiro' online
      contaDestino = contasFin.rows.find((c) => c.tipo === 'caixa')?.id ?? null;
    }

    await client.query(
      `INSERT INTO venda_pagamento (venda_id, metodo, valor, conta_financeira_id)
       VALUES ($1, $2, $3, $4)`,
      [vendaId, met, Number(p.total), contaDestino]
    );

    if (categoriaVendasId && contaDestino) {
      await client.query(
         `INSERT INTO lancamento_financeiro 
          (loja_id, conta_financeira_id, categoria_financeira_id, tipo, valor, descricao, origem_tipo, origem_id, status, utilizador_id)
          VALUES ($1, $2, $3, 'receita', $4, $5, 'venda', $6, 'confirmado', $7)`,
         [r.sessao.lojaId, contaDestino, categoriaVendasId, Number(p.total), `Venda NetShop ${recibo} - ${met}`, vendaId, r.sessao.uid]
      );
    }

    await client.query(
      `DELETE FROM stock_reserva WHERE pedido_online_id = $1`,
      [p.id]
    );

    await client.query(
      `UPDATE pedido_online
       SET status = 'concluido', venda_id = $1, data_expiracao = NULL, data_atualizacao = now()
       WHERE id = $2`,
      [vendaId, p.id]
    );

    await client.query("COMMIT");
    return NextResponse.json({ ok: true, status: "concluido", venda_id: vendaId, recibo });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("pedido acao erro:", e);
    return NextResponse.json({ error: "Falha ao executar a ação" }, { status: 500 });
  } finally {
    client.release();
  }
}