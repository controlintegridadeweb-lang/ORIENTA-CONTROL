import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export async function loadValidationProfileNames(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", unique);
  if (error) throw error;

  const rows = z
    .array(
      z.object({
        user_id: z.string().uuid(),
        full_name: z.string().nullable(),
      }),
    )
    .parse(data ?? []);

  return new Map(
    rows.flatMap((row) => {
      const name = row.full_name?.trim();
      return name ? [[row.user_id, name] as const] : [];
    }),
  );
}

export async function loadValidationQuestionOrder(
  supabase: SupabaseClient,
  cycleId: string,
): Promise<Map<string, number>> {
  const { data: cycle, error: cycleError } = await supabase
    .from("cycles")
    .select("form_version_id")
    .eq("id", cycleId)
    .maybeSingle();
  if (cycleError) throw cycleError;
  if (!cycle?.form_version_id) return new Map();

  const { data, error } = await supabase
    .from("form_questions")
    .select("order_index, question_versions!inner(question_id)")
    .eq("form_version_id", cycle.form_version_id);
  if (error) throw error;

  const rows = z
    .array(
      z.object({
        order_index: z.number().int(),
        question_versions: z.object({ question_id: z.string().uuid() }),
      }),
    )
    .parse(data ?? []);

  return new Map(
    rows.map((row) => [row.question_versions.question_id, row.order_index]),
  );
}
