import { requireSessao } from "@/lib/auth";
import { getLojaConfig } from "@/lib/queries";
import { pool } from "@/lib/db";
import { PosClient } from "./pos-client";

export default async function PosPage() {
  const sessao = await requireSessao();
  const config = (await getLojaConfig(sessao)) ?? {};

  const caixaRes = await pool.query(
    `SELECT id FROM caixa_sessao WHERE loja_id = $1 AND status = 'aberta' LIMIT 1`,
    [sessao.lojaId]
  );
  const caixaAberto = caixaRes.rows.length > 0;

  return (
    <PosClient
      moeda={sessao.moeda}
      modoPos={config.modo_pos ?? "rapido"}
      permiteVendaFiado={config.permite_venda_fiado ?? true}
      controlaLote={config.controla_lote_validade ?? false}
      papel={sessao.papel}
      caixaAberto={caixaAberto}
      loja={{
        nome: config.nome ?? "ShopLink",
        nuit: config.nuit ?? "",
        endereco: config.endereco ?? "",
        telefone: config.telefone ?? "",
      }}
    />
  );
}