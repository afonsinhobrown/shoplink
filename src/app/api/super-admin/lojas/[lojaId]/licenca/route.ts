import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSessao } from "@/lib/auth";

// POST /api/super-admin/lojas/[lojaId]/licenca
// body: { dias: number }  -> estende o trial/licença da loja em N dias
// Cria a licença se ainda não existir. Reativa a licença e estende a partir de
// data_fim quando ainda estiver no futuro, senão a partir de agora.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ lojaId: string }> }
) {
  try {
    const sessao = await getSessao();
    if (!sessao) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    if (sessao.papel !== "dono") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { lojaId } = await params;

    const body = await req.json().catch(() => ({}));
    const dias = Number(body?.dias);
    if (!Number.isFinite(dias) || dias < 1 || dias > 365) {
      return NextResponse.json(
        { error: "Indique um número de dias entre 1 e 365." },
        { status: 400 }
      );
    }

    const loja = await pool.query(`SELECT id, nome FROM loja WHERE id = $1`, [lojaId]);
    if (loja.rowCount === 0) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
    }

    const r = await pool.query(
      `INSERT INTO licenca (loja_id, estado, data_inicio, data_fim)
       VALUES ($1, 'ativa', now(), now() + ($2 || ' days')::interval)
       ON CONFLICT (loja_id) DO UPDATE SET
         estado = 'ativa',
         data_inicio = COALESCE(licenca.data_inicio, now()),
         data_fim = GREATEST(COALESCE(licenca.data_fim, now()), now())
                     + ($2 || ' days')::interval,
         atualizada_em = now()
       RETURNING id, estado, data_inicio, data_fim,
                 GREATEST(0, CEIL(EXTRACT(EPOCH FROM (data_fim - now())) / 86400))::int AS dias_restantes`,
      [lojaId, String(dias)]
    );

    return NextResponse.json({
      ok: true,
      loja: loja.rows[0].nome,
      dias,
      licenca: r.rows[0],
    });
  } catch (error) {
    console.error("Erro ao estender licença:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
