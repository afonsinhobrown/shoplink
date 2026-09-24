import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

// GET /api/publico/[slug]/produtos  -> catálogo público da loja online
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const lojaR = await pool.query(
    `SELECT id, nome, tipo_loja, cidade, provincia, endereco, moeda,
            permite_venda_online, permite_reserva, tempo_expiracao_reserva_horas,
            (SELECT id FROM tenant t WHERE t.id = loja.tenant_id) AS tenant_id
     FROM loja
     WHERE slug_publico = $1 AND ativo = true`,
    [slug]
  );
  const loja = lojaR.rows[0] ?? null;
  if (!loja) {
    return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
  }
  if (!loja.permite_venda_online && !loja.permite_reserva) {
    return NextResponse.json(
      { error: "Esta loja não tem vendas online ativas" },
      { status: 403 }
    );
  }

  const produtos = await pool.query(
    `SELECT p.id, p.nome, p.descricao_publica, p.preco_venda, p.unidade_medida,
            p.categoria_id, c.nome AS categoria,
            pi.url_thumbnail, pi.url AS imagem,
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

  return NextResponse.json({
    loja: {
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
    },
    produtos: produtos.rows,
  });
}