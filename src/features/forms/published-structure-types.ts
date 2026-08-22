import type { InlineLibraryRecommendation } from "@/features/library";

export type PublishedFormQuestion = {
  questionId: string;
  questionVersion: number;
  orderIndex: number;
  prompt: string;
  evidenceRequired: boolean;
  famiEnabled: boolean;
  appliesToRespondent: boolean;
  sectionId: string;
  sectionName: string;
  sectionOrder: number;
  axisId: string;
  axisName: string;
  metricName: string | null;
  metricDescription: string | null;
  recommendation: InlineLibraryRecommendation | null;
  bindingNote: string | null;
  coverageScore: number | null;
};

export type PublishedFormStructure = {
  formVersionId: string;
  version: number;
  publishedAt: string | null;
  questions: PublishedFormQuestion[];
};
