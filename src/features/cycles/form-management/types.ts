import type {
  DeadlineScope,
  FormAdminActionAvailability,
  FormApplicationCounts,
  FormApplicationStatusKey,
} from "./domain";

export type FormManagementOrganizationRow = {
  cycleId: string;
  organizationId: string;
  organizationName: string;
  organizationAcronym: string;
  state: string;
  applicableDeadlineAt: string | null;
  originalDeadlineAt: string | null;
  deadlineStatus: "on_time" | "overdue" | "paused" | "closed" | "none";
  deadlineChangeCount: number;
  exceptionalDeadline: boolean;
  reopenCount: number;
};

export type FormManagementHistoryItem = {
  id: string;
  batchId: string;
  action: string;
  scope: DeadlineScope | string;
  previousDeadlineAt: string | null;
  newDeadlineAt: string | null;
  justification: string;
  actorUserId: string;
  actorName: string | null;
  organizationId: string;
  organizationName: string;
  createdAt: string;
};

export type FormManagementCriterionOption = {
  questionVersionId: string;
  questionId: string;
  prompt: string;
  axisName: string;
  sectionName: string;
  orderIndex: number;
};

export type FormManagementDetails = {
  formId: string;
  formName: string;
  formVersion: number;
  formVersionId: string;
  periodLabel: string;
  status: FormApplicationStatusKey;
  statusLabel: string;
  publishedAt: string | null;
  openedAt: string | null;
  originalDeadlineAt: string | null;
  currentGlobalDeadlineAt: string | null;
  closedAt: string | null;
  createdByName: string | null;
  deadlineMode: "global" | "mixed";
  counts: FormApplicationCounts;
  actions: FormAdminActionAvailability[];
  organizations: FormManagementOrganizationRow[];
  criteria: FormManagementCriterionOption[];
  history: FormManagementHistoryItem[];
};

export type FormManagementMutationResult = {
  batchId: string;
  updated: number;
  notifications?: number;
  reopened?: number;
  action: string;
  newDeadlineAt?: string | null;
};
