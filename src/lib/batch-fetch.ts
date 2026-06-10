import { supabase } from "@/integrations/supabase/client";

/**
 * Fetch all rows from a table, bypassing the 1000-row default limit.
 */
export async function fetchAllRows(
  table: string,
  select: string,
  filters?: { column: string; op: "eq" | "in" | "gte" | "lte" | "not"; value: any; value2?: any }[],
  batchSize = 1000
): Promise<any[]> {
  const allRows: any[] = [];
  let from = 0;

  while (true) {
    let query = (supabase as any).from(table).select(select).range(from, from + batchSize - 1);
    if (filters) {
      for (const f of filters) {
        if (f.op === "not") query = query.not(f.column, f.value, f.value2);
        else query = query[f.op](f.column, f.value);
      }
    }
    const { data, error } = await query;
    if (error || !data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < batchSize) break;
    from += batchSize;
  }

  return allRows;
}
