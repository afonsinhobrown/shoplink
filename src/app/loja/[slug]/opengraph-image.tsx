import { ImageResponse } from "next/og";
import { pool } from "@/lib/db";

export const alt = "Preview da loja";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  try {
    const lojaR = await pool.query(
      `SELECT id, nome FROM loja WHERE slug_publico = $1 AND ativo = true`,
      [slug]
    );
    const loja = lojaR.rows[0];

    if (!loja) {
      return new ImageResponse(
        (
          <div
            style={{
              fontSize: 48,
              background: "black",
              color: "white",
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            Loja não encontrada (slug: {slug || 'undefined'})
          </div>
        ),
        {
          ...size,
        }
      );
    }

    const produtosR = await pool.query(
      `SELECT nome FROM produto 
       WHERE loja_id = $1 AND ativo = true AND disponivel_online = true 
       ORDER BY random() LIMIT 4`,
      [loja.id]
    );

    const produtos = produtosR.rows.map((p) => p.nome);

    return new ImageResponse(
      (
        <div
          style={{
            background: "linear-gradient(to bottom right, #09090b, #18181b)",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            padding: 48,
            fontFamily: "sans-serif",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              border: "4px solid #27272a",
              borderRadius: 32,
              padding: 64,
              background: "rgba(24, 24, 27, 0.8)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            }}
          >
            <div style={{ fontSize: 96, fontWeight: "bold", marginBottom: 24, textAlign: "center" }}>
              {loja.nome}
            </div>
            <div style={{ fontSize: 48, color: "#a1a1aa", marginBottom: 48 }}>
              Faça já a sua encomenda online!
            </div>
            
            {produtos.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 16 }}>
                {produtos.map((p, i) => (
                  <div
                    key={i}
                    style={{
                      background: "#27272a",
                      padding: "16px 32px",
                      borderRadius: 16,
                      fontSize: 32,
                      color: "#e4e4e7",
                    }}
                  >
                    {p}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ position: "absolute", bottom: 40, display: "flex", alignItems: "center", color: "#71717a", fontSize: 32 }}>
            Powered by ShopLink
          </div>
        </div>
      ),
      {
        ...size,
      }
    );
  } catch (e) {
    return new ImageResponse(
      (
        <div
          style={{
            fontSize: 64,
            background: "black",
            color: "white",
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ShopLink
        </div>
      ),
      {
        ...size,
      }
    );
  }
}
