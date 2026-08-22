import { formatPlatformDate } from "@/shared/datetime/platform-date-time";
import { Activity, FilePlus2, FileX2, FileEdit, ShieldCheck, History } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { RecentActivity } from "@/features/dashboard/queries";

function formatRelative(timestamp: string): string {
  const date = new Date(timestamp);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `${minutes} min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h atrás`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d atrás`;
  return formatPlatformDate(date, { dateStyle: "short" });
}

const TABLE_LABELS: Record<string, string> = {
  cycles: "diagnóstico",
  responses: "resposta",
  evidences: "evidência",
  evidence_validations: "validação de evidência",
  validation_analysis_drafts: "rascunho de análise",
  recommendations: "recomendação",
  action_plans: "plano de ação",
  forms: "formulário",
  organizations: "organização",
  users: "usuário",
  profiles: "Perfis de usuários",
  automation_jobs: "operações automáticas",
};

/** Eventos de domínio gravados em audit_logs (fora de INSERT/UPDATE/DELETE). */
const EVENT_LABELS: Record<string, string> = {
  "automation.open_cycle": "Abertura de diagnóstico",
  "automation.finalize_validation": "Conclusão de validação",
  "automation.close_cycle": "Encerramento de avaliação",
  "cycle.schedules_registered": "Agendamentos registrados",
  "organization.created": "Organização criada",
  "user.respondent_created": "Respondente criado",
  "user.respondent_updated": "Respondente atualizado",
};

const MASCULINE_TABLES = new Set([
  "cycles",
  "forms",
  "action_plans",
  "users",
  "validation_analysis_drafts",
]);

function capitalizeLabel(label: string): string {
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

function tableLabel(tableName: string | null): string {
  if (!tableName) return "registro";
  // Evita vazar nomes técnicos em inglês quando a tabela ainda não tem rótulo.
  return TABLE_LABELS[tableName] ?? "registro";
}

function eventVisuals(eventType: string, tableName: string | null): {
  icon: LucideIcon;
  title: string;
} {
  const knownEvent = EVENT_LABELS[eventType];
  if (knownEvent) {
    return { icon: Activity, title: knownEvent };
  }

  const label = tableLabel(tableName);
  const masculine = tableName ? MASCULINE_TABLES.has(tableName) : false;
  if (eventType === "INSERT") {
    if (tableName === "evidence_validations") {
      return { icon: ShieldCheck, title: `${masculine ? "Novo" : "Nova"} ${label}` };
    }
    return { icon: FilePlus2, title: `${masculine ? "Novo" : "Nova"} ${label}` };
  }
  if (eventType === "UPDATE") {
    return {
      icon: FileEdit,
      title: `${capitalizeLabel(label)} ${masculine ? "atualizado" : "atualizada"}`,
    };
  }
  if (eventType === "DELETE") {
    return {
      icon: FileX2,
      title: `${capitalizeLabel(label)} ${masculine ? "removido" : "removida"}`,
    };
  }
  const eventLabel =
    EVENT_LABELS[eventType] ??
    `Evento em ${TABLE_LABELS[tableName ?? ""] ?? "entidade do sistema"}`;
  return { icon: Activity, title: eventLabel };
}

type GroupedActivity = {
  key: string;
  count: number;
  first: RecentActivity;
  last: RecentActivity;
};

function groupConsecutive(activities: RecentActivity[]): GroupedActivity[] {
  const groups: GroupedActivity[] = [];
  for (const a of activities) {
    const key = `${a.eventType}|${a.tableName ?? ""}|${a.actorEmail ?? ""}`;
    const tail = groups[groups.length - 1];
    if (tail && tail.key === key) {
      tail.count += 1;
      tail.last = a;
    } else {
      groups.push({ key, count: 1, first: a, last: a });
    }
  }
  return groups;
}

export function ActivityFeed({ activities }: { activities: RecentActivity[] }) {
  if (activities.length === 0) {
    return (
      <div className="flex items-start gap-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <History className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="text-base font-semibold text-slate-800">Sem atividades recentes</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            Os eventos do sistema aparecerão aqui em tempo real.
          </p>
        </div>
      </div>
    );
  }

  const groups = groupConsecutive(activities);

  return (
    <ol className="relative space-y-4 before:absolute before:left-4.25 before:top-1 before:bottom-1 before:w-px before:bg-slate-200">
      {groups.map((group) => {
        const { icon: Icon, title } = eventVisuals(group.first.eventType, group.first.tableName);
        const actor = group.first.actorEmail ?? "Sistema";
        const when = formatRelative(group.first.createdAt);
        return (
          <li key={group.first.id} className="relative flex items-start gap-4 pl-0">
            <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 ring-6 ring-white">
              <Icon className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                <span>{title}</span>
                {group.count > 1 ? (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-micro font-semibold uppercase tracking-wide text-slate-600">
                    {group.count}x
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                <span className="truncate">{actor}</span>
                <span className="px-2 text-slate-300">|</span>
                <span>{when}</span>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
