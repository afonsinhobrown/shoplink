"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { ImagemProdutoDTO } from "@/lib/types";

export function ImagensProduto({ produtoId }: { produtoId: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imagens, setImagens] = useState<ImagemProdutoDTO[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!produtoId) return;
    apiFetch<ImagemProdutoDTO[]>(`/api/produtos/${produtoId}/imagens`)
      .then(setImagens)
      .catch(() => setImagens([]));
  }, [produtoId]);

  async function enviar(ficheiros: FileList | null) {
    if (!produtoId || !ficheiros?.length) return;
    setEnviando(true);
    setErro("");
    try {
      for (const ficheiro of Array.from(ficheiros)) {
        const fd = new FormData();
        fd.append("ficheiro", ficheiro);
        const res = await fetch(`/api/produtos/${produtoId}/imagens`, {
          method: "POST",
          body: fd,
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? `Erro ${res.status}`);
        setImagens((lista) => [...lista, data as ImagemProdutoDTO]);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao enviar a imagem");
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function tornarPrincipal(imagem: ImagemProdutoDTO) {
    if (!produtoId) return;
    setErro("");
    try {
      const dados = await apiFetch<ImagemProdutoDTO[]>(
        `/api/produtos/${produtoId}/imagens?imagemId=${imagem.id}`,
        { method: "PATCH" }
      );
      setImagens(dados);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao definir a imagem principal");
    }
  }

  async function apagar(imagem: ImagemProdutoDTO) {
    if (!produtoId) return;
    if (!confirm("Remover esta imagem?")) return;
    setErro("");
    try {
      await apiFetch(`/api/produtos/${produtoId}/imagens?imagemId=${imagem.id}`, {
        method: "DELETE",
      });
      const dados = await apiFetch<ImagemProdutoDTO[]>(`/api/produtos/${produtoId}/imagens`);
      setImagens(dados);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao remover a imagem");
    }
  }

  if (!produtoId) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-800 px-3 py-2 text-xs text-zinc-500">
        Guarde o produto para poder anexar imagens.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          multiple
          className="hidden"
          onChange={(e) => enviar(e.target.files)}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={enviando}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800/60 disabled:opacity-50"
        >
          {enviando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImagePlus className="h-4 w-4" />
          )}
          {enviando ? "A enviar…" : "Adicionar imagem"}
        </button>
        <span className="text-xs text-zinc-500">JPG, PNG ou WEBP até 5 MB</span>
      </div>

      {erro && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
          {erro}
        </p>
      )}

      {imagens.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {imagens.map((img) => (
            <div
              key={img.id}
              className="group relative aspect-square overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url_thumbnail || img.url} alt="" className="h-full w-full object-cover" />
              {img.principal && (
                <span className="absolute left-1 top-1 rounded-md bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-medium text-zinc-900">
                  Principal
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-zinc-950/80 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                {!img.principal && (
                  <button
                    type="button"
                    title="Definir como principal"
                    onClick={() => tornarPrincipal(img)}
                    className="rounded-md p-1.5 text-amber-400 hover:bg-zinc-800"
                  >
                    <Star className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  title="Remover imagem"
                  onClick={() => apagar(img)}
                  className="rounded-md p-1.5 text-rose-400 hover:bg-zinc-800"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}