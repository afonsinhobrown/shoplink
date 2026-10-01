import "server-only";
import * as crypto from "crypto";

const PAYSUITE_API_URL = "https://paysuite.tech/api/v1";

export const REF_PREFIX = "PO_"; // referencia dos pedidos online

export type PaySuiteMethod = "mpesa" | "emola" | "mkesh" | "card";

export type PaySuiteChargeResult = {
  id: string;
  status: string;
  method: string;
  amount: number;
  reference: string;
  checkoutUrl?: string;
};

/**
 * Cria uma referência única para a PaySuite
 * A PaySuite só aceita letras e números, não aceita "_"
 */
export function buildPaymentReference(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PO${stamp}${rand}`;
}

/**
 * Cria uma cobrança real via PaySuite
 */
export async function createPaySuiteCharge(params: {
  amountMZN: number;
  reference: string;
  method?: PaySuiteMethod;
  msisdn?: string;
  returnUrl?: string;
}): Promise<PaySuiteChargeResult> {
  const apiToken = process.env.PAYSUITE_API_TOKEN;

  if (!apiToken) {
    throw new Error("Credenciais da PaySuite em falta no .env (PAYSUITE_API_TOKEN)");
  }

  const payload: Record<string, unknown> = {
    amount: Math.round(params.amountMZN),
    reference: params.reference,
    description: `Pedido ${params.reference}`,
  };

  // Se for m-pesa ou e-mola, a PaySuite suporta o envio do telemovel?
  // A PaySuite normal aceita msisdn, mas não é estritamente necessario se usar o checkout link
  if (params.method) {
    payload.method = params.method;
  }
  
  // Extrair numero, a paysuite prefere o numero com 84/82 em vez de +258
  if (params.msisdn && (params.method === 'mpesa' || params.method === 'emola')) {
      let msisdn = String(params.msisdn).replace(/\D/g, "");
      if (msisdn.startsWith("258") && msisdn.length === 12) msisdn = msisdn.substring(3);
      if (msisdn.length === 9) {
          payload.msisdn = msisdn;
      }
  }

  if (params.returnUrl) {
    payload.return_url = params.returnUrl;
  }

  const response = await fetch(`${PAYSUITE_API_URL}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const rawData = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (rawData && (rawData.message || rawData.error)) || "A PaySuite respondeu com estado " + response.status;
    const err = new Error(String(message));
    throw err;
  }

  const charge = (rawData && rawData.data) || {};

  return {
    id: String(charge.id || ""),
    status: String(charge.status || "pending"),
    method: String(charge.method || params.method || ""),
    amount: Number(charge.amount || params.amountMZN),
    reference: charge.reference || payload.reference,
    checkoutUrl: charge.checkout_url || undefined,
  };
}

/**
 * Consulta o estado real de uma cobrança na PaySuite
 */
export async function getPaySuiteCharge(paymentId: string): Promise<{
  status: string | null;
  paid: boolean;
  failed: boolean;
}> {
  const apiToken = process.env.PAYSUITE_API_TOKEN;
  if (!apiToken || !paymentId) return { status: null, paid: false, failed: false };

  try {
    const res = await fetch(`${PAYSUITE_API_URL}/payments/${encodeURIComponent(paymentId)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        Accept: "application/json",
      },
    });

    const rawData = await res.json().catch(() => null);
    if (!res.ok) return { status: null, paid: false, failed: false };

    const data = (rawData && rawData.data) || {};
    const status = String(data.status || "").toLowerCase();
    
    return {
      status,
      paid: status === "paid" || status === "succeeded",
      failed: status === "failed",
    };
  } catch {
    return { status: null, paid: false, failed: false };
  }
}