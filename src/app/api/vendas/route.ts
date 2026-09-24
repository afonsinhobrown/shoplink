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
  const { itens, pagamentos, cliente_id, desconto_total = 0 } = body ?? {};

  if (!Array.isArray(itens) || itens.length === 0) {
    return NextResponse.json({ error: "A venda não tem itens" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const caixa = await client.query(
      `SELECT id FROM caixa_sessao WHERE loja_id = $1 AND status = 'aberta'
       ORDER BY data_abertura DESC LIMIT 1`,
      [r.sessao.lojaId]
    );
    const caixaSessaoId = caixa.rows[0]?.id ?? null;

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

    const total = Number((subtotal - Number(desconto_total)).toFixed(2));
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
                          numero_recibo, subtotal, desconto_total, total, status,
                          origem, sincronizado_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'online', now())
       RETURNING id, numero_recibo, total, status`,
      [
        r.sessao.lojaId, caixaSessaoId, r.sessao.uid, cliente_id ?? null,
        recibo, Number(subtotal.toFixed(2)), Number(desconto_total) || 0, total,
        status,
      ]
    );
    const vendaId = venda.rows[0].id;

    for (const item of itens) {
      const descontoLinha = Number(item.desconto_linha ?? 0);
      const subtotalLinha =
        Number(item.quantidade) * Number(item.preco_unitario) - descontoLinha;
      await client.query(
        `INSERT INTO venda_item (venda_id, produto_id, quantidade, preco_unitario, desconto_linha, subtotal_linha)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [vendaId, item.produto_id, Number(item.quantidade), Number(item.preco_unitario), descontoLinha, subtotalLinha]
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
      await client.query(
        `INSERT INTO venda_pagamento (venda_id, metodo, valor) VALUES ($1, $2, $3)`,
        [vendaId, p.metodo, p.valor]
      );
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