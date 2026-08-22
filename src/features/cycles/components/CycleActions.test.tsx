// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CycleListItem } from "@/features/cycles/cycle-queries";
import { getValidationReopenImpact, transitionAdminCycle, updateAdminCycleSchedule } from "@/features/cycles/client";
import { CycleActions } from "./CycleActions";

const routerPush = vi.fn();
const routerRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: routerRefresh, push: routerPush }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/shared/ui/components/confirm-dialog", () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}));

vi.mock("@/features/cycles/client", () => ({
  getValidationReopenImpact: vi.fn(),
  transitionAdminCycle: vi.fn(),
  updateAdminCycleSchedule: vi.fn(),
}));

function cycle(state: CycleListItem["state"]): CycleListItem {
  return {
    id: "cycle-1",
    state,
    periodId: "period-1",
    periodLabel: "2026",
    organizationId: "org-1",
    organizationName: "Organização",
    organizationAcronym: "ORG",
    formId: "form-1",
    formName: "Diagnóstico",
    formVersionId: "version-1",
    formVersion: 1,
    reopenCount: 0,
    startsAt: "2026-01-01T12:00:00.000Z",
    responseDeadlineAt: "2026-02-01T12:00:00.000Z",
    originalResponseDeadlineAt: "2026-02-01T12:00:00.000Z",
    validationDeadlineAt: null,
    cycleCloseAt: null,
    submittedLateAt: null,
    submissionDelaySeconds: null,
    closedAt: null,
    referenceStartYear: 2026,
    referenceEndYear: 2026,
    responseCollectionPausedAt: null,
    deadlineChangeCount: 0,
    workingProcessingId: "processing-1",
    workingProcessingVersion: 1,
  };
}

describe("CycleActions", () => {
  beforeEach(() => {
    vi.mocked(getValidationReopenImpact).mockResolvedValue({
      actionPlanCount: 0,
      supervisionNoteCount: 0,
      exceptionCount: 0,
      blocked: false,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("edita e salva o calendário no fuso oficial de Fortaleza", async () => {
    render(<CycleActions cycle={cycle("draft")} />);

    const startInput = screen.getByLabelText("Início") as HTMLInputElement;
    const deadlineInput = screen.getByLabelText("Prazo de resposta") as HTMLInputElement;
    expect(startInput.value).toBe("2026-01-01T09:00");
    expect(deadlineInput.value).toBe("2026-02-01T09:00");

    fireEvent.change(startInput, { target: { value: "2027-07-18T10:30" } });
    fireEvent.change(deadlineInput, { target: { value: "2027-07-20T18:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar datas" }));

    await waitFor(() => {
      expect(vi.mocked(updateAdminCycleSchedule)).toHaveBeenCalledWith("cycle-1", {
        startsAt: "2027-07-18T13:30:00.000Z",
        responseDeadlineAt: "2027-07-20T21:00:00.000Z",
        validationDeadlineAt: null,
        cycleCloseAt: null,
      });
    });
    expect(screen.getByText(/horário oficial da plataforma/i)).toBeTruthy();
  });

  it("exige justificativa e novo prazo ao reabrir um diagnóstico", async () => {
    render(<CycleActions cycle={cycle("completed")} reportLifecycleStatus="available" />);

    fireEvent.change(screen.getByLabelText(/Justificativa da reabertura/), {
      target: { value: "Correção institucional solicitada pela auditoria." },
    });
    fireEvent.change(screen.getByLabelText(/Novo prazo de resposta/), {
      target: { value: "2030-08-30T18:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reabrir diagnóstico" }));

    await waitFor(() => {
      expect(vi.mocked(transitionAdminCycle)).toHaveBeenCalledWith(
        "cycle-1",
        "in_response",
        {
          reason: "Correção institucional solicitada pela auditoria.",
          responseDeadlineAt: "2030-08-30T21:00:00.000Z",
        },
        undefined,
      );
    });
  });

  it("bloqueia a reabertura enquanto o relatório oficial não estiver preservado", () => {
    render(<CycleActions cycle={cycle("completed")} reportLifecycleStatus="emission_failed" />);

    const reopenButton = screen.getByRole("button", { name: "Reabrir diagnóstico" }) as HTMLButtonElement;
    expect(reopenButton.disabled).toBe(true);
    expect(
      screen.getByText(/A emissão automática falhou/i),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Abrir Relatórios" }).getAttribute("href"),
    ).toBe("/admin/relatorios?organizationId=org-1&cycleId=cycle-1");
    expect((screen.getByLabelText(/Justificativa da reabertura/) as HTMLTextAreaElement).disabled).toBe(true);
    expect((screen.getByLabelText(/Novo prazo de resposta/) as HTMLInputElement).disabled).toBe(true);
  });

  it("mostra só o botão de reabrir validação e pede o motivo no modal", async () => {
    render(<CycleActions cycle={cycle("validated")} />);

    expect(screen.getByText("Validação")).toBeTruthy();
    expect(
      screen.getByText("O diagnóstico possui um Resultado FAMI oficial."),
    ).toBeTruthy();
    expect(screen.queryByText("Ações do diagnóstico")).toBeNull();
    expect(screen.queryByText("Encerramento da avaliação")).toBeNull();
    expect(screen.queryByLabelText(/Motivo da reabertura/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reabrir validação" }));

    const dialog = screen.getByRole("dialog", { name: "Reabrir validação" });
    expect(dialog).toBeTruthy();
    await screen.findByText("Impacto identificado");
    expect(screen.queryByText(/pelo menos 10 caracteres/i)).toBeNull();

    const modalConfirm = Array.from(dialog.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Reabrir validação",
    );
    expect(modalConfirm).toBeTruthy();
    fireEvent.click(modalConfirm!);

    expect(screen.getByText(/pelo menos 10 caracteres/i)).toBeTruthy();
    expect(vi.mocked(transitionAdminCycle)).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Motivo da reabertura/), {
      target: {
        value: "Revisão administrativa das evidências aprovadas.",
      },
    });
    fireEvent.click(modalConfirm!);

    await waitFor(() => {
      expect(vi.mocked(transitionAdminCycle)).toHaveBeenCalledWith(
        "cycle-1",
        "in_validation",
        undefined,
        { reason: "Revisão administrativa das evidências aprovadas." },
      );
      expect(routerPush).toHaveBeenCalledWith(
        "/admin/ciclos/cycle-1/validacao",
      );
    });
  });

  it("bloqueia a reabertura quando o resultado já possui histórico de melhoria", async () => {
    vi.mocked(getValidationReopenImpact).mockResolvedValue({
      actionPlanCount: 2,
      supervisionNoteCount: 1,
      exceptionCount: 0,
      blocked: true,
    });

    render(<CycleActions cycle={cycle("validated")} />);
    fireEvent.click(screen.getByRole("button", { name: "Reabrir validação" }));

    await screen.findByText(/reabertura foi bloqueada/i);
    const dialog = screen.getByRole("dialog", { name: "Reabrir validação" });
    const confirm = Array.from(dialog.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Reabrir validação",
    ) as HTMLButtonElement | undefined;
    expect(confirm?.disabled).toBe(true);
    expect(vi.mocked(transitionAdminCycle)).not.toHaveBeenCalled();
  });

  it("abre a fila imediatamente ao iniciar a validação", async () => {
    render(<CycleActions cycle={cycle("submitted")} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Iniciar validação" }),
    );

    await waitFor(() => {
      expect(vi.mocked(transitionAdminCycle)).toHaveBeenCalledWith(
        "cycle-1",
        "in_validation",
        undefined,
        undefined,
      );
      expect(routerPush).toHaveBeenCalledWith(
        "/admin/ciclos/cycle-1/validacao",
      );
    });
  });

  it("mantém o administrador aguardando o envio inicial do respondente", () => {
    render(<CycleActions cycle={cycle("in_response")} />);

    expect(screen.getByText("Aguardando envio")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /enviar|validar|avançar/i })).toBeNull();
    expect(screen.queryByText("Ações do diagnóstico")).toBeNull();
  });

  it("não oferece atalho administrativo para reenviar a complementação", () => {
    render(<CycleActions cycle={cycle("awaiting_adjustment")} />);

    expect(screen.getByText("Aguardando correção")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retomar validação" })).toBeNull();
  });

  it("exibe a fila de validação sem card interno nem status duplicado", () => {
    render(<CycleActions cycle={cycle("in_validation")} />);

    expect(screen.getByText("Validação")).toBeTruthy();
    expect(screen.queryByText("Ações do diagnóstico")).toBeNull();
    expect(screen.queryByText(/Situação atual/i)).toBeNull();
    expect(
      screen.getByRole("link", { name: "Revisar validação do diagnóstico" }),
    ).toBeTruthy();
  });
});
