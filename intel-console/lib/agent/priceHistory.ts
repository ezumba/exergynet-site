// lib/agent/priceHistory.ts
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export interface PriceVolumeHistory {
  prices:        number[];
  volumes:       number[];
  currentPrice:  number | null;
  currentVolume: number | null;
  entityId:      string;
}

export async function getPriceHistory(
  entityId: string,
  window = 20
): Promise<PriceVolumeHistory> {
  const priceRows = await db.execute(sql`
    SELECT value FROM series_points
    WHERE entity_id = ${entityId} AND metric = 'price'
    ORDER BY t DESC LIMIT ${window}
  `);
  const volumeRows = await db.execute(sql`
    SELECT value FROM series_points
    WHERE entity_id = ${entityId} AND metric = 'volume'
    ORDER BY t DESC LIMIT ${window}
  `);
  const prices  = (priceRows.rows  as {value: string}[]).map(r => parseFloat(r.value)).reverse();
  const volumes = (volumeRows.rows as {value: string}[]).map(r => parseFloat(r.value)).reverse();
  return {
    prices,
    volumes,
    currentPrice:  prices.length  > 0 ? prices[prices.length - 1]  : null,
    currentVolume: volumes.length > 0 ? volumes[volumes.length - 1] : null,
    entityId,
  };
}
