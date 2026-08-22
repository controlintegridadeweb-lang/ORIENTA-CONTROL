import type { ReactNode } from "react";
import { AsyncErrorState } from "@/shared/ui/components/async-error-state";
import { ADMIN_PAGE_HERO_BLEED } from "@/shared/layout/admin-page-layout";
import { layout } from "@/shared/layout/design-system";

type Props = {
  hero: ReactNode;
  error: string | null;
  loading: boolean;
  onRetry: () => Promise<void>;
  children: ReactNode;
};

export function AdminMonitoringPage({ hero, error, loading, onRetry, children }: Props) {
  return (
    <div className={layout.pageStack}>
      <div className={ADMIN_PAGE_HERO_BLEED}>{hero}</div>
      <div className={`${layout.panelStack} gap-5 pt-1`}>
        {error ? (
          <AsyncErrorState
            compact
            title="Os dados podem estar desatualizados"
            message={error}
            onRetry={onRetry}
            retrying={loading}
          />
        ) : null}
        {children}
      </div>
    </div>
  );
}
