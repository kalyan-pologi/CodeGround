import { useCallback, useMemo, useRef, useState } from 'react';

export function readPreference(key, fallback, valid = () => true) {
  try { const value = JSON.parse(localStorage.getItem('codeground:' + key)); return value !== null && valid(value) ? value : fallback; } catch { return fallback; }
}
export function writePreference(key, value) {
  try { localStorage.setItem('codeground:' + key, JSON.stringify(value)); return true; } catch { return false; }
}
function signature(text) { let hash = 0; for (const char of text) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0; return String(hash); }
export function useExerciseDraft(task, bank) {
  const key = 'draft:v1:' + bank + ':' + task.id;
  const starter = useMemo(() => signature(task.starter), [task.starter]);
  const [draft, setDraft] = useState(() => readPreference(key, { code: task.starter, stdin: '', starter }, value => value.starter === starter && typeof value.code === 'string' && typeof value.stdin === 'string'));
  const [saveStatus, setSaveStatus] = useState('Autosave on');
  const currentDraft = useRef(draft);
  const update = useCallback(patch => {
    const next = { ...currentDraft.current, ...patch, starter };
    currentDraft.current = next;
    setDraft(next);
    setSaveStatus(writePreference(key, next) ? 'Saved locally' : 'Autosave unavailable');
  }, [key, starter]);
  const setCode = useCallback(code => update({ code }), [update]);
  const setStdin = useCallback(stdin => update({ stdin }), [update]);
  return { code: draft.code, stdin: draft.stdin, setCode, setStdin, saveStatus };
}
