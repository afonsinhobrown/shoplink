import { requireSessao } from "@/lib/auth";
import { VendasClient } from "./vendas-client";

export default async function VendasPage() {
  const sessao = await requireSessao();
  return (
    <VendasClient
      moeda={sessao.moeda}
      podeCancelar={["dono", "gestor"].includes(sessao.papel)}
    />
  );
}