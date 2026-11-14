// Trade-Disk — read EVERY row of a query. Supabase's API returns at most 1000 rows per
// request, silently; a day of Radar snapshots is several thousand. `build` must return a
// fresh, ordered query each call; it is read page by page until a short page.
export async function allRows(build, pageSize = 1000) {
  const out = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < pageSize) return out;
  }
}
