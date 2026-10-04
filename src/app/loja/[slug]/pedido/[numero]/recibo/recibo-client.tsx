"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  MapPin,
  Phone,
  Mail,
  Truck,
  CreditCard,
  Wallet,
  User,
  Package,
  Star,
  MapPin as MapPinIcon,
  ArrowLeft,
  RefreshCw,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatarMoeda } from "@/lib/format";

interface Loja {
  id: string;
  nome: string;
  cidade: string | null;
  provincia: string | null;
  endereco: string | null;
  telefone: string | null;
  logotipo_url: string | null;
}

interface Pedido {
  id: string;
  numero_pedido: string;
  tipo: string;
  status: string;
  status_pagamento: string;
  metodo_pagamento: string | null;
  tipo_entrega: string | null;
  endereco_entrega: string | null;
  subtotal: number;
  total: number;
  data_criacao: string;
  data_expiracao: string | null;
  cliente_nome: string;
  cliente_telefone: string;
  cliente_email: string | null;
}

interface Item {
  nome: string;
  quantidade: number;
  preco_unitario: number;
  subtotal_linha: number;
  unidade_medida: string;
}

interface Entregador {
  id: string;
  name: string;
  phone: string;
  vehicleType: string;
  plateNumber: string;
  vehicleColor: string;
  rating: number;
  currentLatitude: number;
  currentLongitude: number;
  isAvailable: boolean;
}

const METODO: Record<string, string> = {
  mpesa: "M-Pesa",
  emola: "e-Mola",
  cartao: "Cartão",
  na_loja: "Na loja",
  credit_card: "Cartão",
};

const VEHICLE_LABEL: Record<string, string> = {
  MOTORCYCLE: "Mota",
  BICYCLE: "Bicicleta",
  CAR: "Carro",
  FOOT: "A pé",
};

export function ReciboClient({
  slug,
  loja,
  pedido,
  itens,
}: {
  slug: string;
  loja: Loja;
  pedido: Pedido;
  itens: Item[];
}) {
  const router = useRouter();
  const [entregadores, setEntregadores] = useState<Entregador[]>([]);
  const [carregandoEntregadores, setCarregandoEntregadores] = useState(true);
  const [entregadorSelecionado, setEntregadorSelecionado] = useState<string | null>(null);
  const [solicitandoEntrega, setSolicitandoEntrega] = useState(false);
  const [entregaSolicitada, setEntregaSolicitada] = useState(false);
  const [erroEntrega, setErroEntrega] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEntregadores() {
      if (pedido.tipo_entrega !== "entrega_domicilio") {
        setCarregandoEntregadores(false);
        return;
      }
      try {
        const res = await fetch(`/api/loja/${slug}/pedido/${pedido.numero_pedido}/entregadores`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          setEntregadores(data.entregadores || []);
        }
      } catch {
        // silencioso
      } finally {
        setCarregandoEntregadores(false);
      }
    }
    fetchEntregadores();
  }, [slug, pedido.numero_pedido, pedido.tipo_entrega]);

  const handleSolicitarEntrega = async (entregadorId: string) => {
    if (!entregadorId) return;
    setSolicitandoEntrega(true);
    setErroEntrega(null);
    try {
      const entregador = entregadores.find((e) => e.id === entregadorId);
      const res = await fetch(`/api/loja/${slug}/pedido/${pedido.numero_pedido}/solicitar-entrega`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryPersonId: entregadorId,
          deliveryAddress: pedido.endereco_entrega,
          deliveryLatitude: entregador?.currentLatitude,
          deliveryLongitude: entregador?.currentLongitude,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao solicitar entrega");
      setEntregaSolicitada(true);
      setEntregadorSelecionado(entregadorId);
    } catch (e: unknown) {
      setErroEntrega(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setSolicitandoEntrega(false);
    }
  };

  const pago = pedido.status_pagamento === "pago";
  const falhou = pedido.status_pagamento === "falhou";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/loja/${slug}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 text-center">
            <h1 className="text-lg font-semibold">Recibo Digital</h1>
            <p className="text-xs text-zinc-500">{loja.nome}</p>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {/* Header do recibo */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-emerald-400">Recibo #{pedido.numero_pedido}</h2>
              <p className="text-sm text-zinc-500 mt-1">
                {new Date(pedido.data_criacao).toLocaleString("pt-MZ", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div className="text-right">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                pago ? "bg-emerald-500/20 text-emerald-400" :
                falhou ? "bg-rose-500/20 text-rose-400" :
                "bg-amber-500/20 text-amber-400"
              }`}>
                {pago ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" /> Pago
                  </>
                ) : falhou ? (
                  "Falhou"
                ) : (
                  <>
                    <span className="h-3 w-3 animate-pulse rounded-full bg-amber-400" />
                    Pendente
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Info da loja e cliente */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
            <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-400 mb-3">
              <Store className="h-4 w-4" /> Loja
            </h3>
            <p className="font-medium">{loja.nome}</p>
            {loja.endereco && <p className="text-sm text-zinc-500 mt-1">{loja.endereco}</p>}
            <p className="text-sm text-zinc-500">
              {[loja.cidade, loja.provincia].filter(Boolean).join(", ") || "Moçambique"}
            </p>
            {loja.telefone && (
              <p className="flex items-center gap-1 text-sm text-zinc-500 mt-1">
                <Phone className="h-3.5 w-3.5" /> {loja.telefone}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
            <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-400 mb-3">
              <User className="h-4 w-4" /> Cliente
            </h3>
            <p className="font-medium">{pedido.cliente_nome}</p>
            <p className="flex items-center gap-1 text-sm text-zinc-500 mt-1">
              <Phone className="h-3.5 w-3.5" /> {pedido.cliente_telefone}
            </p>
            {pedido.cliente_email && (
              <p className="flex items-center gap-1 text-sm text-zinc-500 mt-1">
                <Mail className="h-3.5 w-3.5" /> {pedido.cliente_email}
              </p>
            )}
          </div>
        </div>

        {/* Itens */}
        <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 font-medium">Itens do pedido</div>
          <div className="divide-y divide-zinc-800">
            {itens.map((item, idx) => (
              <div key={idx} className="px-4 py-3 flex justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.nome}</p>
                  <p className="text-sm text-zinc-500">
                    {item.quantidade}x {item.unidade_medida || "un"} × {formatarMoeda(item.preco_unitario, "MZN")}
                  </p>
                </div>
                <span className="font-mono text-emerald-400 whitespace-nowrap">
                  {formatarMoeda(item.subtotal_linha, "MZN")}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Totais */}
        <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Subtotal</span>
            <span>{formatarMoeda(pedido.subtotal, "MZN")}</span>
          </div>
          {pedido.tipo_entrega === "entrega_domicilio" && (
            <div className="mt-1 flex justify-between text-sm">
              <span className="text-zinc-400">Taxa de entrega</span>
              <span>{formatarMoeda(50, "MZN")}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between text-lg font-bold border-t border-zinc-800 pt-2">
            <span>Total</span>
            <span className="text-emerald-400">{formatarMoeda(pedido.total, "MZN")}</span>
          </div>
          <div className="mt-2 flex justify-between text-xs text-zinc-500">
            <span>Pagamento</span>
            <span>{METODO[pedido.metodo_pagamento ?? ""] ?? "—"}</span>
          </div>
          <div className="flex justify-between text-xs text-zinc-500">
            <span>Entrega</span>
            <span>{pedido.tipo_entrega === "entrega_domicilio" ? "Entrega em domicílio" : "Levantamento na loja"}</span>
          </div>
        </div>

        {/* Entregadores */}
        {pedido.tipo_entrega === "entrega_domicilio" && (
          <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
            <h3 className="flex items-center gap-2 text-lg font-medium mb-4">
              <Truck className="h-5 w-5 text-emerald-400" /> Escolher Entregador
            </h3>

            {entregaSolicitada && entregadorSelecionado ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                <div className="flex items-center gap-3 text-emerald-400">
                  <CheckCircle2 className="h-6 w-6" />
                  <div>
                    <p className="font-medium">Entrega solicitada com sucesso!</p>
                    <p className="text-sm text-zinc-400">
                      O entregador foi notificado e vai recolher o pedido em breve.
                    </p>
                  </div>
                </div>
              </div>
            ) : carregandoEntregadores ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
              </div>
            ) : entregadores.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">
                <Truck className="mx-auto h-12 w-12 text-zinc-600 mb-2" />
                <p>Nenhum entregador disponível na sua cidade no momento.</p>
                <p className="text-sm mt-1">Tente novamente mais tarde ou contacte a loja.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {entregadores.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setEntregadorSelecionado(e.id)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition ${
                      entregadorSelecionado === e.id
                        ? "border-emerald-500 bg-emerald-500/10"
                        : "border-zinc-800 hover:border-zinc-700"
                    }`}
                    disabled={entregaSolicitada || solicitandoEntrega}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                        <Truck className="h-6 w-6 text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium truncate">{e.name}</p>
                          <span className="flex items-center gap-1 text-xs text-amber-400">
                            <Star className="h-3 w-3 fill-current" /> {e.rating.toFixed(1)}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-500 mt-1">
                          {VEHICLE_LABEL[e.vehicleType] || e.vehicleType} — {e.vehicleColor} ({e.plateNumber})
                        </p>
                        <p className="text-xs text-zinc-600 mt-1 flex items-center gap-1">
                          <MapPinIcon className="h-3 w-3" />
                          Lat: {e.currentLatitude?.toFixed(4) || "—"}, Lng: {e.currentLongitude?.toFixed(4) || "—"}
                        </p>
                      </div>
                      {entregadorSelecionado === e.id && (
                        <div className="flex flex-col items-end gap-2">
                          <span className="text-xs text-emerald-400 font-medium">Selecionado</span>
                          <Button
                            size="sm"
                            onClick={(ev) => { ev.stopPropagation(); handleSolicitarEntrega(e.id); }}
                            disabled={solicitandoEntrega}
                          >
                            {solicitandoEntrega ? "A solicitar..." : "Confirmar entrega"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {erroEntrega && (
              <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
                {erroEntrega}
              </div>
            )}
          </div>
        )}

        {/* Botões de navegação */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => router.push(`/loja/${slug}`)}>
            <Package className="h-4 w-4 mr-2" /> Voltar à loja
          </Button>
          <Button className="flex-1" onClick={() => router.push("/")}>
            <MapPin className="h-4 w-4 mr-2" /> Página principal
          </Button>
        </div>
      </main>
    </div>
  );
}