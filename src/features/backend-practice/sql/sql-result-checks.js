export function compareSqlResults(actual, expected, ordered = false) {
  if (actual.length !== expected.length) return { passed: false, message: 'Your query returned ' + actual.length + ' result sets; ' + expected.length + ' expected.' };
  for (let index = 0; index < expected.length; index++) {
    const a = actual[index], e = expected[index];
    if (a.truncated || e.truncated) return { passed: false, message: 'Sample comparison is limited to 500 rows. Reduce the result size.' };
    if (JSON.stringify(a.columns) !== JSON.stringify(e.columns)) return { passed: false, message: 'Column names and order must match the expected output.' };
    const rows = values => { const result = values.map(row => JSON.stringify(row)); return ordered ? result : result.sort(); };
    if (JSON.stringify(rows(a.values)) !== JSON.stringify(rows(e.values))) return { passed: false, message: 'The returned rows differ from the expected sample output.' };
  }
  return { passed: true, message: 'Your result matches the sample. This checks the supplied data only.' };
}
