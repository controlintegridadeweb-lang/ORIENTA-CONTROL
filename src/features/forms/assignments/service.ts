import { hasDatabaseErrorCode } from "@/infrastructure/supabase/database-error";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { logInfo } from "@/infrastructure/observability/logger";
import { listAllOrganizationOptions } from "@/features/organizations/server";
import {
  FormAssignmentAccessError,
  FormAssignmentsNotFoundError,
  FormAssignmentsValidationError,
} from "./errors";
import { FormAssignmentsRepository } from "./repository";
import { syncFormAssignmentsSchema } from "./schemas";
import type { FormAssignmentSummary, OrganizationOption } from "./types";

export type FormAssignmentsActor = {
  userId: string;
};

export class FormAssignmentsService {
  private repo: FormAssignmentsRepository;

  constructor(repo?: FormAssignmentsRepository) {
    this.repo = repo ?? new FormAssignmentsRepository();
  }

  async getSummary(formId: string): Promise<FormAssignmentSummary> {
    await this.assertFormExists(formId);
    const assignments = await this.repo.listByFormId(formId);
    return {
      formId,
      organizationIds: assignments.map((a) => a.organizationId),
      assignments,
    };
  }

  async listOrganizationOptions(formId: string): Promise<OrganizationOption[]> {
    await this.assertFormExists(formId);
    const [assignments, lockedOrganizationIds, organizations] =
      await Promise.all([
        this.repo.listByFormId(formId),
        this.repo.listOrganizationIdsWithCycles(formId),
        listAllOrganizationOptions(),
      ]);
    const assigned = new Set(assignments.map((a) => a.organizationId));
    const locked = new Set(lockedOrganizationIds);
    return organizations.map((organization) => ({
      id: organization.id,
      name: organization.name,
      assigned: assigned.has(organization.id),
      locked: assigned.has(organization.id) && locked.has(organization.id),
    }));
  }

  async syncAssignments(
    formId: string,
    payload: unknown,
    actor: FormAssignmentsActor,
  ): Promise<FormAssignmentSummary> {
    const parsed = syncFormAssignmentsSchema.safeParse(payload);
    if (!parsed.success) {
      throw new FormAssignmentsValidationError(
        parsed.error.issues.map((issue) => ({
          path: issue.path.join(".") || "_",
          message: issue.message,
        })),
      );
    }
    await this.assertFormExists(formId);

    try {
      await this.repo.syncAssignments(
        formId,
        parsed.data.organizationIds,
        actor.userId,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (hasDatabaseErrorCode(message, "organization_not_found")) {
        throw new FormAssignmentsValidationError([{
          path: "organizationIds",
          message: "Uma ou mais organizações selecionadas não existem mais.",
        }]);
      }
      if (hasDatabaseErrorCode(message, "duplicate_organization_assignment")) {
        throw new FormAssignmentsValidationError([{
          path: "organizationIds",
          message: "A seleção contém organizações duplicadas.",
        }]);
      }
      if (hasDatabaseErrorCode(message, "form_assignment_has_cycles")) {
        throw new FormAssignmentsValidationError([{
          path: "organizationIds",
          message: "Não é possível remover organizações que já possuem diagnóstico vinculado ao formulário.",
        }]);
      }
      if (hasDatabaseErrorCode(message, "form_published_requires_assignment")) {
        throw new FormAssignmentsValidationError([{
          path: "organizationIds",
          message: "Um formulário publicado precisa permanecer vinculado a pelo menos uma organização.",
        }]);
      }
      throw error;
    }

    logInfo("form_assignments.synced", {
      formId,
      actorId: actor.userId,
      count: parsed.data.organizationIds.length,
    });

    return this.getSummary(formId);
  }

  async listOrganizationIdsForForm(formId: string): Promise<string[]> {
    return this.repo.listOrganizationIdsByFormId(formId);
  }

  async listFormIdsForOrganization(organizationId: string): Promise<string[]> {
    return this.repo.listFormIdsByOrganizationId(organizationId);
  }

  async isOrganizationAssigned(
    formId: string,
    organizationId: string,
  ): Promise<boolean> {
    return this.repo.isAssigned(formId, organizationId);
  }

  async assertOrganizationAssigned(
    formId: string,
    organizationId: string,
  ): Promise<void> {
    const ok = await this.repo.isAssigned(formId, organizationId);
    if (!ok) {
      throw new FormAssignmentAccessError();
    }
  }

  private async assertFormExists(formId: string): Promise<void> {
    const supabase = createSupabaseServiceRoleClient();
    const { data, error } = await supabase
      .from("forms")
      .select("id")
      .eq("id", formId)
      .maybeSingle();
    if (error) throw error;
    if (!data)
      throw new FormAssignmentsNotFoundError("Formulário não encontrado.");
  }


}

export async function listAssignedFormIdsForOrganization(
  organizationId: string,
): Promise<string[]> {
  return new FormAssignmentsService().listFormIdsForOrganization(
    organizationId,
  );
}

export async function assertOrganizationAssignedToForm(
  formId: string,
  organizationId: string,
): Promise<void> {
  await new FormAssignmentsService().assertOrganizationAssigned(
    formId,
    organizationId,
  );
}
