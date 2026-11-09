import { createBrowserClient } from "@supabase/ssr";

type BrowserAuthOptions = {
  detectSessionInUrl?: boolean;
  /**
   * O lock padrão do Auth (`navigator.locks`) não libera a primeira chamada
   * quando o React remonta o efeito no modo estrito. A recuperação fica em
   * "Validando link…" e o botão não volta.
   */
  lock?: <R>(name: string, acquireTimeout: number, fn: () => Promise<R>) => Promise<R>;
};

export function createSupabaseBrowserClient(options?: BrowserAuthOptions) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing Supabase browser environment variables.");
  }

  const auth: Pick<BrowserAuthOptions, "detectSessionInUrl" | "lock"> = {};
  if (options?.detectSessionInUrl !== undefined) auth.detectSessionInUrl = options.detectSessionInUrl;
  if (options?.lock) auth.lock = options.lock;

  return createBrowserClient(url, anonKey, Object.keys(auth).length > 0 ? { auth } : undefined);
}
