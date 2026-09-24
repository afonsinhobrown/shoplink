import "server-only";

// Licença mensal ShopLink: 2.500,00 MZN por loja, paga via NetShop
// (cartão BCI / BIM). Ao pagar: +30 dias da data_fim se ativa,
// ou do dia do pagamento se a licença não está ativa.

export const LICENSE_PREFIX = "LIC_"; // referencia de pagamento das licenças (webhook)

export const DIAS_LICENCA = 30;

export type EstadoLicenca = "ativa" | "expirada" | "bloqueada";

export interface LicencaInfo {
  licencaId: string;
  lojaId: string;
  estado: EstadoLicenca;
  plano: string;
  valorMensal: number;
  dataInicio: string | null;
  dataFim: string | null;
  diasRestantes: number;
  efetivamenteAtiva: boolean;
}

/**
 * Estado efetivo da licença: mesmo com estado='ativa', passou a data fim
 * => é tratada como expirada. estado='bloqueada' bloqueia sempre.
 */
export function licencaEfetivamenteAtiva(
  estado: string,
  dataFim: string | Date | null
): boolean {
  if (estado === "bloqueada") return false;
  if (estado !== "ativa") return false;
  if (!dataFim) return false;
  return new Date(dataFim).getTime() > Date.now();
}

export function diasRestantes(dataFim: string | Date | null): number {
  if (!dataFim) return 0;
  const fim = new Date(dataFim).getTime();
  return Math.max(0, Math.ceil((fim - Date.now()) / 86400000));
}

export function buildLicencaReference(): string {
  return `${LICENSE_PREFIX}${Date.now().toString(36).toUpperCase()}${Math.random()
    .toString(36)
    .substring(2, 6)
    .toUpperCase()}`;
}

/** Build do recibo de pagamento da licença (humano). */
export function buildReciboNumero(data: Date = new Date()): string {
  const d =
    data.toISOString().slice(0, 10).replace(/-/g, "") +
    "-" +
    String(data.getSeconds()).padStart(2, "0");
  return `REC-LIC-${d}`;
}

/**
 * Aplica o pagamento de uma licença (chamado pelo webhook ou pós-cobrança):
 * novo período = data_fim atual + 30 dias se ativa, senão agora + 30 dias.
 * Recebe uma transação (client) para rodar dentro da mesma transação.
 */
export async function aplicarPagamentoLicenca(
  client: {
    query: (
      sql: string,
      params?: unknown[]
    ) => Promise<{ rows: { id: string; estado?: string | null; data_fim?: string | null }[] }>;
  },
  licencaId: string,
  pagamentoId: string
): Promise<{ períodoInicio: string; períodoFim: string }> {
  const lic = await client.query(
    `SELECT id, estado, data_fim FROM licenca WHERE id = $1 FOR UPDATE`,
    [licencaId]
  );
  const licenca = lic.rows[0];

  const fimAnterior =
    licenca.data_fim && licenca.estado === "ativa"
      ? new Date(licenca.data_fim)
      : new Date();
  const novoFim = new Date(fimAnterior.getTime());
  novoFim.setUTCDate(novoFim.getUTCDate() + DIAS_LICENCA);

  const reciboNumero = buildReciboNumero();

  await client.query(
    `UPDATE licenca SET estado = 'ativa', data_inicio = COALESCE(data_inicio, now()),
            data_fim = $1, atualizada_em = now()
     WHERE id = $2`,
    [novoFim.toISOString(), licencaId]
  );

  await client.query(
    `UPDATE licenca_pagamento
     SET status = 'pago', data_pagamento = now(), periodo_inicio = $1, periodo_fim = $2,
         recibo_numero = COALESCE(recibo_numero, $3)
     WHERE id = $4 AND status = 'pendente'`,
    [fimAnterior.toISOString(), novoFim.toISOString(), reciboNumero, pagamentoId]
  );

  return {
    períodoInicio: fimAnterior.toISOString(),
    períodoFim: novoFim.toISOString(),
  };
}