import { env } from "cloudflare:workers";

export function getDB() {
  if (!env.DB) throw new Error("Character storage is temporarily unavailable.");
  return env.DB;
}
