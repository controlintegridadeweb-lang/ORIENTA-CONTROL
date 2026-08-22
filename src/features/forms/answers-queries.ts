import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { isEvidenceRequired } from "@/shared/domain/evidence-parameter";
import { FormsNotFoundError } from "./admin-service";

type Client = SupabaseClient;

const orderedQuestionRowSchema = z.object({
  order_index: z.number().int(),
  question_versions: z.object({
    question_id: z.string().min(1),
    prompt: z.string(),
    evidence_parameter: z.unknown().nullable().optional(),
    fami_enabled: z.boolean(),
  }),
});

/** Consultas auxiliares do detalhe individual de respostas. */
export async function loadFormBasic(
  client: Client,
  formId: string,
): Promise<{ id: string; name: string; state: string }> {
  const { data, error } = await client
    .from("forms")
    .select("id,name")
    .eq("id", formId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new FormsNotFoundError("Formulário não encontrado.");
  return { id: data.id, name: data.name, state: "draft" };
}

export async function loadOrderedQuestionsForVersion(
  client: Client,
  formVersionId: string,
): Promise<
  {
    id: string;
    prompt: string;
    orderIndex: number;
    requiresEvidence: boolean;
    famiEnabled: boolean;
  }[]
> {
  const { data: links, error: linksErr } = await client
    .from("form_questions")
    .select(
      "order_index, question_versions!inner(question_id, prompt, evidence_parameter, fami_enabled)",
    )
    .eq("form_version_id", formVersionId)
    .order("order_index", { ascending: true });
  if (linksErr) throw linksErr;

  return z.array(orderedQuestionRowSchema).parse(links ?? []).map((link) => ({
    id: link.question_versions.question_id,
    prompt: link.question_versions.prompt,
    orderIndex: link.order_index,
    requiresEvidence: isEvidenceRequired({
      evidence_parameter: link.question_versions.evidence_parameter ?? null,
    }),
    famiEnabled: link.question_versions.fami_enabled,
  }));
}

export async function loadUserNames(
  client: Client,
  ids: string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await client
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", ids);
  if (error) throw error;
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const r = row as { user_id: string; full_name: string | null };
    if (r.full_name) map.set(r.user_id, r.full_name);
  }
  return map;
}
