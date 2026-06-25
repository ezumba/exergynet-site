// lib/agent/scheduler.ts
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { triggerAgentCycle } from "./watchlistAgent";

export async function runScheduledCycles(): Promise<void> {
  try {
    const due = await db.execute(sql`
      SELECT id, agent_frequency, name FROM entities
      WHERE agent_enabled = true
      AND (
        last_agent_run IS NULL
        OR last_agent_run < NOW() - make_interval(secs => CASE
          WHEN agent_frequency = '5min'  THEN 300
          WHEN agent_frequency = '15min' THEN 900
          WHEN agent_frequency = '1h'    THEN 3600
          WHEN agent_frequency = '6h'    THEN 21600
          WHEN agent_frequency = '24h'   THEN 86400
          ELSE 900
        END)
      )
      LIMIT 10
    `);
    for (const entity of due.rows as any[]) {
      try {
        await triggerAgentCycle(entity.id);
        console.log(`[Scheduler] cycle complete for ${entity.name}`);
      } catch (err) {
        console.error(`[Scheduler] cycle failed for ${entity.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[Scheduler] query failed:", err);
  }
}
