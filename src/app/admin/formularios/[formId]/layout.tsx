import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { FormsAdminService, FormsNotFoundError } from "@/features/forms/admin-service";
import { FormIdLayoutBridge } from "@/features/forms/components/form/form-id-layout-bridge";
import { parseUuidParam } from "@/shared/validation/uuid";

type Props = {
  params: Promise<{ formId: string }>;
  children: ReactNode;
};

export default async function AdminFormularioLayout({ params, children }: Props) {
  const { formId: rawId } = await params;
  const formId = parseUuidParam(rawId);
  if (!formId) notFound();

  let form;
  try {
    form = await new FormsAdminService().getById(formId);
  } catch (error) {
    if (error instanceof FormsNotFoundError) notFound();
    throw error;
  }

  return (
    <FormIdLayoutBridge formId={form.id} formName={form.name} state={form.state}>
      {children}
    </FormIdLayoutBridge>
  );
}
