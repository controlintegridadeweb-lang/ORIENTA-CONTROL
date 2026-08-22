import { RespondentReportsShell } from "@/features/reports/components/respondent/respondent-reports-shell";
import { layout } from "@/shared/layout/design-system";

export default function RespondenteRelatoriosPage() {
  return (
    <div className={layout.pageStack}>
      <RespondentReportsShell />
    </div>
  );
}
