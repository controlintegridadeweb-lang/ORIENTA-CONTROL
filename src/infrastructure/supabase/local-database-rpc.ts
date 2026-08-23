import "server-only";

const LOCAL_SUPABASE_DB =
  /^postgres(?:ql)?:\/\/[^@]+@127\.0\.0\.1:54322(?:\/|$)/i;

/**
 * O Kong local estoura timeout no POST de “não se aplica” depois do rate
 * limit e do SELECT de escopo. A mesma RPC no PostgreSQL (verify) conclui
 * em milissegundos. Este caminho só existe para 127.0.0.1:54322.
 */
export function canInvokeLocalDatabaseRpc(): boolean {
  if (process.env.VITEST || process.env.NODE_ENV === "test") return false;
  const url = process.env.DATABASE_URL?.trim();
  return Boolean(url && LOCAL_SUPABASE_DB.test(url));
}

export async function invokeLocalDatabaseRpc<T>(
  sql: string,
  values: unknown[],
): Promise<T> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url || !LOCAL_SUPABASE_DB.test(url)) {
    throw new Error("local_database_rpc_unavailable");
  }

  const { default: pg } = await import("pg");
  const client = new pg.Client({
    connectionString: url,
    statement_timeout: 8_000,
  });
  await client.connect();
  try {
    const result = await client.query(sql, values);
    return result.rows[0] as T;
  } finally {
    await client.end();
  }
}
