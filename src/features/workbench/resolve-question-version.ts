import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolve a question_version congelada de um critério na versão do formulário do ciclo.
 */
export async function resolveQuestionVersionId(
  supabase: SupabaseClient,
  formVersionId: string,
  questionId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("form_questions")
    .select("question_version_id, question_versions!inner(question_id)")
    .eq("form_version_id", formVersionId)
    .eq("question_versions.question_id", questionId)
    .maybeSingle();
  if (error) throw error;
  return data ? (data.question_version_id as string) : null;
}
