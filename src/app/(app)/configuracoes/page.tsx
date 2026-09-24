import { requireSessao } from "@/lib/auth";
import { ConfiguracoesClient } from "./configuracoes-client";

export default async function ConfiguracoesPage() {
  const sessao = await requireSessao();
  return <ConfiguracoesClient ehDono={sessao.papel === "dono"} />;
}