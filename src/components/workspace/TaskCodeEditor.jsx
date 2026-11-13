import { memo } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import 'monaco-editor/esm/vs/basic-languages/java/java.contribution';
import 'monaco-editor/esm/vs/basic-languages/sql/sql.contribution';
import 'monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });
monaco.editor.defineTheme('codeground-dark', {
  base: 'vs-dark', inherit: true,
  rules: [{ token: 'comment', foreground: '788D9D' }, { token: 'string', foreground: 'B5CFA7' }, { token: 'keyword', foreground: 'A7BBDD' }, { token: 'number', foreground: 'D6BC95' }],
  colors: { 'editor.background': '#0b1118', 'editor.foreground': '#d7e1eb', 'editorLineNumber.foreground': '#627589', 'editorLineNumber.activeForeground': '#a3b3c3', 'editor.lineHighlightBackground': '#162331', 'editorCursor.foreground': '#9bc9b8', 'editor.selectionBackground': '#2b4b43', 'editor.inactiveSelectionBackground': '#233c36', 'editorWidget.border': '#293540' }
});

const editorOptions = { minimap: { enabled: false }, fontSize: 14, lineNumbers: 'on', scrollBeyondLastLine: false, automaticLayout: true, tabSize: 4, wordWrap: 'on', padding: { top: 14 }, bracketPairColorization: { enabled: true } };

function TaskCodeEditor({ task, code, onChange }) {
  return <Editor height="100%" path={`task-${task.id}.${task.language || 'java'}`} language={task.language || 'java'} theme="codeground-dark" value={code} onChange={value => onChange(value ?? '')}
    loading={<p role="status">Loading editor…</p>}
    options={{ ...editorOptions, readOnly: task.readOnly === true }} />;
}

export default memo(TaskCodeEditor);
