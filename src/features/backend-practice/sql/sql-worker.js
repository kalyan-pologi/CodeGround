import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { compareSqlResults } from './sql-result-checks.js';

// sql.js initialization is expensive. Keep the WASM module warm for the
// lifetime of this worker while still creating and closing a database per job.
let sqlPromise;
function loadSql() {
  sqlPromise ??= initSqlJs({ locateFile: () => wasmUrl });
  return sqlPromise;
}

function execute(db, code, preview = '') {
  const results = [];
  const changesBefore = db.exec('SELECT total_changes()')[0].values[0][0];
  for (const statement of db.iterateStatements(code)) {
    const columns = statement.getColumnNames(), values = [];
    let truncated = false;
    while (statement.step()) {
      if (values.length === 500) { truncated = true; break; }
      values.push(statement.get());
    }
    if (columns.length) results.push({ columns, values, truncated });
    if (results.length === 20) break;
  }
  if (preview) { try { results.push(...db.exec(preview)); } catch { /* A user's query may remove the preview table. */ } }
  return { results, changed: db.exec('SELECT total_changes()')[0].values[0][0] - changesBefore };
}
self.onmessage = async ({ data }) => {
  let db, reference;
  try {
    const SQL = await loadSql();
    db = new SQL.Database(); db.run(data.setup);
    if (data.mode === 'inspect') {
      const names = db.exec("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")[0]?.values || [];
      const tables = names.map(([name]) => {
        const quoted = '"' + name.replaceAll('"', '""') + '"';
        return { name, schema: db.exec('PRAGMA table_info(' + quoted + ')')[0], data: db.exec('SELECT * FROM ' + quoted + ' LIMIT 10')[0] };
      });
      const expected = data.reference ? execute(db, data.reference, data.preview) : null;
      self.postMessage({ tables, expected }); return;
    }
    const output = execute(db, data.code, data.preview);
    if (data.mode === 'check') {
      reference = new SQL.Database(); reference.run(data.setup);
      const expected = execute(reference, data.reference, data.preview);
      output.expected = expected.results;
      output.comparison = compareSqlResults(output.results, expected.results, data.ordered);
    }
    self.postMessage(output);
  } catch (error) { self.postMessage({ error: error.message }); }
  finally { db?.close(); reference?.close(); }
};
