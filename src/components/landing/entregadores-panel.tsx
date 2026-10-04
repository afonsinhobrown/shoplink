"use client";

import { useEffect, useRef, useState } from "react";
import {
  Truck,
  Star,
  MapPin,
  Navigation,
  MapPin as MapPinIcon,
  CheckCircle2,
  Map,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";

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
  cityId: string;
}

const CITY_COORDS: Record<string, { lat: number; lng: number; name: string }> = {
  "cmmgsavkw00009cdk2efeaiw5": { lat: -25.9653, lng: 32.5892, name: "Maputo" },
  "cmmgsavw100019cdkz9e03d07": { lat: -25.9622, lng: 32.4589, name: "Matola" },
  "cmmgsaw1a00029cdk0wmqrih3": { lat: -25.0519, lng: 33.6436, name: "Xai-Xai" },
  "cmmgsaw6e00039cdkpwl0k84l": { lat: -23.865, lng: 35.3833, name: "Inhambane" },
  "cmmgsawbh00049cdkl3t1088y": { lat: -19.8436, lng: 34.8389, name: "Beira" },
  "cmmgsawgj00059cdks7m8adlw": { lat: -19.1164, lng: 33.4833, name: "Chimoio" },
  "cmmgsawlu00069cdk7ydu9hzi": { lat: -16.1564, lng: 33.5867, name: "Tete" },
  "cmmgsawr100079cdkscmxb9py": { lat: -17.8786, lng: 36.8883, name: "Quelimane" },
  "cmmgsaww300089cdkgdafgk13": { lat: -15.1166, lng: 39.2666, name: "Nampula" },
  "cmmgsax1500099cdkxl3ukaxy": { lat: -12.9776, lng: 40.5167, name: "Pemba" },
  "cmmgsax6a000a9cdkcb1x3oxo": { lat: -13.3128, lng: 35.2422, name: "Lichinga" },
  "cmmgsaxc5000b9cdko3vozib2": { lat: -26.0447, lng: 32.3333, name: "Boane" },
  "cmmgsaxhn000c9cdk8ep59bb9": { lat: -26.0167, lng: 32.0333, name: "Namaacha" },
  "cmmgsaxmz000d9cdk9ii117uc": { lat: -25.6, lng: 32.25, name: "Moamba" },
  "cmmgsaxs0000e9cdk4ghgqfxh": { lat: -25.0333, lng: 32.65, name: "Magude" },
  "cmmgsaxx6000f9cdkv65stjgx": { lat: -25.4117, lng: 32.8067, name: "Manhiça" },
  "cmmgsay28000g9cdko52gtwye": { lat: -25.7167, lng: 32.6833, name: "Marracuene" },
  "cmmgsayfm000h9cdkxzroibzo": { lat: -26.2, lng: 32.85, name: "Matutuíne" },
  "cmmgsaykr000i9cdkax4d6neb": { lat: -26.1, lng: 32.9, name: "Bela Vista" },
};

const VEHICLE_LABEL: Record<string, string> = {
  MOTORCYCLE: "Mota",
  BICYCLE: "Bicicleta",
  CAR: "Carro",
  FOOT: "A pé",
};

const VEHICLE_ICON: Record<string, string> = {
  MOTORCYCLE: "🏍️",
  BICYCLE: "🚲",
  CAR: "🚗",
  FOOT: "🚶",
};

const DEFAULT_CENTER = { lat: -25.9653, lng: 32.5892, zoom: 6 }; // Maputo

function createVehicleMarker(L: typeof Leaflet, vehicleType: string) {
  const emoji = VEHICLE_ICON[vehicleType] || "🚚";
  return L.divIcon({
    className: "vehicle-marker",
    html: `<div style="font-size:28px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));">${emoji}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
}

function createSelectedMarker(L: typeof Leaflet) {
  return L.divIcon({
    className: "selected-marker",
    html: `<div style="font-size:36px;filter:drop-shadow(0 2px 6px rgba(16,185,129,0.6));">📍</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
  });
}

export function EntregadoresPanel() {
  const [entregadores, setEntregadores] = useState<Entregador[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [entregadorSelecionado, setEntregadorSelecionado] = useState<Entregador | null>(null);
  const [cidadeSelecionada, setCidadeSelecionada] = useState<string>("");
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef(new (globalThis.Map as new () => Map<string, L.Marker>)());

  // Fetch entregadores
  useEffect(() => {
    async function fetchEntregadores() {
      setCarregando(true);
      try {
        const params = cidadeSelecionada ? `?cidade=${encodeURIComponent(cidadeSelecionada)}` : "";
        const res = await fetch(`/api/entregadores${params}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setEntregadores(data.entregadores || []);
        }
      } catch {
        // silencioso
      } finally {
        setCarregando(false);
      }
    }
    fetchEntregadores();
  }, [cidadeSelecionada]);

  // Initialize / update map
  useEffect(() => {
    let cancelado = false;

    async function setupMapa() {
      if (!mapRef.current) return;
      const L = (await import("leaflet")).default;
      if (cancelado || !mapRef.current) return;

      const center = entregadorSelecionado
        ? { lat: entregadorSelecionado.currentLatitude, lng: entregadorSelecionado.currentLongitude, zoom: 14 }
        : cidadeSelecionada && CITY_COORDS[cidadeSelecionada]
          ? { ...CITY_COORDS[cidadeSelecionada], zoom: 12 }
          : DEFAULT_CENTER;

      if (!mapInstance.current) {
        mapInstance.current = L.map(mapRef.current, {
          center: [center.lat, center.lng],
          zoom: center.zoom,
          zoomControl: true,
          attributionControl: true,
        });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(mapInstance.current);
      } else {
        mapInstance.current.setView([center.lat, center.lng], center.zoom);
      }

      // Clear old markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();

      // Add markers for each entregador
      entregadores.forEach((e) => {
        const marker = L.marker([e.currentLatitude, e.currentLongitude], {
          icon: createVehicleMarker(L, e.vehicleType),
        })
          .bindPopup(
            `<div style="min-width:180px;">
              <strong>${e.name}</strong><br/>
              ${VEHICLE_LABEL[e.vehicleType] || e.vehicleType} — ${e.vehicleColor} (${e.plateNumber})<br/>
              ⭐ ${e.rating.toFixed(1)}<br/>
              <button onclick="window.dispatchEvent(new CustomEvent('select-entregador',{detail:'${e.id}'}))"
                style="margin-top:8px;padding:4px 10px;background:#10b981;color:white;border:none;border-radius:4px;cursor:pointer;">
                Selecionar
              </button>
            </div>`
          )
          .addTo(mapInstance.current!);
        markersRef.current.set(e.id, marker);
      });

      // Highlight selected
      if (entregadorSelecionado) {
        const m = markersRef.current.get(entregadorSelecionado.id);
        if (m) {
          m.setIcon(createSelectedMarker(L));
          m.openPopup();
        }
      }
    }

    setupMapa();

    // Listen for popup button clicks
    const handler = (ev: CustomEvent<string>) => {
      const id = ev.detail;
      const e = entregadores.find((x) => x.id === id);
      if (e) setEntregadorSelecionado(e);
    };
    window.addEventListener("select-entregador", handler as EventListener);
    return () => {
      cancelado = true;
      window.removeEventListener("select-entregador", handler as EventListener);
    };
  }, [entregadores, entregadorSelecionado, cidadeSelecionada]);

  const handleSelecionarEntregador = (e: Entregador) => {
    setEntregadorSelecionado(e);
    const url = `/entregas/nova?entregador=${e.id}&lat=${e.currentLatitude}&lng=${e.currentLongitude}`;
    window.open(url, "_blank");
  };

  return (
    <section id="entregadores" className="border-y border-zinc-800/80 bg-zinc-900/30">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            Entregadores Parceiros
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-zinc-50">
            Rede de entregadores disponíveis
          </h2>
          <p className="mt-3 text-zinc-400">
            Escolha um entregador na lista ou no mapa. Clique para abrir o sistema de entregas
            com o entregador pré-selecionado.
          </p>

          {/* Filtro de cidade */}
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              onClick={() => setCidadeSelecionada("")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                !cidadeSelecionada
                  ? "bg-emerald-500 text-white"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              Todas
            </button>
            {[
              { id: "cmmgsavkw00009cdk2efeaiw5", name: "Maputo" },
              { id: "cmmgsavw100019cdkz9e03d07", name: "Matola" },
              { id: "cmmgsawgj00059cdks7m8adlw", name: "Chimoio" },
              { id: "cmmgsawbh00049cdkl3t1088y", name: "Beira" },
              { id: "cmmgsaww300089cdkgdafgk13", name: "Nampula" },
              { id: "cmmgsax1500099cdkxl3ukaxy", name: "Pemba" },
            ].map((c) => (
              <button
                key={c.id}
                onClick={() => setCidadeSelecionada(c.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  cidadeSelecionada === c.id
                    ? "bg-emerald-500 text-white"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          {/* Lista de entregadores */}
          <Card className="border-zinc-800 bg-zinc-900/60">
            <div className="p-4 border-b border-zinc-800">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
                <Truck className="h-5 w-5 text-emerald-500" />
                Entregadores disponíveis ({entregadores.length})
              </h3>
            </div>
            <div className="p-0">
              {carregando ? (
                <div className="p-8 text-center text-zinc-500">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                  <p className="mt-2">A carregar entregadores...</p>
                </div>
              ) : entregadores.length === 0 ? (
                <div className="p-8 text-center text-zinc-500">
                  <Truck className="mx-auto h-12 w-12 text-zinc-600 mb-2" />
                  <p>Nenhum entregador disponível</p>
                  <p className="text-sm mt-1">Tente outra cidade ou mais tarde.</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-800 max-h-[500px] overflow-y-auto">
                  {entregadores.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => handleSelecionarEntregador(e)}
                      className={`w-full text-left p-4 hover:bg-zinc-800/50 transition flex items-start gap-4 ${
                        entregadorSelecionado?.id === e.id ? "bg-emerald-500/10" : ""
                      }`}
                    >
                      <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-emerald-500/20 flex items-center justify-center text-2xl">
                        {VEHICLE_ICON[e.vehicleType] || "🚚"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium truncate">{e.name}</p>
                          <span className="flex items-center gap-1 text-sm text-amber-400">
                            <Star className="h-3.5 w-3.5 fill-current" /> {e.rating.toFixed(1)}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-500 mt-1 flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {VEHICLE_LABEL[e.vehicleType] || e.vehicleType} — {e.vehicleColor} ({e.plateNumber})
                        </p>
                        <p className="text-xs text-zinc-600 mt-1 flex items-center gap-1">
                          <MapPinIcon className="h-3 w-3" />
                          Lat: {e.currentLatitude?.toFixed(4) || "—"}, Lng: {e.currentLongitude?.toFixed(4) || "—"}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                          <CheckCircle2 className="h-3 w-3" /> Disponível
                        </span>
                        <Button size="sm" variant="outline" onClick={(ev) => { ev.stopPropagation(); handleSelecionarEntregador(e); }}>
                          Selecionar
                        </Button>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Mapa Leaflet + OpenStreetMap */}
          <Card className="border-zinc-800 bg-zinc-900/60 overflow-hidden">
            <div className="p-4 border-b border-zinc-800">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
                <Map className="h-5 w-5 text-emerald-500" />
                Mapa de entregadores (OpenStreetMap)
              </h3>
            </div>
            <div className="relative h-[500px]">
              <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
              {entregadorSelecionado && (
                <div className="absolute bottom-4 left-4 right-4 bg-zinc-950/95 backdrop-blur rounded-xl border border-zinc-800 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-xl">
                        {VEHICLE_ICON[entregadorSelecionado.vehicleType] || "🚚"}
                      </div>
                      <div>
                        <p className="font-medium">{entregadorSelecionado.name}</p>
                        <p className="text-sm text-zinc-500">
                          {VEHICLE_LABEL[entregadorSelecionado.vehicleType]} — {entregadorSelecionado.plateNumber}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => handleSelecionarEntregador(entregadorSelecionado)}>
                      <Navigation className="h-3.5 w-3.5 mr-1.5" />
                      Abrir no sistema
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}