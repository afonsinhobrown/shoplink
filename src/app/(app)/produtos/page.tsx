import { requireSessao } from "@/lib/auth";
import { ProdutosClient } from "./produtos-client";

export default async function ProdutosPage() {
  const sessao = await requireSessao();
  return (
    <ProdutosClient
      moeda={sessao.moeda}
      papel={sessao.papel}
      permiteEditar={["dono", "gestor", "stock"].includes(sessao.papel)}
    />
  );
}