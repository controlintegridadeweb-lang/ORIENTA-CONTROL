/** Par institucional form × organização (ciclo atribuído). */
export type FormAssignment = {
  id: string;
  formId: string;
  organizationId: string;
  organizationName: string;
  assignedAt: string;
  assignedBy: string | null;
};

export type FormAssignmentSummary = {
  formId: string;
  organizationIds: string[];
  assignments: FormAssignment[];
};

export type OrganizationOption = {
  id: string;
  name: string;
  assigned: boolean;
  /** Não pode ser removida porque já possui diagnóstico criado neste formulário. */
  locked: boolean;
};
