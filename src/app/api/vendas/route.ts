import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiPapel } from "@/lib/api-auth";

const PAD = (n: number) => String(n).padStart(4, "0");

export async function GET(req: Request) {
  const r = await apiPapel("dono", "gestor", "caixa");
  if (r.response) return r.response;
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);

  const params: unknown[] = [r.sessao.lojaId];
  let sql = `
    SELECT v.id, v.numero_recibo, v.subtotal, v.desconto_total, v.total,
           v.status, v.origem, v.data_venda,
           u.nome AS utilizador_nome, c.nome AS cliente_nome,
           (SELECT STRING_AGG(DISTINCT vp.metodo, ', ') FROM venda_pagamento vp WHERE vp.venda_id = v.id) AS metodos
    FROM venda v
    JOIN utilizador u ON u.id = v.utilizador_id
    LEFT JOIN cliente c ON c.id = v.cliente_id
    WHERE v.loja_id = $1`;
  if (q) {
    params.push(`%${q}%`);
    sql += ` AND (v.numero_recibo ILIKE $${params.length} OR c.nome ILIKE $${params.length})`;
  }
  sql += ` ORDER BY v.data_venda DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await pool.query(sql, params);
  return NextResponse.json(result.rows);
}

export async function POST(req: Request) {
  const r = await apiPapel("dono", "gestor", "caixa");
  if (r.response) return r.response;
  const body = await req.json();
  const { itens, pagamentos, cliente_id, desconto_total = 0, imposto_total = 0 } = body ?? {};

  if (!Array.isArray(itens) || itens.length === 0) {
    return NextResponse.json({ error: "A venda não tem itens" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const caixa = await client.query(
      `SELECT id, conta_financeira_id FROM caixa_sessao WHERE loja_id = $1 AND utilizador_id = $2 AND status = 'aberta'
       ORDER BY data_abertura DESC LIMIT 1`,
      [r.sessao.lojaId, r.sessao.uid]
    );
    const caixaSessaoId = caixa.rows[0]?.id ?? null;
    const caixaContaId = caixa.rows[0]?.conta_financeira_id ?? null;

    if (!caixaSessaoId) {
      throw new ApiError("Tem de abrir o Caixa primeiro para poder faturar.");
    }

    let catFinanceira = await client.query(
      `SELECT id FROM categoria_financeira WHERE loja_id = $1 AND nome = 'Vendas' LIMIT 1`,
      [r.sessao.lojaId]
    );
    if (catFinanceira.rows.length === 0) {
      catFinanceira = await client.query(
        `INSERT INTO categoria_financeira (loja_id, nome, tipo) VALUES ($1, 'Vendas', 'receita') RETURNING id`,
        [r.sessao.lojaId]
      );
    }
    const categoriaVendasId = catFinanceira.rows[0]?.id ?? null;

    let contasFin = await client.query(
      `SELECT id, tipo FROM conta_financeira WHERE loja_id = $1 AND ativo = true`,
      [r.sessao.lojaId]
    );
    if (contasFin.rows.length === 0) {
      await client.query(
        `INSERT INTO conta_financeira (loja_id, nome, tipo, saldo_inicial) VALUES ($1, 'Caixa Principal', 'caixa', 0)`,
        [r.sessao.lojaId]
      );
      contasFin = await client.query(
        `SELECT id, tipo FROM conta_financeira WHERE loja_id = $1 AND ativo = true`,
        [r.sessao.lojaId]
      );
    }

    // Recolher produtos e validar stock
    const ids = [...new Set(itens.map((i: { produto_id: string }) => i.produto_id))];
    const prods = await client.query(
      `SELECT p.id, p.nome, p.controla_stock, COALESCE(v.quantidade_atual,0) AS stock_atual
       FROM produto p LEFT JOIN vw_stock_atual v ON v.produto_id = p.id
       WHERE p.id = ANY($1) AND p.loja_id = $2 AND p.ativo = true`,
      [ids, r.sessao.lojaId]
    );
    const prodMap = new Map(prods.rows.map((p) => [p.id, p]));

    let subtotal = 0;
    for (const item of itens) {
      const prod = prodMap.get(item.produto_id);
      if (!prod) {
        throw new ApiError(`Produto inválido ou inativo`);
      }
      if (prod.controla_stock && Number(item.quantidade) > prod.stock_atual) {
        throw new ApiError(
          `Stock insuficiente para "${prod.nome}" (disponível: ${prod.stock_atual})`
        );
      }
      subtotal +=
        Number(item.quantidade) * Number(item.preco_unitario) -
        Number(item.desconto_linha ?? 0);
    }

    const total = Number((subtotal + Number(imposto_total) - Number(desconto_total)).toFixed(2));
    if (total < 0) {
      throw new ApiError("O total da venda não pode ser negativo");
    }

    // Pagamentos
    const pagamentoList: { metodo: string; valor: number }[] = Array.isArray(
      pagamentos
    )
      ? pagamentos.map((p) => ({ metodo: p.metodo, valor: Number(p.valor) }))
      : [];
    const somaPagos = pagamentoList.reduce((s, p) => s + p.valor, 0);
    const fiadoValor = pagamentoList
      .filter((p) => p.metodo === "fiado")
      .reduce((s, p) => s + p.valor, 0);

    if (Math.abs(somaPagos - total) > 0.01) {
      throw new ApiError("A soma dos pagamentos não corresponde ao total");
    }

    let status = "concluida";
    if (fiadoValor > 0) {
      if (!cliente_id) {
        throw new ApiError("Venda a fiado exige a seleção de um cliente");
      }
      const cli = await client.query(
        `SELECT id, nome, limite_fiado,
                (SELECT COALESCE(SUM(total),0) FROM venda WHERE cliente_id = $1 AND status = 'pendente_fiado') AS saldo
         FROM cliente WHERE id = $1 AND loja_id = $2`,
        [cliente_id, r.sessao.lojaId]
      );
      if (cli.rows.length === 0) {
        throw new ApiError("Cliente não encontrado");
      }
      const { limite_fiado, saldo } = cli.rows[0];
      if (limite_fiado > 0 && Number(saldo) + fiadoValor > limite_fiado) {
        throw new ApiError(
          `O cliente ultrapassa o limite de fiado (${limite_fiado} MZN)`
        );
      }
      status = "pendente_fiado";
    }

    // Número do recibo
    const cnt = await client.query(
      `SELECT COUNT(*) AS c FROM venda WHERE loja_id = $1 AND data_venda::date = CURRENT_DATE`,
      [r.sessao.lojaId]
    );
    const recibo =
      `REC-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-` +
      PAD(Number(cnt.rows[0].c) + 1);

    const venda = await client.query(
      `INSERT INTO venda (loja_id, caixa_sessao_id, utilizador_id, cliente_id,
                          numero_recibo, subtotal, desconto_total, imposto_total, total, status,
                          origem, sincronizado_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'online', now())
       RETURNING id, numero_recibo, total, status`,
      [
        r.sessao.lojaId, caixaSessaoId, r.sessao.uid, cliente_id ?? null,
        recibo, Number(subtotal.toFixed(2)), Number(desconto_total) || 0, Number(imposto_total) || 0, total,
        status,
      ]
    );
    const vendaId = venda.rows[0].id;

    for (const item of itens) {
      const descontoLinha = Number(item.desconto_linha ?? 0);
      const subtotalLinha =
        Number(item.quantidade) * Number(item.preco_unitario) - descontoLinha;
      await client.query(
        `INSERT INTO venda_item (venda_id, produto_id, quantidade, preco_unitario, desconto_linha, imposto_linha, subtotal_linha)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [vendaId, item.produto_id, Number(item.quantidade), Number(item.preco_unitario), descontoLinha, Number(item.imposto_linha || 0), subtotalLinha]
      );
      const prod = prodMap.get(item.produto_id);
      if (prod?.controla_stock) {
        await client.query(
          `INSERT INTO movimento_stock (loja_id, produto_id, utilizador_id, tipo, quantidade, referencia_id)
           VALUES ($1, $2, $3, 'saida_venda', $4, $5)`,
          [r.sessao.lojaId, item.produto_id, r.sessao.uid, -Number(item.quantidade), vendaId]
        );
      }
    }

    for (const p of pagamentoList) {
      let contaDestino = null;
      if (p.metodo === 'dinheiro') {
        contaDestino = caixaContaId || contasFin.rows.find((c) => c.tipo === 'caixa')?.id || contasFin.rows[0]?.id;
      } else if (p.metodo === 'mpesa') {
        contaDestino = contasFin.rows.find((c) => c.tipo === 'mpesa')?.id || contasFin.rows[0]?.id;
      } else if (p.metodo === 'emola') {
        contaDestino = contasFin.rows.find((c) => c.tipo === 'emola')?.id || contasFin.rows[0]?.id;
      } else if (['cartao', 'transferencia', 'cheque'].includes(p.metodo)) {
        contaDestino = contasFin.rows.find((c) => c.tipo === 'banco')?.id || contasFin.rows[0]?.id;
      }

      await client.query(
        `INSERT INTO venda_pagamento (venda_id, metodo, valor, conta_financeira_id) VALUES ($1, $2, $3, $4)`,
        [vendaId, p.metodo, p.valor, contaDestino]
      );

      if (p.metodo !== 'fiado' && categoriaVendasId && contaDestino) {
        await client.query(
           `INSERT INTO lancamento_financeiro 
            (loja_id, conta_financeira_id, categoria_financeira_id, tipo, valor, descricao, origem_tipo, origem_id, status, utilizador_id)
            VALUES ($1, $2, $3, 'receita', $4, $5, 'venda', $6, 'confirmado', $7)`,
           [r.sessao.lojaId, contaDestino, categoriaVendasId, p.valor, `Venda ${recibo} - ${p.metodo}`, vendaId, r.sessao.uid]
        );
      }
    }

    if (caixaSessaoId) {
      await client.query(
        `INSERT INTO caixa_movimento (caixa_sessao_id, tipo, valor, observacao)
         VALUES ($1, 'venda', $2, $3)`,
        [caixaSessaoId, total, null]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json(venda.rows[0], { status: 201 });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("venda erro:", e);
    return NextResponse.json({ error: "Falha ao registar venda" }, { status: 500 });
  } finally {
    client.release();
  }
}

class ApiError extends Error {}