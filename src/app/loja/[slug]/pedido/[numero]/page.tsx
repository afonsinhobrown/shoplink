import { pool } from "@/lib/db";
import { PedidoClient } from "./pedido-client";

export const dynamic = "force-dynamic";

export default async function PedidoPage({
  params,
}: {
  params: Promise<{ slug: string; numero: string }>;
}) {
  const { slug, numero } = await params;

  const lojaR = await pool.query(
    `SELECT id, nome, cidade, provincia
     FROM loja WHERE slug_publico = $1 AND ativo = true`,
    [slug]
  );
  const loja = lojaR.rows[0] ?? null;

  if (!loja) {
    return <Aviso titulo="Loja não encontrada" texto="Esta loja não existe ou deixou de estar disponível." />;
  }

  const pedidoR = await pool.query(
    `SELECT po.numero_pedido, po.tipo, po.status, po.status_pagamento,
            po.metodo_pagamento, po.tipo_entrega, po.endereco_entrega,
            po.subtotal, po.total, po.data_expiracao
     FROM pedido_online po
     WHERE po.loja_id = $1 AND po.numero_pedido = $2`,
    [loja.id, numero]
  );
  const pedido = pedidoR.rows[0] ?? null;

  if (!pedido) {
    return (
      <Aviso
        titulo="Pedido não encontrado"
        texto="Verifique o número do pedido introduzido."
        loja={loja}
      />
    );
  }

  return (
    <PedidoClient
      slug={slug}
      loja={{
        nome: loja.nome,
        cidade: loja.cidade,
        provincia: loja.provincia,
      }}
      pedido={{
        numero_pedido: pedido.numero_pedido,
        tipo: pedido.tipo,
        status: pedido.status,
        status_pagamento: pedido.status_pagamento,
        metodo_pagamento: pedido.metodo_pagamento,
        tipo_entrega: pedido.tipo_entrega,
        endereco_entrega: pedido.endereco_entrega,
        subtotal: Number(pedido.subtotal),
        total: Number(pedido.total),
        data_expiracao: pedido.data_expiracao,
      }}
    />
  );
}

function Aviso({
  titulo,
  texto,
  loja,
}: {
  titulo: string;
  texto: string;
  loja?: { nome: string; cidade: string | null; provincia: string | null };
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-zinc-100">
      <div className="max-w-md rounded-3xl border border-zinc-800 bg-zinc-900/60 p-10 text-center">
        <p className="text-4xl">🧾</p>
        <h1 className="mt-4 text-xl font-semibold">{titulo}</h1>
        <p className="mt-2 text-sm text-zinc-500">{texto}</p>
        {loja && <p className="mt-4 text-xs text-zinc-600">{loja.nome}</p>}
      </div>
    </div>
  );
}