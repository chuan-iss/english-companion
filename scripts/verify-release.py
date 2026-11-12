"""Verify the distributable and stage its own runtime for a dependency check."""
import json
from pathlib import Path
import zipfile

root=Path(__file__).resolve().parent.parent
version=json.loads((root/'package.json').read_text(encoding='utf-8'))['version']
target=root/'dist'/f'EnglishCompanion-{version}-win-x64.zip'
stage=root/'.runtime'/'package-check'
with zipfile.ZipFile(target) as z:
    names=z.namelist()
    forbidden={'.runtime','.git','.codex','auth.json','settings.json'}
    assert all(not forbidden.intersection(Path(n).parts) for n in names)
    for file in ['Start.vbs','app/main.cjs','extension/manifest.json','node_modules/electron/dist/electron.exe','runtime/codex/bin/codex.exe','licenses/CODEX-LICENSE.txt']:
        assert 'EnglishCompanion/'+file in names,file
    assert json.loads(z.read('EnglishCompanion/package.json'))['version']==version
    assert json.loads(z.read('EnglishCompanion/extension/manifest.json'))['version']==version
    assert json.loads(z.read('EnglishCompanion/release.json'))['version']==version
    for name in names:
        if name.startswith(('EnglishCompanion/app/','EnglishCompanion/runtime/codex/')):
            z.extract(name,stage)
print(json.dumps({'version':version,'entries':len(names),'noUserData':True,'bundledCodex':str(stage/'EnglishCompanion/runtime/codex/bin/codex.exe')},ensure_ascii=False))
