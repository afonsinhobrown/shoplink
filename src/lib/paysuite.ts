import "server-only";

const PAYSUITE_API_URL = (
  process.env.PAYSUITE_API_URL || "https://paysuite.tech/api/v1"
).replace(/\/$/, "");
const REQUEST_TIMEOUT_MS = 15000;
const CODIGO_PAIS = "258";

export const REF_PREFIX = "PO"; // prefixo das referencias de pedidos online

/**
 * Métodos aceites em POST /payments. A API recusa qualquer outro valor
 * (ex.: "card" ou "mkesh" devolvem 422 — mkesh só existe em payouts).
 */
export type PaySuiteMethod = "mpesa" | "emola" | "credit_card";

export type PaySuiteChargeResult = {
  id: string;
  status: string;
  amount: number;
  reference: string;
  method?: string;
  checkoutUrl?: string;
};

export type PaySuiteChargeStatus = {
  status: string | null;
  paid: boolean;
  failed: boolean;
  amount?: number;
};

export class PaySuiteApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "PaySuiteApiError";
    this.status = status;
  }
}

const ESTADOS_PAGOS = new Set([
  "paid",
  "pago",
  "succeeded",
  "success",
  "completed",
  "confirmed",
]);
const ESTADOS_FALHADOS = new Set([
  "failed",
  "falhou",
  "cancelled",
  "canceled",
  "expired",
  "declined",
  "rejected",
]);

export function classificarEstado(status: string | null | undefined): PaySuiteChargeStatus {
  const s = String(status ?? "").toLowerCase();
  return {
    status: s || null,
    paid: ESTADOS_PAGOS.has(s),
    failed: ESTADOS_FALHADOS.has(s),
  };
}

/** Normaliza um telefone moçambicano para E.164 (+2588XXXXXXXX). */
export function normalizarTelefoneE164(telefone: string | number | null | undefined): string | null {
  let digitos = String(telefone ?? "").replace(/\D/g, "");
  if (digitos.startsWith(CODIGO_PAIS) && digitos.length === 12) {
    digitos = digitos.slice(CODIGO_PAIS.length);
  }
  if (digitos.length !== 9) return null;
  return `+${CODIGO_PAIS}${digitos}`;
}

/**
 * Referência única para a PaySuite: alfanumérica, máx. 50 caracteres.
 * A API recusa "_" e "-" em references.
 */
export function buildPaymentReference(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${REF_PREFIX}${stamp}${rand}`;
}

function apiToken(): string {
  const token = process.env.PAYSUITE_API_TOKEN;
  if (!token) {
    throw new Error(
      "Credenciais da PaySuite em falta no ambiente (PAYSUITE_API_TOKEN)."
    );
  }
  return token;
}

async function paysuiteRequest<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown }
): Promise<T> {
  const response = await fetch(`${PAYSUITE_API_URL}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${apiToken()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const raw = await response.text();
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const errors = parsed?.errors;
    const detalhe =
      errors && typeof errors === "object"
        ? Object.values(errors as Record<string, unknown>)
            .map(String)
            .join("; ")
        : "";
    const message =
      (parsed && typeof parsed.message === "string" && parsed.message) ||
      (parsed && typeof parsed.error === "string" && parsed.error) ||
      `PaySuite respondeu com estado ${response.status}`;
    throw new PaySuiteApiError(detalhe ? `${message} (${detalhe})` : message, response.status);
  }

  return ((parsed?.data ?? parsed ?? {}) as T);
}

function toNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Cria uma cobrança na PaySuite.
 *
 * Se `method` for omitido, a PaySuite mostra o checkout hospedado e o cliente
 * escolhe o método (M-Pesa, e-Mola ou Cartão) e introduz os seus dados.
 * Para cobranças diretas a M-Pesa/e-Mola é preciso enviar também `contactId`
 * (a PaySuite não aceita telefone diretamente no corpo do pedido).
 */
export async function createPaySuiteCharge(params: {
  amountMZN: number;
  reference: string;
  description?: string;
  method?: PaySuiteMethod;
  contactId?: string | null;
  webhookUrl?: string;
  returnUrl?: string;
}): Promise<PaySuiteChargeResult> {
  const payload: Record<string, unknown> = {
    amount: Number(params.amountMZN.toFixed(2)),
    reference: params.reference.slice(0, 50),
    description: String(
      params.description || `Pagamento ${params.reference}`
    ).slice(0, 125),
  };

  if (params.method) payload.method = params.method;
  if (params.contactId) payload.contact_id = params.contactId;
  if (params.webhookUrl) payload.webhook_url = params.webhookUrl;
  if (params.returnUrl) payload.return_url = params.returnUrl;

  const charge = await paysuiteRequest<Record<string, unknown>>("/payments", {
    method: "POST",
    body: payload,
  });

  return {
    id: String(charge.id ?? ""),
    status: String(charge.status || "pending").toLowerCase(),
    amount: toNumber(charge.amount, params.amountMZN),
    reference: String(charge.reference || params.reference),
    method: charge.method ? String(charge.method) : undefined,
    checkoutUrl:
      typeof charge.checkout_url === "string" && charge.checkout_url
        ? charge.checkout_url
        : undefined,
  };
}

/** Consulta o estado de um pagamento (usado como fallback do webhook). */
export async function getPaySuiteCharge(
  paymentId: string | null | undefined
): Promise<PaySuiteChargeStatus> {
  if (!paymentId) return { status: null, paid: false, failed: false };

  try {
    const charge = await paysuiteRequest<Record<string, unknown>>(
      `/payments/${encodeURIComponent(paymentId)}`,
      { method: "GET" }
    );
    return {
      ...classificarEstado(charge.status as string),
      amount: charge.amount === undefined ? undefined : toNumber(charge.amount, 0),
    };
  } catch {
    return { status: null, paid: false, failed: false };
  }
}

/**
 * Procura um contacto PaySuite pelo telefone (E.164) e cria-o se não existir.
 * Devolve o ULID do contacto, ou null se o telefone for inválido / a API falhar
 * (nunca deve impedir a criação da cobrança).
 */
export async function findOrCreatePaySuiteContact(params: {
  name?: string | null;
  phone: string | number | null | undefined;
  email?: string | null;
}): Promise<string | null> {
  const phone = normalizarTelefoneE164(params.phone);
  if (!phone) return null;

  try {
    const existentes = await paysuiteRequest<unknown[]>("/contacts?limit=100", {
      method: "GET",
    });
    if (Array.isArray(existentes)) {
      const achado = existentes.find(
        (c) =>
          c &&
          typeof c === "object" &&
          normalizarTelefoneE164((c as Record<string, unknown>).phone as string) === phone
      );
      const id = achado && (achado as Record<string, unknown>).id;
      if (id) return String(id);
    }
  } catch {
    // lista indisponível — seguimos para criar
  }

  try {
    const body: Record<string, unknown> = { phone };
    if (params.name?.trim()) body.name = params.name.trim().slice(0, 100);
    if (params.email?.trim()) body.email = params.email.trim().slice(0, 100);

    const contact = await paysuiteRequest<Record<string, unknown>>("/contacts", {
      method: "POST",
      body,
    });
    return contact.id ? String(contact.id) : null;
  } catch {
    return null;
  }
}