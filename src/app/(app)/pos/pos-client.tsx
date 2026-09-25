"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Banknote,
  Smartphone,
  CreditCard,
  HeartHandshake,
  Loader2,
  CheckCircle2,
  Wifi,
  WifiOff,
  ScanLine,
  PackageX,
  AlertTriangle,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatarMoeda } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input, Select, Field } from "@/components/ui/input";
import { QRCodeSVG } from "qrcode.react";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Loading, EmptyState } from "@/components/ui/feedback";
import type { ProdutoDTO, ClienteDTO } from "@/lib/types";

interface CartItem {
  produto: ProdutoDTO;
  quantidade: number;
}

type Metodo = "dinheiro" | "mpesa" | "emola" | "cartao" | "fiado";

const METODO_INFO: Record<Metodo, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  dinheiro: { label: "Dinheiro", icon: Banknote },
  mpesa: { label: "M-Pesa", icon: Smartphone },
  emola: { label: "eMola", icon: Smartphone },
  cartao: { label: "Cartão", icon: CreditCard },
  fiado: { label: "Fiado", icon: HeartHandshake },
};

interface Pendente {
  itens: CartItem[];
  total: number;
  metodo: Metodo;
  cliente_id?: string;
  criadoEm: string;
}

export function PosClient({
  moeda,
  permiteVendaFiado,
  papel,
  caixaAberto,
  loja,
}: {
  moeda: string;
  modoPos: string;
  permiteVendaFiado: boolean;
  controlaLote: boolean;
  papel: string;
  caixaAberto: boolean;
  loja: { nome: string; nuit: string; endereco: string; telefone: string };
}) {
  const [produtos, setProdutos] = useState<ProdutoDTO[]>([]);
  const [clientes, setClientes] = useState<ClienteDTO[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [carrinho, setCarrinho] = useState<CartItem[]>([]);
  const [desconto, setDesconto] = useState(0);
  const [clienteId, setClienteId] = useState("");
  const [metodo, setMetodo] = useState<Metodo>("dinheiro");
  const [recebido, setRecebido] = useState("");
  const [checkout, setCheckout] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [erro, setErro] = useState("");
  const [recibo, setRecibo] = useState<{ numero_recibo: string; total: number; status: string; itens: CartItem[]; recebido?: number; troco?: number } | null>(null);
  const [online, setOnline] = useState(true);
  const [fila, setFila] = useState<Pendente[]>([]);
  const [sincronizando, setSincronizando] = useState(false);

  useEffect(() => {
    let ativo = true;
    Promise.all([
      apiFetch<ProdutoDTO[]>("/api/produtos?ativos=true"),
      apiFetch<ClienteDTO[]>("/api/clientes"),
    ])
      .then(([p, c]) => {
        if (!ativo) return;
        setProdutos(p);
        setClientes(c);
      })
      .catch(() => {})
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, []);

  const guardarFila = useCallback((fila: Pendente[]) => {
    setFila(fila);
    try {
      localStorage.setItem("shoplink_fila", JSON.stringify(fila));
    } catch {}
  }, []);

  const sincronizarFila = useCallback(async () => {
    if (!navigator.onLine) return;
    setSincronizando(true);
    let atual = [...fila];
    for (const p of atual) {
      try {
        await apiFetch("/api/vendas", {
          method: "POST",
          body: JSON.stringify({
            itens: p.itens.map((i) => ({
              produto_id: i.produto.id,
              quantidade: i.quantidade,
              preco_unitario: i.produto.preco_venda,
            })),
            pagamentos: [{ metodo: p.metodo, valor: p.total }],
            cliente_id: p.cliente_id,
          }),
        });
        atual = atual.filter((x) => x !== p);
        guardarFila(atual);
      } catch {
        break;
      }
    }
    setSincronizando(false);
  }, [fila, guardarFila]);

  const sincronizarRef = useRef(sincronizarFila);
  useEffect(() => {
    sincronizarRef.current = sincronizarFila;
  }, [sincronizarFila]);

  useEffect(() => {
    const carregarFila = () => {
      try {
        const raw = localStorage.getItem("shoplink_fila");
        setFila(raw ? JSON.parse(raw) : []);
      } catch {
        setFila([]);
      }
    };
    carregarFila();
    const onOnline = () => {
      setOnline(true);
      void sincronizarRef.current();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (online && fila.length > 0) {
      const t = setTimeout(() => void sincronizarFila(), 0);
      return () => clearTimeout(t);
    }
  }, [online, fila.length, sincronizarFila]);

  const produtosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return produtos;
    return produtos.filter(
      (p) =>
        p.nome.toLowerCase().includes(q) ||
        (p.codigo_barras ?? "").toLowerCase().includes(q) ||
        (p.sku_interno ?? "").toLowerCase().includes(q)
    );
  }, [produtos, busca]);

  const subtotal = carrinho.reduce(
    (s, i) => s + i.quantidade * i.produto.preco_venda,
    0
  );
  const total = Math.max(subtotal - Number(desconto || 0), 0);
  const troco = Math.max(Number(recebido || 0) - total, 0);

  function adicionar(p: ProdutoDTO) {
    if (!caixaAberto) {
      setErro("Tem de abrir o Caixa primeiro para poder adicionar produtos ao carrinho.");
      return;
    }
    setErro("");
    setCarrinho((c) => {
      const existente = c.find((i) => i.produto.id === p.id);
      if (existente) {
        return c.map((i) =>
          i.produto.id === p.id
            ? {
                ...i,
                quantidade: Math.min(
                  i.produto.controla_stock
                    ? i.produto.stock_atual
                    : Number.MAX_SAFE_INTEGER,
                  i.quantidade + 1
                ),
              }
            : i
        );
      }
      return [...c, { produto: p, quantidade: 1 }];
    });
  }

  function mudarQtd(id: string, delta: number) {
    setCarrinho((c) =>
      c
        .map((i) => {
          if (i.produto.id !== id) return i;
          const max = i.produto.controla_stock ? i.produto.stock_atual : Number.MAX_SAFE_INTEGER;
          const nova = Math.min(Math.max(i.quantidade + delta, 1), max);
          return { ...i, quantidade: nova };
        })
        .filter((i) => i.quantidade > 0)
    );
  }

  function remover(id: string) {
    setCarrinho((c) => c.filter((i) => i.produto.id !== id));
  }

  function concluir() {
    setErro("");
    if (metodo === "fiado" && !permiteVendaFiado) {
      return setErro("Esta loja não permite vendas a fiado");
    }
    if (metodo === "fiado" && !clienteId) {
      return setErro("Selecione o cliente para a venda a fiado");
    }
    setCheckout(false);
    setFinalizando(true);

    const payload = {
      itens: carrinho.map((i) => ({
        produto_id: i.produto.id,
        quantidade: i.quantidade,
        preco_unitario: i.produto.preco_venda,
      })),
      pagamentos: [{ metodo, valor: total }],
      cliente_id: metodo === "fiado" ? clienteId : undefined,
      desconto_total: Number(desconto || 0),
    };

    async function executar() {
      if (navigator.onLine) {
        const venda = await apiFetch<{ numero_recibo: string; total: number; status: string }>(
          "/api/vendas",
          { method: "POST", body: JSON.stringify(payload) }
        );
        setRecibo({ ...venda, itens: [...carrinho], recebido: Number(recebido), troco });
        setCarrinho([]);
        setDesconto(0);
        setRecebido("");
        setClienteId("");
        setMetodo("dinheiro");
      } else {
        const pendente = {
          itens: carrinho,
          total,
          metodo,
          cliente_id: payload.cliente_id,
          criadoEm: new Date().toISOString(),
        } satisfies Pendente;
        guardarFila([...fila, pendente]);
        setRecibo({ numero_recibo: "OFFLINE", total, status: "pendente_fiado", itens: [...carrinho], recebido: Number(recebido), troco });
        setCarrinho([]);
        setDesconto(0);
        setRecebido("");
        setClienteId("");
        setMetodo("dinheiro");
      }
    }

    executar()
      .catch((e: unknown) => setErro(e instanceof Error ? e.message : "Falha ao registar a venda"))
      .finally(() => setFinalizando(false));
  }

  const mudarParaCliente = (id: string) => {
    setClienteId(id);
    const c = clientes.find((x) => x.id === id);
    if (c && c.saldo_fiado >= c.limite_fiado && c.limite_fiado > 0) {
      setErro("Este cliente atingiu o limite de fiado");
    }
  };

  if (carregando) return <Loading className="min-h-[60vh]" label="A preparar o PDV…" />;

  return (
    <div className="mx-auto max-w-7xl">
      {/* Banner offline */}
      {!online && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          <WifiOff className="h-4 w-4" />
          <span>Sem internet — as vendas ficam guardadas e sincronizam quando voltar online.</span>
        </div>
      )}
      {fila.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-300">
          {sincronizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
          <span>
            {sincronizando
              ? "A sincronizar vendas offline…"
              : `${fila.length} venda${fila.length > 1 ? "s" : ""} offline à espera de sincronização`}
          </span>
        </div>
      )}
      {!caixaAberto && (
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>O Caixa está fechado. Tem de o abrir na página do Caixa para poder faturar.</span>
          </div>
          <Link href="/caixa" className="rounded-lg bg-rose-500/20 px-3 py-1.5 font-medium text-rose-200 hover:bg-rose-500/30">
            Ir para Caixa
          </Link>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Catálogo */}
        <div className="lg:col-span-2">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              placeholder="Procurar por nome ou código de barras…"
              className="h-12 pl-10 text-base"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              autoFocus
            />
          </div>

          {produtosFiltrados.length === 0 ? (
            <EmptyState
              icon={PackageX}
              title="Nenhum produto"
              description="Adicione produtos ao catálogo para começar a vender"
              action={
                <Link href="/produtos" className="text-sm font-medium text-emerald-400 hover:text-emerald-300">
                  Cadastrar produto
                </Link>
              }
            />
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {produtosFiltrados.map((p) => {
                const esgotado = p.controla_stock && p.stock_atual <= 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => !esgotado && adicionar(p)}
                    disabled={esgotado}
                    className="group relative flex flex-col gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-left transition-all hover:border-emerald-500/50 hover:bg-zinc-900 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                        {p.categoria ?? "Sem categoria"}
                      </span>
                      {esgotado && <Badge color="red">Esgotado</Badge>}
                    </div>
                    <p className="line-clamp-2 text-sm font-medium leading-snug text-zinc-100">
                      {p.nome}
                    </p>
                    <div className="mt-auto flex items-end justify-between gap-2">
                      <div>
                        <p className="text-base font-bold text-emerald-400">
                          {formatarMoeda(p.preco_venda, moeda)}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          {p.controla_stock ? `${p.stock_atual} ${p.unidade_medida}` : "Sem stock"}
                        </p>
                      </div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500 text-white opacity-0 shadow-lg shadow-emerald-500/30 transition-opacity group-hover:opacity-100">
                        <Plus className="h-4 w-4" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Carrinho */}
        <div className="lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)] lg:max-h-none">
          <div className="flex h-full flex-col rounded-3xl border border-zinc-800 bg-zinc-900/60">
            <div className="flex items-center gap-2 border-b border-zinc-800 px-5 py-4">
              <ShoppingCart className="h-4 w-4 text-emerald-400" />
              <h2 className="font-semibold text-zinc-100">Venda atual</h2>
              <span className="ml-auto rounded-lg bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                {carrinho.length} itens
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {carrinho.length === 0 ? (
                <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-center">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                    <ShoppingCart className="h-6 w-6 text-zinc-600" />
                  </div>
                  <p className="text-sm text-zinc-500">
                    Toque num produto para adicionar
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {carrinho.map((i) => (
                    <div key={i.produto.id} className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-200">
                          {i.produto.nome}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {formatarMoeda(i.produto.preco_venda, moeda)}{" "}
                          {i.produto.unidade_medida !== "un" && `/ ${i.produto.unidade_medida}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => mudarQtd(i.produto.id, -1)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-7 text-center text-sm font-semibold text-zinc-100">
                          {i.quantidade}
                        </span>
                        <button
                          onClick={() => mudarQtd(i.produto.id, 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="w-20 text-right text-sm font-semibold text-zinc-100">
                        {formatarMoeda(i.quantidade * i.produto.preco_venda, moeda)}
                      </p>
                      <button
                        onClick={() => remover(i.produto.id)}
                        className="text-zinc-600 hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-zinc-800 p-5">
              <div className="flex justify-between text-sm text-zinc-400">
                <span>Subtotal</span>
                <span>{formatarMoeda(subtotal, moeda)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-sm text-zinc-400">Desconto</span>
                <Input
                  type="number"
                  min={0}
                  placeholder="0.00"
                  className="h-8 w-28 text-right"
                  value={desconto || ""}
                  onChange={(e) => setDesconto(Number(e.target.value))}
                />
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-3">
                <span className="text-base font-semibold text-zinc-100">Total</span>
                <span className="text-2xl font-black tracking-tight text-emerald-400">
                  {formatarMoeda(total, moeda)}
                </span>
              </div>
              <Button
                size="lg"
                className="mt-4 w-full"
                disabled={carrinho.length === 0 || !caixaAberto}
                onClick={() => {
                  setErro("");
                  setCheckout(true);
                }}
              >
                Finalizar ({formatarMoeda(total, moeda)})
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal checkout */}
      <Modal
        open={checkout}
        onClose={() => setCheckout(false)}
        title="Pagamento"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCheckout(false)}>
              Cancelar
            </Button>
            <Button onClick={concluir} disabled={finalizando}>
              {finalizando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                `Confirmar · ${formatarMoeda(total, moeda)}`
              )}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {erro && (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
              {erro}
            </p>
          )}

          <div className="grid grid-cols-5 gap-2">
            {(Object.keys(METODO_INFO) as Metodo[])
              .filter((m) => m !== "fiado" || permiteVendaFiado)
              .map((m) => {
                const info = METODO_INFO[m];
                const Icon = info.icon;
                return (
                  <button
                    key={m}
                    onClick={() => setMetodo(m)}
                    className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-xs font-medium transition-all ${
                      metodo === m
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                        : "border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {info.label}
                  </button>
                );
              })}
          </div>

          {metodo === "fiado" && (
            <Field label="Cliente (fiado)">
              <Select value={clienteId} onChange={(e) => mudarParaCliente(e.target.value)}>
                <option value="">Selecione o cliente…</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} {c.saldo_fiado > 0 ? `(deve ${formatarMoeda(c.saldo_fiado, moeda)})` : ""}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {metodo === "dinheiro" && (
            <Field label="Valor recebido">
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  placeholder="0.00"
                  autoFocus
                  className="h-12 text-lg font-semibold"
                  value={recebido}
                  onChange={(e) => setRecebido(e.target.value)}
                />
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {[500, 200, 100, 50].map((v) => (
                  <button
                    key={v}
                    onClick={() => setRecebido(String(Number(recebido || 0) + v))}
                    className="rounded-xl border border-zinc-800 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800"
                  >
                    +{v}
                    {moeda === "MZN" ? "" : ""}
                  </button>
                ))}
              </div>
              {troco > 0 && (
                <p className="mt-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
                  Troco: {formatarMoeda(troco, moeda)}
                </p>
              )}
            </Field>
          )}

          <div className="flex justify-between rounded-2xl bg-zinc-950/60 px-4 py-3">
            <span className="text-sm text-zinc-400">Total a cobrar</span>
            <span className="text-lg font-bold text-zinc-100">
              {formatarMoeda(total, moeda)}
            </span>
          </div>
        </div>
      </Modal>

      {/* Modal recibo */}
      <Modal
        open={recibo !== null}
        onClose={() => setRecibo(null)}
        title={recibo?.numero_recibo === "OFFLINE" ? "Venda guardada offline" : "Venda concluída"}
        size="sm"
        footer={
          <Button
            className="w-full"
            onClick={() => {
              setRecibo(null);
              setCheckout(false);
            }}
          >
            Nova venda
          </Button>
        }
      >
        {recibo && (
          <div className="flex flex-col items-center gap-3 py-4 text-center" id="recibo-imprimir">
            <div className="mb-2 w-full text-center">
              <h3 className="text-xl font-bold text-zinc-100">{loja.nome}</h3>
              {loja.endereco && <p className="text-xs text-zinc-500">{loja.endereco}</p>}
              <p className="text-xs text-zinc-500">
                {loja.nuit && `NUIT: ${loja.nuit}`} {loja.nuit && loja.telefone && "| "} {loja.telefone && `Tel: ${loja.telefone}`}
              </p>
            </div>

            <div className="rounded-full bg-emerald-500/15 p-3">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
            <div>
              <p className="font-mono text-sm font-semibold text-zinc-100">
                {recibo.numero_recibo}
              </p>
              <p className="mt-1 text-2xl font-black text-zinc-50">
                {formatarMoeda(Number(recibo.total), moeda)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {recibo.numero_recibo === "OFFLINE"
                  ? "Será enviado quando houver internet"
                  : `${METODO_INFO[metodo].label} · ${new Date().toLocaleTimeString("pt-PT")}`}
              </p>
            </div>
            
            <div className="mt-3 w-full border-t border-dashed border-zinc-700 pt-3 text-left">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500">
                    <th className="pb-1 text-left font-medium">Qtd</th>
                    <th className="pb-1 text-left font-medium">Descrição</th>
                    <th className="pb-1 text-right font-medium">Preço</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {recibo.itens.map(i => (
                    <tr key={i.produto.id}>
                      <td className="py-1 text-zinc-300">{i.quantidade}</td>
                      <td className="py-1 text-zinc-300 line-clamp-1">{i.produto.nome}</td>
                      <td className="py-1 text-right text-zinc-300">{formatarMoeda(i.quantidade * i.produto.preco_venda, moeda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {metodo === "dinheiro" && (
              <div className="w-full text-right text-xs text-zinc-400 mt-2">
                <p>Dinheiro: {formatarMoeda(recibo.recebido || 0, moeda)}</p>
                <p>Troco: {formatarMoeda(recibo.troco || 0, moeda)}</p>
              </div>
            )}

            <div className="mt-4 flex justify-center bg-white p-2 rounded-xl">
              <QRCodeSVG 
                value={`${loja.nome}\n${recibo.numero_recibo}\nTotal: ${formatarMoeda(Number(recibo.total), moeda)}\n${recibo.itens.length} itens`} 
                size={120} 
              />
            </div>

            <div className="mt-2 w-full border-t border-dashed border-zinc-700 pt-3 text-center">
              <p className="text-xs text-zinc-500">Obrigado pela preferência!</p>
              <p className="text-[10px] text-zinc-600 mt-1">Processado por ShopLink</p>
            </div>

            <Button
              variant="outline"
              className="w-full mt-4 hidden-print"
              onClick={() => {
                const html = document.getElementById("recibo-imprimir")?.innerHTML;
                const imprime = window.open("", "_blank");
                if (imprime && html) {
                  imprime.document.write(`
                    <html>
                      <head>
                        <title>Recibo ${recibo.numero_recibo}</title>
                        <style>
                          body { font-family: monospace; width: 300px; margin: 0 auto; padding: 10px; color: black; background: white; }
                          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                          th, td { padding: 4px 0; font-size: 12px; }
                          th { text-align: left; border-bottom: 1px dashed black; }
                          .text-right { text-align: right; }
                          .text-center { text-align: center; }
                          .font-bold { font-weight: bold; }
                          .text-xl { font-size: 18px; margin: 0; }
                          .text-xs { font-size: 10px; margin: 2px 0; }
                          .text-2xl { font-size: 24px; margin: 5px 0; }
                          .border-t { border-top: 1px dashed black; margin-top: 10px; padding-top: 10px; }
                          .bg-emerald-500\\/15 { display: none; }
                          .hidden-print { display: none !important; }
                          .flex { display: flex; flex-direction: column; align-items: center; }
                          svg { display: block; margin: 0 auto; }
                        </style>
                      </head>
                      <body onload="window.print(); window.close();">
                        ${html}
                      </body>
                    </html>
                  `);
                  imprime.document.close();
                }
              }}
            >
              <ScanLine className="h-4 w-4 mr-2" /> Imprimir recibo
            </Button>
          </div>
        )}
      </Modal>

      {/* Rodapé info */}
      <div className="mt-4 hidden items-center gap-2 text-xs text-zinc-600 lg:flex">
        <span>Tipo de loja: {papel === "caixa" ? "operador de caixa" : papel}</span>
      </div>
    </div>
  );
}