# AeroReserva

Prototipo funcional de reservas de vuelos de instrucción para un club aéreo, basado en `AeroReserva_informe.pdf` y la Evaluación 3 de Ingeniería de Software. Incluye implementación, pruebas y documentación; el video está excluido por instrucción del usuario.

## Inicio rápido

Requisitos: Node.js 22 o superior compatible con Next.js 16, npm y Docker Desktop iniciado. No necesitas instalar PostgreSQL en el equipo.

```sh
npm ci
npm run setup
npm run dev
```

Abre **http://127.0.0.1:3000**. `setup` genera `.env` con secretos locales aleatorios, inicia PostgreSQL 17 en Docker, aplica migraciones y crea datos de demostración. El archivo `.env` existente nunca se sobrescribe.

| Perfil | Correo | Contraseña de demostración |
|---|---|---|
| Administrador | admin@aeroreserva.cl | VueloSeguro2026! |
| Instructor | instructor@aeroreserva.cl | VueloSeguro2026! |
| Alumno | alumno@aeroreserva.cl | VueloSeguro2026! |

Los datos de muestra son ficticios y destinados a la evaluación. La contraseña se obtiene de `DEMO_PASSWORD` al crear cuentas por primera vez. Ejecutar el seed de nuevo no cambia contraseñas ni borra datos. Antes de exponer la aplicación, sustituye las cuentas de demostración y configura HTTPS.

La instrucción original “puerto 27.0.0.1” se interpretó como dirección local **127.0.0.1**. El puerto de PostgreSQL es **5432**, accesible únicamente desde el equipo anfitrión. Docker conserva datos en el volumen `aeroreserva_data`; `docker compose down` no los elimina.

## Funciones

- Auth.js con correo y contraseña, Argon2id, sesiones revocables, expiración y limitación de intentos.
- Roles ALUMNO, INSTRUCTOR y ADMINISTRADOR. El instructor incluye permisos administrativos.
- Agenda diaria/semanal y filtros por aeronave, instructor y vuelos propios; ocupación pública con datos privados protegidos.
- Crear, reprogramar y cancelar reservas. Valida habilitaciones, disponibilidad y recursos sin superposición.
- Administración de personas, roles, estado, contraseñas, aeronaves, habilitaciones y bloqueos.
- Cada instructor declara y modifica su propia disponibilidad.
- Historial auditable con actor, instante, motivo y valores anteriores/nuevos.
- Observaciones, recordatorios dentro de la aplicación y exportación `.ics`.
- Interfaz adaptable a móviles, navegación por teclado y animaciones que respetan movimiento reducido.

## Comprobaciones

Con la base iniciada:

```sh
npm test
npm run test:integration
npm run typecheck
npm run lint
npm run build
```

Con la aplicación ejecutándose en otra terminal:

```sh
npm run test:http
```

`test:integration` usa transacciones reales e incluye dos clientes Prisma independientes para verificar la exclusión de PostgreSQL. Crea registros con prefijo temporal y elimina únicamente esos registros. `test:http` crea una cuenta efímera y prueba el flujo real de Auth.js. No uses estas pruebas contra una base de producción.

La ruta usada por `test:http` se puede cambiar con `TEST_BASE_URL`. Los resultados de la ejecución están en `docs/evidencias/`.

## Organización

| Carpeta / archivo | Responsabilidad |
|---|---|
| `app/` | Páginas, Server Actions y rutas Auth.js / iCalendar |
| `components/` | Interfaz de acceso y plataforma |
| `auth.ts` | Autenticación, limitación y revocación de sesiones |
| `lib/rules.ts` | Zod, intervalos, zona horaria y políticas Strategy |
| `lib/service.ts` | Transacción de reserva, cancelación y auditoría |
| `lib/admin-service.ts` | Administración y protección de reservas existentes |
| `lib/ical.ts` | Exportación iCalendar y escape de texto |
| `prisma/` | Esquema, migración SQL y seed |
| `tests/` | Pruebas unitarias, de integración y HTTP |
| `docs/INFORME_EVALUACION_3.md` | Informe, trazabilidad, riesgos y límites |
| `docs/MANUAL.md` | Recorrido de demostración y operación |
| `docs/uml/AeroReserva.drawio` | Diagramas UML editables en Draw.io |

## Arquitectura y decisiones

Monolito modular: Next.js App Router + TypeScript + Tailwind CSS 4; Auth.js v5 beta, Zod y Prisma 6; PostgreSQL 17 en Docker. Se usa la versión de Next.js que ya tenía el proyecto. Las versiones exactas quedan en `package-lock.json`.

Todas las mutaciones de agenda y administración adquieren un bloqueo asesor transaccional común. Esto simplifica la coordinación de reservas con cambios de habilitación, roles y disponibilidad. Es una adaptación conservadora del bloqueo por recurso propuesto en el informe: prioriza integridad, pero serializa escrituras. La migración agrega además una exclusión GiST para intervalos `[inicio, fin)` activos, XOR de procedencia y claves foráneas. No basta con ejecutar `prisma db push`: utiliza las migraciones SQL.

La política de autorización se elige por solicitud (`StudentPolicy` / `AdministrativePolicy`). Ningún perfil omite las validaciones comunes. Cancelar conserva la reserva y desactiva ocupaciones y recordatorios; reprogramar conserva el identificador y revierte todo si falla.

Los instantes se almacenan en `timestamptz` y se presentan en `America/Santiago`. Las horas inexistentes se rechazan; las ambiguas requieren elegir su ocurrencia en el formulario. El calendario exportado usa instantes UTC (`Z`), compatibles con la conversión de zona del calendario receptor.

## Respaldo y operación

```sh
npm run backup
sh scripts/restore-check.sh backups/ARCHIVO.dump
```

La restauración de prueba crea y luego elimina una base temporal, sin reemplazar la aplicación. El respaldo diario debe programarse en el entorno de operación; no se ha instalado una tarea automática en tu equipo.

Para ejecutar la versión compilada, detén `dev` y utiliza `npm run build && npm start`. El servidor escucha únicamente en `127.0.0.1` por defecto. Para un despliegue real, configura un proxy HTTPS, `AUTH_URL`, secretos propios y un procedimiento de respaldo y restauración.

## Estado y límites

Los procesos centrales están implementados y verificados. La entrega no afirma certificación ISO, autorización aeronáutica ni validación con un club real. Quedan pendientes de un entorno de producción: HTTPS público, copias programadas, monitorización, política de retención y pruebas con 50 sesiones/10.000 reservas y cinco usuarios reales. La agenda del prototipo carga su conjunto de reservas; se debe paginar por periodo antes de esa escala. El informe de evaluación detalla estos límites.
