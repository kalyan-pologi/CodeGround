const javaSampleOutput = {
  1: '20.00', 2: '3145728', 3: '{api=[east]}', 4: '85.00',
  5: '{1=Customer[id=1, revision=1, name=Ada], 2=Customer[id=2, revision=2, name=Lin A]}',
  6: '{x-id=[1, 2]}', 7: '[a, c]', 8: '[1, 2, 3]', 9: '{Ada=150, Lin=80}',
  10: '{a@example.com=2}', 11: '{b=2.50}', 12: '{A=5, B=1}',
  13: '{host=localhost, port=8080, token=a=b}', 14: 'complete report',
  15: '2025-01-15T17:00:00Z', 16: 'true\nfalse\n2', 17: 'loaded',
  18: 'Ada:approved', 19: 'B\nnull', 20: 'event\n0', 22: '[email, name]'
};
export function sampleChecksFor(task, kind = 'task') {
  if (task.runtime === 'project') return [];
  const expected = kind === 'challenge' ? javaSampleOutput[task.id] : task.expected;
  return typeof expected === 'string' ? [{ name: 'Starter main() sample', stdin: '', expected }] : [];
}
// Ignore line ending differences and a trailing newline; preserve meaningful spaces.
export const normalizeOutput = output => (output || '').replace(/\r\n?/g, '\n').replace(/\n+$/, '');
export function assessSample(result, sample) {
  return result.status?.id === 3 && (result.exit_code == null || result.exit_code === 0)
    && normalizeOutput(result.stdout) === normalizeOutput(sample.expected);
}
