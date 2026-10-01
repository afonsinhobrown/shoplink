"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Loader2, MapPin, Store, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatarMoeda } from "@/lib/format";

interface Loja {
  nome: string;
  cidade: string | null;
  provincia: string | null;
}

interface Pedido {
  numero_pedido: string;
  tipo: string;
  status: string;
  status_pagamento: string;
  metodo_pagamento: string | null;
  tipo_entrega: string | null;
  endereco_entrega: string | null;
  subtotal: number;
  total: number;
  data_expiracao: string | null;
}

const METODO: Record<string, string> = {
  mpesa: "M-Pesa",
  emola: "e-Mola",
  cartao: "Cartão",
  na_loja: "Na loja",
  credit_card: "Cartão",
};

/** Quantas vezes sondamos o estado antes de parar (3s cada). */
const TENTATIVAS = 40;

export function PedidoClient({ slug, loja, pedido: inicial }: { slug: string; loja: Loja; pedido: Pedido }) {
  const router = useRouter();
  const [pedido, setPedido] = useState<Pedido>(inicial);
  const [tentativas, setTentativas] = useState(0);

  const terminal =
    pedido.status_pagamento === "pago" ||
    pedido.status_pagamento === "falhou" ||
    pedido.status_pagamento === "reembolsado" ||
    tentativas >= TENTATIVAS;

  // Só faz sentido sondar enquanto o pagamento não tem estado final.
  useEffect(() => {
    if (pedido.status_pagamento !== "pendente" || tentativas >= TENTATIVAS) return;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/publico/${slug}/pedidos/${pedido.numero_pedido}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          if (data.pedido) setPedido((p) => ({ ...p, ...data.pedido }));
        }
      } catch {
        // rede instável: voltamos a tentar
      }
      setTentativas((t) => t + 1);
    }, 3000);

    return () => clearTimeout(timer);
  }, [slug, pedido.numero_pedido, pedido.status_pagamento, tentativas]);

  const pago = pedido.status_pagamento === "pago";
  const falhou = pedido.status_pagamento === "falhou";
  const expirado = pedido.status === "expirado" || pedido.status === "cancelado";

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
                {[loja.cidade, loja.provincia].filter(Boolean).join(", ") || "Moçambique"}
              </p>
            </div>
          </div>
          <Badge color="green">Loja online</Badge>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-8">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-8 text-center">
          {pago ? (
            <>
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
              <h1 className="mt-4 text-xl font-semibold text-emerald-300">
                Pagamento confirmado
              </h1>
              <p className="mt-2 text-sm text-zinc-400">
                A loja já foi notificada e vai preparar o seu pedido.
              </p>
            </>
          ) : falhou ? (
            <>
              <XCircle className="mx-auto h-12 w-12 text-rose-500" />
              <h1 className="mt-4 text-xl font-semibold text-rose-300">
                Pagamento não concluído
              </h1>
              <p className="mt-2 text-sm text-zinc-400">
                O pagamento não foi confirmado. Pode tentar novamente na loja.
              </p>
            </>
          ) : (
            <>
              {terminal ? (
                <Clock className="mx-auto h-12 w-12 text-amber-400" />
              ) : (
                <Loader2 className="mx-auto h-12 w-12 animate-spin text-emerald-500" />
              )}
              <h1 className="mt-4 text-xl font-semibold">
                {terminal
                  ? expirado
                    ? "Pedido expirado"
                    : "A aguardar confirmação"
                  : "A confirmar o pagamento"}
              </h1>
              <p className="mt-2 text-sm text-zinc-400">
                {terminal
                  ? "Se já pagou, a confirmação pode demorar alguns minutos. Contacte a loja com o número do pedido."
                  : "Não feche esta página. Assim que a PaySuite confirmar, o estado é atualizado aqui."}
              </p>
            </>
          )}

          <p className="mt-6 text-2xl font-bold">{pedido.numero_pedido}</p>
        </div>

        <div className="mt-4 space-y-2 rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 text-sm">
          <Linha rotulo="Tipo" valor={pedido.tipo === "compra_online" ? "Compra online" : "Reserva"} />
          <Linha
            rotulo="Pagamento"
            valor={
              pedido.status_pagamento === "pago"
                ? "Pago"
                : pedido.status_pagamento === "falhou"
                  ? "Falhou"
                  : `${METODO[pedido.metodo_pagamento ?? ""] ?? "Por definir"} — pendente`
            }
          />
          <Linha
            rotulo="Entrega"
            valor={pedido.tipo_entrega === "entrega_domicilio" ? "Entrega em domicílio" : "Levantamento na loja"}
          />
          {pedido.endereco_entrega && <Linha rotulo="Morada" valor={pedido.endereco_entrega} />}
          <Linha rotulo="Total" valor={formatarMoeda(pedido.total, "MZN")} destaque />
        </div>

        <Button
          className="mt-6 w-full"
          variant="secondary"
          onClick={() => router.push(`/loja/${slug}`)}
        >
          Voltar à loja
        </Button>
      </main>
    </div>
  );
}

function Linha({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4 border-b border-zinc-800/60 py-2 last:border-0">
      <span className="shrink-0 text-zinc-500">{rotulo}</span>
      <span
        className={`text-right ${destaque ? "font-semibold text-emerald-400" : "text-zinc-300"}`}
      >
        {valor}
      </span>
    </div>
  );
}