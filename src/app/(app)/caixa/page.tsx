import { requireSessao } from "@/lib/auth";
import { CaixaClient } from "./caixa-client";

export default async function CaixaPage() {
  const sessao = await requireSessao();
  return (
    <CaixaClient
      moeda={sessao.moeda}
      papel={sessao.papel}
    />
  );
}