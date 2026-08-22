// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActivityFeed } from "./activity-feed";

describe("ActivityFeed", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("apresenta diagnóstico e tempo relativo em português correto", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T12:00:00.000Z"));

    render(
      <ActivityFeed
        activities={[
          {
            id: "activity-1",
            eventType: "INSERT",
            tableName: "cycles",
            actorEmail: "admin@example.com",
            createdAt: "2026-07-16T11:58:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.getByText("Novo diagnóstico")).toBeTruthy();
    expect(screen.getByText("2 min atrás")).toBeTruthy();
  });

  it("traduz eventos de automação para português", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T12:00:00.000Z"));

    render(
      <ActivityFeed
        activities={[
          {
            id: "activity-close",
            eventType: "automation.close_cycle",
            tableName: "automation_jobs",
            actorEmail: "Mauricio",
            createdAt: "2026-07-16T11:08:00.000Z",
          },
          {
            id: "activity-finalize",
            eventType: "automation.finalize_validation",
            tableName: "automation_jobs",
            actorEmail: "Mauricio",
            createdAt: "2026-07-15T13:00:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.getByText("Encerramento de avaliação")).toBeTruthy();
    expect(screen.getByText("Conclusão de validação")).toBeTruthy();
    expect(screen.queryByText(/automation\./)).toBeNull();
    expect(screen.queryByText(/automation jobs/i)).toBeNull();
  });

  it("traduz eventos de perfil e evita nomes técnicos em inglês", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T12:00:00.000Z"));

    render(
      <ActivityFeed
        activities={[
          {
            id: "profile-created",
            eventType: "user.respondent_created",
            tableName: "profiles",
            actorEmail: "Mauricio",
            createdAt: "2026-07-16T11:00:00.000Z",
          },
          {
            id: "profile-updated",
            eventType: "user.respondent_updated",
            tableName: "profiles",
            actorEmail: "Mauricio",
            createdAt: "2026-07-16T10:00:00.000Z",
          },
          {
            id: "profile-unknown",
            eventType: "user.unknown_profile_event",
            tableName: "profiles",
            actorEmail: "Mauricio",
            createdAt: "2026-07-16T09:00:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.getByText("Respondente criado")).toBeTruthy();
    expect(screen.getByText("Respondente atualizado")).toBeTruthy();
    expect(screen.getByText("Evento em Perfis de usuários")).toBeTruthy();
    expect(screen.queryByText(/Evento em profiles/i)).toBeNull();
  });

  it("traduz rascunhos de análise de validação sem expor inglês", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T12:00:00.000Z"));

    render(
      <ActivityFeed
        activities={[
          {
            id: "draft-insert",
            eventType: "INSERT",
            tableName: "validation_analysis_drafts",
            actorEmail: "Mauricio",
            createdAt: "2026-07-16T11:00:00.000Z",
          },
          {
            id: "draft-update",
            eventType: "UPDATE",
            tableName: "validation_analysis_drafts",
            actorEmail: "Mauricio",
            createdAt: "2026-07-16T10:00:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.getByText("Novo rascunho de análise")).toBeTruthy();
    expect(screen.getByText("Rascunho de análise atualizado")).toBeTruthy();
    expect(screen.queryByText(/validation analysis drafts/i)).toBeNull();
  });
});
