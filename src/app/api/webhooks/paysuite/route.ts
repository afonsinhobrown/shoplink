import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { REF_PREFIX } from "@/lib/paysuite";
import { LICENSE_PREFIX, aplicarPagamentoLicenca } from "@/lib/licenca";
import * as crypto from "crypto";

/**
 * Assinatura do webhook PaySuite: HMAC-SHA256 do corpo cru em hexadecimal,
 * no header X-Signature.
 *
 * O segredo da conta aparece frequentemente prefixado com "whsec_" (é o
 * formato de vários gateways). Não sabemos de que forma o PaySuite o assinou,
 * por isso validamos contra ambas — com e sem o prefixo.
 */
function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const provided = signature.replace(/^sha256=/i, "").trim();
  const segredos = new Set([secret]);
  if (secret.startsWith("whsec_")) segredos.add(secret.slice(6));

  for (const s of segredos) {
    const esperada = crypto.createHmac("sha256", s).update(rawBody, "utf8").digest("hex");
    const a = Buffer.from(provided, "utf8");
    const b = Buffer.from(esperada, "utf8");
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
}

/**
 * A PaySuite devolve "credit_card"; a coluna pedido_online.metodo_pagamento
 * aceita "cartao". Qualquer valor desconhecido é ignorado para não violar o CHECK.
 */
function metodoInterno(metodo: string | null): string | null {
  if (metodo === "mpesa" || metodo === "emola") return metodo;
  if (metodo === "credit_card" || metodo === "card") return "cartao";
  return null;
}

/**
 * Actualiza o pagamento de um pedido online.
 * Idempotente: só aplica a transição se ainda estiver 'pendente'.
 */
async function actualizarPedido(
  pedidoId: string,
  metodo: string | null,
  statusPago: "pago" | "falhou"
) {
  await pool.query(
    `UPDATE pedido_online
     SET status_pagamento = $2,
         metodo_pagamento = COALESCE($3, metodo_pagamento),
         status = CASE WHEN tipo = 'compra_online' AND $2 = 'pago' THEN 'confirmado' ELSE status END,
         data_atualizacao = now()
     WHERE id = $1 AND status_pagamento = 'pendente'`,
    [pedidoId, statusPago, metodoInterno(metodo)]
  );
}

// POST /api/webhooks/paysuite
export async function POST(req: Request) {
  const secret = process.env.PAYSUITE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("webhook paysuite: PAYSUITE_WEBHOOK_SECRET não configurado");
    return NextResponse.json({ received: false, error: "not configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-signature") || "";

  if (!signature || !verifySignature(rawBody, signature, secret)) {
    return NextResponse.json({ received: false, error: "invalid signature" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ received: false, error: "invalid json" }, { status: 400 });
  }

  // O evento vem em `event` e o recurso em `data` (ver docs da PaySuite).
  const event = String(body.event ?? "").toLowerCase();
  const data = (
    (body.data ?? body.payment ?? body) as Record<string, unknown>
  );
  const status = String(data.status ?? body.status ?? "").toLowerCase();
  const reference = String(data.reference ?? body.reference ?? "");
  const amount = data.amount === undefined ? null : Number(data.amount);
  const metodo = typeof data.method === "string" ? data.method.toLowerCase() : null;

  const eventoSucesso =
    event === "payment.success" ||
    event === "payment.succeeded" ||
    event === "payment.paid";
  const eventoFalha =
    event === "payment.failed" || event === "payment.cancelled";

  const isPago = eventoSucesso || (!event && ["paid", "succeeded", "completed"].includes(status));
  const isFalhado =
    eventoFalha ||
    (!event && ["failed", "cancelled", "canceled", "expired"].includes(status));

  if (!isPago && !isFalhado) {
    return NextResponse.json({ received: true, ok: true, ignored: event || status || "unknown" });
  }

  const novoStatus = isPago ? "pago" : "falhou";

  if (!reference) {
    return NextResponse.json({ received: true, ok: true, ignored: "no reference" });
  }

  try {
    if (reference.startsWith(LICENSE_PREFIX)) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const pag = await client.query(
          `SELECT id, licenca_id, valor FROM licenca_pagamento
           WHERE referencia_pagamento = $1 AND status = 'pendente'
           FOR UPDATE`,
          [reference]
        );
        if (pag.rows.length === 0) {
          await client.query("ROLLBACK");
          return NextResponse.json({ received: true, ok: true, ignored: "not pending" });
        }
        const registro = pag.rows[0];
        if (amount !== null && Math.abs(amount - Number(registro.valor)) > 0.01) {
          await client.query("ROLLBACK");
          console.error(
            `webhook paysuite: valor divergente na licença ${reference} (${amount} vs ${registro.valor})`
          );
          return NextResponse.json({ received: true, ok: true, ignored: "amount mismatch" });
        }

        if (isFalhado) {
          await client.query(
            `UPDATE licenca_pagamento
             SET status = 'falhou', observacao = 'Recusado pela PaySuite'
             WHERE id = $1 AND status = 'pendente'`,
            [registro.id]
          );
          await client.query("COMMIT");
          return NextResponse.json({ received: true, ok: true });
        }

        if (metodo) {
          await client.query(`UPDATE licenca_pagamento SET metodo = $2 WHERE id = $1`, [
            registro.id,
            metodo,
          ]);
        }
        await aplicarPagamentoLicenca(client, registro.licenca_id, registro.id);
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        console.error("webhook paysuite: falha ao aplicar licença:", e);
        return NextResponse.json({ received: false, error: "internal" }, { status: 500 });
      } finally {
        client.release();
      }
      return NextResponse.json({ received: true, ok: true });
    }

    if (!reference.startsWith(REF_PREFIX)) {
      return NextResponse.json({ received: true, ok: true, ignored: "other-app" });
    }

    const pedido = await pool.query(
      `SELECT id, total FROM pedido_online WHERE referencia_pagamento = $1`,
      [reference]
    );
    if (pedido.rows.length === 0) {
      return NextResponse.json({ received: true, ok: true, ignored: "unknown reference" });
    }

    const p = pedido.rows[0];
    if (amount !== null && Math.abs(amount - Number(p.total)) > 0.01) {
      console.error(
        `webhook paysuite: valor divergente no pedido ${reference} (${amount} vs ${p.total})`
      );
      return NextResponse.json({ received: true, ok: true, ignored: "amount mismatch" });
    }

    await actualizarPedido(p.id, metodo, novoStatus);
    return NextResponse.json({ received: true, ok: true });
  } catch (error) {
    console.error("webhook paysuite: erro interno:", error);
    return NextResponse.json({ received: false, error: "internal" }, { status: 500 });
  }
}