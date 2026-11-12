"""Build portable Windows artifacts from an explicit allowlist, never user data."""
import hashlib
import json
import os
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent.parent
VERSION = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
OUT = ROOT / 'dist'
PREFIX = 'EnglishCompanion/'

def release_files():
    files = {}
    for folder in ('app', 'extension', 'licenses'):
        for path in sorted((ROOT / folder).rglob('*')):
            if path.is_file():
                files[path.relative_to(ROOT).as_posix()] = path
    for name in ('package.json', 'Start.vbs', 'Quicker-Capture.vbs', 'README.md', 'RELEASE-GUIDE.md'):
        files[name] = ROOT / name
    return files

def bundle_files():
    files = release_files()
    electron = ROOT / 'node_modules/electron/dist'
    if not (electron / 'electron.exe').is_file():
        raise RuntimeError('Electron runtime is missing; install it before packaging.')
    for path in electron.rglob('*'):
        if path.is_file(): files['node_modules/electron/dist/' + path.relative_to(electron).as_posix()] = path
    codex = Path(os.environ.get('APPDATA', '')) / 'npm/node_modules/@openai/codex/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc'
    if not (codex / 'bin/codex.exe').is_file():
        raise RuntimeError('Expected Codex Windows x64 runtime is missing.')
    for path in codex.rglob('*'):
        if path.is_file(): files['runtime/codex/' + path.relative_to(codex).as_posix()] = path
    return files

def write_zip(name, files):
    target = OUT / name
    for name, path in files.items():
        if any(part in ('.runtime', '.git', '.codex', '__pycache__') for part in Path(name).parts):
            raise RuntimeError('Forbidden release path: ' + name)
        if not path.is_file(): raise RuntimeError('Missing release file: ' + str(path))
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED, compresslevel=5) as z:
        for name, path in sorted(files.items()): z.write(path, PREFIX + name)
        z.writestr(PREFIX + 'release.json', json.dumps({'version': VERSION, 'platform': 'win32-x64', 'electron': '45.2.3', 'codex': '0.148.0', 'updateMode': 'manual'}, indent=2))
    with zipfile.ZipFile(target) as z:
        if z.testzip(): raise RuntimeError('ZIP integrity failure')
    digest = hashlib.file_digest(target.open('rb'), 'sha256').hexdigest()
    (OUT / (target.name + '.sha256')).write_text(digest + '  ' + target.name + '\n', encoding='utf-8')
    print(json.dumps({'file': str(target), 'bytes': target.stat().st_size, 'sha256': digest, 'entries': len(files)}, ensure_ascii=False), flush=True)

if __name__ == '__main__':
    OUT.mkdir(exist_ok=True)
    for required in ('CODEX-LICENSE.txt', 'CODEX-NOTICE.txt', 'THIRD-PARTY.txt'):
        if not (ROOT / 'licenses' / required).is_file(): raise RuntimeError('Missing license: ' + required)
    write_zip(f'EnglishCompanion-{VERSION}-update.zip', release_files())
    write_zip(f'EnglishCompanion-{VERSION}-win-x64.zip', bundle_files())
