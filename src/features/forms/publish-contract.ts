export type FormPublishPending = {
  questionId: string;
  missing: string[];
};

export type FormPublishReadiness = {
  canPublish: boolean;
  pending: FormPublishPending[];
  checks: {
    hasName: boolean;
    hasQuestions: boolean;
    bindingsComplete: boolean;
    hasAssignments: boolean;
  };
  questionCount: number;
  assignmentCount: number;
};

export class FormPublishPendingError extends Error {
  constructor(
    message: string,
    readonly pending: FormPublishPending[],
  ) {
    super(message);
    this.name = "FormPublishPendingError";
  }
}
