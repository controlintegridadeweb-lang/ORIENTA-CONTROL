declare module "pg" {
  export type ClientConfig = {
    connectionString?: string;
    statement_timeout?: number;
  };

  export class Client {
    constructor(config?: ClientConfig);
    connect(): Promise<void>;
    query(
      queryText: string,
      values?: unknown[],
    ): Promise<{ rows: Array<Record<string, unknown>> }>;
    end(): Promise<void>;
  }

  const pg: { Client: typeof Client };
  export default pg;
}
