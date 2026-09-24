import { pool } from "@/lib/db";
import { LojaClient } from "./loja-client";

export const dynamic = "force-dynamic";

export interface LojaPublica {
  id: string;
  nome: string;
  tipo_loja: string;
  cidade: string | null;
  provincia: string | null;
  endereco: string | null;
  moeda: string;
  permite_reserva: boolean;
  permite_venda_online: boolean;
  tempo_expiracao_reserva_horas: number;
}

export interface ProdutoPublico {
  id: string;
  nome: string;
  descricao_publica: string | null;
  preco_venda: number;
  unidade_medida: string;
  categoria: string | null;
  url_thumbnail: string | null;
  imagem: string | null;
  quantidade_disponivel: number;
}

export default async function LojaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const lojaR = await pool.query(
    `SELECT id, nome, tipo_loja, cidade, provincia, endereco, moeda,
            permite_venda_online, permite_reserva, tempo_expiracao_reserva_horas
     FROM loja WHERE slug_publico = $1 AND ativo = true`,
    [slug]
  );
  const loja = lojaR.rows[0] ?? null;

  if (!loja || (!loja.permite_venda_online && !loja.permite_reserva)) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-3xl border border-zinc-800 bg-zinc-900/60 p-10 text-center">
          <p className="text-4xl">🏪</p>
          <h1 className="mt-4 text-xl font-semibold text-zinc-100">Loja não encontrada</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Esta loja não existe ou ainda não tem vendas online ativas.
          </p>
        </div>
      </div>
    );
  }

  const produtosR = await pool.query(
    `SELECT p.id, p.nome, p.descricao_publica, p.preco_venda, p.unidade_medida,
            c.nome AS categoria, pi.url_thumbnail, pi.url AS imagem,
            COALESCE(v.quantidade_disponivel, 0) AS quantidade_disponivel
     FROM produto p
     LEFT JOIN categoria c ON c.id = p.categoria_id
     LEFT JOIN LATERAL (
        SELECT url_thumbnail, url FROM produto_imagem
        WHERE produto_id = p.id ORDER BY principal DESC, ordem ASC LIMIT 1
     ) pi ON true
     LEFT JOIN vw_stock_disponivel v ON v.produto_id = p.id
     WHERE p.loja_id = $1 AND p.ativo = true AND p.disponivel_online = true
     ORDER BY p.nome ASC`,
    [loja.id]
  );

  const lojaProps: LojaPublica = {
    id: loja.id,
    nome: loja.nome,
    tipo_loja: loja.tipo_loja,
    cidade: loja.cidade,
    provincia: loja.provincia,
    endereco: loja.endereco,
    moeda: loja.moeda,
    permite_reserva: loja.permite_reserva,
    permite_venda_online: loja.permite_venda_online,
    tempo_expiracao_reserva_horas: loja.tempo_expiracao_reserva_horas,
  };

  const produtos: ProdutoPublico[] = produtosR.rows.map((p) => ({
    ...p,
    preco_venda: Number(p.preco_venda),
    quantidade_disponivel: Number(p.quantidade_disponivel),
  }));

  return <LojaClient slug={slug} loja={lojaProps} produtos={produtos} />;
}