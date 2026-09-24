import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import {
  REF_PREFIX,
  verifyNetShopWebhookSignature,
} from "@/lib/netshop";
import { LICENSE_PREFIX, aplicarPagamentoLicenca } from "@/lib/licenca";

// POST /api/webhooks/netshop  -> callback real da NetShop (valida assinatura HMAC)
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature =
    req.headers.get("x-netshop-signature") ||
    req.headers.get("x-webhook-signature") ||
    "";

  try {
    if (process.env.NETSHOP_WEBHOOK_SECRET && signature) {
      if (!verifyNetShopWebhookSignature(rawBody, signature)) {
        return NextResponse.json(
          { received: true, error: "invalid signature" },
          { status: 400 }
        );
      }
    }

    interface WebhookBody {
      event?: string;
      type?: string;
      status?: string;
      data?: Record<string, unknown>;
      charge?: Record<string, unknown>;
    }
    interface ChargeData {
      status?: string;
      reference?: string;
      order_id?: string;
    }
    let body: WebhookBody;
    try {
      body = JSON.parse(rawBody) as WebhookBody;
    } catch {
      return NextResponse.json({ received: true, error: "invalid json" }, { status: 400 });
    }

    const data = (body.data ?? body.charge ?? body) as ChargeData;
    const status = String(data.status ?? body.status ?? "").toLowerCase();
    const event = String(body.event || body.type || "");
    const isPaid = event === "charge.paid" || status === "paid" || status === "succeeded";

    if (!isPaid) {
      return NextResponse.json({ received: true, ok: true });
    }

    const reference =
      (data.reference && String(data.reference)) ||
      (data.order_id && String(data.order_id)) ||
      null;

    if (reference && reference.startsWith(LICENSE_PREFIX)) {
      // Pagamento de licença — estende 30 dias e gera recibo
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
          console.log(`Licença ${reference} paga e renovada via webhook NetShop`);
        } else {
          await client.query("ROLLBACK");
        }
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        console.error("erro ao processar pagamento de licenca:", e);
        return NextResponse.json({ received: true, error: "internal" }, { status: 500 });
      } finally {
        client.release();
      }
      return NextResponse.json({ received: true, ok: true });
    }

    if (!reference || !reference.startsWith(REF_PREFIX)) {
      // Webhooks de outras apps na mesma conta NetShop -> ignorar
      return NextResponse.json({ received: true, ok: true, ignored: "other-app" });
    }

    const pedido = await pool.query(
      `SELECT id, tipo FROM pedido_online WHERE referencia_pagamento = $1`,
      [reference]
    );
    if (pedido.rows.length > 0) {
      const p = pedido.rows[0];
      const upd = await pool.query(
        `UPDATE pedido_online
         SET status_pagamento = 'pago',
             status = CASE WHEN tipo = 'compra_online' THEN 'confirmado' ELSE status END,
             data_atualizacao = now()
         WHERE id = $1 AND status_pagamento = 'pendente'
         RETURNING numero_pedido`,
        [p.id]
      );
      if (upd.rows.length > 0) {
        console.log(`✅ Pagamento ${reference} confirmado via webhook NetShop (${p.tipo})`);
      }
    }

    return NextResponse.json({ received: true, ok: true });
  } catch (error) {
    console.error("Erro no webhook NetShop:", error);
    return NextResponse.json({ received: true, error: "internal" }, { status: 500 });
  }
}