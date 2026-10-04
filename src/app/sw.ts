/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// As imagens de publicidade são servidas normalmente e não entram no precache
// (no Windows a geração do manifest gerava URLs com barras invertidas, inválidas).
const precache = (self.__SW_MANIFEST ?? []).filter(
  (e) => {
    const url = typeof e === "string" ? e : e.url;
    return !url.includes("/publicidade/");
  },
);

const serwist = new Serwist({
  precacheEntries: precache,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
