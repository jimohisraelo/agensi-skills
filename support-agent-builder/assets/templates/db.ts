import pg from "pg";

/**
 * The slice of a database client the tools need. Tests pass a fake with the same shape.
 *
 * ADAPT: if the project uses Prisma/Drizzle/TypeORM/Mongoose, delete this file and
 * rewrite the queries in tools.ts with the project's client. Keep the same rules
 * (ownership filter inside the query, parameterised inputs).
 */
export interface Db {
  query<R extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params?: unknown[]): Promise<{ rows: R[] }>;
}

export function createPool(connectionString = process.env.DATABASE_URL): pg.Pool {
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new pg.Pool({ connectionString, max: 10 });
}
