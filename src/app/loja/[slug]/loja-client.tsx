"use client";

import { useMemo, useRef, useState } from "react";
import {
  Banknote,
  CreditCard,
  Loader2,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Store,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { formatarMoeda } from "@/lib/format";
import type { LojaPublica, ProdutoPublico } from "./page";

type Metodo = "mpesa" | "emola" | "cartao";
type Estado =
  | { tela: "loja" }
  | { tela: "checkout" }
  | { tela: "enviando" }
  | { tela: "pago"; numero: string }
  | { tela: "aguardando"; numero: string; metodo: Metodo | null }
  | { tela: "erro"; mensagem: string };

export function LojaClient({
  slug,
  loja,
  produtos,
}: {
  slug: string;
  loja: LojaPublica;
  produtos: ProdutoPublico[];
}) {
  const [cat, setCat] = useState<string | null>(null);
  const [carrinho, setCarrinho] = useState<Record<string, number>>({});
  const [estado, setEstado] = useState<Estado>({ tela: "loja" });
  const [cartAberto, setCartAberto] = useState(false);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [tipo, setTipo] = useState<"compra_online" | "reserva">(
    loja.permite_venda_online ? "compra_online" : "reserva"
  );
  const [metodo, setMetodo] = useState<Metodo>("mpesa");
  const [tipoEntrega, setTipoEntrega] = useState<"levantamento" | "entrega_domicilio">(
    "levantamento"
  );
  const [endereco, setEndereco] = useState("");

  const submetendo = useRef(false);

  const categorias = useMemo(() => {
    const set = new Set<string>();
    for (const p of produtos) if (p.categoria) set.add(p.categoria);
    return [...set].sort();
  }, [produtos]);

  const filtrados = useMemo(
    () => (cat ? produtos.filter((p) => p.categoria === cat) : produtos),
    [produtos, cat]
  );

  const qtd = (id: string) => carrinho[id] ?? 0;
  const totalItens = Object.values(carrinho).reduce((a, b) => a + b, 0);

  const subtotal = useMemo(() => {
    let s = 0;
    for (const [id, q] of Object.entries(carrinho))
      s += (produtos.find((p) => p.id === id)?.preco_venda ?? 0) * q;
    return s;
  }, [carrinho, produtos]);

  const add = (p: ProdutoPublico) => {
    if (qtd(p.id) >= p.quantidade_disponivel) return;
    setCarrinho((c) => ({ ...c, [p.id]: (c[p.id] ?? 0) + 1 }));
  };
  const menos = (id: string) =>
    setCarrinho((c) => {
      const n = (c[id] ?? 0) - 1;
      const nc = { ...c };
      if (n <= 0) delete nc[id];
      else nc[id] = n;
      return nc;
    });

  const podeVenderOnline = loja.permite_venda_online;
  const podeReservar = loja.permite_reserva;

  async function confirmarPedido() {
    if (submetendo.current) return;
    if (!nome.trim() || telefone.trim().length < 9) {
      setEstado({
        tela: "erro",
        mensagem: "Indique o seu nome e um telefone válido (9 dígitos, ex: 84 000 0000).",
      });
      return;
    }
    if (tipoEntrega === "entrega_domicilio" && !endereco.trim()) {
      setEstado({ tela: "erro", mensagem: "Indique o endereço de entrega." });
      return;
    }

    submetendo.current = true;
    setEstado({ tela: "enviando" });
    try {
      const itens = Object.entries(carrinho).map(([id, q]) => ({ produto_id: id, quantidade: q }));
      const res = await fetch(`/api/publico/${slug}/pedidos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          telefone: telefone.trim(),
          email: email.trim() || null,
          tipo,
          metodo_pagamento: tipo === "compra_online" ? metodo : null,
          tipo_entrega: tipoEntrega,
          endereco_entrega: tipoEntrega === "entrega_domicilio" ? endereco.trim() : null,
          itens,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível registar o pedido.");

      const pedido = data.pedido;
      if (pedido.status_pagamento === "pago") {
        setEstado({ tela: "pago", numero: pedido.numero_pedido });
        return;
      }
      if (tipo === "reserva") {
        setEstado({ tela: "pago", numero: pedido.numero_pedido });
        return;
      }
      if (pedido.checkout_url) {
        window.location.assign(pedido.checkout_url);
        return;
      }
      setEstado({ tela: "aguardando", numero: pedido.numero_pedido, metodo });
      vigiar(pedido.numero_pedido);
    } catch (e) {
      setEstado({
        tela: "erro",
        mensagem: e instanceof Error ? e.message : "Erro inesperado.",
      });
    } finally {
      submetendo.current = false;
    }
  }

  function vigiar(numero: string, tentativa = 0) {
    if (tentativa >= 50) return;
    setTimeout(async () => {
      try {
        const res = await fetch(`/api/publico/${slug}/pedidos/${numero}`);
        const data = await res.json();
        const st = data.pedido?.status_pagamento;
        if (st === "pago") {
          setEstado({ tela: "pago", numero });
          return;
        }
        if (st === "falhou") {
          setEstado({
            tela: "erro",
            mensagem: "Não recebemos a confirmação do pagamento. Contacte a loja com o número do pedido.",
          });
          return;
        }
        vigiar(numero, tentativa + 1);
      } catch {
        vigiar(numero, tentativa + 1);
      }
    }, 3000);
  }

  function esvaziar() {
    setCarrinho({});
    setCartAberto(false);
    setEstado({ tela: "loja" });
  }

  // ---------------- Telas finais ----------------
  if (estado.tela === "pago") {
    return (
      <Shell loja={loja}>
        <div className="mx-auto max-w-md animate-slide-up">
          <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h1 className="mt-5 text-xl font-semibold text-emerald-300">
              {tipo === "reserva" ? "Pedido registado!" : "Pagamento confirmado!"}
            </h1>
            <p className="mt-2 text-sm text-zinc-400">O seu pedido foi registado com sucesso.</p>
            <p className="mt-4 text-2xl font-bold text-zinc-100">{estado.numero}</p>
            {tipo === "compra_online" ? (
              <p className="mt-2 text-xs text-zinc-500">
                A loja vai preparar os produtos. Apresente este número ao levantar.
              </p>
            ) : (
              <p className="mt-2 text-xs text-zinc-500">
                Pague na loja ao levantar. A reserva expira em{" "}
                {loja.tempo_expiracao_reserva_horas} h.
              </p>
            )}
            <Button className="mt-6 w-full" onClick={esvaziar}>
              Voltar à loja
            </Button>
          </div>
        </div>
      </Shell>
    );
  }

  if (estado.tela === "erro") {
    return (
      <Shell loja={loja}>
        <div className="mx-auto max-w-md animate-slide-up">
          <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-8 text-center">
            <h1 className="text-lg font-semibold text-rose-300">Ops!</h1>
            <p className="mt-2 text-sm text-zinc-400">{estado.mensagem}</p>
            <Button
              className="mt-6 w-full"
              variant="secondary"
              onClick={() => setEstado({ tela: "loja" })}
            >
              Tentar novamente
            </Button>
          </div>
        </div>
      </Shell>
    );
  }

  if (estado.tela === "aguardando") {
    return (
      <Shell loja={loja}>
        <div className="mx-auto max-w-md animate-slide-up">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-8 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-500" />
            <h1 className="mt-4 text-lg font-semibold text-zinc-100">
              {estado.metodo === "cartao" ? "A confirmar pagamento…" : "Pague e aguarde a confirmação"}
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Numero do pedido: <b className="text-zinc-100">{estado.numero}</b>
            </p>
            <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-left text-sm text-zinc-400">
              {estado.metodo === "mpesa" && (
                <p>1. Recebeu um pedido de pagamento no seu M-Pesa. 2. Confirme no telemóvel. 3. Aguarde…</p>
              )}
              {estado.metodo === "emola" && (
                <p>1. Recebeu um pedido de pagamento no seu e-Mola. 2. Confirme no telemóvel. 3. Aguarde…</p>
              )}
              {(estado.metodo === "cartao" || estado.metodo === null) && (
                <p>Estamos a verificar o estado do pagamento. Isto pode demorar alguns minutos.</p>
              )}
            </div>
            <Button
              className="mt-6 w-full"
              variant="secondary"
              onClick={() => {
                setEstado({ tela: "loja" });
              }}
            >
              Voltar à loja
            </Button>
          </div>
        </div>
      </Shell>
    );
  }

  // ---------------- Checkout ----------------
  if (estado.tela === "checkout" || estado.tela === "enviando") {
    const temItens = Object.entries(carrinho).length > 0;
    return (
      <Shell loja={loja}>
        <div className="mx-auto max-w-lg animate-slide-up">
          <button
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200"
            onClick={() => setEstado({ tela: "loja" })}
          >
            <X className="h-4 w-4" /> Cancelar e voltar
          </button>
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6">
            <h1 className="text-lg font-semibold text-zinc-100">Finalizar pedido</h1>

            {podeVenderOnline && podeReservar && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {(["compra_online", "reserva"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipo(t)}
                    className={`rounded-xl border p-3 text-sm text-left transition-colors ${
                      tipo === t
                        ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                        : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600"
                    }`}
                  >
                    {t === "compra_online" ? "Comprar online" : "Reservar (pagar na loja)"}
                  </button>
                ))}
              </div>
            )}

            <div className={`${podeVenderOnline && podeReservar ? "mt-5" : "mt-2"} space-y-3.5`}>
              <Field label="Nome completo">
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Maria Santos" />
              </Field>
              <Field label="Telemóvel" hint="Usado para o pedido de pagamento (M-Pesa/e-Mola)">
                <Input
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value.replace(/\D/g, ""))}
                  placeholder="840000000"
                  inputMode="numeric"
                  maxLength={12}
                />
              </Field>
              <Field label="Email (opcional)">
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@email.com" />
              </Field>
              <Field label="Tipo de entrega">
                <Select
                  value={tipoEntrega}
                  onChange={(e) => setTipoEntrega(e.target.value as typeof tipoEntrega)}
                >
                  <option value="levantamento">Levantar na loja</option>
                  <option value="entrega_domicilio">Entrega ao domicilio</option>
                </Select>
              </Field>
              {tipoEntrega === "entrega_domicilio" && (
                <Field label="Endereco de entrega">
                  <Textarea
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                    placeholder="Bairro, rua, pontos de referencia…"
                  />
                </Field>
              )}
            </div>

            {tipo === "compra_online" && (
              <div className="mt-5">
                <p className="text-xs font-medium text-zinc-400">Metodo de pagamento</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(
                    [
                      ["mpesa", "M-Pesa", Smartphone],
                      ["emola", "e-Mola", Banknote],
                      ["cartao", "Cartao / Visa", CreditCard],
                    ] as [Metodo, string, typeof Smartphone][]
                  ).map(([m, label, Icon]) => (
                    <button
                      key={m}
                      type="button"
                      disabled={loja.permite_venda_online ? false : true}
                      onClick={() => setMetodo(m)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-colors ${
                        metodo === m
                          ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                          : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs font-medium">{label}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-zinc-600">
                  Pagamentos processados com seguranca pela <b>NetShop</b>. Paga no telemovel ou com cartao, conforme o metodo escolhido.
                </p>
              </div>
            )}

            <div className="mt-5 space-y-1.5 border-t border-zinc-800 pt-4 text-sm">
              {Object.entries(carrinho).map(([id, q]) => {
                const p = produtos.find((x) => x.id === id);
                if (!p) return null;
                return (
                  <div key={id} className="flex justify-between text-zinc-400">
                    <span>
                      {p.nome} × {q}
                    </span>
                    <span>{formatarMoeda(p.preco_venda * q, loja.moeda)}</span>
                  </div>
                );
              })}
              <div className="flex justify-between pt-2 text-base font-semibold text-zinc-100">
                <span>Total</span>
                <span>{formatarMoeda(subtotal, loja.moeda)}</span>
              </div>
            </div>

            <Button
              className="mt-5 w-full"
              size="lg"
              disabled={!temItens || estado.tela === "enviando"}
              onClick={confirmarPedido}
            >
              {estado.tela === "enviando" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> A processar…
                </>
              ) : tipo === "compra_online" ? (
                "Confirmar e pagar"
              ) : (
                "Confirmar reserva"
              )}
            </Button>
          </div>
        </div>
      </Shell>
    );
  }

  // ---------------- Loja ----------------
  return (
    <Shell loja={loja}>
      {/* Categorias */}
      {categorias.length > 0 && (
        <div className="sticky top-16 z-20 -mx-4 flex gap-2 overflow-x-auto px-4 py-3 bg-zinc-950/80 backdrop-blur">
          <button
            onClick={() => setCat(null)}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              cat === null
                ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                : "border-zinc-700 bg-zinc-900 text-zinc-400"
            }`}
          >
            Tudo
          </button>
          {categorias.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                cat === c
                  ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                  : "border-zinc-700 bg-zinc-900 text-zinc-400"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {filtrados.length === 0 ? (
        <p className="py-16 text-center text-sm text-zinc-500">
          Nenhum produto disponivel nesta categoria.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 pb-28 sm:grid-cols-3 lg:grid-cols-4">
          {filtrados.map((p) => {
            const disp = p.quantidade_disponivel;
            const foraDeStock = disp <= 0 || qtd(p.id) >= disp;
            return (
              <article
                key={p.id}
                className="animate-fade-in overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60"
              >
                <div className="flex aspect-square items-center justify-center overflow-hidden bg-zinc-950">
                  {p.imagem ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.imagem}
                      alt={p.nome}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Store className="h-10 w-10 text-zinc-700" />
                  )}
                </div>
                <div className="p-3">
                  {p.categoria && <p className="text-[10px] uppercase tracking-wide text-zinc-500">{p.categoria}</p>}
                  <h3 className="mt-0.5 truncate text-sm font-medium text-zinc-100">{p.nome}</h3>
                  {p.descricao_publica && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{p.descricao_publica}</p>
                  )}
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <div>
                      <p className="text-base font-semibold text-emerald-400">
                        {formatarMoeda(p.preco_venda, loja.moeda)}
                      </p>
                      {disp > 0 && disp <= 5 && qtd(p.id) < disp && (
                        <Badge color="amber" className="mt-1">
                          Sobram {disp}
                        </Badge>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={qtd(p.id) > 0 ? "secondary" : "primary"}
                      disabled={foraDeStock}
                      onClick={() => add(p)}
                    >
                      {qtd(p.id) > 0 ? `+${qtd(p.id)}` : "Adicionar"}
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Botao carrinho */}
      {totalItens > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 p-4">
          <div className="mx-auto max-w-md">
            <Button size="lg" className="w-full" onClick={() => setCartAberto(true)}>
              <ShoppingBag className="h-5 w-5" />
              Ver carrinho ({totalItens}) — {formatarMoeda(subtotal, loja.moeda)}
            </Button>
          </div>
        </div>
      )}

      {/* Drawer carrinho */}
      {cartAberto && (
        <div className="fixed inset-0 z-40 bg-black/60 p-4 backdrop-blur-sm" onClick={() => setCartAberto(false)}>
          <div
            className="mx-auto flex h-full max-w-md animate-slide-up flex-col rounded-3xl border border-zinc-800 bg-zinc-950 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-zinc-100">O seu carrinho</h2>
              <button
                onClick={() => setCartAberto(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
              {Object.entries(carrinho).map(([id, q]) => {
                const p = produtos.find((x) => x.id === id);
                if (!p) return null;
                return (
                  <div key={id} className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-100">{p.nome}</p>
                      <p className="text-xs text-zinc-500">
                        {formatarMoeda(p.preco_venda, loja.moeda)} × {q}{" "}
                        {q >= p.quantidade_disponivel && <span className="text-amber-400">(max)</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => menos(id)}
                        className="rounded-lg border border-zinc-700 p-1.5 text-zinc-300 hover:bg-zinc-800"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-6 text-center text-sm font-medium text-zinc-100">{q}</span>
                      <button
                        onClick={() => add(p)}
                        disabled={q >= p.quantidade_disponivel}
                        className="rounded-lg border border-zinc-700 p-1.5 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-zinc-800 pt-4">
              <span className="text-sm text-zinc-400">Total</span>
              <span className="text-lg font-semibold text-zinc-100">{formatarMoeda(subtotal, loja.moeda)}</span>
            </div>
            <Button className="mt-3 w-full" size="lg" onClick={() => { setCartAberto(false); setEstado({ tela: "checkout" }); }}>
              Continuar
            </Button>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Shell({ loja, children }: { loja: LojaPublica; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 font-bold text-white">
              <Store className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold leading-tight">{loja.nome}</p>
              <p className="flex items-center gap-1 text-[11px] text-zinc-500">
                <MapPin className="h-3 w-3" />
                {[loja.cidade, loja.provincia].filter(Boolean).join(", ") || "Mocambique"}
              </p>
            </div>
          </div>
          <Badge color="green">Loja online</Badge>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-4">{children}</main>
    </div>
  );
}