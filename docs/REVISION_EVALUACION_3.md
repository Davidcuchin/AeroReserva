# Segunda revisión de AeroReserva

Fecha: 1 de octubre de 2026. Solicitud: `intrucciones2.md`.

Se volvieron a leer los dos PDF originales y se contrastaron con implementación, pruebas, documentación y UML. Sus extractos coinciden con `requisitos.txt` y `evaluacion.txt`. También se inspeccionaron las figuras originales de casos de uso, dominio, Strategy, componentes y secuencia.

## Resultado

El prototipo conserva su arquitectura y funciones principales. La revisión encontró diferencias concretas que sí justificaban cambios. Se corrigieron sin modificar el esquema de base de datos ni reemplazar los datos del usuario. Las pruebas crean y eliminan sus propios registros temporales.

| Hallazgo | Corrección | Evidencia |
|---|---|---|
| CU13/PA10 exige cancelación repetible; antes se rechazaba una reserva ya cancelada | Se verifica autorización y se devuelve el estado CANCELADA existente, sin segunda auditoría ni cambios | Regresión fallida antes; ahora verifica una sola auditoría y rechazo a otro alumno |
| Reprogramar sobre un bloqueo omitía filas cuyo bookingId es NULL | La consulta incluye explícitamente bloqueos y excluye solo las ocupaciones de la reserva que se edita | Regresión fallida antes; ahora mensaje comprensible y conservación del horario y de las tres ocupaciones originales |
| CU10 especifica 30 minutos; la interfaz anterior utilizaba 24 horas y un reloj inicial fijo | Anticipación mínima de 30 minutos para solicitarlo; consulta al servidor cada minuto y al recuperar foco; revalidación de titular, estado, tiempo y lectura | Pruebas de límites, cambio de horario, lectura, cancelación y aislamiento entre alumnos |
| Una consulta automática podría renovar indefinidamente la sesión | El endpoint de avisos verifica sesión sin actualizar su última actividad | Prueba HTTP comprueba lastSeen intacto y rechazo tras 31 minutos, en desarrollo y producción |
| Un vuelo que termina a medianoche se mostraba también al día siguiente | Filtrado por intersección de intervalos [inicio, fin), con límites locales de Santiago | Pruebas de medianoche y cambios de horario de verano/invierno |
| UML de entrega agrupaba 17 casos en ocho y mezclaba componentes lógicos con tecnología | Vista CU01–CU17, include/extend, generalizaciones y siete componentes del informe; adaptación del dominio explicada | Validación estructural del archivo Draw.io; generador reproducible incluido |
| El diálogo no tenía nombre accesible asociado a su título | aria-labelledby con identificador propio | Inspección del navegador reconoce el diálogo «Planifica tu próximo vuelo» |

En el defecto de bloqueo, PostgreSQL ya impedía el solapamiento: el fallo estaba en la detección previa y el mensaje, no en una doble reserva persistida.

## Pruebas ejecutadas

- 8 pruebas unitarias de reglas, calendario, zonas horarias y exportación.
- 16 escenarios de integración con PostgreSQL real: permisos, concurrencia, idempotencia, auditoría, conservación transaccional y avisos.
- 7 escenarios HTTP de autenticación y seguridad, ejecutados contra desarrollo y repetidos contra la compilación de producción.
- Total de escenarios distintos: **31 aprobados**. Node informa **33 resultados** al incluir las dos pruebas contenedoras; repetir HTTP en producción no añade escenarios distintos.
- TypeScript, ESLint, formato y compilación de producción aprobados.
- Navegador: acceso como alumno, campana con ventana de 30 minutos, formulario con nombre accesible y cierre de sesión. Inspección visual del diálogo en vista estrecha. El recorrido completo de creación/cancelación de la entrega inicial permanece registrado en `evidencias/NAVEGADOR.md`.

Las salidas actuales están en `evidencias/revision2/`. `regresiones-antes.txt` conserva deliberadamente los dos fallos reproducidos antes de aplicar las correcciones; no es el resultado final. La validación UML comprueba XML, identificadores, referencias, número de casos y tipos/dirección de relaciones; no constituye una exportación visual realizada por Draw.io.

Durante la implementación, una prueba HTTP detectó que la inicialización diferida de Auth.js devuelve una promesa para el adaptador de ruta en esta versión. Se corrigió esperando su resolución; las pruebas HTTP posteriores y la compilación de producción aprobaron.

## Coherencia con los documentos

Los 17 casos de uso se corresponden con acceso, agenda, creación propia/administrativa, validación, persistencia, observación, recordatorio, exportación, reprogramación, cancelación, gestión de usuarios/habilitaciones, aeronaves/bloqueos, disponibilidad e historial. Strategy mantiene las variantes de alumno y administración; el instructor conserva los permisos administrativos exigidos por el informe.

La reserva sigue ocupando tres recursos y las modificaciones de agenda se validan y auditan en una transacción. El bloqueo global en vez de bloqueos por recurso es una adaptación conservadora documentada, que reduce paralelismo. Resource representa la abstracción común mediante asociaciones uno a uno y XOR, en lugar de herencia ORM. Los siete componentes son responsabilidades del monolito, no siete servicios desplegados.

Los avisos son internos: la aplicación debe estar abierta y la sesión vigente. La actualización ocurre cada minuto, sujeta a la planificación del navegador; no se promete entrega exacta al segundo ni con la pestaña suspendida. Se consultan después de la confirmación, de modo que un fallo del endpoint de avisos no puede revertir la transacción de reserva. Cancelar o reprogramar modifica la fuente de esos avisos; no hay cola externa que pueda conservar trabajos obsoletos.

La evaluación exige explicar SaaS/IaaS/nube, confiabilidad, ética, seguridad, UML, pruebas y correcciones. Estos puntos se mantienen en `INFORME_EVALUACION_3.md`, con trazabilidad, controles y riesgos pendientes. No se añadieron módulos que el proyecto excluye.

## Límites de la conclusión

No se garantiza una calificación. El PDF de evaluación referencia `Rúbrica_Ev3.xlsx`, que no fue proporcionada; la revisión cubre los criterios escritos de los dos PDF disponibles. La presentación y defensa deben realizarse ante el docente. El video permanece fuera de esta entrega por la instrucción previa del solicitante.

Siguen pendientes las mediciones formales de carga, usabilidad con personas reales, respaldo diario programado, HTTPS público y endurecimiento de producción. Se conserva la evidencia previa de respaldo/restauración, sin presentarla como una operación continua. No se afirma certificación ISO, cumplimiento jurídico integral ni autorización operacional de vuelo. Estos límites ya estaban documentados y no justifican ampliar innecesariamente el prototipo académico.
