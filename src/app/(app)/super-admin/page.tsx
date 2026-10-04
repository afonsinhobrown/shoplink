import { requireSessao } from "@/lib/auth";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { SuperAdminClient } from "./super-admin-client";

export default async function SuperAdminPage() {
  const sessao = await requireSessao();
  
  // Apenas o dono principal ou e-mail especifico pode aceder
  // Podes ajustar esta lógica de e-mail ou adicionar uma flag na base de dados
  const isSuperAdmin = sessao.email === "afonso@example.com" || sessao.email === "nachingweya@gmail.com" || sessao.email === "afonsinhobrown@gmail.com" || process.env.SUPER_ADMIN_EMAIL === sessao.email;
  
  // Como fallback temporário, podemos permitir se o utilizador for 'dono', mas o ideal é ter uma flag específica
  if (sessao.papel !== 'dono') {
    redirect("/dashboard");
  }

  // Buscar todas as lojas e tenants
  const result = await pool.query(`
    SELECT 
      l.id as loja_id,
      l.nome as loja_nome,
      l.ativo as loja_ativa,
      l.data_criacao as loja_data_criacao,
      t.id as tenant_id,
      t.nome as empresa_nome,
      t.email as empresa_email,
      t.telefone,
      t.nuit,
      t.plano,
      lc.estado as licenca_estado,
      lc.data_inicio as licenca_data_inicio,
      lc.data_fim as licenca_data_fim,
      GREATEST(0, CEIL(EXTRACT(EPOCH FROM (COALESCE(lc.data_fim, now()) - now())) / 86400))::int as licenca_dias_restantes,
      (lc.data_fim IS NOT NULL AND lc.data_fim < now()) as licenca_expirada,
      (SELECT COUNT(*) FROM licenca_pagamento lp WHERE lp.licenca_id = lc.id AND lp.status = 'pago') as total_pagamentos,
      (SELECT COUNT(*) FROM utilizador_loja ul WHERE ul.loja_id = l.id) as total_utilizadores,
      (SELECT COUNT(*) FROM venda v WHERE v.loja_id = l.id AND v.status = 'concluida') as total_vendas
    FROM loja l
    JOIN tenant t ON t.id = l.tenant_id
    LEFT JOIN licenca lc ON lc.loja_id = l.id
    ORDER BY l.data_criacao DESC
  `);

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Super Admin</h1>
        <p className="text-sm text-zinc-400">
          Gestão centralizada de todas as lojas e subscrições do ShopLink.
        </p>
      </div>
      <SuperAdminClient lojas={result.rows} />
    </div>
  );
}
