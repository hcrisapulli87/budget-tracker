/** PostgREST (Supabase's API) returns at most this many rows per request. */
export const PAGE_SIZE = 1000

/**
 * Fetch every row of a query, a page at a time, so results are never silently
 * cut off at 1000 rows. `page(from, to)` must return the query with
 * `.range(from, to)` applied and a stable order (end it with `.order('id')`)
 * so rows can't shift between pages.
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = []
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await page(start, start + PAGE_SIZE - 1)
    if (error) throw error
    const rows = data ?? []
    out.push(...rows)
    if (rows.length < PAGE_SIZE) return out
  }
}
