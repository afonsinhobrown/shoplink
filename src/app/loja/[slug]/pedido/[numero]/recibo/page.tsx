import { pool } from "@/lib/db";
import { ReciboClient } from "./recibo-client";
import { Store } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReciboPage({
  params,
}: {
  params: Promise<{ slug: string; numero: string }>;
}) {
  const { slug, numero } = await params;

  const lojaR = await pool.query(
    `SELECT id, nome, cidade, provincia, endereco, telefone, logotipo_url
     FROM loja WHERE slug_publico = $1 AND ativo = true`,
    [slug]
  );
  const loja = lojaR.rows[0] ?? null;

  if (!loja) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-zinc-100">
        <div className="max-w-md rounded-3xl border border-zinc-800 bg-zinc-900/60 p-10 text-center">
          <p className="text-4xl">🧾</p>
          <h1 className="mt-4 text-xl font-semibold">Loja não encontrada</h1>
        </div>
      </div>
    );
  }

  const pedidoR = await pool.query(
    `SELECT po.id, po.numero_pedido, po.tipo, po.status, po.status_pagamento,
            po.metodo_pagamento, po.tipo_entrega, po.endereco_entrega,
            po.subtotal, po.total, po.data_criacao, po.data_expiracao,
            co.nome as cliente_nome, co.telefone as cliente_telefone, co.email as cliente_email
     FROM pedido_online po
     JOIN cliente_online co ON co.id = po.cliente_online_id
     WHERE po.loja_id = $1 AND po.numero_pedido = $2`,
    [loja.id, numero]
  );
  const pedido = pedidoR.rows[0] ?? null;

  if (!pedido) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-zinc-100">
        <div className="max-w-md rounded-3xl border border-zinc-800 bg-zinc-900/60 p-10 text-center">
          <p className="text-4xl">🧾</p>
          <h1 className="mt-4 text-xl font-semibold">Pedido não encontrado</h1>
        </div>
      </div>
    );
  }

  const itensR = await pool.query(
    `SELECT poi.quantidade, poi.preco_unitario, poi.subtotal_linha, p.nome, p.unidade_medida
     FROM pedido_online_item poi
     JOIN produto p ON p.id = poi.produto_id
     WHERE poi.pedido_online_id = $1`,
    [pedido.id]
  );

  return (
    <ReciboClient
      slug={slug}
      loja={{
        id: loja.id,
        nome: loja.nome,
        cidade: loja.cidade,
        provincia: loja.provincia,
        endereco: loja.endereco,
        telefone: loja.telefone,
        logotipo_url: loja.logotipo_url,
      }}
      pedido={{
        id: pedido.id,
        numero_pedido: pedido.numero_pedido,
        tipo: pedido.tipo,
        status: pedido.status,
        status_pagamento: pedido.status_pagamento,
        metodo_pagamento: pedido.metodo_pagamento,
        tipo_entrega: pedido.tipo_entrega,
        endereco_entrega: pedido.endereco_entrega,
        subtotal: Number(pedido.subtotal),
        total: Number(pedido.total),
        data_criacao: pedido.data_criacao,
        data_expiracao: pedido.data_expiracao,
        cliente_nome: pedido.cliente_nome,
        cliente_telefone: pedido.cliente_telefone,
        cliente_email: pedido.cliente_email,
      }}
      itens={itensR.rows.map((i) => ({
        nome: i.nome,
        quantidade: i.quantidade,
        preco_unitario: Number(i.preco_unitario),
        subtotal_linha: Number(i.subtotal_linha),
        unidade_medida: i.unidade_medida,
      }))}
    />
  );
}