import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { REF_PREFIX } from "@/lib/paysuite";
import { LICENSE_PREFIX, aplicarPagamentoLicenca } from "@/lib/licenca";
import * as crypto from "crypto";

// Validador de Assinatura Webhook da PaySuite
function verifyPaySuiteWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.PAYSUITE_WEBHOOK_SECRET;
  if (!secret || !signature) return false;

  try {
    const provided = signature.replace(/^(sha256=|t=.*,v1=)/, "").trim();
    
    // 1. Tenta com o secret exacto
    const expectedRaw = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
    if (provided.length === expectedRaw.length && crypto.timingSafeEqual(Buffer.from(provided, "utf8"), Buffer.from(expectedRaw, "utf8"))) {
      return true;
    }

    // 2. Se o secret comecar com whsec_, tenta remover esse prefixo (as vezes acontece na paysuite)
    if (secret.startsWith("whsec_")) {
      const cleanSecret = secret.slice(6);
      const expectedClean = crypto.createHmac("sha256", cleanSecret).update(rawBody, "utf8").digest("hex");
      if (provided.length === expectedClean.length && crypto.timingSafeEqual(Buffer.from(provided, "utf8"), Buffer.from(expectedClean, "utf8"))) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

// POST /api/webhooks/paysuite
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-signature") || req.headers.get("x-paysuite-signature") || "";

  try {
    if (process.env.PAYSUITE_WEBHOOK_SECRET && signature) {
      if (!verifyPaySuiteWebhookSignature(rawBody, signature)) {
        return NextResponse.json({ received: true, error: "invalid signature" }, { status: 400 });
      }
    }

    interface WebhookBody {
      event?: string;
      status?: string;
      data?: Record<string, unknown>;
      payment?: Record<string, unknown>;
      payment_id?: string;
      reference?: string;
    }
    let body: WebhookBody;
    try {
      body = JSON.parse(rawBody) as WebhookBody;
    } catch {
      return NextResponse.json({ received: true, error: "invalid json" }, { status: 400 });
    }

    // A PaySuite pode enviar no body directo, ou dentro de .data, ou .payment
    const data = (body.data ?? body.payment ?? body) as Record<string, unknown>;
    const status = String(data.status ?? body.status ?? "").toLowerCase();
    const event = String(body.event ?? "");
    const isPaid = event === "payment.succeeded" || status === "paid" || status === "succeeded";

    if (!isPaid) {
      return NextResponse.json({ received: true, ok: true });
    }

    const reference = String(data.reference || body.reference || "");

    if (reference && reference.startsWith(LICENSE_PREFIX)) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const pag = await client.query(
          `SELECT id, licenca_id FROM licenca_pagamento
           WHERE referencia_pagamento = $1 AND status = 'pendente'
           FOR UPDATE`,
          [reference]
        );
        if (pag.rows.length > 0) {
          await aplicarPagamentoLicenca(client, pag.rows[0].licenca_id, pag.rows[0].id);
          await client.query("COMMIT");
        } else {
          await client.query("ROLLBACK");
        }
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        return NextResponse.json({ received: true, error: "internal" }, { status: 500 });
      } finally {
        client.release();
      }
      return NextResponse.json({ received: true, ok: true });
    }

    if (!reference || !reference.startsWith(REF_PREFIX)) {
      return NextResponse.json({ received: true, ok: true, ignored: "other-app" });
    }

    const pedido = await pool.query(`SELECT id, tipo FROM pedido_online WHERE referencia_pagamento = $1`, [reference]);
    if (pedido.rows.length > 0) {
      const p = pedido.rows[0];
      await pool.query(
        `UPDATE pedido_online
         SET status_pagamento = 'pago',
             status = CASE WHEN tipo = 'compra_online' THEN 'confirmado' ELSE status END,
             data_atualizacao = now()
         WHERE id = $1 AND status_pagamento = 'pendente'`,
        [p.id]
      );
    }

    return NextResponse.json({ received: true, ok: true });
  } catch (error) {
    return NextResponse.json({ received: true, error: "internal" }, { status: 500 });
  }
}