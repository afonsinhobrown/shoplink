import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { pool } from "@/lib/db";
import { criarSessao } from "@/lib/auth";
import { DIAS_TRIAL } from "@/lib/licenca";

const CATEGORIAS_DEFAULT = [
  "Bebidas",
  "Mercearia",
  "Laticínios",
  "Pães e Bolos",
  "Higiene",
  "Snacks e Doces",
  "Frutas e Legumes",
];

export async function POST(req: Request) {
  const client = await pool.connect();
  try {
    const body = await req.json();
    const {
      empresa,
      donoNome,
      email,
      senha,
      lojaNome,
      tipoLoja = "mercearia",
      cidade,
    } = body ?? {};

    if (!empresa || !donoNome || !email || !senha || !lojaNome) {
      return NextResponse.json(
        { error: "Preencha todos os campos obrigatórios" },
        { status: 400 }
      );
    }
    if (senha.length < 6) {
      return NextResponse.json(
        { error: "A senha deve ter pelo menos 6 caracteres" },
        { status: 400 }
      );
    }

    const existente = await pool.query(
      "SELECT id FROM utilizador WHERE lower(email) = lower($1)",
      [email]
    );
    if (existente.rows.length > 0) {
      return NextResponse.json(
        { error: "Já existe uma conta com este email" },
        { status: 409 }
      );
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    await client.query("BEGIN");

    const tenant = await client.query(
      `INSERT INTO tenant (nome, email, plano) VALUES ($1, $2, 'basico') RETURNING id`,
      [empresa, email]
    );
    const tenantId = tenant.rows[0].id;

    const loja = await client.query(
      `INSERT INTO loja (tenant_id, nome, tipo_loja, cidade) VALUES ($1, $2, $3, $4) RETURNING id, nome, moeda, modo_pos`,
      [tenantId, lojaNome, tipoLoja, cidade ?? null]
    );
    const lojaId = loja.rows[0].id;

    const user = await client.query(
      `INSERT INTO utilizador (tenant_id, nome, email, senha_hash) VALUES ($1, $2, $3, $4) RETURNING id`,
      [tenantId, donoNome, email, senhaHash]
    );
    const userId = user.rows[0].id;

    await client.query(
      `INSERT INTO utilizador_loja (utilizador_id, loja_id, papel) VALUES ($1, $2, 'dono')`,
      [userId, lojaId]
    );

    for (const nome of CATEGORIAS_DEFAULT) {
      await client.query(
        `INSERT INTO categoria (loja_id, nome) VALUES ($1, $2)`,
        [lojaId, nome]
      );
    }

    // Licença em período de avaliação gratuita (10 dias)
    await client.query(
      `INSERT INTO licenca (loja_id, estado, data_inicio, data_fim)
       VALUES ($1, 'ativa', now(), now() + ($2 || ' days')::interval)
       ON CONFLICT (loja_id) DO NOTHING`,
      [lojaId, String(DIAS_TRIAL)]
    );

    await client.query("COMMIT");

    await criarSessao({
      uid: userId,
      tenantId,
      lojaId,
      lojaNome: loja.rows[0].nome,
      moeda: loja.rows[0].moeda,
      tipoLoja,
      papel: "dono",
      email,
      nome: donoNome,
      modoPos: loja.rows[0].modo_pos,
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("registo erro:", e);
    return NextResponse.json({ error: "Falha ao criar conta" }, { status: 500 });
  } finally {
    client.release();
  }
}