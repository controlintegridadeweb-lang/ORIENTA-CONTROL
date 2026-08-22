export type RespondentProgress = {
  cycleId: string;
  formId: string;
  formName: string;
  periodLabel: string;
  formVersion: number;
  organizationName: string;
  state: string;
  totalQuestions: number;
  answeredQuestions: number;
  submissionReady: boolean;
  submissionBlockCount: number;
  complementationRequests: number;
  resolvedComplementationRequests: number;
};

export type RespondentProgressPeriod = { year: number };
