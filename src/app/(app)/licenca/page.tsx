import { requireSessao } from "@/lib/auth";
import { LicencaPanel } from "@/components/licenca/licenca-panel";

export default async function LicencaPage() {
  const sessao = await requireSessao();
  return <LicencaPanel papel={sessao.papel} />;
}