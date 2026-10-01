import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
if(existsSync('.env')){console.log('.env ya existe; se conserva.');}else{
 const password=randomBytes(18).toString('hex');
 writeFileSync('.env',`POSTGRES_PASSWORD=${password}\nDATABASE_URL=postgresql://aeroreserva:${password}@127.0.0.1:5432/aeroreserva?schema=public\nAUTH_SECRET=${randomBytes(32).toString('hex')}\nAUTH_URL=http://127.0.0.1:3000\nAUTH_TRUST_HOST=true\nDEMO_PASSWORD=VueloSeguro2026!\n`,{mode:0o600});
 console.log('Entorno local creado con secretos aleatorios.');
}
