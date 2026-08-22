import { notFound } from "next/navigation";
import { AnswersShell } from "@/features/forms/components/form/answers/answers-shell";
import { parseUuidParam } from "@/shared/validation/uuid";

type Props = {
  params: Promise<{ formId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminFormularioRespostasPage({ params, searchParams }: Props) {
  const { formId: rawId } = await params;
  const formId = parseUuidParam(rawId);
  if (!formId) notFound();

  const sp = await searchParams;
  const rawCycleId = Array.isArray(sp.cycleId) ? sp.cycleId[0] : sp.cycleId;
  const initialCycleId = rawCycleId ? parseUuidParam(rawCycleId) : null;
  return <AnswersShell formId={formId} initialCycleId={initialCycleId} />;
}
