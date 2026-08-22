"use client";

import { usePathname } from "next/navigation";
import { Skeleton, TableSkeleton } from "@/shared/ui/components/loading";

function HeaderSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-2" aria-hidden>
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      <Skeleton className="h-3 w-72 max-w-full" />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <Skeleton className="h-44 w-full rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-32 rounded-xl" />)}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <Skeleton className="h-12 w-full rounded-xl" />
      {[1, 2, 3].map((item) => (
        <div key={item} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-4/5" />
          <div className="grid gap-2 sm:grid-cols-3">
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((item) => <Skeleton key={item} className="h-28 rounded-xl" />)}
      </div>
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}

function CardsSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-40 w-full rounded-xl" />)}
    </div>
  );
}

export function RouteAwarePageLoader({ role }: { role: "admin" | "respondent" }) {
  const pathname = usePathname() ?? "";
  const isDashboard = pathname === "/admin" || pathname === "/respondente";
  const isForm = pathname.includes("/ciclos/") && role === "respondent";
  const isChart = pathname.includes("maturidade") || pathname.includes("pontuacao-fami");
  const isCards = pathname.includes("recomendacoes") || pathname.includes("plano-acao");

  return (
    <div role="status" aria-live="polite" aria-label="Carregando conteúdo" className="space-y-5">
      <HeaderSkeleton label={role === "admin" ? "Carregando área administrativa" : "Carregando sua área"} />
      {isDashboard ? (
        <DashboardSkeleton />
      ) : isForm ? (
        <FormSkeleton />
      ) : isChart ? (
        <ChartSkeleton />
      ) : isCards ? (
        <CardsSkeleton />
      ) : (
        <TableSkeleton rows={6} cols={4} />
      )}
    </div>
  );
}
