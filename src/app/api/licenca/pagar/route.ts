import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiPapel } from "@/lib/api-auth";
import {
  buildLicencaReference,
  aplicarPagamentoLicenca,
} from "@/lib/licenca";
import { createNetShopCharge } from "@/lib/netshop";

// POST /api/licenca/pagar  body: { metodo: 'bci' | 'bim' }
// Licença mensal (2.500,00 MZN) paga por cartão via NetShop (BCI ou BIM).
export async function POST(req: Request) {
  const r = await apiPapel("dono");
  if (r.response) return r.response;

  const body = await req.json();
  const metodo = body?.metodo;
  if (!["bci", "bim"].includes(metodo)) {
    return NextResponse.json(
      { error: "Escolha o método de pagamento: BCI ou BIM." },
      { status: 400 }
    );
  }

  const lic = await pool.query(
    `SELECT lc.id, lc.valor_mensal FROM licenca lc WHERE lc.loja_id = $1`,
    [r.sessao.lojaId]
  );
  let licencaId: string;
  let valor: number;
  if (lic.rows.length > 0) {
    licencaId = lic.rows[0].id;
    valor = Number(lic.rows[0].valor_mensal) || 2500;
  } else {
    const criada = await pool.query(
      `INSERT INTO licenca (loja_id) VALUES ($1) RETURNING id, valor_mensal`,
      [r.sessao.lojaId]
    );
    licencaId = criada.rows[0].id;
    valor = Number(criada.rows[0].valor_mensal) || 2500;
  }

  const reference = buildLicencaReference();

  const pag = await pool.query(
    `INSERT INTO licenca_pagamento (licenca_id, loja_id, metodo, valor, referencia_pagamento, status)
     VALUES ($1, $2, $3, $4, $5, 'pendente')
     RETURNING id`,
    [licencaId, r.sessao.lojaId, metodo, valor, reference]
  );
  const pagamentoId = pag.rows[0].id;

  const host = req.headers.get("host") || "localhost:3000";
  const base = (process.env.APP_URL || `http://${host}`).replace(/\/$/, "");
  const returnUrl = `${base}/licenca?recibo=1`;

  try {
    const charge = await createNetShopCharge({
      amountMZN: valor,
      reference,
      method: metodo === "bci" ? "card_bci" : "card",
      returnUrl,
    });

    await pool.query(
      `UPDATE licenca_pagamento SET cobranca_id = $1, checkout_url = $2, observacao = $3
       WHERE id = $4`,
      [charge.id, charge.checkoutUrl ?? null, `Cobrança NetShop ${charge.status}`.slice(0, 250), pagamentoId]
    );

    const st = String(charge.status).toLowerCase();
    if (st === "paid" || st === "succeeded") {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const periodo = await aplicarPagamentoLicenca(client, licencaId, pagamentoId);
        await client.query("COMMIT");
        return NextResponse.json({
          ok: true,
          status: "pago",
          recibo: `Período: ${pt(periodo.períodoInicio)} → ${pt(periodo.períodoFim)}`,
        });
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        console.error("pagamento licenca pago erro:", e);
        return NextResponse.json(
          { error: "Pagamento aprovado mas a renovação falhou. Contacte-nos." },
          { status: 500 }
        );
      } finally {
        client.release();
      }
    }
    if (st === "failed") {
      await pool.query(
        `UPDATE licenca_pagamento SET status = 'falhou' WHERE id = $1`,
        [pagamentoId]
      );
      return NextResponse.json(
        { error: "A NetShop recusou o pagamento. Tente novamente." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      status: "pendente",
      checkout_url: charge.checkoutUrl ?? null,
      pagamento_id: pagamentoId,
    });
  } catch (e) {
    const motivo =
      e && typeof e === "object" && "message" in e
        ? String((e as Error).message)
        : "erro ao contactar a NetShop";
    await pool
      .query(`UPDATE licenca_pagamento SET status = 'falhou' WHERE id = $1`, [
        pagamentoId,
      ])
      .catch(() => {});
    return NextResponse.json(
      { error: `Não foi possível criar o pagamento: ${motivo}` },
      { status: 502 }
    );
  }
}

function pt(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}