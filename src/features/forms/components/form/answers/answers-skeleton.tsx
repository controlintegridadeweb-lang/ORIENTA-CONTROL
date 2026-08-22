import { Skeleton, TableSkeleton } from "@/shared/ui/components/loading";
import { formSurface } from "@/shared/layout/form-surface";

export function AnswersOverviewSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className={`${formSurface.nestedCard} flex h-30 flex-col justify-between p-4`}
        >
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-7 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function AnswersSummarySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className={formSurface.nestedCard}>
          <div className="space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/4" />
            <div className="flex items-center gap-4 pt-2">
              <Skeleton className="h-32 w-32 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AnswersListSkeleton() {
  return <TableSkeleton rows={6} cols={5} />;
}

export function AnswersIndividualSkeleton() {
  return (
    <div className="space-y-4">
      <div className={`${formSurface.nestedCard} space-y-3`}>
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={formSurface.nestedCard}>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-2 h-3 w-1/4" />
            <Skeleton className="mt-3 h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
