"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function PublicidadeCarousel({ imagens }: { imagens: string[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [indice, setIndice] = useState(0);
  const [noInicio, setNoInicio] = useState(true);
  const [noFim, setNoFim] = useState(false);

  const total = imagens.length;

  const sincronizar = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const item = el.firstElementChild as HTMLElement | null;
    const passo = item ? item.offsetWidth + 16 : el.clientWidth;
    const i = Math.round(el.scrollLeft / passo);
    setIndice(Math.min(Math.max(i, 0), total - 1));
    setNoInicio(el.scrollLeft <= 8);
    setNoFim(el.scrollLeft >= el.scrollWidth - el.clientWidth - 8);
  }, [total]);

  useEffect(() => {
    sincronizar();
  }, [sincronizar, total]);

  const irPara = useCallback(
    (i: number) => {
      const el = trackRef.current;
      if (!el) return;
      const item = el.firstElementChild as HTMLElement | null;
      const passo = item ? item.offsetWidth + 16 : el.clientWidth;
      const destino = Math.min(Math.max(i, 0), total - 1) * passo;
      el.scrollTo({ left: destino, behavior: "smooth" });
    },
    [total]
  );

  const anterior = useCallback(() => irPara(indice - 1), [indice, irPara]);
  const seguinte = useCallback(() => irPara(indice + 1), [indice, irPara]);

  if (total === 0) return null;

  return (
    <div className="relative">
      {/* Setas desktop */}
      <button
        onClick={anterior}
        disabled={noInicio}
        aria-label="Publicidade anterior"
        className="absolute left-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/85 text-zinc-200 backdrop-blur transition hover:bg-zinc-800 disabled:pointer-events-none disabled:opacity-0 sm:flex"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={seguinte}
        disabled={noFim}
        aria-label="Publicidade seguinte"
        className="absolute right-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/85 text-zinc-200 backdrop-blur transition hover:bg-zinc-800 disabled:pointer-events-none disabled:opacity-0 sm:flex"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* Trilho: altura fixa + object-contain = nunca quebra o layout */}
      <div
        ref={trackRef}
        onScroll={sincronizar}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {imagens.map((src) => (
          <figure
            key={src}
            className="relative aspect-[3/4] w-[78%] shrink-0 snap-center overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 sm:w-[48%] lg:w-[30%]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt="Publicidade ShopLink"
              loading="lazy"
              decoding="async"
              className="h-full w-full object-contain"
            />
          </figure>
        ))}
      </div>

      {/* Indicadores */}
      <div className="mt-4 flex items-center justify-center gap-2">
        {imagens.map((src, i) => (
          <button
            key={src}
            onClick={() => irPara(i)}
            aria-label={`Ver publicidade ${i + 1}`}
            aria-current={i === indice}
            className={`h-1.5 rounded-full transition-all ${
              i === indice ? "w-6 bg-emerald-500" : "w-1.5 bg-zinc-700 hover:bg-zinc-500"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
