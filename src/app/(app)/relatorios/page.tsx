import { requireSessao } from "@/lib/auth";
import { RelatoriosClient } from "./relatorios-client";

export default async function RelatoriosPage() {
  const sessao = await requireSessao();
  return <RelatoriosClient moeda={sessao.moeda} />;
}