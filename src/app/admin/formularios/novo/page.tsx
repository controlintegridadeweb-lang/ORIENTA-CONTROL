import { Suspense } from "react";
import { FormWizard } from "@/features/forms/components/form/form-wizard/form-wizard";
import { Spinner } from "@/shared/ui/components/loading";

export default function AdminNewFormPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Spinner size="xl" className="text-brand" />
        </div>
      }
    >
      <FormWizard />
    </Suspense>
  );
}
