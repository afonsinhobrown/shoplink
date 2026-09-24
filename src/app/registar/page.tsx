"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Store, Loader2, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field, Switch } from "@/components/ui/input";

export default function RegistoPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    empresa: "",
    donoNome: "",
    email: "",
    senha: "",
    lojaNome: "",
    tipoLoja: "mercearia" as "mercearia" | "mini_mercado",
    cidade: "",
  });
  const [mercado, setMercado] = useState(false);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    const tipoLoja = mercado ? "mini_mercado" : "mercearia";
    try {
      const res = await fetch("/api/auth/registo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, tipoLoja }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao criar conta");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao criar conta");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="absolute -bottom-24 left-0 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
      </div>

      <div className="animate-fade-in relative w-full max-w-lg">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-xl shadow-emerald-500/30">
            <Store className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
              Comece gratuitamente
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              A sua conta inclui a loja, os colaboradores e o PDV
            </p>
          </div>
        </div>

        <form
          onSubmit={criar}
          className="space-y-5 rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome da empresa *">
              <Input
                required
                placeholder="Mercearia Central, Lda"
                value={form.empresa}
                onChange={(e) => set("empresa", e.target.value)}
              />
            </Field>
            <Field label="Seu nome *">
              <Input
                required
                placeholder="Nome completo"
                value={form.donoNome}
                onChange={(e) => set("donoNome", e.target.value)}
              />
            </Field>
            <Field label="Email *">
              <Input
                type="email"
                required
                autoComplete="email"
                placeholder="voce@empresa.com"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </Field>
            <Field label="Senha *" hint="Mínimo de 6 caracteres">
              <Input
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={form.senha}
                onChange={(e) => set("senha", e.target.value)}
              />
            </Field>
          </div>

          <div className="h-px bg-zinc-800" />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome da loja *">
              <Input
                required
                placeholder="Mercearia Central"
                value={form.lojaNome}
                onChange={(e) => set("lojaNome", e.target.value)}
              />
            </Field>
            <Field label="Cidade">
              <Input
                placeholder="Maputo"
                value={form.cidade}
                onChange={(e) => set("cidade", e.target.value)}
              />
            </Field>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
            <div>
              <p className="text-sm font-medium text-zinc-200">
                É um mini supermercado?
              </p>
              <p className="text-xs text-zinc-500">
                Ativa controlo de lotes, validade e código de barras
              </p>
            </div>
            <Switch checked={mercado} onChange={setMercado} label="Mini supermercado" />
          </div>

          {erro && (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
              {erro}
            </p>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={carregando}>
            {carregando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Criar conta"
            )}
          </Button>
        </form>

        <p className="mt-6 flex items-center justify-center gap-1 text-center text-sm text-zinc-500">
          <ChevronLeft className="h-4 w-4" />
          <Link href="/login" className="font-medium text-zinc-300 hover:text-white">
            Já tenho conta
          </Link>
        </p>
      </div>
    </div>
  );
}