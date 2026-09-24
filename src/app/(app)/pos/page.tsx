import { requireSessao } from "@/lib/auth";
import { getLojaConfig } from "@/lib/queries";
import { PosClient } from "./pos-client";

export default async function PosPage() {
  const sessao = await requireSessao();
  const config = (await getLojaConfig(sessao)) ?? {};

  return (
    <PosClient
      moeda={sessao.moeda}
      modoPos={config.modo_pos ?? "rapido"}
      permiteVendaFiado={config.permite_venda_fiado ?? true}
      controlaLote={config.controla_lote_validade ?? false}
      papel={sessao.papel}
    />
  );
}