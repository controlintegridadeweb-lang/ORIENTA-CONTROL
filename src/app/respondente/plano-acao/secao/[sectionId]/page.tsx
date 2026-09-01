import { redirect } from "next/navigation";
import { parseUuidParam } from "@/shared/validation/uuid";
import { respondentReturnPathOrFallback } from "@/shared/navigation/respondent-navigation-context";

type Props = { params: Promise<{ sectionId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
export default async function Page({ params, searchParams }: Props) {
  const [{ sectionId: rawSectionId }, sp] = await Promise.all([params, searchParams]);
  const sectionId = parseUuidParam(rawSectionId);
  const rawCycle = Array.isArray(sp.cycleId) ? sp.cycleId[0] : sp.cycleId;
  const cycleId = parseUuidParam(rawCycle);
  if (!sectionId || !cycleId) redirect("/respondente/portfolio-recomendacoes");
  const query = new URLSearchParams({ cycleId });
  const rawReturnTo = Array.isArray(sp.returnTo) ? sp.returnTo[0] : sp.returnTo;
  const returnTo = respondentReturnPathOrFallback(rawReturnTo, "");
  if (returnTo) query.set("returnTo", returnTo);
  redirect(`/respondente/plano-acao/secao/${sectionId}/visao-geral?${query.toString()}`);
}
