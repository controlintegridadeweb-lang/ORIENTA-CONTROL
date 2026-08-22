import { redirect } from "next/navigation";
import { parseUuidParam } from "@/shared/validation/uuid";
import { adminReturnPathOrFallback } from "@/shared/navigation/admin-navigation-context";

type Props = { params: Promise<{ sectionId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
export default async function Page({ params, searchParams }: Props) {
  const [{ sectionId: rawSectionId }, sp] = await Promise.all([params, searchParams]);
  const sectionId = parseUuidParam(rawSectionId);
  const rawCycle = Array.isArray(sp.cycleId) ? sp.cycleId[0] : sp.cycleId;
  const cycleId = parseUuidParam(rawCycle);
  if (!sectionId || !cycleId) redirect("/admin/plano-acao");
  const query = new URLSearchParams({ cycleId });
  const rawReturnTo = Array.isArray(sp.returnTo) ? sp.returnTo[0] : sp.returnTo;
  const returnTo = adminReturnPathOrFallback(rawReturnTo, "");
  if (returnTo) query.set("returnTo", returnTo);
  redirect(`/admin/plano-acao/secao/${sectionId}/visao-geral?${query.toString()}`);
}
