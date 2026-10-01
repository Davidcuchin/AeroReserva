# Comprobación manual en navegador

Fecha local: 30 de septiembre de 2026; sesión de desarrollo de la entrega del 1 de octubre.

Se utilizó el navegador integrado, con interacción real sobre la aplicación en `http://127.0.0.1:3000`.

1. Pantalla de acceso: etiquetas, contraseña oculta y botón de mostrar/ocultar presentes. Diseño revisado visualmente.
2. Acceso del alumno de demostración correcto. No aparecen opciones administrativas. La agenda muestra nombres únicamente en reservas propias y “Vuelo reservado” en reservas ajenas.
3. Formulario: selección de Cessna 172S CC-KDA y Cristian Lizama; alumno propio preseleccionado. Inicio 1 de octubre de 2026 12:00, término 13:00, nota de prueba.
4. Confirmación: mensaje “Tu reserva está confirmada.” y aumento de 3 a 4 próximos vuelos.
5. Mis reservas: nueva fila con fecha, intervalo, instructor, alumno y estado Confirmada, leída después de la respuesta del servidor.
6. Cancelación: motivo “Cierre de la prueba de aceptación en navegador.”, confirmación y mensaje “Reserva cancelada. Los recursos ya están disponibles.” El contador vuelve a 3. El registro permanece como cancelado para trazabilidad.
7. Cierre de sesión mediante el botón de cuenta: redirección al acceso.
8. Vista de escritorio revisada por captura. Vista móvil 390 × 844 revisada por captura; sin desbordamiento de documento y menú móvil accesible.

Se conservó la reserva de prueba cancelada en la base de demostración. Las pruebas HTTP automatizadas complementan esta revisión con acceso incorrecto, cuenta inactiva, límite de intentos, CSRF, exportación privada, cierre de sesión y expiración por inactividad. Esto no sustituye una prueba de usabilidad con usuarios reales ni una auditoría integral de accesibilidad.
