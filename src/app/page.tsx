import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  Boxes,
  Check,
  ClipboardList,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Store,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSessao } from "@/lib/auth";

const FUNCIONALIDADES = [
  {
    icon: ShoppingCart,
    titulo: "PDV rápido",
    texto:
      "Vendas em segundos, com pesquisa de produtos, leitor de código de barras e modo rápido ou completo.",
  },
  {
    icon: Boxes,
    titulo: "Stock em tempo real",
    texto:
      "Entradas, saídas, ajustes e alertas de stock baixo. Controlo de lotes e validade para mini supermercados.",
  },
  {
    icon: ReceiptText,
    titulo: "Vendas e recibos",
    texto:
      "Histórico completo de vendas, pagamentos em dinheiro, M-Pesa, e-Mola ou fiado, com comprovativos.",
  },
  {
    icon: Banknote,
    titulo: "Caixa e fiado",
    texto:
      "Abertura e fecho de caixa, controlo de valores e gestão de devedores num só lugar.",
  },
  {
    icon: ClipboardList,
    titulo: "Loja online (opcional)",
    texto:
      "Ative se quiser: catálogo público por loja, reservas e compras online com pagamento por M-Pesa, e-Mola e cartão.",
  },
  {
    icon: Users,
    titulo: "Equipa e permissões",
    texto:
      "Dono, gestor, caixa e stock — cada colaborador vê apenas o que precisa para trabalhar.",
  },
];

const INCLUIDO = [
  "PDV ilimitado para a sua loja",
  "Gestão de stock, vendas e caixa",
  "Loja online opcional, com catálogo público",
  "Pagamentos M-Pesa, e-Mola e cartão (NetShop)",
  "Funciona em telemóvel, tablet e computador",
  "Colaboradores com níveis de acesso",
];

export default async function LandingPage() {
  const sessao = await getSessao();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30">
              <Store className="h-[18px] w-[18px] text-white" />
            </div>
            <div className="leading-tight">
              <p className="text-base font-bold tracking-tight text-zinc-50">
                ShopLink
              </p>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500">
                POS para mercearias
              </p>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-zinc-400 md:flex">
            <a href="#funcionalidades" className="hover:text-zinc-100">
              Funcionalidades
            </a>
            <a href="#loja-online" className="hover:text-zinc-100">
              Loja online
            </a>
            <a href="#preco" className="hover:text-zinc-100">
              Preço
            </a>
          </nav>
          <div className="flex items-center gap-2">
            {sessao ? (
              <Link href="/dashboard">
                <Button size="sm">
                  Ir para o painel
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    Entrar
                  </Button>
                </Link>
                <Link href="/registar">
                  <Button size="sm">Criar conta</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-500/15 blur-3xl" />
          <div className="absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-medium text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            Feito para mercearias e mini supermercados de Moçambique
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-tight tracking-tight text-zinc-50 sm:text-5xl">
            Gerencie a sua loja,{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-emerald-600 bg-clip-text text-transparent">
              sem complicações
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-zinc-400 sm:text-lg">
            O ShopLink reúne PDV, stock, caixa e fiado numa única aplicação. E se
            quiser vender online, a loja pública já vem incluída, sem custo
            extra.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href={sessao ? "/dashboard" : "/registar"}>
              <Button size="lg" className="w-full sm:w-auto">
                {sessao ? "Abrir o painel" : "Criar conta gratuita"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#preco">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Ver preço
              </Button>
            </a>
          </div>
          <div className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { valor: "PDV", label: "Vendas rápidas" },
              { valor: "Stock", label: "Em tempo real" },
              { valor: "Online", label: "Catálogo público" },
              { valor: "2.500", label: "MZN / mês" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4"
              >
                <p className="text-lg font-bold text-zinc-50">{s.valor}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Funcionalidades */}
      <section id="funcionalidades" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-50">
            Tudo o que a sua loja precisa
          </h2>
          <p className="mt-3 text-zinc-400">
            Uma ferramenta simples, pensada para o dia a dia de quem vende.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FUNCIONALIDADES.map((f) => (
            <div
              key={f.titulo}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition-colors hover:border-emerald-500/30 hover:bg-zinc-900"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-zinc-50">
                {f.titulo}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                {f.texto}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Loja online */}
      <section id="loja-online" className="border-y border-zinc-800/80 bg-zinc-900/30">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-300">
              <Smartphone className="h-3.5 w-3.5" />
              Opcional · incluído na licença
            </span>
            <h2 className="mt-5 text-3xl font-bold tracking-tight text-zinc-50">
              Venda online, se quiser
            </h2>
            <p className="mt-3 text-zinc-400">
              A loja online é opcional. Se ativar, cada loja ganha uma montra
              pública com os produtos disponíveis. Os clientes podem reservar ou
              comprar e pagar por M-Pesa, e-Mola ou cartão, e a encomenda entra
              diretamente no seu painel de pedidos. Não ativou? Usa o ShopLink
              normalmente, só para gerir a loja.
            </p>
            <ul className="mt-6 space-y-3">
              {["Ative ou desative quando quiser, sem custo extra", "Catálogo público por loja", "Pedidos confirmados com um clique no balcão"].map(
                (t) => (
                  <li key={t} className="flex items-start gap-2.5 text-sm text-zinc-300">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    {t}
                  </li>
                )
              )}
            </ul>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/registar">
                <Button>Criar a minha conta</Button>
              </Link>
              <Link
                href="/loja/mercearia-central"
                className="inline-flex h-10 items-center rounded-xl border border-zinc-700 px-4 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
              >
                Ver loja de exemplo
              </Link>
            </div>
          </div>
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <p className="font-semibold text-zinc-50">Mercearia Central</p>
                <p className="text-xs text-zinc-500">Maputo · mini supermercado</p>
              </div>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] text-emerald-300">
                Aberta
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {[
                { nome: "Arroz 5kg", preco: "450,00 MZN" },
                { nome: "Óleo 1L", preco: "180,00 MZN" },
                { nome: "Açúcar 1kg", preco: "95,00 MZN" },
              ].map((p) => (
                <div
                  key={p.nome}
                  className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3"
                >
                  <span className="text-sm text-zinc-200">{p.nome}</span>
                  <span className="text-sm font-medium text-emerald-400">
                    {p.preco}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-emerald-500 px-4 py-3 text-center text-sm font-semibold text-white">
              Finalizar compra
            </div>
          </div>
        </div>
      </section>

      {/* Preço */}
      <section id="preco" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-50">
            Um preço simples e justo
          </h2>
          <p className="mt-3 text-zinc-400">
            Sem taxa de adesão. Comece grátis e renove quando quiser.
          </p>
        </div>
        <div className="mx-auto mt-10 max-w-md">
          <div className="relative overflow-hidden rounded-3xl border border-emerald-500/40 bg-zinc-900/60 p-8">
            <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-emerald-500/20 blur-3xl" />
            <div className="relative">
              <p className="text-sm font-medium text-emerald-400">
                Licença mensal
              </p>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-4xl font-bold text-zinc-50">2.500,00 MZN</span>
                <span className="pb-1 text-sm text-zinc-500">/ mês</span>
              </div>
              <p className="mt-2 text-sm text-zinc-400">
                Por loja. Pago por cartão BCI ou BIM, sem compromisso.
              </p>
              <ul className="mt-6 space-y-3">
                {INCLUIDO.map((t) => (
                  <li
                    key={t}
                    className="flex items-start gap-2.5 text-sm text-zinc-300"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    {t}
                  </li>
                ))}
              </ul>
              <Link href={sessao ? "/licenca" : "/registar"} className="mt-8 block">
                <Button size="lg" className="w-full">
                  {sessao ? "Renovar licença" : "Começar agora"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <p className="mt-3 text-center text-xs text-zinc-500">
                10 dias de avaliação gratuita ao criar conta.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="border-t border-zinc-800/80">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
            <Store className="h-6 w-6" />
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-zinc-50">
            Pronto para modernizar a sua loja?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-zinc-400">
            Crie a sua conta em menos de um minuto e comece a vender hoje mesmo.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href={sessao ? "/dashboard" : "/registar"}>
              <Button size="lg">
                {sessao ? "Abrir o painel" : "Criar conta gratuita"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg">
                Entrar
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600">
              <Store className="h-4 w-4 text-white" />
            </div>
            <p className="text-sm font-semibold text-zinc-300">ShopLink</p>
          </div>
          <p className="text-xs text-zinc-500">
            © {new Date().getFullYear()} TECNOINCUBADORA · Sistema de gestão para
            mercearias e mini supermercados
          </p>
        </div>
      </footer>
    </div>
  );
}