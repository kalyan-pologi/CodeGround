import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

self.onmessage = async ({ data }) => {
  let db;
  try {
    const SQL = await initSqlJs({ locateFile: () => wasmUrl });
    db = new SQL.Database(); db.run(data.setup);
    const results = [];
    const changesBefore = db.exec('SELECT total_changes()')[0].values[0][0];
    for (const statement of db.iterateStatements(data.code)) {
      const columns = statement.getColumnNames(), values = [];
      let truncated = false;
      while (statement.step()) {
        if (values.length === 500) { truncated = true; break; }
        values.push(statement.get());
      }
      if (columns.length) results.push({ columns, values, truncated });
      if (results.length === 20) break;
    }
    if (data.preview) {
      try { results.push(...db.exec(data.preview)); } catch { /* The user's query may remove the preview table. */ }
    }
    const changed = db.exec('SELECT total_changes()')[0].values[0][0] - changesBefore;
    self.postMessage({ results, changed });
  } catch (error) { self.postMessage({ error: error.message }); }
  finally { db?.close(); }
};
