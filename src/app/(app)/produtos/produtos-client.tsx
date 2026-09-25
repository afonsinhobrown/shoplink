"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Package,
  Loader2,
  Barcode,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatarMoeda } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input, Select, Field, Switch, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Loading, EmptyState } from "@/components/ui/feedback";
import type { ProdutoDTO, CategoriaDTO, FornecedorDTO } from "@/lib/types";

const VAZIO: Omit<ProdutoDTO, "id" | "stock_atual"> = {
  nome: "",
  codigo_barras: "",
  sku_interno: "",
  categoria_id: null,
  fornecedor_id: null,
  tipo_venda: "unidade",
  unidade_medida: "un",
  preco_custo: 0,
  preco_venda: 0,
  controla_stock: true,
  stock_minimo: 0,
  ativo: true,
  disponivel_online: false,
  descricao_publica: null,
  isento_imposto: false,
};

export function ProdutosClient({
  moeda,
  papel,
  permiteEditar,
}: {
  moeda: string;
  papel: string;
  permiteEditar: boolean;
}) {
  const [produtos, setProdutos] = useState<ProdutoDTO[]>([]);
  const [categorias, setCategorias] = useState<CategoriaDTO[]>([]);
  const [fornecedores, setFornecedores] = useState<FornecedorDTO[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [q, setQ] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [modal, setModal] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  function carregar() {
    Promise.all([
      apiFetch<ProdutoDTO[]>("/api/produtos?ativos=true"),
      apiFetch<CategoriaDTO[]>("/api/categorias"),
      apiFetch<FornecedorDTO[]>("/api/fornecedores"),
    ])
      .then(([p, c, f]) => {
        setProdutos(p);
        setCategorias(c);
        setFornecedores(f);
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    carregar();
  }, []);

  const filtrados = useMemo(() => {
    const termo = q.trim().toLowerCase();
    return produtos.filter((p) => {
      const okTermo =
        !termo ||
        p.nome.toLowerCase().includes(termo) ||
        (p.codigo_barras ?? "").toLowerCase().includes(termo) ||
        (p.sku_interno ?? "").toLowerCase().includes(termo);
      const okCategoria = !categoriaFiltro || p.categoria_id === categoriaFiltro;
      return okTermo && okCategoria;
    });
  }, [produtos, q, categoriaFiltro]);

  function abrirNovo() {
    setEditandoId(null);
    setForm(VAZIO);
    setErro("");
    setModal(true);
  }

  function abrirEdicao(p: ProdutoDTO) {
    setEditandoId(p.id);
    setForm({
      nome: p.nome,
      codigo_barras: p.codigo_barras ?? "",
      sku_interno: p.sku_interno ?? "",
      categoria_id: p.categoria_id,
      fornecedor_id: p.fornecedor_id,
      tipo_venda: p.tipo_venda,
      unidade_medida: p.unidade_medida,
      preco_custo: p.preco_custo,
      preco_venda: p.preco_venda,
      controla_stock: p.controla_stock,
      stock_minimo: p.stock_minimo,
      ativo: p.ativo,
      disponivel_online: p.disponivel_online,
      descricao_publica: p.descricao_publica ?? null,
      isento_imposto: p.isento_imposto ?? false,
    });
    setErro("");
    setModal(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      if (editandoId) {
        await apiFetch(`/api/produtos/${editandoId}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
      } else {
        await apiFetch("/api/produtos", {
          method: "POST",
          body: JSON.stringify(form),
        });
      }
      setModal(false);
      carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao guardar");
    } finally {
      setSalvando(false);
    }
  }

  async function apagar(p: ProdutoDTO) {
    if (!confirm(`Desativar "${p.nome}"?`)) return;
    await apiFetch(`/api/produtos/${p.id}`, { method: "DELETE" });
    carregar();
  }

  function set<K extends keyof typeof VAZIO>(k: K, v: (typeof VAZIO)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  if (carregando && produtos.length === 0)
    return <Loading className="min-h-[50vh]" label="A carregar produtos…" />;

  return (
    <div className="animate-fade-in mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Produtos</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {produtos.length} produtos no catálogo
          </p>
        </div>
        {permiteEditar && (
          <Button onClick={abrirNovo}>
            <Plus className="h-4 w-4" /> Novo produto
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            className="pl-10"
            placeholder="Procurar produto…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)}>
          <option value="">Todas as categorias</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Select>
      </div>

      {filtrados.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Sem produtos"
          description="Adicione o primeiro produto ao catálogo"
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-800">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 border-b border-zinc-800 bg-zinc-950/60 px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500 sm:grid-cols-[1.5fr_1fr_1fr_120px_auto]">
            <span>Produto</span>
            <span className="hidden sm:block">Categoria</span>
            <span className="hidden text-right sm:block">Preço</span>
            <span className="text-right">Stock</span>
            <span />
          </div>
          <div className="divide-y divide-zinc-800/70">
            {filtrados.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 px-4 py-3 transition-colors hover:bg-zinc-900/50 sm:grid-cols-[1.5fr_1fr_1fr_120px_auto]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-100">{p.nome}</p>
                  {p.codigo_barras && (
                    <p className="flex items-center gap-1 text-[11px] text-zinc-500">
                      <Barcode className="h-3 w-3" /> {p.codigo_barras}
                    </p>
                  )}
                  {p.disponivel_online && (
                    <Badge color="green" className="mt-1">
                      Online
                    </Badge>
                  )}
                </div>
                <span className="hidden truncate text-sm text-zinc-400 sm:block">
                  {p.categoria ?? "—"}
                </span>
                <span className="hidden text-right text-sm font-semibold text-zinc-200 sm:block">
                  {formatarMoeda(p.preco_venda, moeda)}
                </span>
                <span className="text-right">
                  {p.controla_stock ? (
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-sm font-semibold text-zinc-200">
                        {p.stock_atual} {p.unidade_medida}
                      </span>
                      {p.stock_minimo > 0 && p.stock_atual <= p.stock_minimo && (
                        <Badge color="red">Repor</Badge>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-500">—</span>
                  )}
                </span>
                {permiteEditar && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => abrirEdicao(p)}
                      className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {["dono", "gestor"].includes(papel) && (
                      <button
                        onClick={() => apagar(p)}
                        className="rounded-lg p-2 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editandoId ? "Editar produto" : "Novo produto"}
        size="lg"
      >
        <form onSubmit={salvar} className="space-y-4">
          <Field label="Nome *">
            <Input
              required
              value={form.nome}
              onChange={(e) => set("nome", e.target.value)}
              placeholder="Ex.: Açúcar 1kg"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Código de barras">
              <Input
                value={form.codigo_barras ?? ""}
                onChange={(e) => set("codigo_barras", e.target.value)}
                placeholder="Não obrigatório"
              />
            </Field>
            <Field label="Referência interna (SKU)">
              <Input
                value={form.sku_interno ?? ""}
                onChange={(e) => set("sku_interno", e.target.value)}
              />
            </Field>
            <Field label="Categoria">
              <Select
                value={form.categoria_id ?? ""}
                onChange={(e) => set("categoria_id", e.target.value || null)}
              >
                <option value="">Sem categoria</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Fornecedor">
              <Select
                value={form.fornecedor_id ?? ""}
                onChange={(e) => set("fornecedor_id", e.target.value || null)}
              >
                <option value="">Sem fornecedor</option>
                {fornecedores.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tipo de venda">
              <Select
                value={form.tipo_venda}
                onChange={(e) => set("tipo_venda", e.target.value as typeof VAZIO["tipo_venda"])}
              >
                <option value="unidade">Unidade</option>
                <option value="peso">Peso (kg)</option>
                <option value="volume">Volume (litro)</option>
              </Select>
            </Field>
            <Field label="Unidade de medida">
              <Input
                value={form.unidade_medida}
                onChange={(e) => set("unidade_medida", e.target.value)}
                placeholder="un, kg, l"
              />
            </Field>
            <Field label="Preço de custo">
              <Input
                type="number"
                step="0.01"
                min={0}
                value={form.preco_custo || ""}
                onChange={(e) => set("preco_custo", Number(e.target.value))}
              />
            </Field>
            <Field label="Preço de venda *">
              <Input
                type="number"
                step="0.01"
                min={0}
                required
                value={form.preco_venda || ""}
                onChange={(e) => set("preco_venda", Number(e.target.value))}
              />
            </Field>
          </div>

          <Field label="Descrição pública (loja online)">
            <Textarea
              value={form.descricao_publica ?? ""}
              onChange={(e) => set("descricao_publica", e.target.value || null)}
              placeholder="Breve descrição mostrada aos clientes"
            />
          </Field>

          <div className="grid gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 sm:grid-cols-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-200">Controla stock</p>
                <p className="text-xs text-zinc-500">Debitar quantidade ao vender</p>
              </div>
              <Switch
                checked={form.controla_stock}
                onChange={(v) => set("controla_stock", v)}
              />
            </div>
            <Field label="Stock mínimo (alerta)">
              <Input
                type="number"
                min={0}
                value={form.stock_minimo || ""}
                onChange={(e) => set("stock_minimo", Number(e.target.value))}
              />
            </Field>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-200">Disponível na loja online</p>
                <p className="text-xs text-zinc-500">Aparece no catálogo público</p>
              </div>
              <Switch
                checked={form.disponivel_online}
                onChange={(v) => set("disponivel_online", v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-200">Isento de Imposto</p>
                <p className="text-xs text-zinc-500">Não aplicar IVA na venda deste produto</p>
              </div>
              <Switch
                checked={form.isento_imposto ?? false}
                onChange={(v) => set("isento_imposto", v)}
              />
            </div>
          </div>

          {erro && (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
              {erro}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
              {editandoId ? "Guardar alterações" : "Criar produto"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}