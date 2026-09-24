import { requireSessao } from "@/lib/auth";
import { getLojaConfig } from "@/lib/queries";
import { StockClient } from "./stock-client";

export default async function StockPage() {
  const sessao = await requireSessao();
  const config = (await getLojaConfig(sessao)) ?? {};
  return (
    <StockClient
      permiteEditar={["dono", "gestor", "stock"].includes(sessao.papel)}
      controlaLote={config.controla_lote_validade ?? false}
    />
  );
}