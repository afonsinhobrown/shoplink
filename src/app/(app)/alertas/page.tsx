import { requireSessao } from "@/lib/auth";
import { AlertasClient } from "./alertas-client";

export default async function AlertasPage() {
  const sessao = await requireSessao();
  return <AlertasClient moeda={sessao.moeda} />;
}