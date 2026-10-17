// Read-only smoke test for an already running local starter; creates/deletes no data.
async function main() {
  const api = process.argv[2] || 'http://127.0.0.1:3000';
  const web = process.argv[3] || 'http://localhost:5173';
  const health = await fetch(`${api}/api/v1/health`, { signal: AbortSignal.timeout(10000) });
  const data = await health.json();
  if (!health.ok || data.status !== 'ok' || data.checks?.database !== 'connected') throw new Error('API/database readiness check failed.');
  if (!health.headers.get('x-request-id')) throw new Error('Missing request ID.');
  const missing = await fetch(`${api}/api/v1/__foundation_missing`, { signal: AbortSignal.timeout(10000) });
  const envelope = await missing.json();
  if (missing.status !== 404 || envelope.error?.code !== 'NOT_FOUND' || !envelope.error?.requestId) throw new Error('Error contract check failed.');
  const frontend = await fetch(web, { signal: AbortSignal.timeout(10000) });
  if (!frontend.ok || !(await frontend.text()).includes('id="root"')) throw new Error('Frontend document check failed.');
  console.log('PASS: API/DB readiness, request ID, error envelope and frontend HTML.');
  console.log('This does not test completed domain features or replace a browser acceptance test.');
}
main().catch(() => { console.error('Smoke check failed. Confirm app, database and target URLs; secret values are not printed.'); process.exitCode = 1; });
