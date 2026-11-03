"""Run a local Docker scanner and export genuine SonarQube evidence.

Requires an isolated server on 127.0.0.1:9000, both native Jest LCOVs,
and the official scanner image. No GitHub or cloud access is performed.
Local administrative credentials stay only in excluded .part3-tmp.
"""
import argparse
import base64
import datetime
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess
import time
import urllib.parse
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
PROJECT = 'study-platform-nfr005-local'
HOST = 'http://127.0.0.1:9000'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--evidence', required=True)
    parser.add_argument('--export-only', action='store_true')
    args = parser.parse_args()
    evidence = (ROOT / args.evidence).resolve()
    evidence.relative_to(ROOT)
    evidence.mkdir(parents=True, exist_ok=True)
    runtime = ROOT / '.part3-tmp'
    runtime.mkdir(exist_ok=True)
    credential = runtime / 'nfr005-admin.secret'
    password = credential.read_text() if credential.exists() else 'admin'

    def api(path, params=None, post=False, authenticated=True):
        query = urllib.parse.urlencode(params or {})
        url = HOST + path + (('?' + query) if query and not post else '')
        request = urllib.request.Request(url, data=query.encode() if post else None)
        if authenticated:
            auth = base64.b64encode(('admin:' + password).encode()).decode()
            request.add_header('Authorization', 'Basic ' + auth)
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                content = response.read().decode()
        except urllib.error.HTTPError as error:
            raise RuntimeError(f'{path}: HTTP {error.code}: {error.read().decode()}') from None
        return json.loads(content) if content else {}

    def save(name, value):
        (evidence / name).write_text(json.dumps(value, indent=2), encoding='utf-8')

    deadline = time.monotonic() + 300
    while True:
        try:
            status = api('/api/system/status', authenticated=False)
            if status.get('status') == 'UP':
                break
        except Exception:
            pass
        if time.monotonic() >= deadline:
            raise RuntimeError('SonarQube did not become UP in 300 seconds')
        time.sleep(5)
    save('sonar-system-status.json', status)
    if password == 'admin':
        replacement = secrets.token_urlsafe(32) + 'aA1!'
        api('/api/users/change_password', {'login': 'admin', 'previousPassword': password,
                                         'password': replacement}, post=True)
        credential.write_text(replacement)
        password = replacement
    if not api('/api/projects/search', {'projects': PROJECT}).get('components'):
        api('/api/projects/create', {'project': PROJECT, 'name': 'Study Platform NFR005 Local',
                                     'visibility': 'private'}, post=True)

    mapping = []
    for workspace in ['server', 'client']:
        native = ROOT / workspace / 'coverage/lcov.info'
        original = native.read_text(encoding='utf-8')
        rewritten = []
        for line in original.splitlines():
            if line.startswith('SF:'):
                source = line[3:].replace('\\', '/')
                if source.startswith('src/'):
                    source = workspace + '/' + source
                elif Path(source).is_absolute():
                    source = Path(source).relative_to(ROOT).as_posix()
                if not (ROOT / source).is_file():
                    raise RuntimeError('Unresolvable LCOV source: ' + source)
                mapping.append({'workspace': workspace, 'original': line[3:], 'normalized': source})
                line = 'SF:' + source
            rewritten.append(line)
        normalized = '\n'.join(rewritten) + '\n'
        # Check that only source-path metadata changes, never coverage counters.
        assert [s for s in original.splitlines() if not s.startswith('SF:')] == [
            s for s in normalized.splitlines() if not s.startswith('SF:')]
        (evidence / (workspace + '-lcov-sonar.info')).write_text(normalized, encoding='utf-8')
    save('lcov-source-mapping.json', mapping)
    token_name = 'nfr005-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    token = api('/api/user_tokens/generate', {'name': token_name}, post=True)['token']
    scanner_image = ('sonarsource/sonar-scanner-cli@sha256:'
                     '47956b669bf486bdad919e1cbd0533223515aa0b6d1d31763e5a3754942df6d7')
    scanner_command = ['docker', 'run', '--rm', '--network', 'host',
                       '-e', 'SONAR_TOKEN', '-e', 'SONAR_HOST_URL',
                       '-v', str(ROOT) + ':/usr/src:ro', scanner_image,
                       '-Dsonar.working.directory=/tmp/nfr005-scannerwork',
                       '-Dsonar.javascript.lcov.reportPaths=' + ','.join(
                           evidence.relative_to(ROOT).as_posix() + '/' + w + '-lcov-sonar.info'
                           for w in ['server', 'client'])]
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    try:
        env = {**os.environ, 'SONAR_TOKEN': token, 'SONAR_HOST_URL': HOST}
        # Docker Desktop host networking may not be enabled; host.docker.internal
        # reaches the localhost-published port from the scanner container.
        env['SONAR_HOST_URL'] = 'http://host.docker.internal:9000'
        scanner_command.remove('--network')
        scanner_command.remove('host')
        if not args.export_only:
            run = subprocess.run(scanner_command, cwd=ROOT, env=env, capture_output=True,
                                 text=True, encoding='utf-8', errors='replace', timeout=900)
            log = (run.stdout + '\n' + run.stderr).replace(token, '[REDACTED]')
            (evidence / 'sonar-scanner.log').write_text(log, encoding='utf-8')
            save('sonar-execution.json', {'command': scanner_command, 'startedUtc': started,
                 'endedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                 'exitCode': run.returncode, 'projectKey': PROJECT,
                 'nativeLcovSha256': {w: hashlib.sha256((ROOT / w / 'coverage/lcov.info').read_bytes()).hexdigest()
                                      for w in ['server', 'client']}})
        # Export gate and findings even when the scanner exits nonzero for a failed gate.
        exports = {
            'sonar-quality-gate.json': ('/api/qualitygates/project_status', {'projectKey': PROJECT}),
            'sonar-quality-gate-definition.json': ('/api/qualitygates/get_by_project', {'project': PROJECT}),
            'sonar-quality-gate-conditions.json': ('/api/qualitygates/show', {'name': 'Sonar way'}),
            'sonar-measures.json': ('/api/measures/component', {'component': PROJECT,
                'metricKeys': 'coverage,line_coverage,branch_coverage,lines_to_cover,uncovered_lines,conditions_to_cover,uncovered_conditions,bugs,vulnerabilities,code_smells,security_hotspots,reliability_rating,security_rating,sqale_rating,duplicated_lines_density'}),
            'sonar-analyses.json': ('/api/project_analyses/search', {'project': PROJECT}),
            'sonar-compute-tasks.json': ('/api/ce/component', {'component': PROJECT}),
            'sonar-quality-profiles.json': ('/api/qualityprofiles/search', {'project': PROJECT}),
        }
        for name, (path, params) in exports.items():
            try:
                save(name, api(path, params))
            except Exception as error:
                save(name, {'error': str(error)})
        for name, path, key, params in [
            ('sonar-issues.json', '/api/issues/search', 'issues', {'componentKeys': PROJECT, 'resolved': 'false'}),
            ('sonar-hotspots.json', '/api/hotspots/search', 'hotspots', {'project': PROJECT}),
            ('sonar-file-measures.json', '/api/measures/component_tree', 'components',
             {'component': PROJECT, 'qualifiers': 'FIL', 'metricKeys': 'line_coverage,lines_to_cover,uncovered_lines,coverage'}),
        ]:
            items = []
            page = 1
            while True:
                data = api(path, {**params, 'p': page, 'ps': 100})
                items.extend(data.get(key, []))
                total = data.get('paging', {}).get('total', data.get('total', len(items)))
                if len(items) >= total or not data.get(key):
                    break
                page += 1
            save(name, {'total': len(items), key: items})
        if not args.export_only:
            print('Scanner exit code:', run.returncode)
        print('Quality gate:', api('/api/qualitygates/project_status', {'projectKey': PROJECT}))
    finally:
        api('/api/user_tokens/revoke', {'name': token_name}, post=True)


if __name__ == '__main__':
    main()
