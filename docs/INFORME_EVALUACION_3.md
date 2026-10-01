# AeroReserva — Implementación, pruebas y calidad

**Ingeniería de Software · Evaluación 3 · 1 de octubre de 2026**  
Proyecto de referencia: David González, Cristian Lizama y Javier Gracia.  
Base documental: AeroReserva_informe.pdf y Evaluación N°3 ING_SW.pdf proporcionados en el espacio de trabajo.

## 1. Resultado y alcance

Se implementó un prototipo funcional que coordina vuelos de instrucción entre un alumno, un instructor y una aeronave. El ciclo completo comprende autenticación, consulta de agenda, ingreso de una solicitud, validación, confirmación, consulta posterior, reprogramación y cancelación auditable. No se implementó el video por instrucción explícita del solicitante.

La solución utiliza Next.js 16.3.8 con TypeScript, Tailwind CSS 4, Auth.js, Zod, Prisma ORM 6 y PostgreSQL 17 en Docker. Hay datos de demostración, migraciones reproducibles, scripts de respaldo, manual y pruebas automatizadas. La base tiene persistencia real; no se sustituyó por datos almacenados en el navegador.

Los usuarios creados para la demostración son ejemplos académicos. No se afirma haber entrevistado ni validado requisitos con un club real. La plataforma reserva recursos y no autoriza operacionalmente un vuelo, verifica licencias oficiales ni registra horas efectivamente voladas.

## 2. Correspondencia con la evaluación

| Criterio / actividad | Evidencia entregada |
|---|---|
| 3.1.1 Tendencias tecnológicas | Análisis SaaS, IaaS y nube en sección 3 |
| 3.1.2 Confiabilidad, ética y marco jurídico | Riesgos, alcance profesional y fuentes en sección 4 |
| 3.1.3 Prototipo y buenas prácticas | Aplicación funcional, Auth.js, Argon2id, Zod, permisos en servidor, privacidad y transacciones |
| 3.1.4 UML y consistencia | Cinco páginas editables de Draw.io; correspondencia en sección 5 |
| 3.1.5 Correcciones desde pruebas | Evidencia automatizada, registro de ajustes y riesgos pendientes en sección 7 |
| Proceso de inicio a fin | Acceso, creación y cancelación probados desde navegador; reglas y transacciones probadas automáticamente |
| Datos obligatorios e incorrectos | Validación HTML accesible y Zod en servidor; mensajes de dominio para conflictos y vigencias |
| Autor de una operación | Audit con actor, instante, entidad, acción, motivo y valores anteriores/nuevos |
| Explicar lo que falta | Límites explícitos en sección 8, sin declarar metas de producción como medidas |

## 3. SaaS, IaaS y Cloud Computing

AeroReserva puede ofrecerse como **SaaS**: el club usa el servicio mediante navegador y el proveedor mantiene la aplicación. La entrega actual es local y de un solo club; no incluye contratación, multicliente ni facturación SaaS.

En un despliegue **IaaS**, una máquina virtual alojaría Node.js y PostgreSQL o sus contenedores. El equipo tendría responsabilidad sobre parches del sistema, red, HTTPS, secretos, respaldos, monitoreo y recuperación. En una alternativa PaaS o con base administrada, parte de esas tareas se delegaría al proveedor, conservando responsabilidad por acceso y datos.

**Cloud Computing** permite aprovisionar capacidad y servicios de forma remota y elástica. Utilizar Docker facilita reproducir el entorno, pero un contenedor local no constituye por sí solo un despliegue en la nube. Este prototipo emplea un monolito modular para mantener transacciones en una sola base y evitar la complejidad de coordinación entre servicios.

## 4. Confiabilidad, ética y riesgos de información

Una reserva duplicada puede generar pérdida de tiempo y decisiones basadas en información incorrecta. La integridad de agenda es el proceso crítico: consulta e inserción se ejecutan en una transacción y la base rechaza superposiciones activas. La cancelación y la reprogramación mantienen evidencia de los cambios; no se borran reservas para ocultar incidencias.

El enfoque de riesgos se alinea conceptualmente con ISO/IEC 27001:2022; ISO/IEC 27002:2022 orienta la selección de controles. Aplicar controles técnicos no equivale a certificar un sistema de gestión. La evaluación requiere explicar qué riesgo reduce cada medida y reconocer sus límites. [ISO 27001](https://www.iso.org/standard/27001), [ISO 27002](https://www.iso.org/standard/75652.html).

| Riesgo | Control implementado | Verificación | Riesgo residual / operación |
|---|---|---|---|
| Acceso con contraseña expuesta | Argon2id con sal, parámetros 19 MiB / 2 iteraciones / paralelismo 1; campo de contraseña oculto | Login real con contraseña correcta/incorrecta | Reemplazar credenciales demo; recuperación controlada por administración |
| Fuerza bruta | Ventana persistida en PostgreSQL: máximo 5 intentos por cuenta en 15 minutos | Sexto intento correcto rechazado tras 5 fallos | Un atacante podría bloquear una cuenta temporalmente; no hay límite por IP ni MFA |
| Reutilizar sesión cerrada | Sesión Auth.js con registro revocable en base; 30 min de inactividad y 8 h absolutas | Repetir cookie antigua tras signout devuelve 401 | Depende de disponibilidad de PostgreSQL; requiere HTTPS fuera de localhost |
| Cambio ajeno de reserva | Rol y pertenencia comprobados en servidor, releídos en transacción | Alumno no puede reservar por otro; administración exige motivo | El instructor tiene permisos amplios por requisito del informe |
| Doble asignación | Bloqueo asesor, transacción, exclusión GiST y ocupaciones compartidas para vuelos/bloqueos | Solicitudes simultáneas y dos clientes Prisma independientes | Escrituras serializadas; rendimiento de referencia aún no medido |
| Cambio administrativo que invalida vuelo | Revalidación de vuelos activos/futuros dentro de la misma transacción | Reducir vigencia, desactivar cuenta o retirar disponibilidad se revierte | La calidad de datos depende del registro responsable del club |
| Divulgación en calendario | Proyección de datos según permisos; exportación con misma restricción | Calendario ajeno anonimizado; ICS sin nombres/observaciones ajenos | Debe definirse política de conservación y acceso administrativo |
| Entradas maliciosas | Zod, consultas parametrizadas Prisma, escape React, escape/folding ICS, CSRF Auth.js/Server Actions | Rechazo de campos, CSRF ausente e intento de inyección de líneas ICS | Falta prueba de penetración independiente y CSP con nonces |
| Falta de trazabilidad | Auditoría transaccional sin interfaz de eliminación; hashes y claves no se incluyen en auditoría de cuentas | Alta/cancelación con autor y valores | Un operador con privilegios directos de base podría alterar registros; falta almacenamiento inmutable externo |
| Pérdida de información | Volumen Docker, script pg_dump y ensayo de pg_restore en base temporal | Respaldo restaurado con reservas y auditorías | El respaldo diario automático y su retención están pendientes de operación |

La práctica profesional exige minimizar datos, no divulgar credenciales, respetar autorizaciones y reportar errores de forma honesta. Las pruebas se realizaron exclusivamente en el entorno local autorizado. No se realizaron ataques a servicios de terceros.

Como referencia chilena, la Ley 21.459 regula delitos informáticos. Su consideración motiva controles frente a acceso no autorizado y alteración de datos; el prototipo no constituye una evaluación jurídica ni una declaración de cumplimiento integral. El club debe acordar responsabilidades, acceso, conservación y tratamiento de datos antes de operar. [Texto oficial de la Ley 21.459, BCN](https://www.bcn.cl/leychile/navegar?idNorma=1177743&tipoVersion=0).

## 5. Arquitectura y UML

El archivo `uml/AeroReserva.drawio` contiene cinco vistas editables:

1. **Casos de uso:** alumno, administrador e instructor; herencia de permisos del instructor; operaciones propias y administrativas.
2. **Clases del dominio:** User, LoginSession, Qualification, Aircraft, Resource, Booking, Occupancy, Block, Availability y Audit.
3. **Strategy:** interfaz BookingPolicy, StudentPolicy y AdministrativePolicy; contexto representado por el módulo de servicio.
4. **Componentes:** interfaz, Next.js, identidad, dominio, iCalendar y PostgreSQL.
5. **Secuencia:** validación de sesión, transacción, idempotencia, política, validaciones, inserciones y ramas de commit/rollback.

### Adaptaciones respecto del informe de diseño

- Los nombres de código están en inglés; la interfaz mantiene español. Usuario → User, Reserva → Booking, RecursoAgenda → Resource, Ocupación → Occupancy, Habilitación → Qualification.
- El servicio es un módulo de funciones TypeScript. Las variantes Strategy sí son clases que realizan una interfaz común; se seleccionan por solicitud y no mediante estado global mutable.
- Se reemplazó el bloqueo ordenado por filas de recursos por un **bloqueo asesor transaccional global**, compartido por todas las mutaciones del dominio. Es más conservador y simple para el prototipo; evita carreras de cambios administrativos con reservas, a costa de menor paralelismo. Se conserva la exclusión SQL por recurso como defensa independiente.
- El recordatorio se deriva de la reserva confirmada y su ventana de 24 horas. No crea otra reserva ni depende de un servicio externo. `reminderRead` registra lectura.
- El cierre de sesión añade LoginSession revocable al JWT de Auth.js; así se impide reutilizar una cookie capturada antes de cerrar sesión.
- El historial genérico enlaza por entidad/identificador y conserva valores JSON. Solo se entrega al cliente información permitida por el rol.

## 6. Matriz de trazabilidad

| Requisito | Implementación | Verificación |
|---|---|---|
| RF01 Acceso y permisos | `auth.ts`, `lib/session.ts`, políticas, Server Actions | HTTP: válidas/erróneas/inactivas, CSRF, revocación e inactividad; PA02 |
| RF02 Agenda filtrada | `app/page.tsx`, `components/dashboard.tsx` | Revisión navegador, filtros y privacidad; exportación HTTP |
| RF03 Crear reserva | `saveBooking` + formulario | Creación real desde navegador y pruebas PostgreSQL |
| RF04 Validaciones y conflictos | `interval`, `validateFlight`, Occupancy/GiST | PA04, PA05, PA06; dos clientes SQL |
| RF05 Reprogramar | `saveBooking(..., id)` | PA09 conserva estado ante conflicto |
| RF06 Cancelar | `cancelBooking` | PA10 y cancelación desde navegador |
| RF07 Usuarios y habilitaciones | `administer` | Permisos y PA16 vigencia/estado; formularios administrativos |
| RF08 Aeronaves y bloqueos | `administer`, Resource/Occupancy | PA11; bloqueo incompatible se rechaza |
| RF09 Disponibilidad | `administer`, Availability | PA05 fuera de disponibilidad, PA16 retiro incompatible |
| RF10 Historial | `audit` dentro de transacción | PA12 antes/después; consulta autorizada |
| RF11 Nota y recordatorio | Booking.note/reminder/reminderRead | Límite 500, cancelación desactiva; ventana interna visible |
| RF12 Exportación | `/api/calendar`, `calendarFile` | Escape, UTF-8, fechas UTC, privacidad HTTP |
| RN11 Idempotencia de creación | UNIQUE creador/clave + hash de carga | PA15 doble envío concurrente y clave incompatible |
| RN10 Zona horaria | Temporal, timestamptz, Santiago | Horas inexistentes y ambiguas; offsets explícitos |

## 7. Proceso de pruebas y correcciones

### Entorno y resultados ejecutados

- macOS ARM64, Node.js 26.4.0, PostgreSQL 17 en Docker; pruebas contra `127.0.0.1`.
- `npm test`: **6 pruebas de reglas/exportación**, aprobadas.
- `npm run test:integration`: **11 escenarios de aceptación** y su prueba contenedora, aprobados. Node informa 12 pruebas.
- `npm run test:http`: **6 escenarios HTTP** y su prueba contenedora, aprobados. Node informa 7 pruebas.
- Total: **23 escenarios**, o 25 resultados contando las dos pruebas contenedoras. Se conserva la salida sin inventar porcentajes de cobertura.
- TypeScript, ESLint, validación Prisma y compilación de producción ejecutados satisfactoriamente; las salidas se conservan en `evidencias/`.
- Auditoría de dependencias: se actualizó la dependencia transitiva `deepmerge-ts` a la versión corregida mediante override; el análisis npm final no reportó vulnerabilidades conocidas en esa ejecución. Esto no equivale a ausencia demostrada de todas las vulnerabilidades.
- Respaldo/restauración: se restauraron **7 reservas y 7 entradas de auditoría** del momento del respaldo en una base temporal. No se sobrescribió la base principal.

### Escenarios relevantes

**Concurrencia:** dos solicitudes de distintos alumnos para la misma aeronave e intervalo producen exactamente una confirmación. Una prueba adicional usa dos instancias Prisma independientes y escritura directa de ocupaciones para verificar que la restricción de base de datos funciona sin depender del servicio.

**Atomicidad:** un cambio hacia un intervalo ocupado no modifica horario ni ocupaciones originales. Cancelar desactiva las tres ocupaciones, desactiva el aviso y permite reservar de nuevo.

**Idempotencia:** dos envíos simultáneos con una misma clave y carga devuelven el mismo identificador; variar la carga reutilizando la clave se rechaza.

**Acceso:** se rechazan contraseñas incorrectas, cuentas inactivas, peticiones de autenticación sin CSRF y exportaciones anónimas. Cerrar sesión revoca incluso una copia de la cookie anterior; la inactividad se aplica en el servidor.

**Datos privados:** una cuenta efímera sin participación recibe eventos ocupados en la exportación, sin nombres de participantes ni observaciones.

### Correcciones registradas

| Hallazgo durante desarrollo | Corrección | Evidencia posterior |
|---|---|---|
| Errores de delimitadores en Auth.js y JSX inicial | Corrección de sintaxis y formato con Prettier | TypeScript, ESLint y build aprobados |
| Función de reloj impura durante renderizado | Capturar el instante inicial como estado | ESLint aprobado |
| Test ICS comparaba texto plegado con patrón no plegado | Desplegar continuaciones al verificar contenido, conservando prueba de límite UTF-8 | 6 pruebas unitarias aprobadas |
| Test HTTP asumía objeto para una sesión cerrada | Aceptar respuesta nula documentada por el flujo real | Casos HTTP de cierre e inactividad aprobados |
| Reintento idempotente validaba nuevamente horizonte antes de recuperar resultado | Consultar clave/hash antes de reglas temporales de una nueva reserva | Caso de idempotencia mantiene una única reserva |
| Dependencia transitiva reportada por npm audit | Override `deepmerge-ts >=8` y verificación de Prisma | Esquema y migraciones comprobados; auditoría final sin avisos |
| Acción de cuenta fuera de vista en ventanas bajas | Menú lateral desplazable y bloque auxiliar oculto en baja altura | Botón de cierre accesible en revisión de navegador |
| Resolución de localhost inconsistente durante reinicio de desarrollo | Unificar interfaz, Auth.js y pruebas en 127.0.0.1 | Acceso y formulario de reserva completados |

No se afirmaron como defectos del producto los errores de un oráculo de prueba. Tampoco se presenta una prueba local como sustituto de una revisión independiente de seguridad.

## 8. Pendientes y límites de la entrega

El núcleo del prototipo es funcional. Para una operación real quedan:

- Validación de parámetros de duración/horizonte, permisos del instructor y procesos con el club.
- HTTPS en un entorno público, gestión operacional de secretos, eliminación de usuarios demo y política de recuperación de acceso.
- Respaldo diario programado, retención y ejercicios periódicos. El ensayo realizado no demuestra por sí solo un RPO sostenido de 24 h ni un RTO contractual de 4 h.
- Medir percentiles con 50 sesiones y 10.000 reservas; paginar la consulta de agenda e historial y evaluar bloqueo por recursos si la carga lo exige.
- Prueba de usabilidad con cinco personas reales, incluyendo teclado, dispositivos de asistencia y tareas cronometradas.
- Endurecimiento de despliegue: CSP por nonce, monitorización, alertas, límites por IP, registros inmutables y procedimiento de incidentes.
- Revisión jurídica y de privacidad específica del club. No se declara certificación ISO ni cumplimiento integral automático por usar librerías.

No pertenecen al alcance inicial: registro público, redes sociales, pagos, lista de espera, correo/SMS, meteorología, bitácora de horas voladas ni sincronización bidireccional de calendarios. El video se omitió expresamente.

## 9. Fuentes técnicas

- Documentación Next.js incluida en `node_modules/next/dist/docs/`, revisada para la versión instalada.
- [Auth.js: Credentials](https://authjs.dev/getting-started/authentication/credentials).
- [Prisma ORM 6: transacciones](https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions).
- [PostgreSQL 17: rangos y restricciones de exclusión](https://www.postgresql.org/docs/17/rangetypes.html).
- [OWASP: almacenamiento de contraseñas](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
- [OWASP: autenticación](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html).
- ISO/IEC 27001:2022, ISO/IEC 27002:2022 y Ley 21.459: páginas oficiales enlazadas en sección 4, consultadas para esta entrega.

Los extractos de los dos PDF base se conservan en `requisitos.txt` y `evaluacion.txt` para trazabilidad. Los PDF originales permanecen sin modificar en la carpeta superior.
