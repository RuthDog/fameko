import { getCloudflareContext } from "@opennextjs/cloudflare";

export class DatabaseUnavailableError extends Error {
  constructor() {
    super("Fameko D1 binding is unavailable.");
    this.name = "DatabaseUnavailableError";
  }
}

export async function getFamekoDatabase(): Promise<D1Database> {
  try {
    const { env } = await getCloudflareContext({ async: true });

    if (!env.FAMEKO_DB) {
      throw new DatabaseUnavailableError();
    }

    return env.FAMEKO_DB;
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      throw error;
    }

    throw new DatabaseUnavailableError();
  }
}
