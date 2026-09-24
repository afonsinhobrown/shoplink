import { redirect } from "next/navigation";
import { getSessao } from "@/lib/auth";

export default async function Home() {
  const sessao = await getSessao();
  if (sessao) return redirect("/dashboard");
  return redirect("/login");
}