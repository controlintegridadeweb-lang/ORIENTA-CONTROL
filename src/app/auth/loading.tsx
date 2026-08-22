import { Spinner } from "@/shared/ui/components/loading";

export default function AuthLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center bg-slate-900 text-white/80"
    >
      <div className="inline-flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium backdrop-blur">
        <Spinner size="md" />
        <span>Carregando…</span>
      </div>
    </div>
  );
}
