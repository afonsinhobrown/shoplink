import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { createNetShopCharge, buildPaymentReference, type NetShopMethod } from "@/lib/netshop";

const PAD = (n: number) => String(n).padStart(4, "0");

class ApiError extends Error {}

function metodoToNetShop(metodo: string): NetShopMethod {
  if (metodo === "cartao") return "card";
  if (metodo === "emola") return "emola";
  return "mpesa";
}

// POST /api/publico/[slug]/pedidos
// Cria um pedido online: tipo reserva (paga na loja) ou compra_online (paga já via NetShop).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  interface PedidoBody {
    nome?: string;
    telefone?: string | number;
    email?: string | null;
    tipo?: string;
    metodo_pagamento?: string;
    tipo_entrega?: string;
    endereco_entrega?: string | null;
    itens?: { produto_id: string; quantidade: number }[];
  }
  let body: PedidoBody;
  try {
    body = (await req.json()) as PedidoBody;
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const {
    nome,
    telefone,
    email,
    tipo = "reserva",
    metodo_pagamento = "na_loja",
    tipo_entrega = "levantamento",
    endereco_entrega,
    itens,
  } = body ?? {};

  if (!nome?.trim()) {
    return NextResponse.json({ error: "Indique o seu nome" }, { status: 400 });
  }
  if (!telefone || String(telefone).replace(/\D/g, "").length < 9) {
    return NextResponse.json(
      { error: "Indique um número de telemóvel válido (9 dígitos)" },
      { status: 400 }
    );
  }
  if (!Array.isArray(itens) || itens.length === 0) {
    return NextResponse.json({ error: "O pedido não tem itens" }, { status: 400 });
  }
  if (!["reserva", "compra_online"].includes(tipo)) {
    return NextResponse.json({ error: "Tipo de pedido inválido" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const loja = await client.query(
      `SELECT id, nome, moeda, tempo_expiracao_reserva_horas,
              permite_venda_online, permite_reserva
       FROM loja WHERE slug_publico = $1 AND ativo = true
       FOR UPDATE`,
      [slug]
    );
    if (loja.rows.length === 0) {
      throw new ApiError("Loja não encontrada");
    }
    const L = loja.rows[0];

    const isCompra = tipo === "compra_online";
    if (isCompra && !L.permite_venda_online) {
      throw new ApiError("Esta loja não aceita compras online no momento.");
    }
    if (!isCompra && !L.permite_reserva) {
      throw new ApiError("Esta loja não aceita reservas online no momento.");
    }

    if (isCompra) {
      if (!["mpesa", "emola", "cartao"].includes(metodo_pagamento)) {
        throw new ApiError("Escolha um método de pagamento online (M-Pesa, e-Mola ou Cartão).");
      }
    } else {
      if (metodo_pagamento !== "na_loja") {
        throw new ApiError("As reservas são pagas na loja.");
      }
    }

    // Cliente online
    const cli = await client.query(
      `INSERT INTO cliente_online (loja_id, nome, telefone, email)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [L.id, nome.trim(), String(telefone).trim(), email ?? null]
    );
    const clienteOnlineId = cli.rows[0].id;

    // Número do pedido
    const cnt = await client.query(
      `SELECT COUNT(*) AS c FROM pedido_online WHERE loja_id = $1 AND data_criacao::date = CURRENT_DATE`,
      [L.id]
    );
    const numeroPedido =
      `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-` +
      PAD(Number(cnt.rows[0].c) + 1);

    // Validar itens (stock disponível = stock atual - reservas ativas)
    let subtotal = 0;
    const itensValidados: {
      produto_id: string;
      quantidade: number;
      preco_unitario: number;
      nome: string;
    }[] = [];

    for (const item of itens) {
      const qtd = Number(item.quantidade);
      if (!qtd || qtd <= 0) {
        throw new ApiError("Quantidade inválida num dos produtos.");
      }
      // Bloqueia a linha do produto para serializar a reserva de stock
      const prod = await client.query(
        `SELECT id, nome, preco_venda, controla_stock FROM produto
         WHERE id = $1 AND loja_id = $2 AND ativo = true AND disponivel_online = true
         FOR UPDATE`,
        [item.produto_id, L.id]
      );
      if (prod.rows.length === 0) {
        throw new ApiError("Produto não encontrado ou indisponível online.");
      }
      const p = prod.rows[0];

      if (p.controla_stock) {
        const atual = await client.query(
          `SELECT COALESCE(SUM(CASE WHEN m.tipo = 'entrada' THEN m.quantidade
                                   WHEN m.tipo = 'devolucao' THEN m.quantidade
                                   WHEN m.tipo IN ('saida_venda','quebra') THEN -m.quantidade
                                   WHEN m.tipo = 'ajuste' THEN m.quantidade END), 0) AS atual
           FROM movimento_stock m WHERE m.produto_id = $1`,
          [p.id]
        );
        const reservado = await client.query(
          `SELECT COALESCE(SUM(sr.quantidade), 0) AS reservado
           FROM stock_reserva sr
           JOIN pedido_online po ON po.id = sr.pedido_online_id
           WHERE sr.produto_id = $1 AND po.status IN ('aguardando_confirmacao','confirmado')`,
          [p.id]
        );
        const disponivel = Number(atual.rows[0].atual) - Number(reservado.rows[0].reservado);
        if (qtd > disponivel) {
          throw new ApiError(`Stock insuficiente para "${p.nome}" (disponível: ${disponivel}).`);
        }
      }

      const preco = Number(p.preco_venda);
      const subtotalLinha = Number((qtd * preco).toFixed(2));
      subtotal += subtotalLinha;
      itensValidados.push({
        produto_id: p.id,
        quantidade: qtd,
        preco_unitario: preco,
        nome: p.nome,
      });
    }

    const total = Number(subtotal.toFixed(2));

    const expiracaoHoras = Number(L.tempo_expiracao_reserva_horas) || 24;
    const pedido = await client.query(
      `INSERT INTO pedido_online (loja_id, cliente_online_id, numero_pedido, tipo,
                                  metodo_pagamento, status_pagamento, tipo_entrega,
                                  endereco_entrega, subtotal, total, status, data_expiracao)
       VALUES ($1, $2, $3, $4, $5, 'pendente', $6, $7, $8, $9, 'aguardando_confirmacao',
               now() + make_interval(hours => $10))
       RETURNING id, numero_pedido, status, status_pagamento, total, data_expiracao`,
      [
        L.id,
        clienteOnlineId,
        numeroPedido,
        tipo,
        metodo_pagamento,
        tipo_entrega,
        endereco_entrega ?? null,
        subtotal,
        total,
        expiracaoHoras,
      ]
    );
    const pedidoId = pedido.rows[0].id;

    for (const it of itensValidados) {
      await client.query(
        `INSERT INTO pedido_online_item (pedido_online_id, produto_id, quantidade, preco_unitario, subtotal_linha)
         VALUES ($1, $2, $3, $4, $5)`,
        [pedidoId, it.produto_id, it.quantidade, it.preco_unitario, Number((it.quantidade * it.preco_unitario).toFixed(2))]
      );
      await client.query(
        `INSERT INTO stock_reserva (produto_id, pedido_online_id, quantidade)
         VALUES ($1, $2, $3)`,
        [it.produto_id, pedidoId, it.quantidade]
      );
    }

    await client.query("COMMIT");

    const pedidoData = {
      numero_pedido: pedido.rows[0].numero_pedido,
      type: tipo,
      status: pedido.rows[0].status,
      total: pedido.rows[0].total,
      data_expiracao: pedido.rows[0].data_expiracao,
      metodo_pagamento,
    };

    // Compra online: iniciar cobrança real na NetShop DEPOIS do commit (não segura a transação).
    if (isCompra && metodo_pagamento !== "na_loja") {
      const reference = buildPaymentReference();
      const protocol =
        new URL(req.url).protocol || process.env.APP_URL?.startsWith("https") ? "https:" : "http:";
      const base = (process.env.APP_URL || `${protocol}//${req.headers.get("host")}`).replace(/\/$/, "");
      const returnUrl = `${base}/loja/${slug}/pedido/${numeroPedido}?pg=1`;

      try {
        const charge = await createNetShopCharge({
          amountMZN: total,
          reference,
          method: metodoToNetShop(metodo_pagamento),
          msisdn: String(telefone).replace(/\D/g, ""),
          returnUrl,
        });

        await pool.query(
          `UPDATE pedido_online SET cobranca_id = $1, referencia_pagamento = $2 WHERE id = $3`,
          [charge.id, reference, pedidoId]
        );

        const chargeStatus = String(charge.status).toLowerCase();
        if (chargeStatus === "paid" || chargeStatus === "succeeded") {
          await pool.query(
            `UPDATE pedido_online SET status_pagamento = 'pago',
                    status = CASE WHEN tipo = 'compra_online' THEN 'confirmado' ELSE status END,
                    data_atualizacao = now()
             WHERE id = $1 AND status_pagamento = 'pendente'`,
            [pedidoId]
          );
          return NextResponse.json({
            pedido: pedidoData,
            pagamento: { status: "pago", reference, total },
          });
        }
        if (chargeStatus === "failed") {
          const motivo = charge.failedReason || charge.responseDesc || "cobrança recusada.";
          await pool.query(
            `UPDATE pedido_online SET status_pagamento = 'falhou', data_atualizacao = now() WHERE id = $1`,
            [pedidoId]
          );
          return NextResponse.json(
            {
              error: `A NetShop recusou a cobrança: ${motivo}. Reveja os dados e tente novamente.`,
              pedido: pedidoData,
            },
            { status: 502 }
          );
        }

        return NextResponse.json({
          pedido: pedidoData,
          pagamento: {
            status: "pendente",
            reference,
            chargeId: charge.id,
            checkoutUrl: charge.checkoutUrl ?? null,
            total,
          },
        });
      } catch (chargeErr: unknown) {
        const chargeInfo =
          chargeErr && typeof chargeErr === "object" && "charge" in chargeErr
            ? (chargeErr as { charge: { failedReason?: string | null; responseDesc?: string | null } }).charge
            : null;
        const motivo =
          chargeInfo?.failedReason ||
          chargeInfo?.responseDesc ||
          (chargeErr instanceof Error ? chargeErr.message : null) ||
          "erro ao contactar a NetShop";
        await pool
          .query(
            `UPDATE pedido_online SET status_pagamento = 'falhou', data_atualizacao = now()
             WHERE id = $1 AND status_pagamento = 'pendente'`,
            [pedidoId]
          )
          .catch(() => {});
        return NextResponse.json(
          {
            error: `Não foi possível criar a cobrança na NetShop: ${motivo}`,
            pedido: pedidoData,
          },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({ pedido: pedidoData, pagamento: null }, { status: 201 });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("pedido online erro:", e);
    return NextResponse.json({ error: "Falha ao registar o pedido" }, { status: 500 });
  } finally {
    client.release();
  }
}