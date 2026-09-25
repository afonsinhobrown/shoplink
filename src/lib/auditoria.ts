import { pool } from "./db";

export async function registarAuditoria({
  lojaId,
  utilizadorId,
  acao,
  entidade,
  entidadeId,
  detalhes
}: {
  lojaId: string;
  utilizadorId: string;
  acao: string;
  entidade: string;
  entidadeId?: string;
  detalhes?: any;
}) {
  try {
    await pool.query(
      `INSERT INTO auditoria (loja_id, utilizador_id, acao, entidade, entidade_id, detalhes) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [lojaId, utilizadorId, acao, entidade, entidadeId || null, detalhes ? JSON.stringify(detalhes) : null]
    );
  } catch (error) {
    console.error("Erro ao registar auditoria:", error);
  }
}
