# Manual breve y demostración de AeroReserva

## Preparación

Sigue el inicio rápido del README. Mantén Docker abierto y ejecuta la aplicación desde la carpeta `aeroreserva`. Usa `http://127.0.0.1:3000` de forma consistente para que las cookies correspondan al mismo sitio.

## Recorrido de alumno (proceso completo)

1. Ingresa con `alumno@aeroreserva.cl` y la contraseña de demostración.
2. Abre Calendario. Cambia entre Día y Semana, selecciona una fecha y prueba los filtros. Las reservas de otros alumnos muestran ocupación, sin nombres ni observaciones.
3. Pulsa Nueva reserva. Tu cuenta queda como alumno. Selecciona aeronave e instructor.
4. Consulta los horarios del instructor en el desplegable del formulario. El seed crea disponibilidad entre 08:00 y 20:00 para los próximos 31 días.
5. Elige inicio y término futuros, en bloques de 30 minutos y duración de 30 a 180 minutos. No superes 30 días de anticipación.
6. Agrega una observación opcional y, si lo deseas, activa el recordatorio. Confirma: debe aparecer el mensaje y la reserva en la agenda.
7. Vuelve a intentar reservar un tramo superpuesto. El servidor rechaza la operación y explica el conflicto. Puede ser por avión, instructor o alumno.
8. En Mis reservas abre el detalle y cambia a otro horario. El identificador se mantiene. Un cambio fallido conserva el original.
9. Cancela una reserva futura con un motivo de al menos cinco caracteres. El estado pasa a Cancelada; las ocupaciones se liberan y el historial se conserva.
10. Exporta Mis reservas a `.ics`. Abre Historial de actividad y despliega una entrada para comparar sus valores.
11. Pulsa Cerrar sesión. Volver a una ruta protegida exige autenticarse de nuevo.

Si una fecha coincide con el retroceso de reloj y una hora se repite, abre “Si una hora se repite por cambio de horario” y elige la ocurrencia para el inicio y/o término. Si la hora no existe por adelanto del reloj, selecciona otra.

## Administración

- Personas y habilitaciones: crea una cuenta, asigna rol y registra una contraseña inicial de al menos 12 caracteres. Editar permite cambiar estado, rol o contraseña. Un cambio incompatible con vuelos futuros se rechaza.
- Usa el icono de escudo para registrar o actualizar la vigencia de un modelo. Alumno e instructor necesitan habilitación para ese modelo hasta el término del vuelo.
- Aeronaves y bloqueos: crea o modifica matrícula, modelo, plazas y estado. No desactives una aeronave con reservas sin resolverlas primero.
- Crear bloqueo ocupa una sola aeronave o persona. Si hay conflictos se muestran los identificadores de las reservas afectadas; reprograma o cancela explícitamente antes de insistir.
- Liberar bloqueo conserva su auditoría y libera la ocupación.
- El calendario permite abrir cualquier reserva. Los cambios administrativos de horario y las cancelaciones requieren motivo.

## Instructor

La cuenta `instructor@aeroreserva.cl` cuenta con las funciones administrativas y la sección Mi disponibilidad. Añade un tramo, edítalo o elimínalo. El sistema rechazará reducir o eliminar un tramo que sea necesario para una reserva existente. Un administrador no puede actuar como piloto si su perfil no es INSTRUCTOR.

## Recordatorios

La campana muestra reservas propias confirmadas que comienzan en los próximos 30 minutos. El aviso debe solicitarse con al menos 30 minutos de anticipación; si falta menos, la reserva se confirma igualmente y se informa que no se programó el aviso. Con la aplicación abierta, se consulta al servidor cada minuto y al recuperar el foco. La consulta vuelve a comprobar estado, horario y lectura, y no prolonga la sesión por inactividad. Marcar leído solo modifica el aviso. Reprogramar recalcula la ventana y cancelar desactiva el recordatorio. Si falla la consulta, se informa y se reintenta, sin modificar la reserva. No hay envíos por correo ni notificaciones fuera de la aplicación.

## Solución de problemas

- Docker no responde: inicia Docker Desktop y espera hasta que esté listo; ejecuta `npm run db:up`.
- Puerto 5432 ocupado: cambia el puerto publicado en `compose.yaml` y el puerto de `DATABASE_URL` a un mismo valor libre.
- Cuenta rechazada: verifica correo/contraseña y estado. Tras cinco intentos en 15 minutos espera a que termine la ventana.
- Sesión vencida: vuelve a ingresar; la inactividad máxima es de 30 minutos y el máximo absoluto, de 8 horas.
- Modelo sin habilitación: administración debe registrar el modelo exacto que figura en la aeronave.
- Cambiaste `DEMO_PASSWORD` y la cuenta ya existía: el seed no sobrescribe contraseñas. Actualízala desde otra cuenta administrativa.
- Faltan datos recientes: actualiza la vista. El calendario es orientativo; la transacción al confirmar es la autoridad final.

La plataforma coordina reservas. No acredita licencias oficiales, aeronavegabilidad, horas efectivamente voladas ni autorización operacional.
