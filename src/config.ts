import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PELOTON_USERNAME: z.string().min(1, "PELOTON_USERNAME is required"),
  PELOTON_PASSWORD: z.string().min(1, "PELOTON_PASSWORD is required"),
  DB_PATH: z.string().min(1).default("./peloton.db"),
  SYNC_RECENT_COUNT: z.coerce.number().int().positive().default(20),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export const config = envSchema.parse(process.env);
