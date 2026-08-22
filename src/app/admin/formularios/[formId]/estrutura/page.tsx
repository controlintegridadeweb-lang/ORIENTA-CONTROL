import { notFound } from "next/navigation";
import { PublishedFormStructureView } from "@/features/forms/components/form/published-form-structure";
import { loadCurrentPublishedFormStructure } from "@/features/forms/published-structure";
import { parseUuidParam } from "@/shared/validation/uuid";

type Props = { params: Promise<{ formId: string }> };

export default async function AdminFormularioEstruturaPage({ params }: Props) {
  const { formId: rawId } = await params;
  const formId = parseUuidParam(rawId);
  if (!formId) notFound();

  const structure = await loadCurrentPublishedFormStructure(formId);
  if (!structure) notFound();
  return <PublishedFormStructureView structure={structure} />;
}
