import "server-only";
import * as crypto from "crypto";

interface NetShopApiData {
  id?: string;
  status?: string;
  method?: string;
  amount?: number;
  reference?: string;
  order_id?: string;
  checkout_url?: string;
  checkout?: { hosted_url?: string } | null;
  failed_reason?: string | null;
  error?: string | null;
  detail?: string | null;
  provider?: { responseDesc?: string | null; transactionID?: string | null } | null;
}

// Reprodução da integração real NetShop (api.netshop.co.mz/api/v1) do projeto
// cafe-point-app — usa as MESMAS variáveis de ambiente no .env.local.
//
//   NETSHOP_API_KEY         -> chave da API (Authorization: Bearer)
//   NETSHOP_WALLET_ID_MPESA -> carteira M-Pesa
//   NETSHOP_WALLET_ID_BIM   -> carteira cartão BIM/Visa
//   NETSHOP_WALLET_ID_BCI   -> carteira cartão BCI/Visa (default 654027)
//   NETSHOP_WEBHOOK_SECRET  -> segredo para validar assinatura HMAC dos webhooks

const NETSHOP_API_URL = "https://www.netshop.co.mz/api/v1";

export const REF_PREFIX = "PO_"; // referencia dos pedidos online (identifica a app nos webhooks)

export type NetShopMethod = "mpesa" | "emola" | "mkesh" | "card" | "card_bci";

export type NetShopChargeResult = {
  id: string;
  status: string;
  method: string;
  amount: number;
  reference: string;
  checkoutUrl?: string;
  failedReason?: string | null;
  responseDesc?: string | null;
  providerTransactionId?: string | null;
};

/**
 * Normaliza e valida um número de telemóvel moçambicano (M-Pesa/e-Mola).
 * Regras: exatamente 9 dígitos, a começar por 8 (82/83/84/85/86/87).
 * Devolve já com o prefixo internacional 258.
 */
export function normalizeMpesaNumber(input: string): string {
  let phone = String(input || "").replace(/\D/g, "");
  if (phone.startsWith("258") && phone.length === 12) {
    phone = phone.substring(3);
  }
  if (phone.startsWith("+")) {
    phone = phone.substring(1);
  }
  if (phone.length !== 9 || !phone.startsWith("8")) {
    throw new Error("Número inválido. Indique os 9 dígitos a começar por 8.");
  }
  return `258${phone}`;
}

export function buildPaymentReference(): string {
  return `${REF_PREFIX}${Date.now().toString(36).toUpperCase()}${Math.random()
    .toString(36)
    .substring(2, 6)
    .toUpperCase()}`;
}

/**
 * Cria uma cobrança real via NetShop API v1 (M-Pesa, e-Mola, mKesh, Cartão).
 */
export async function createNetShopCharge(params: {
  amountMZN: number;
  reference: string;
  method?: NetShopMethod;
  msisdn?: string;
  returnUrl?: string;
}): Promise<NetShopChargeResult> {
  const apiKey = process.env.NETSHOP_API_KEY;
  const selectedMethod: NetShopMethod = params.method || "mpesa";

  const isCard = selectedMethod === "card" || selectedMethod === "card_bci";
  const walletId = isCard
    ? (selectedMethod === "card_bci"
        ? (process.env.NETSHOP_WALLET_ID_BCI || "654027")
        : process.env.NETSHOP_WALLET_ID_BIM)
    : process.env.NETSHOP_WALLET_ID_MPESA;

  if (!apiKey || !walletId) {
    throw new Error(
      `Credenciais da NetShop em falta no .env (${
        selectedMethod === "card_bci"
          ? "NETSHOP_WALLET_ID_BCI"
          : isCard
            ? "NETSHOP_WALLET_ID_BIM"
            : "NETSHOP_WALLET_ID_MPESA"
      })`
    );
  }

  let msisdn: string | undefined;
  if (params.msisdn) {
    msisdn = normalizeMpesaNumber(params.msisdn);
  }

  const payload: Record<string, unknown> = {
    amount: Math.round(params.amountMZN),
    currency: "MZN",
    reference: params.reference,
    method: isCard ? "card" : selectedMethod,
  };

  if ((selectedMethod === "mpesa" || selectedMethod === "emola") && msisdn) {
    // A NetShop exige o numero com o prefixo internacional e o '+' (ex: +258842828600)
    payload.msisdn = msisdn.startsWith("+") ? msisdn : `+${msisdn}`;
  }

  if (params.returnUrl) {
    payload.return_url = params.returnUrl;
  }

  const response = await fetch(`${NETSHOP_API_URL}/charges`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "X-Wallet-ID": walletId,
      "Idempotency-Key": `sl_${params.reference}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as NetShopApiData;

  if (!response.ok) {
    const str = (v: unknown): string | undefined =>
      typeof v === "string" && v.length ? v : undefined;
    const friendlyFailed =
      data.status === "failed"
        ? "Pagamento cancelado ou recusado no telemóvel."
        : JSON.stringify(data);
    const err = new Error(
      str(data.failed_reason) ||
        str(data.provider?.responseDesc) ||
        str(data.error) ||
        str(data.detail) ||
        friendlyFailed
    ) as Error & {
      charge?: {
        id?: string | null;
        status?: string | null;
        failedReason?: string | null;
        responseDesc?: string | null;
        providerTransactionId?: string | null;
      };
    };
    err.charge = {
      id: data.id || null,
      status: data.status || "failed",
      failedReason: data.failed_reason || null,
      responseDesc: data.provider?.responseDesc || null,
      providerTransactionId: data.provider?.transactionID || null,
    };
    throw err;
  }

  const checkoutUrl = data.checkout?.hosted_url || data.checkout_url;
  const reference = data.order_id || data.reference || params.reference;

  return {
    id: data.id || "",
    status: data.status || "pending",
    method: data.method || selectedMethod,
    amount: data.amount || params.amountMZN,
    reference,
    checkoutUrl,
    failedReason: data.failed_reason || null,
    responseDesc: data.provider?.responseDesc || null,
    providerTransactionId: data.provider?.transactionID || null,
  };
}

/**
 * Consulta o estado real de uma cobrança na NetShop pelo ID (ch_...).
 * Usado como confirmação de segurança por polling.
 */
export async function getNetShopCharge(chargeId: string): Promise<{
  status: string | null;
  paid: boolean;
  failed: boolean;
  failedReason?: string | null;
  responseDesc?: string | null;
}> {
  const apiKey = process.env.NETSHOP_API_KEY;
  if (!apiKey || !chargeId) return { status: null, paid: false, failed: false };
  const wallets = [
    process.env.NETSHOP_WALLET_ID_MPESA,
    process.env.NETSHOP_WALLET_ID_BIM,
    process.env.NETSHOP_WALLET_ID_BCI || "654027",
  ].filter(Boolean) as string[];

  for (const walletId of wallets) {
    try {
      const res = await fetch(
        `${NETSHOP_API_URL}/charges/${encodeURIComponent(chargeId)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "X-Wallet-ID": walletId,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      );
      let data: NetShopApiData | null = null;
      try {
        data = (await res.json()) as NetShopApiData;
      } catch {
        data = null;
      }
      if (!data || !data.status) continue;
      const status = String(data.status).toLowerCase();
      return {
        status,
        paid: status === "paid" || status === "succeeded",
        failed: status === "failed",
        failedReason: data.failed_reason || null,
        responseDesc: data.provider?.responseDesc || null,
      };
    } catch {
      // tenta a próxima carteira
    }
  }
  return { status: null, paid: false, failed: false };
}

/**
 * Valida a assinatura HMAC dos webhooks enviados pela NetShop.
 */
export function verifyNetShopWebhookSignature(
  rawBody: string,
  signature: string | null
): boolean {
  const secret = process.env.NETSHOP_WEBHOOK_SECRET;
  if (!secret || !signature) return false;

  try {
    const provided = signature.replace(/^(sha256=|t=.*,v1=)/, "").trim();

    // 1. Testa com a secret como fornecida no .env
    const expectedRaw = crypto
      .createHmac("sha256", secret)
      .update(rawBody, "utf8")
      .digest("hex");

    if (
      provided.length === expectedRaw.length &&
      crypto.timingSafeEqual(
        Buffer.from(provided, "utf8"),
        Buffer.from(expectedRaw, "utf8")
      )
    ) {
      return true;
    }

    // 2. Testa removendo o prefixo whsec_ caso exista
    if (secret.startsWith("whsec_")) {
      const cleanSecret = secret.slice(6);
      const expectedClean = crypto
        .createHmac("sha256", cleanSecret)
        .update(rawBody, "utf8")
        .digest("hex");

      if (
        provided.length === expectedClean.length &&
        crypto.timingSafeEqual(
          Buffer.from(provided, "utf8"),
          Buffer.from(expectedClean, "utf8")
        )
      ) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}