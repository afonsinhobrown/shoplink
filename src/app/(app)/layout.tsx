import { requireSessao } from "@/lib/auth";
import { pool } from "@/lib/db";
import { licencaEfetivamenteAtiva } from "@/lib/licenca";
import { AppShell } from "@/components/layout/app-shell";
import { LicencaPanel } from "@/components/licenca/licenca-panel";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessao = await requireSessao();

  // Porta de licença: sem licença ativa (expirada ou bloqueada) o utilizador
  // é levado diretamente para o ecrã de pagamento/renovação da licença.
  const lic = await pool.query(
    `SELECT estado, data_fim FROM licenca WHERE loja_id = $1`,
    [sessao.lojaId]
  );
  const semLicenca =
    lic.rows.length === 0 ||
    !licencaEfetivamenteAtiva(
      lic.rows[0].estado,
      lic.rows[0].data_fim
    );

  if (semLicenca) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 text-zinc-100">
        <LicencaPanel papel={sessao.papel} />
      </div>
    );
  }

  return (
    <AppShell
      sessao={{
        papel: sessao.papel,
        nome: sessao.nome,
        lojaNome: sessao.lojaNome,
        tipoLoja: sessao.tipoLoja,
        moeda: sessao.moeda,
      }}
    >
      {children}
    </AppShell>
  );
}