import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
mkdirSync('../entrega',{recursive:true});
const result=spawnSync('python3',['-c',`
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root=Path('.')
excluded={'node_modules','.next','.git','backups','.agents','.codex'}
with ZipFile('../entrega/AeroReserva_Evaluacion_3.zip','w',ZIP_DEFLATED) as out:
 for path in sorted(root.rglob('*')):
  if not path.is_file() or any(p in excluded for p in path.parts): continue
  if path.name.startswith('.env') and path.name!='.env.example': continue
  if path.name in {'.DS_Store','tsconfig.tsbuildinfo'} or path.suffix=='.log': continue
  out.write(path,Path('aeroreserva')/path)
 print('Entrega creada: ../entrega/AeroReserva_Evaluacion_3.zip')
`],{stdio:'inherit'});
process.exit(result.status??1);
