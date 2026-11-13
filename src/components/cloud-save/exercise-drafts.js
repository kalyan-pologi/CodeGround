import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, supabaseConfigured } from '../../services/supabase';

export function readPreference(key, fallback, valid = () => true) {
  try { const value = JSON.parse(localStorage.getItem('codeground:' + key)); return value !== null && valid(value) ? value : fallback; } catch { return fallback; }
}
export function writePreference(key, value) {
  try { localStorage.setItem('codeground:' + key, JSON.stringify(value)); return true; } catch { return false; }
}
export function clearLocalDrafts() {
  try {
    Object.keys(localStorage).filter(key => key.startsWith('codeground:draft:v1:')).forEach(key => localStorage.removeItem(key));
    return true;
  } catch { return false; }
}
function signature(text) { let hash = 0; for (const char of text) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0; return String(hash); }
export function useExerciseDraft(task, bank) {
  const key = 'draft:v1:' + bank + ':' + task.id;
  const starter = useMemo(() => signature(task.starter), [task.starter]);
  const readDraft = useCallback(() => readPreference(key, { code: task.starter, stdin: '', starter }, value => value.starter === starter && typeof value.code === 'string' && typeof value.stdin === 'string'), [key, starter, task.starter]);
  const [draft, setDraft] = useState(readDraft);
  const [saveStatus, setSaveStatus] = useState('Autosave on');
  const [user, setUser] = useState(null);
  const [cloudStatus, setCloudStatus] = useState(supabaseConfigured ? 'Sign in to sync' : 'Local only');
  const [cloudError, setCloudError] = useState('');
  const currentDraft = useRef(draft);
  const persistTimer = useRef(null);
  const loadVersion = useRef(0);
  const mounted = useRef(true);
  const persist = useCallback(next => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    setSaveStatus('Saving locally');
    persistTimer.current = setTimeout(() => {
      const saved = writePreference(key, next);
      persistTimer.current = null;
      setSaveStatus(saved ? 'Saved locally' : 'Autosave unavailable');
    }, 250);
  }, [key]);
  const flush = useCallback(() => {
    if (persistTimer.current) {
      clearTimeout(persistTimer.current);
      persistTimer.current = null;
    }
    writePreference(key, currentDraft.current);
  }, [key]);

  const loadCloudDraft = useCallback(async sessionUser => {
    if (!supabase || !sessionUser) return;
    const requestVersion = ++loadVersion.current;
    setCloudStatus('Loading cloud draft…');
    setCloudError('');
    try {
      const { data, error } = await supabase
        .from('practice_drafts')
        .select('code, stdin, starter_signature, updated_at')
        .eq('bank', bank)
        .eq('task_id', String(task.id))
        .maybeSingle();
      if (!mounted.current || requestVersion !== loadVersion.current) return;
      if (error) {
        setCloudStatus('Cloud unavailable');
        setCloudError(error.message);
        return;
      }
      if (data && data.starter_signature === starter && typeof data.code === 'string') {
        const next = { code: data.code, stdin: typeof data.stdin === 'string' ? data.stdin : '', starter };
        currentDraft.current = next;
        setDraft(next);
        writePreference(key, next);
        setCloudStatus('Synced from cloud');
      } else {
        setCloudStatus('Cloud sync ready');
      }
    } catch (error) {
      if (!mounted.current || requestVersion !== loadVersion.current) return;
      setCloudStatus('Cloud unavailable');
      setCloudError(error instanceof Error ? error.message : 'Unable to load the cloud draft.');
    }
  }, [bank, key, starter, task.id]);

  useEffect(() => {
    mounted.current = true;
    if (!supabase) return () => { mounted.current = false; };
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setCloudError(error.message);
      const sessionUser = data.session?.user || null;
      setUser(sessionUser);
    }).catch(error => {
      if (active) setCloudError(error instanceof Error ? error.message : 'Unable to read the current session.');
    });
    const { data: auth } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user || null;
      setUser(sessionUser);
    });
    return () => {
      active = false;
      mounted.current = false;
      ++loadVersion.current;
      auth.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (persistTimer.current) {
      clearTimeout(persistTimer.current);
      persistTimer.current = null;
    }
    ++loadVersion.current;
    const next = readDraft();
    currentDraft.current = next;
    setDraft(next);
    setSaveStatus('Autosave on');
    setCloudError('');
    if (user) loadCloudDraft(user);
    else setCloudStatus(supabaseConfigured ? 'Sign in to sync' : 'Local only');
  }, [loadCloudDraft, readDraft, user]);

  useEffect(() => {
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [flush]);

  const update = useCallback(patch => {
    const next = { ...currentDraft.current, ...patch, starter };
    currentDraft.current = next;
    setDraft(next);
    persist(next);
  }, [persist, starter]);
  const setCode = useCallback(code => update({ code }), [update]);
  const setStdin = useCallback(stdin => update({ stdin }), [update]);
  const signIn = useCallback(async (email, password) => {
    if (!supabase) return { error: new Error('Supabase is not configured.') };
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) setCloudError(result.error.message);
    return result;
  }, []);
  const signUp = useCallback(async (email, password) => {
    if (!supabase) return { error: new Error('Supabase is not configured.') };
    const result = await supabase.auth.signUp({ email, password });
    if (result.error) setCloudError(result.error.message);
    return result;
  }, []);
  const signOut = useCallback(async () => {
    if (!supabase) return { error: new Error('Supabase is not configured.') };
    const result = await supabase.auth.signOut();
    if (!result.error) {
      ++loadVersion.current;
      if (persistTimer.current) {
        clearTimeout(persistTimer.current);
        persistTimer.current = null;
      }
      clearLocalDrafts();
      const reset = { code: task.starter, stdin: '', starter };
      currentDraft.current = reset;
      setDraft(reset);
      setUser(null);
      setCloudStatus('Sign in to sync');
      setCloudError('');
      setSaveStatus('Local drafts cleared');
    }
    return result;
  }, [starter, task.starter]);
  const saveToCloud = useCallback(async () => {
    if (!supabase || !user) {
      const error = new Error('Sign in before submitting a task.');
      setCloudError(error.message);
      return { error };
    }
    setCloudStatus('Submitting to cloud…');
    setCloudError('');
    try {
      const { error } = await supabase.from('practice_drafts').upsert({
        user_id: user.id,
        bank,
        task_id: String(task.id),
        starter_signature: starter,
        code: currentDraft.current.code,
        stdin: currentDraft.current.stdin || '',
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,bank,task_id' });
      if (error) {
        setCloudStatus('Cloud submit failed');
        setCloudError(error.message);
      } else {
        setCloudStatus('Submitted to cloud');
      }
      return { error };
    } catch (error) {
      const failure = error instanceof Error ? error : new Error('Unable to save the draft to the cloud.');
      setCloudStatus('Cloud submit failed');
      setCloudError(failure.message);
      return { error: failure };
    }
  }, [bank, starter, task.id, user]);
  return {
    code: draft.code,
    stdin: draft.stdin,
    setCode,
    setStdin,
    saveStatus,
    user,
    cloudEnabled: supabaseConfigured,
    cloudStatus,
    cloudError,
    signIn,
    signUp,
    signOut,
    saveToCloud
  };
}
