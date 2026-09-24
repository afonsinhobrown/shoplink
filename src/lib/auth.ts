import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { redirect } from "next/navigation";

export type Papel = "dono" | "gestor" | "caixa" | "stock";

export interface Sessao {
  uid: string;
  tenantId: string;
  lojaId: string;
  lojaNome: string;
  moeda: string;
  tipoLoja: "mercearia" | "mini_mercado";
  papel: Papel;
  nome: string;
  email: string;
  modoPos: "rapido" | "completo";
}

const COOKIE = "shoplink_sessao";
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev");

export async function criarSessao(dados: Sessao) {
  const token = await new SignJWT(dados as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destruirSessao() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" });
}

export async function getSessao(): Promise<Sessao | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as Sessao;
  } catch {
    return null;
  }
}

export async function requireSessao(): Promise<Sessao> {
  const sessao = await getSessao();
  if (!sessao) redirect("/login");
  return sessao;
}