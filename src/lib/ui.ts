// Small global stores (theme) and helpers shared by the pages.
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast as toasts } from "@/components/ui/toast";
import type { Theme } from "../core/types.ts";

let theme: Theme = (() => {
   try {
      return localStorage.getItem("devart-theme") === "dark" ? "dark" : "light";
   } catch {
      return "light";
   }
})();
const themeSubs = new Set<() => void>();
export function applyTheme(t: Theme) {
   theme = t;
   document.documentElement.dataset.theme = t;
   document.querySelector("meta[name=theme-color]")?.setAttribute("content", t === "dark" ? "#14161b" : "#ffffff");
   try {
      localStorage.setItem("devart-theme", t);
   } catch {
      /* storage may be blocked */
   }
   themeSubs.forEach((f) => f());
}
applyTheme(theme);
export const useTheme = () =>
   useSyncExternalStore(
      (f) => {
         themeSubs.add(f);
         return () => themeSubs.delete(f);
      },
      () => theme
   );
export const toggleTheme = () => applyTheme(theme === "dark" ? "light" : "dark");

/** Shows a toast. Errors stay a little longer. */
export function toast(text: string, error = false) {
  toasts.add({ title: text, type: error ? 'error' : 'success', timeout: error ? 6000 : 3000 });
}
export const toastError = (e: unknown) => toast((e as Error).message, true);

/** Runs `load` when `key` changes (or `reload` is called). A null key loads nothing. */
export function useLoad<T>(key: string | null, load: () => Promise<T>): { data: T | undefined; error?: string; reload: () => void } {
   const [data, setData] = useState<T>();
   const [error, setError] = useState<string>();
   const [tick, setTick] = useState(0);
   useEffect(() => {
      if (!key) return;
      let live = true;
      load()
         .then((d) => {
            if (live) {
               setData(d);
               setError(undefined);
            }
         })
         .catch((e) => {
            if (live) setError((e as Error).message);
         });
      return () => {
         live = false;
      };
   }, [key, tick]);
   return { data, error, reload: () => setTick((t) => t + 1) };
}

/** Saves a Blob as a file download. */
export function download(blob: Blob, name: string) {
   const url = URL.createObjectURL(blob);
   const a = document.createElement("a");
   a.href = url;
   a.download = name;
   document.body.append(a);
   a.click();
   a.remove();
   setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const timeAgo = (t: number) => {
   const s = Math.round((Date.now() - t) / 1000);
   if (s < 60) return "just now";
   if (s < 3600) return `${Math.floor(s / 60)}m ago`;
   if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
   if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
   return new Date(t).toLocaleDateString();
};
