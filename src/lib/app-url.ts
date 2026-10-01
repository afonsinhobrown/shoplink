/**
 * URL pública desta aplicação, usada para montar as URLs que a PaySuite
 * chama (webhook) ou para onde devolve o cliente (return_url).
 *
 * Ordem de precedência:
 *   1. APP_URL (defini-la explicitamente evita depender do proxy)
 *   2. o protocolo/host do pedido actual (funciona em dev e em preview)
 *
 * Nota: o protocolo do pedido é sempre https atrás do proxy da Vercel,
 * por isso não se deve assumir "http" a partir do valor do header.
 */
export function appBaseUrl(req: Request): string {
  const explicita = process.env.APP_URL?.trim();
  if (explicita) return explicita.replace(/\/$/, "");

  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = forwardedHost || req.headers.get("host");
  if (!host) return "";

  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwardedProto || new URL(req.url).protocol.replace(":", "") || "https";

  return `${proto}://${host}`;
}