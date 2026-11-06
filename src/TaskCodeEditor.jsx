import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import 'monaco-editor/esm/vs/basic-languages/java/java.contribution';
import 'monaco-editor/esm/vs/basic-languages/sql/sql.contribution';
import 'monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });

export default function TaskCodeEditor({ task, code, onChange }) {
  return <Editor height="100%" path={`task-${task.id}.${task.language || 'java'}`} language={task.language || 'java'} theme="vs-dark" value={code} onChange={value => onChange(value ?? '')}
    loading={<p role="status">Loading editor…</p>}
    options={{ minimap: { enabled: false }, fontSize: 14, lineNumbers: 'on', scrollBeyondLastLine: false, automaticLayout: true, tabSize: 4, wordWrap: 'on', padding: { top: 14 }, bracketPairColorization: { enabled: true } }} />;
}
