from xml.etree.ElementTree import Element,SubElement,ElementTree
from pathlib import Path
mx=Element('mxfile',host='app.diagrams.net',agent='AeroReserva',version='24.7.17')
def page(name,w=1200,h=850):
 d=SubElement(mx,'diagram',name=name,id=name.replace(' ','-'));m=SubElement(d,'mxGraphModel',dx='1200',dy='850',grid='1',gridSize='10',guides='1',tooltips='1',connect='1',arrows='1',fold='1',page='1',pageScale='1',pageWidth=str(w),pageHeight=str(h));r=SubElement(m,'root');SubElement(r,'mxCell',id='0');SubElement(r,'mxCell',id='1',parent='0');return r
base='whiteSpace=wrap;html=1;fontFamily=Helvetica;fontSize=12;strokeColor=#52756c;fillColor=#f4f8f6;'
def box(r,i,text,x,y,w=210,h=100,style=''):
 c=SubElement(r,'mxCell',id=i,value=text,style=base+style,vertex='1',parent='1');SubElement(c,'mxGeometry',x=str(x),y=str(y),width=str(w),height=str(h),attrib={'as':'geometry'});return c
def edge(r,i,s,t,label='',style=''):
 c=SubElement(r,'mxCell',id=i,value=label,style='edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;fontSize=10;strokeColor=#69867c;endArrow=none;'+style,edge='1',parent='1',source=s,target=t);SubElement(c,'mxGeometry',relative='1',attrib={'as':'geometry'});return c
def title(r,text):box(r,'title',text,30,20,1110,45,'strokeColor=none;fillColor=none;fontSize=23;fontStyle=1;align=left;')
def cls(r,i,name,fields,x,y,w=210,h=120):return box(r,i,'<b>'+name+'</b><hr>'+fields,x,y,w,h,'align=left;verticalAlign=top;spacing=10;')
r=page('01 Casos de uso',1700,1350);title(r,'AeroReserva · CU01–CU17 del informe original')
box(r,'boundary','AeroReserva',220,95,1250,1160,'fillColor=none;verticalAlign=top;fontStyle=1;')
for i,n,x,y in [('student','Alumno',50,310),('admin','Administrador',1540,320),('instructor','Instructor',1540,1060)]:box(r,i,n,x,y,95,105,'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;fillColor=none;')
cases=[('01','Iniciar sesión',290,140),('02','Consultar calendario',650,140),('11','Exportar calendario',1050,140),('04','Reservar para sí mismo',290,360),('03','Crear reserva {abstracto}',650,360),('05','Reservar para un alumno',1050,360),('06','Validar habilitaciones',290,590),('07','Verificar disponibilidad',650,590),('08','Registrar reserva',1050,590),('09','Añadir observación',290,780),('10','Programar recordatorio',1050,780),('12','Reprogramar reserva',290,940),('13','Cancelar reserva',650,940),('17','Consultar historial',1050,940),('14','Gestionar usuarios y habilitaciones',290,1110),('15','Gestionar aeronaves y bloqueos',650,1110),('16','Definir disponibilidad',1050,1110)]
for i,n,x,y in cases:box(r,'CU'+i,'CU'+i+' · '+n,x,y,270,75,'ellipse;'+('fontStyle=2;' if i=='03' else ''))
for i in ['01','02','04','12','13','17']:edge(r,'s'+i,'student','CU'+i)
for i in ['01','02','05','12','13','14','15','17']:edge(r,'a'+i,'admin','CU'+i)
edge(r,'inherit','instructor','admin','','endArrow=block;endFill=0;')
edge(r,'own','instructor','CU16')
for i in ['04','05']:edge(r,'g'+i,'CU'+i,'CU03','','endArrow=block;endFill=0;')
for i in ['06','07','08']:edge(r,'inc'+i,'CU03','CU'+i,'«include»','endArrow=open;dashed=1;')
for i,target,label in [('09','03','«extend» [observación ingresada]'),('10','03','«extend» [solicitado; anticipación ≥ 30 min; después del commit]'),('11','02','«extend» [exportar solicitado]')]:edge(r,'ext'+i,'CU'+i,'CU'+target,label,'endArrow=open;dashed=1;')
box(r,'note','CU09: datos opcionales. CU10: tras confirmar, aviso a 30 minutos del inicio. CU11: calendario consultado. Instructor especializa Administrador. Las asociaciones no omiten las reglas de autorización del servidor.',240,1270,1200,60,'shape=note;fillColor=#fff9e9;')
r=page('02 Clases del dominio');title(r,'AeroReserva · Clases persistentes y relaciones')
cls(r,'user','User','id, name, email<br>passwordHash, role, active',30,100)
cls(r,'session','LoginSession','id, userId, lastSeen, expiresAt',30,325)
cls(r,'qual','Qualification','userId, model, validUntil',30,550)
cls(r,'booking','Booking','studentId, instructorId, aircraftId<br>creatorId, requestKey, requestHash<br>start, end, status, note<br>reminder, reminderRead',340,100,265,165)
cls(r,'resource','Resource','id, userId?, aircraftId?<br>{exactamente un propietario}',680,100)
cls(r,'plane','Aircraft','id, registration, model<br>seats, active',960,100)
cls(r,'occ','Occupancy','resourceId, bookingId?, blockId?<br>start, end, active<br>{XOR de procedencia}<br>{exclusión por recurso e intervalo}',680,350,240,165)
cls(r,'block','Block','resourceId, start, end<br>reason, active',960,350)
cls(r,'audit','Audit','actorId, entity, entityId, action<br>reason, before, after, createdAt',340,550,265)
cls(r,'availability','Availability','userId, start, end',960,570)
for i,s,t,l in [('e1','user','session','1 — 0..*'),('e2','user','qual','1 — 0..*'),('e3','user','booking','1 alumno / instructor / creador — 0..*'),('e4','booking','occ','1 — 0..* históricas; 3 activas si confirmada'),('e5','resource','occ','1 — 0..*'),('e6','plane','resource','1 — 1'),('e7','block','occ','1 — 1 activa'),('e8','user','audit','1 actor — 0..*'),('e9','booking','audit','0..* cambios (entityId)'),('e10','user','resource','1 — 1'),('e11','user','availability','1 instructor — 0..*'),('e12','plane','booking','1 — 0..*'),('e13','resource','block','1 — 0..*')]:edge(r,i,s,t,l)
box(r,'note','Booking.status = CONFIRMADA | CANCELADA. No se registran horas voladas. Intervalos [inicio, fin). La relación genérica de Audit usa entity/entityId y no una clave foránea de reserva.',80,740,1060,65,'shape=note;fillColor=#fff9e9;')
r=page('03 Strategy');title(r,'AeroReserva · Strategy de autorización por solicitud')
cls(r,'controller','Server Action','+ bookingAction(raw, id?)<br>obtiene sesión en servidor',70,125,260)
cls(r,'service','Servicio de reservas (módulo)','+ saveBooking(actor, raw, id?)<br>+ cancelBooking(actor, id, reason)<br>+ validateFlight(tx, input)',70,360,300,150)
cls(r,'policy','«interface» BookingPolicy','+ validate(actor, studentId): void',520,130,290)
cls(r,'student','StudentPolicy','+ validate(actor, studentId)<br>{ALUMNO y titular = solicitante}',480,390,280)
cls(r,'admin','AdministrativePolicy','+ validate(actor)<br>{ADMINISTRADOR o INSTRUCTOR}',820,390,300)
edge(r,'cs','controller','service','invoca','endArrow=open;')
edge(r,'sp','service','policy','policyFor(actor) por solicitud','endArrow=open;')
edge(r,'si','student','policy','','endArrow=block;endFill=0;dashed=1;')
edge(r,'ai','admin','policy','','endArrow=block;endFill=0;dashed=1;')
box(r,'note','Las políticas cambian quién puede reservar. Habilitaciones, disponibilidad, tiempos y conflictos son reglas comunes. Strategy no reemplaza la transacción ni la restricción SQL.',200,650,830,85,'shape=note;fillColor=#fff9e9;')
r=page('04 Componentes');title(r,'AeroReserva · Siete componentes lógicos del informe')
components=[('ui','InterfazWeb','React · formularios · calendario<br>Next.js App Router',50,120),('identity','Identidad','auth.ts · Auth.js · Argon2id<br>sesiones revocables',450,120),('notify','Notificaciones','lib/reminders.ts · /api/reminders<br>revalidación cada minuto<br>avisos dentro de la aplicación',850,120),('booking','Reservas','lib/service.ts · lib/rules.ts<br>Strategy · auditoría · iCalendar',50,380),('resources','Recursos','lib/admin-service.ts<br>usuarios · habilitaciones<br>aeronaves · bloqueos · disponibilidad',450,380),('persist','Persistencia','lib/db.ts · Prisma<br>transacciones y consultas',850,380)]
for i,n,detail,x,y in components:box(r,i,'«component»<br><b>'+n+'</b><br>'+detail,x,y,280,145)
box(r,'database','«database»<br><b>BaseDatosAeroReserva</b><br>PostgreSQL 17 · GiST<br>Docker local',450,670,280,120,'shape=cylinder3;size=15;')
for i,s,t,label in [('a','ui','identity','autentica'),('b','ui','booking','reserva / calendario'),('c','ui','resources','administra'),('d','ui','notify','consulta avisos'),('e','identity','persist','sesiones'),('f','booking','persist','transacción'),('g','resources','persist','transacción'),('h','notify','persist','solo reservas confirmadas'),('i','persist','database','SQL')]:edge(r,i,s,t,label,'endArrow=open;dashed=1;')
box(r,'note','Monolito modular: son responsabilidades lógicas, no siete procesos. Los avisos se consultan después de confirmar; un fallo de lectura no revierte la reserva. Sin correo ni servicios externos.',50,690,330,110,'shape=note;fillColor=#fff9e9;')
r=page('05 Secuencia de reserva',1200,950);title(r,'AeroReserva · Confirmación atómica y rechazo sin cambios parciales')
actors=[('ui','Alumno / UI',70),('action','Server Action',320),('srv','saveBooking',570),('pg','PostgreSQL',940)]
for id,name,x in actors:
 box(r,id,name,x,100,165,50,'fontStyle=1;')
 c=SubElement(r,'mxCell',id=id+'line',value='',style='endArrow=none;dashed=1;strokeColor=#8c9d96;',edge='1',parent='1');g=SubElement(c,'mxGeometry',relative='1',attrib={'as':'geometry'});SubElement(g,'mxPoint',x=str(x+82),y='150',attrib={'as':'sourcePoint'});SubElement(g,'mxPoint',x=str(x+82),y='850',attrib={'as':'targetPoint'})
def msg(i,s,t,y,text,dash=False):
 xs=dict((id,x+82) for id,_,x in actors);c=SubElement(r,'mxCell',id=i,value=text,style='endArrow=open;html=1;fontSize=11;strokeColor=#496f60;'+('dashed=1;' if dash else ''),edge='1',parent='1');g=SubElement(c,'mxGeometry',relative='1',attrib={'as':'geometry'});SubElement(g,'mxPoint',x=str(xs[s]),y=str(y),attrib={'as':'sourcePoint'});SubElement(g,'mxPoint',x=str(xs[t]),y=str(y),attrib={'as':'targetPoint'})
msg('m1','ui','action',205,'1. confirmar(datos, clave)');msg('m2','action','pg',255,'2. validar sesión revocable / cuenta activa');msg('m3','action','srv',305,'3. saveBooking(actor, Zod.parse(datos))');msg('m4','srv','pg',355,'4. BEGIN + bloqueo asesor transaccional');msg('m5','srv','pg',405,'5. releer actor / buscar clave idempotente');
box(r,'policy','6. policyFor(actor).validate()<br>RN01–RN05 + habilitación + disponibilidad',570,430,285,60,'shape=note;fillColor=#fff9e9;')
msg('m7','srv','pg',525,'7. consultar ocupaciones y bloqueos');
box(r,'alt','alt',510,555,650,255,'fillColor=none;align=left;verticalAlign=top;fontStyle=1;')
msg('m8','srv','pg',600,'[válida] insertar reserva + 3 ocupaciones + auditoría');msg('m9','pg','srv',640,'COMMIT (GiST impide superposición)',True);msg('m10','srv','action',680,'reserva confirmada',True);msg('m11','pg','srv',735,'[conflicto / error] ROLLBACK',True);msg('m12','srv','action',775,'mensaje comprensible, sin cambios parciales',True);msg('m13','action','ui',840,'8. actualizar vista / mostrar resultado',True)
box(r,'note','Adaptación del diseño: un bloqueo asesor común serializa las escrituras del prototipo; la exclusión GiST por recurso es una segunda defensa. La reprogramación desactiva ocupaciones anteriores dentro de la misma transacción.',70,875,1050,55,'shape=note;fillColor=#fff9e9;fontSize=11;')
Path('docs/uml').mkdir(parents=True,exist_ok=True)
ElementTree(mx).write('docs/uml/AeroReserva.drawio',encoding='utf-8',xml_declaration=True)
print('5 vistas UML editables generadas y XML válido.')
