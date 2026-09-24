import { requireSessao } from "@/lib/auth";
import { FornecedoresClient } from "./fornecedores-client";

export default async function FornecedoresPage() {
  const sessao = await requireSessao();
  return (
    <FornecedoresClient
      papel={sessao.papel}
      podeEditar={["dono", "gestor", "stock"].includes(sessao.papel)}
    />
  );
}