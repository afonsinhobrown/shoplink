import { requireSessao } from "@/lib/auth";
import { ClientesClient } from "./clientes-client";

export default async function ClientesPage() {
  const sessao = await requireSessao();
  return (
    <ClientesClient
      moeda={sessao.moeda}
      papel={sessao.papel}
      podeEditar={["dono", "gestor", "caixa"].includes(sessao.papel)}
    />
  );
}