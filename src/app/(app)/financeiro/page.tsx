import { requireSessao } from "@/lib/auth";
import { FinanceiroClient } from "./financeiro-client";

export default async function FinanceiroPage() {
  const sessao = await requireSessao();
  return <FinanceiroClient moeda={sessao.moeda} />;
}