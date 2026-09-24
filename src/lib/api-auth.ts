import { NextResponse } from "next/server";
import { getSessao, type Papel, type Sessao } from "./auth";

export async function apiSessao(): Promise<
  | { sessao: Sessao; response?: never }
  | { sessao?: never; response: NextResponse }
> {
  const sessao = await getSessao();
  if (!sessao) {
    return {
      response: NextResponse.json({ error: "Não autenticado" }, { status: 401 }),
    };
  }
  return { sessao };
}

export async function apiPapel(
  ...papeis: Papel[]
): Promise<
  | { sessao: Sessao; response?: never }
  | { sessao?: never; response: NextResponse }
> {
  const r = await apiSessao();
  if (r.response) return r;
  if (!papeis.includes(r.sessao.papel)) {
    return {
      response: NextResponse.json(
        { error: "Sem permissão para esta ação" },
        { status: 403 }
      ),
    };
  }
  return { sessao: r.sessao };
}