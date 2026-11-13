import { useRef, useState } from 'react';

export default function CloudSaveControls({ draft, onSubmit, onSignedOut, compact = false }) {
  const control = useRef(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  async function authenticate(mode) {
    setBusy(true);
    try {
      const result = mode === 'signup' ? await draft.signUp(email, password) : await draft.signIn(email, password);
      setNotice(result.error ? result.error.message : mode === 'signup' && !result.data?.session ? 'Account created. Check your email if confirmation is enabled.' : 'Signed in successfully.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (!draft.user) {
      control.current?.setAttribute('open', '');
      setNotice('Sign in to submit this work to the cloud.');
      return;
    }
    setBusy(true);
    try {
      const result = await onSubmit();
      setNotice(result?.error ? result.error.message : 'Submitted and saved to the cloud.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Cloud save failed.');
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    setBusy(true);
    try {
      const result = await draft.signOut();
      setNotice(result?.error ? result.error.message : 'Signed out. Local drafts cleared.');
      if (!result?.error) onSignedOut?.();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Sign out failed.');
    } finally {
      setBusy(false);
    }
  }
  return <span className="cloud-save-actions">
    <details className={'cloud-save-control' + (compact ? ' compact' : '')} ref={control}>
      <summary>{draft.user ? 'Cloud synced' : 'Save online'}</summary>
      {!draft.cloudEnabled && <p>Configure Supabase to enable cloud saving.</p>}
      {draft.cloudEnabled && draft.user && <div><p>Signed in as {draft.user.email}</p><button type="button" disabled={busy} onClick={signOut}>Sign out</button></div>}
      {draft.cloudEnabled && !draft.user && <form onSubmit={event => { event.preventDefault(); authenticate('signin'); }}>
        <input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Email" required />
        <input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Password" minLength="6" required />
        <button type="submit" disabled={busy}>{busy ? 'Working…' : 'Sign in'}</button>
        <button type="button" disabled={busy} onClick={() => authenticate('signup')}>Create account</button>
      </form>}
      {(draft.cloudError || notice) && <small role="alert">{draft.cloudError || notice}</small>}
    </details>
    <button className="cloud-submit-button" type="button" disabled={busy} onClick={submit}>Submit &amp; Save</button>
    {notice && <span className="cloud-submit-status" role="status" aria-live="polite">{notice}</span>}
  </span>;
}
