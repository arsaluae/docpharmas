import { supabase } from "@/integrations/supabase/client";

/**
 * Fetch all rows from a table, bypassing the 1000-row default limit.
 * Fetches in batches of `batchSize` until no more rows are returned.
 */
export async function fetchAllRows<T = any>(
  table: string,
  select: string,
  filters?: { column: string; op: "eq" | "in" | "gte" | "lte"; value: any }[],
  batchSize = 1000
): Promise<T[]> {
  const allRows: T[] = [];
  let from = 0;

  while (true) {
    let query = supabase.from(table).select(select).range(from, from + batchSize - 1);
    if (filters) {
      for (const f of filters) {
        if (f.op === "eq") query = query.eq(f.column, f.value);
        else if (f.op === "in") query = query.in(f.column, f.value);
        else if (f.op === "gte") query = query.gte(f.column, f.value);
        else if (f.op === "lte") query = query.lte(f.column, f.value);
      }
    }
    const { data, error } = await query;
    if (error || !data || data.length === 0) break;
    allRows.push(...(data as T[]));
    if (data.length < batchSize) break;
    from += batchSize;
  }

  return allRows;
}
