export const JUDGE0_URL = 'https://ce.judge0.com';
export const JAVA_LANGUAGE_ID = 91;

// One deadline covers POST, GET polling and response bodies. Never retry POST:
// a lost response does not mean that no submission was created remotely.
export async function executeJava(sourceCode, stdin = '', {
  signal, onStatus, timeoutMs = 45000, pollIntervalMs = 1000,
} = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new RangeError('timeoutMs must be greater than zero.');
  if (!Number.isFinite(pollIntervalMs) || pollIntervalMs < 0) throw new RangeError('pollIntervalMs cannot be negative.');
  if (!sourceCode.trim()) throw new Error('Enter Java code before running.');
  if (sourceCode.length > 100_000) throw new Error('Java source is too large to submit.');
  if (typeof stdin !== 'string' || stdin.length > 100_000) throw new Error('Standard input is too large to submit.');
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  signal?.addEventListener('abort', cancel, { once: true });
  const deadline = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);

  async function request(path, options) {
    const response = await fetch(`${JUDGE0_URL}${path}`, {
      ...options, signal: controller.signal, credentials: 'omit',
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { /* Non-JSON HTTP errors are handled below. */ }
    if (!response.ok) {
      let message;
      if (response.status === 429) {
        const retry = response.headers.get('Retry-After');
        message = `Judge0 rate limit reached (HTTP 429). ${retry ? `Retry-After: ${retry}.` : 'Wait before trying again.'}`;
      } else if (response.status === 401 || response.status === 403) {
        message = `Judge0 denied access (HTTP ${response.status}). This endpoint may require authentication or block browser submissions.`;
      } else {
        const detail = data?.error || data?.message || (data && JSON.stringify(data));
        message = `Judge0 request failed (HTTP ${response.status}).${detail ? ` ${String(detail).slice(0, 800)}` : ' Please try again later.'}`;
      }
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    if (!data || typeof data !== 'object') throw new Error('Judge0 returned an invalid JSON response.');
    return data;
  }

  function pause() {
    return new Promise((resolve, reject) => {
      const aborted = () => {
        clearTimeout(timer);
        reject(new DOMException('Execution request cancelled.', 'AbortError'));
      };
      const timer = setTimeout(() => {
        controller.signal.removeEventListener('abort', aborted);
        resolve();
      }, pollIntervalMs);
      if (controller.signal.aborted) aborted();
      else controller.signal.addEventListener('abort', aborted, { once: true });
    });
  }

  try {
    onStatus?.({ description: 'Submitting...' });
    const submission = await request('/submissions?base64_encoded=false', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_code: sourceCode, language_id: JAVA_LANGUAGE_ID, stdin }),
    });
    if (typeof submission.token !== 'string' || !submission.token) throw new Error('Judge0 did not return a submission token.');
    const fields = 'stdout,stderr,compile_output,message,status,time,memory,exit_code,exit_signal';
    while (true) {
      const result = await request(`/submissions/${encodeURIComponent(submission.token)}?base64_encoded=false&fields=${fields}`);
      if (!Number.isInteger(result.status?.id) || result.status.id < 1) throw new Error('Judge0 returned an invalid execution status.');
      onStatus?.(result.status);
      if (result.status.id > 2) return { ...result, token: submission.token };
      await pause();
    }
  } catch (error) {
    if (timedOut) throw new Error('Judge0 execution timed out. The submission may still finish remotely; no result was received before the deadline.');
    if (controller.signal.aborted) throw new DOMException('Execution request cancelled.', 'AbortError');
    if (error instanceof TypeError) throw new Error('Cannot reach Judge0. Check your connection; the provider may be unavailable or blocking browser requests (CORS). Browsers do not reveal which network restriction caused this error.');
    throw error;
  } finally {
    clearTimeout(deadline);
    signal?.removeEventListener('abort', cancel);
  }
}
