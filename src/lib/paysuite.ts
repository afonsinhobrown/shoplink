import "server-only";

const PAYSUITE_API_URL = "https://paysuite.tech/api/v1";

export const REF_PREFIX = "PO"; // prefixo pedidos online (sem _ ou -)
export const LICENSE_REF_PREFIX = "LIC"; // prefixo licenças

export type PaySuiteMethod = "mpesa" | "emola" | "mkesh" | "card";

export type PaySuiteChargeResult = {
  id: string;
  status: string;
  amount: number;
  reference: string;
  checkoutUrl?: string;
};

/**
 * Cria uma referência única (apenas letras e números, sem _ ou -)
 * A PaySuite recusa referências com esses caracteres.
 */
export function buildPaymentReference(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${REF_PREFIX}${stamp}${rand}`;
}


/**
 * Cria uma cobrança na PaySuite.
 * Se não enviar `method`, o cliente escolhe no checkout da PaySuite
 * (M-Pesa, e-Mola ou Cartão).
 */
export async function createPaySuiteCharge(params: {
  amountMZN: number;
  reference: string;
  description?: string;
  method?: PaySuiteMethod;
  msisdn?: string;
  webhookUrl?: string;
  returnUrl?: string;
}): Promise<PaySuiteChargeResult> {
  const apiToken = process.env.PAYSUITE_API_TOKEN;

  if (!apiToken) {
    throw new Error("Credenciais da PaySuite em falta no .env (PAYSUITE_API_TOKEN)");
  }

  const payload: Record<string, unknown> = {
    amount: Math.round(params.amountMZN),
    reference: params.reference,
    description: String(params.description || `Pedido ${params.reference}`).slice(0, 125),
  };

  if (params.method) payload.method = params.method;
  if (params.webhookUrl) payload.webhook_url = params.webhookUrl;
  if (params.returnUrl) payload.return_url = params.returnUrl;

  // msisdn só para M-Pesa / e-Mola — normalizar para 9 dígitos
  if (params.msisdn && (params.method === "mpesa" || params.method === "emola")) {
    let msisdn = String(params.msisdn).replace(/\D/g, "");
    if (msisdn.startsWith("258") && msisdn.length === 12) msisdn = msisdn.substring(3);
    if (msisdn.length === 9) payload.msisdn = msisdn;
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

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (data && (data.message || data.error)) ||
      `PaySuite respondeu com estado ${response.status}`;
    throw new Error(String(message));
  }

  const charge = (data && data.data) || {};

  return {
    id: String(charge.id ?? ""),
    status: String(charge.status || "pending"),
    amount: Number(charge.amount ?? params.amountMZN),
    reference: charge.reference || params.reference,
    checkoutUrl: charge.checkout_url || undefined,
  };
}

/**
 * Consulta o estado de um pagamento (polling).
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
      headers: {
        Authorization: `Bearer ${apiToken}`,
        Accept: "application/json",
      },
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) return { status: null, paid: false, failed: false };

    const charge = (data && data.data) || data || {};
    const status = String(charge.status || "").toLowerCase();

    return {
      status,
      paid: status === "paid" || status === "succeeded",
      failed: status === "failed",
    };
  } catch {
    return { status: null, paid: false, failed: false };
  }
}