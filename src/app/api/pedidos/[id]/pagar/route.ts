import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiPapel } from "@/lib/api-auth";
import { appBaseUrl } from "@/lib/app-url";
import { REF_PREFIX } from "@/lib/paysuite";
import {
  createPaySuiteCharge,
  classificarEstado,
  getPaySuiteCharge,
} from "@/lib/paysuite";

class ApiError extends Error {
  constructor(message: string, public status: number = 400) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Verifica o estado do pagamento do pedido na PaySuite.
 * NÃO aplica alterações — só lê. O webhook é a fonte de verdade.
 */
async function verificarPagamentoPedido(pedidoId: string, lojaId: string): Promise<{
  status: "pago" | "falhou" | "pendente" | null;
  metodo?: string | null;
  cobrancaId?: string;
  total?: number;
}> {
  const pedido = await pool.query(
    `SELECT id, cobranca_id, metodo_pagamento, total, status_pagamento
     FROM pedido_online
     WHERE id = $1 AND loja_id = $2`,
    [pedidoId, lojaId]
  );
  if (pedido.rows.length === 0) return { status: null };

  const { cobranca_id: cobrancaId, metodo_pagamento: metodo, total, status_pagamento } = pedido.rows[0];
  if (!cobrancaId || status_pagamento !== "pendente") {
    return { status: status_pagamento === "pago" ? "pago" : status_pagamento === "falhou" ? "falhou" : "pendente", metodo, cobrancaId, total: Number(total) };
  }

  const check = await getPaySuiteCharge(cobrancaId);
  if (!check.paid && !check.failed) return { status: "pendente", metodo, cobrancaId, total: Number(total) };

  return {
    status: check.paid ? "pago" : "falhou",
    metodo: check.paid ? null : metodo, // webhook vai atualizar
    cobrancaId,
    total: Number(total),
  };
}

/**
 * Aplica o pagamento confirmado ao pedido (chamado pelo webhook ou reconciliação manual).
 * Idempotente: só actua se status_pagamento = 'pendente'.
 */
async function aplicarPagamentoPedido(
  client: any,
  pedidoId: string,
  metodo: string | null,
  statusPago: "pago" | "falhou"
): Promise<void> {
  // Para compra_online, ao pagar muda status para 'confirmado'
  await client.query(
    `UPDATE pedido_online
     SET status_pagamento = $2,
         metodo_pagamento = COALESCE($3, metodo_pagamento),
         status = CASE WHEN tipo = 'compra_online' AND $2 = 'pago' THEN 'confirmado' ELSE status END,
         data_atualizacao = now()
     WHERE id = $1 AND status_pagamento = 'pendente'`,
    [pedidoId, statusPago, metodo]
  );
}

// GET /api/pedidos/[id]/pagar -> verifica estado do pagamento (fallback do webhook)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const r = await apiPapel("dono", "gestor");
    if (r.response) return r.response;
    const { id } = await params;

    const estado = await verificarPagamentoPedido(id, r.sessao.lojaId);
    return NextResponse.json({ ok: true, ...estado });
  } catch (e) {
    console.error("pedido/pagar GET erro:", e);
    return NextResponse.json({ error: "Falha ao verificar o pagamento." }, { status: 500 });
  }
}

// POST /api/pedidos/[id]/pagar -> inicia pagamento PaySuite para compra_online
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const r = await apiPapel("dono", "gestor");
    if (r.response) return r.response;
    const { id } = await params;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Busca o pedido e bloqueia a linha
      const pedido = await client.query(
        `SELECT po.id, po.numero_pedido, po.tipo, po.status, po.status_pagamento,
                po.total, po.referencia_pagamento, po.cobranca_id, po.checkout_url
         FROM pedido_online po
         WHERE po.id = $1 AND po.loja_id = $2
         FOR UPDATE`,
        [id, r.sessao.lojaId]
      );
      if (pedido.rows.length === 0) {
        throw new ApiError("Pedido não encontrado", 404);
      }
      const p = pedido.rows[0];

      if (p.tipo !== "compra_online") {
        throw new ApiError("Apenas pedidos de compra online podem ser pagos aqui", 400);
      }
      if (p.status_pagamento !== "pendente") {
        throw new ApiError(`Pagamento já ${p.status_pagamento}`, 400);
      }

      // Idempotência: se já há cobrança criada, reusa
      if (p.cobranca_id && p.checkout_url) {
        await client.query("COMMIT");
        return NextResponse.json({
          ok: true,
          status: "pendente",
          checkout_url: p.checkout_url,
          pagamento_id: p.id,
          reusado: true,
        });
      }

      const reference = `${REF_PREFIX}${p.numero_pedido}`;
      const valor = Number(p.total);
      const base = appBaseUrl(req);
      const returnUrl = `${base}/pedidos/${id}?pagamento_id=${id}`;
      const webhookUrl = `${base}/api/webhooks/paysuite`;

      let charge;
      try {
        charge = await createPaySuiteCharge({
          amountMZN: valor,
          reference,
          returnUrl,
          webhookUrl,
          description: `Pedido ${p.numero_pedido} - ${reference}`,
        });
      } catch (chargeErr) {
        const motivo = chargeErr instanceof Error ? chargeErr.message : "erro ao contactar a PaySuite";
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: `Não foi possível criar o pagamento: ${motivo}` },
          { status: 502 }
        );
      }

      await client.query(
        `UPDATE pedido_online
         SET cobranca_id = $1, checkout_url = $2, referencia_pagamento = $3, observacao = $4, data_atualizacao = now()
         WHERE id = $5`,
        [charge.id, charge.checkoutUrl ?? null, reference, `PaySuite ${charge.status}`.slice(0, 250), id]
      );

      await client.query("COMMIT");

      const { paid, failed } = classificarEstado(charge.status);

      if (paid) {
        // Pagamento aprovado sincronamente — aplica já
        await client.query("BEGIN");
        await aplicarPagamentoPedido(client, id, null, "pago");
        await client.query("COMMIT");
        return NextResponse.json({ ok: true, status: "pago" });
      }

      if (failed) {
        await pool.query(
          `UPDATE pedido_online SET status_pagamento = 'falhou' WHERE id = $1`,
          [id]
        );
        return NextResponse.json(
          { error: "A PaySuite recusou o pagamento. Tente novamente." },
          { status: 502 }
        );
      }

      // pendente -> devolve checkout_url
      return NextResponse.json({
        ok: true,
        status: "pendente",
        checkout_url: charge.checkoutUrl ?? null,
        pagamento_id: id,
      });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      if (e instanceof ApiError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      console.error("pedido/pagar POST erro:", e);
      return NextResponse.json({ error: "Falha ao iniciar o pagamento" }, { status: 500 });
    } finally {
      client.release();
    }
  } catch (e) {
    console.error("pedido/pagar POST erro externo:", e);
    return NextResponse.json({ error: "Falha ao iniciar o pagamento" }, { status: 500 });
  }
}