import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiPapel } from "@/lib/api-auth";
import {
  cloudinaryConfigurado,
  destroyImagem,
  MAX_IMAGENS_POR_LOJA,
  MAX_IMAGENS_POR_PRODUTO,
  uploadImagem,
  urlThumbnail,
  validarImagem,
} from "@/lib/cloudinary";

type ImagemRow = {
  id: string;
  cloudinary_public_id: string;
  url: string;
  url_thumbnail: string | null;
  principal: boolean;
  ordem: number;
};

async function produtoDaLoja(produtoId: string, lojaId: string) {
  const r = await pool.query("SELECT id FROM produto WHERE id = $1 AND loja_id = $2", [
    produtoId,
    lojaId,
  ]);
  return r.rows.length > 0;
}

/** Contagens em uma só viagem, para validar a quota antes de gastar CDN. */
async function contarImagens(produtoId: string, lojaId: string) {
  const r = await pool.query<{ do_produto: number; da_loja: number }>(
    `SELECT
       (SELECT COUNT(*) FROM produto_imagem WHERE produto_id = $1) AS do_produto,
       (SELECT COUNT(*) FROM produto_imagem pi
          JOIN produto p ON p.id = pi.produto_id
         WHERE p.loja_id = $2) AS da_loja`,
    [produtoId, lojaId]
  );
  return { produto: r.rows[0].do_produto, loja: r.rows[0].da_loja };
}

/** Resposta única para GET/PATCH/DELETE: a UI lê sempre a mesma coisa. */
async function listar(produtoId: string) {
  const result = await pool.query<ImagemRow>(
    `SELECT id, cloudinary_public_id, url, url_thumbnail, principal, ordem
       FROM produto_imagem WHERE produto_id = $1
      ORDER BY principal DESC, ordem ASC`,
    [produtoId]
  );
  return {
    imagens: result.rows,
    limite: MAX_IMAGENS_POR_PRODUTO,
    maxPorLoja: MAX_IMAGENS_POR_LOJA,
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await apiPapel("dono", "gestor", "stock");
  if (r.response) return r.response;
  const { id } = await params;

  if (!(await produtoDaLoja(id, r.sessao.lojaId))) {
    return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
  }

  return NextResponse.json(await listar(id));
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await apiPapel("dono", "gestor", "stock");
  if (r.response) return r.response;
  const { id } = await params;

  if (!cloudinaryConfigurado()) {
    return NextResponse.json(
      { error: "Cloudinary não configurado neste servidor" },
      { status: 503 }
    );
  }
  if (!(await produtoDaLoja(id, r.sessao.lojaId))) {
    return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
  }

  const form = await req.formData().catch(() => null);
  const ficheiro = form?.get("ficheiro");
  if (!(ficheiro instanceof File)) {
    return NextResponse.json({ error: "Envie um ficheiro no campo 'ficheiro'" }, { status: 400 });
  }

  const erro = validarImagem(ficheiro);
  if (erro) {
    return NextResponse.json({ error: erro }, { status: 400 });
  }

  // Quota validada ANTES do upload: depois de enviar, o ficheiro já existe no
  // CDN e um 429 deixaria um órfão para limpar à mão.
  const { produto: total, loja: daLoja } = await contarImagens(id, r.sessao.lojaId);
  if (total >= MAX_IMAGENS_POR_PRODUTO) {
    return NextResponse.json(
      { error: `Limite de ${MAX_IMAGENS_POR_PRODUTO} imagens por produto atingido` },
      { status: 429 }
    );
  }
  if (daLoja >= MAX_IMAGENS_POR_LOJA) {
    return NextResponse.json(
      { error: `Limite de ${MAX_IMAGENS_POR_LOJA} imagens da loja atingido` },
      { status: 429 }
    );
  }

  let uploaded;
  try {
    uploaded = await uploadImagem(
      Buffer.from(await ficheiro.arrayBuffer()),
      id,
      `img_${Date.now()}`
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha no upload";
    return NextResponse.json({ error: `Falha no upload: ${msg}` }, { status: 502 });
  }

  const url = uploaded.secure_url;
  const resultado = await pool.query(
    `INSERT INTO produto_imagem
       (produto_id, cloudinary_public_id, url, url_thumbnail, principal, ordem, largura, altura, formato)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, cloudinary_public_id, url, url_thumbnail, principal, ordem`,
    [
      id,
      uploaded.public_id,
      url,
      urlThumbnail(url),
      total === 0,
      total,
      uploaded.width ?? null,
      uploaded.height ?? null,
      uploaded.format ?? null,
    ]
  );

  return NextResponse.json(resultado.rows[0], { status: 201 });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await apiPapel("dono", "gestor", "stock");
  if (r.response) return r.response;
  const { id } = await params;
  const imagemId = new URL(req.url).searchParams.get("imagemId");
  if (!imagemId) {
    return NextResponse.json({ error: "Indique o imagemId" }, { status: 400 });
  }
  if (!(await produtoDaLoja(id, r.sessao.lojaId))) {
    return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
  }

  const alvo = await pool.query("SELECT id FROM produto_imagem WHERE id = $1 AND produto_id = $2", [
    imagemId,
    id,
  ]);
  if (alvo.rows.length === 0) {
    return NextResponse.json({ error: "Imagem não encontrada" }, { status: 404 });
  }

  await pool.query("UPDATE produto_imagem SET principal = false WHERE produto_id = $1", [id]);
  await pool.query("UPDATE produto_imagem SET principal = true WHERE id = $1", [imagemId]);

  const imagens = await listar(id);
  return NextResponse.json(imagens);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await apiPapel("dono", "gestor");
  if (r.response) return r.response;
  const { id } = await params;
  const imagemId = new URL(req.url).searchParams.get("imagemId");
  if (!imagemId) {
    return NextResponse.json({ error: "Indique o imagemId" }, { status: 400 });
  }
  if (!(await produtoDaLoja(id, r.sessao.lojaId))) {
    return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
  }

  const alvo = await pool.query<ImagemRow>(
    "SELECT id, cloudinary_public_id, url, url_thumbnail, principal, ordem FROM produto_imagem WHERE id = $1 AND produto_id = $2",
    [imagemId, id]
  );
  if (alvo.rows.length === 0) {
    return NextResponse.json({ error: "Imagem não encontrada" }, { status: 404 });
  }

  await pool.query("DELETE FROM produto_imagem WHERE id = $1", [imagemId]);

  // Se apagámos a principal, promove a seguinte disponível
  if (alvo.rows[0].principal) {
    await pool.query(
      `UPDATE produto_imagem SET principal = true
        WHERE id = (SELECT id FROM produto_imagem WHERE produto_id = $1 ORDER BY ordem ASC LIMIT 1)`,
      [id]
    );
  }

  // A linha já foi apagada; se o CDN falhar, devolvemos aviso em vez de 500
  // para não reverter a BD. O ficheiro órfão é inofensivo, fica apenas storage.
  let aviso: string | null = null;
  if (cloudinaryConfigurado()) {
    try {
      await destroyImagem(alvo.rows[0].cloudinary_public_id);
    } catch (e) {
      console.error("Falha ao apagar imagem no Cloudinary:", e);
      aviso = "Imagem removida do catálogo, mas não foi possível apagá-la no Cloudinary";
    }
  }
  return NextResponse.json({ ...(await listar(id)), ok: true, aviso });
}