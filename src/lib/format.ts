export function rotuloTipoLoja(tipo: string): string {
  if (tipo === "mini_mercado") return "Mini Supermercado";
  return "Mercearia";
}

export function formatarMoeda(valor: number, moeda = "MZN"): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: moeda,
    minimumFractionDigits: 2,
  }).format(valor);
}

export function formatarData(iso: string | Date): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatarDataHora(iso: string | Date): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relativo(iso: string | Date): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const dias = Math.floor(h / 24);
  return `${dias} d`;
}