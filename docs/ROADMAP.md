# Roadmap de Soly

Actualizado: 10 de septiembre de 2026. Documento operativo para avanzar tarea por tarea.

## Producto acordado

- SaaS B2B para barberías, salones, centros de estética, uñas y pestañas, y spas.
- Marca: Soly. Promesa: **Tu negocio, en orden.** Identidad visual cálida aprobada.
- Plan común: **$23.000 CLP mensuales por negocio, IVA incluido**.
- Primer alcance: un local por negocio; clientes, servicios, equipo, citas y reportes.
- Piloto propuesto: cinco negocios de distintos rubros. Chile como mercado inicial por confirmar.
- Documentos base: [estrategia y diagnóstico](ESTRATEGIA-PRODUCCION-2026-09.md) y [dirección visual](soly-direccion-de-marca.html).

## Cómo usaremos este roadmap

Trabajar una tarea principal a la vez, siguiendo sus dependencias. Al empezar, registrar el ID en “Trabajo actual”. Al terminar, marcar la casilla y añadir evidencia al registro final. Una tarea que solo existe en código sigue pendiente de verificación; un cambio local no equivale a un cambio publicado.

Cada entrega debe dejar: comportamiento verificable, estados de carga/error/vacío cuando correspondan, permisos comprobados, prueba proporcional al riesgo y un breve resumen de lo hecho y lo pendiente. Para publicar, registrar versión y resultado de la verificación en el entorno de destino.

Las etapas indican orden, no fechas comprometidas. Se estimará cada bloque después de revisar sus dependencias y capacidad disponible. Este documento sustituye el calendario tentativo de seis semanas de la estrategia como guía de ejecución.

**Trabajo actual:** inventario técnico actualizado en `docs/ESTADO-IMPLEMENTACION.md`. Existe implementación previa considerable; las tareas del roadmap describen lo que falta para completar y verificar esa base.

**Siguiente tarea:** F0.1 — establecer una versión de referencia y resolver el historial de migraciones antes de modificar la base de datos.

## Vista general

### Punto de partida verificado en el repositorio

Leer el [estado de implementación](ESTADO-IMPLEMENTACION.md) antes de repartir trabajo entre agentes. Incluye archivos de referencia y 14 hallazgos concretos. La guía de entrada del repositorio es [AGENTS.md](../AGENTS.md).

**Ya existe en código:** login/registro/recuperación, multi-tenancy y RLS, CRUD paginado de clientes, registro y edición de citas, invitación/eliminación de miembros, importación con dry-run y mapeo, reportes/KPIs, configuración de nombre/subtítulo, tema/PWA, pago individual Flow y monitoreo instrumental. Precio local actualizado a $23.000 IVA incluido.

**No confundir con funciones completas:** no hay calendario de agenda ni disponibilidad real; servicios e inventario tienen base SQL pero carecen de sus pantallas completas; membresías no equivalen a gestión de profesionales; la IA existente ayuda al mapeo de importaciones; el rebranding aprobado está en una propuesta, no aplicado a toda la app.

**Verificaciones:** typecheck y seis tests frontend aprobados de nuevo en esta revisión; build aprobado en el turno anterior. Backend, navegador autenticado, aislamiento real, Flow y producción no verificados. Las casillas F0–F7 permanecen abiertas cuando todavía no se cumplen todos sus criterios.

| Tareas | Estado de partida | Qué reutilizar / qué queda |
|---|---|---|
| F0.1–F0.2 | Parcial / no verificado | Repo y configuración existentes; cerrar cambios locales, historial y DB de ensayo |
| F0.3 | Parcial | CI frontend y seis tests aprobados; integrar pruebas SQL/backend y reconstrucción de DB |
| F0.4 | Parcial | Inventario estático completado; falta recorrido en navegador con sesión |
| F1.1–F1.2 | Parcial | RLS, roles, auth e invitaciones existentes; comprobar aislamiento y flujos completos |
| F1.3–F1.4 | Parcial con bloqueos | Checkout y webhook existentes; corregir contrato, tenant, errores e idempotencia |
| F1.5–F1.6 | Parcial | Trial/pago/cancelación existentes; cerrar lifecycle y renovación. Cobro automático no implementado en creación |
| F1.7 | Parcial / no verificado | Health, cron/expiry, Sentry y documentos; demostrar restauración, alertas y reversión |
| F2.1–F2.3 | Parcial | Componentes/tema/PWA y propuesta visual; aplicar marca y conectar portada |
| F2.4–F2.5 | Parcial | Signup conectado y nombre/subtítulo; faltan rubro, zona horaria y lenguaje común |
| F3.1 | Parcial | CRUD/lista/paginación; faltan búsqueda global, ficha histórica y validaciones del alcance |
| F3.2 | Parcial: base SQL | Servicios con nombre/precio; faltan UI, duración y relación operativa con citas |
| F3.3 | Parcial | Miembros/invitaciones; faltan profesionales, asignación de servicios y horarios |
| F3.4 | Pendiente | Jornadas, bloqueos y recursos no implementados como módulo operativo |
| F3.5 | Parcial | Importador avanzado ya existe; probar homónimos, reimportación, volumen y plantillas |
| F3.6 | Pendiente | No se encontró exportación completa ni gestión de solicitudes de eliminación |
| F4.1 | Parcial | Lista/formulario de citas; falta vista calendario y asignación completa |
| F4.2–F4.3 | Pendiente | Sin disponibilidad por duración/recursos ni reserva concurrente verificada |
| F4.4 | Parcial | Estados y edición manual existen; falta historial y reglas de liberación/reprogramación |
| F4.5 | No verificado | Jornada real por rubro aún no ensayada |
| F5.1–F5.2 | Parcial | RPC/vistas/reportes; ocupación fija, filtros y semántica por verificar |
| F5.3 | Parcial | Eventos Sentry existentes; faltan costos y soporte observados por negocio |
| F5.4–F5.6 | No verificado | Piloto/pagos/renovación comerciales sin evidencia aportada |
| F6.1–F6.3 | Pendiente | Reservas públicas y recordatorios de citas no encontrados |
| F6.4–F6.6 | Parcial / no verificado | Configuración/documentos presentes; operación, fiscalidad, capacidad y release pendientes |
| F7.1 | Parcial: base SQL | Tablas y trigger inventario; faltan UI e integración comprobada |
| F7.2–F7.5 | Pendiente | Paquetes, comisiones, WhatsApp y retención sin módulo operativo encontrado |
| F7.6 | Parcial | IA para mapeo de importación; no asistente de negocio ni medición completa de consumo |
| F7.7 | Pendiente | Multi-tenancy existente no equivale a múltiples sucursales por negocio |

### Etapas de ejecución

| Etapa | Resultado | Depende de | Hito |
|---|---|---|---|
| 0. Base de trabajo | Entorno de ensayo reproducible y estado conocido | Ninguna | Inicio seguro |
| 1. Seguridad y cobros | Datos aislados y pago confiable | 0 | Bloqueos críticos resueltos |
| 2. Rebranding y onboarding | Experiencia coherente para todos los rubros | 0; ensayo de usuarios después de 1 | Demo con nueva marca |
| 3. Operación del local | Clientes, servicios y profesionales completos | 1 y 2 | Base funcional |
| 4. Agenda | Disponibilidad y citas sin solapamientos | 3 | Núcleo operativo |
| 5. Reportes y piloto | Cinco negocios usando y evaluando el producto | 1–4 y reportes verificados | Piloto pagado |
| 6. Reservas y lanzamiento | Reservas públicas, operación y adquisición listas | 4 y evidencia de 5 | Lanzamiento público |
| 7. Ampliaciones | Funciones elegidas por uso y rentabilidad | Evidencia de 5–6 | Evolución continua |

## 0. Preparar la base de trabajo

- [ ] **F0.1 — Versión de referencia.** Revisar cambios locales existentes, documentar qué pertenece a cada trabajo y contrastar migraciones 0026/0027 con el historial aplicado. **Termina cuando:** existe una referencia reproducible y ninguna migración aplicada será renumerada o sobrescrita.
- [ ] **F0.2 — Entorno de ensayo.** Separar configuración de desarrollo/ensayo y producción; preparar datos ficticios de barbería, salón y estética. **Termina cuando:** se puede reconstruir el entorno sin datos reales y probar cobros con sandbox.
- [ ] **F0.3 — Verificación inicial.** Ejecutar checks de frontend y documentar la prueba de migraciones desde cero. Integrar pruebas backend críticas en CI, interpretando correctamente el rollback deliberado de la suite SQL actual. **Termina cuando:** un fallo de permisos o migración bloquea la validación automática.
- [ ] **F0.4 — Mapa de funciones.** Recorrer login, clientes, citas, archivos, reportes y configuración en navegador; clasificar cada módulo como usable, parcial o pendiente. **Termina cuando:** el inventario refleja comportamiento observado, además del código existente.

**Cierre de etapa:** entorno de ensayo disponible, cambios previos preservados y fallos iniciales registrados.

## 1. Resolver seguridad y cobros antes de clientes reales

Esta etapa implementa los hallazgos prioritarios del diagnóstico; no parte de la suposición de que ya estén corregidos.

- [ ] **F1.1 — Aislamiento por negocio.** Verificar tablas, vistas, RPCs y archivos con dos organizaciones y todos los roles. **Termina cuando:** A no puede leer ni modificar datos de B, incluso enviando identificadores ajenos directamente a la API.
- [ ] **F1.2 — Sesión, roles e invitaciones.** Verificar registro, recuperación, expiración de sesión e invitaciones. Definir qué puede hacer propietario, administrador, recepción/profesional y lector, reutilizando o ajustando roles existentes. **Termina cuando:** permisos se aplican en servidor y no se puede elevar el rol desde el cliente.
- [ ] **F1.3 — Confirmación de pago Flow.** Alinear callback con contrato oficial y validar estado mediante consulta al proveedor; vincular orden, tenant, importe y moneda. **Termina cuando:** un pago válido de $23.000 activa solo el negocio correcto y un pago ajeno o de importe incorrecto no concede acceso.
- [ ] **F1.4 — Duplicados y recuperación.** Corregir clave de idempotencia y manejo de errores; guardar y aplicar eventos de forma durable. **Termina cuando:** callbacks concurrentes, repetidos y desordenados no duplican efectos, y un fallo de DB puede recuperarse sin perder pagos.
- [ ] **F1.5 — Ciclo de acceso.** Verificar prueba de 14 días, pago, vencimiento, renovación, cancelación y reintentos. Evitar reiniciar pruebas indefinidamente y retirar períodos ya pagados por eventos tardíos. **Termina cuando:** cada transición tiene una prueba y coincide con la pantalla de cobro.
- [ ] **F1.6 — Modalidad de renovación.** Decidir renovación manual para piloto o automática; completar el flujo elegido. **Termina cuando:** la oferta explica la modalidad real. Si es automática, hay autorización de cobro, renovación y cancelación verificadas; si es manual, hay aviso y nueva orden sin pérdida de días pagados.
- [ ] **F1.7 — Respaldo, alertas y release.** Ensayar restauración, error de cobro y caída; verificar cron de vencimientos. **Termina cuando:** se demuestra recuperación en ensayo, una alerta llega al responsable y existe procedimiento de reversión de release compatible con los datos.

**Cierre de etapa:** ningún bloqueo crítico abierto; pruebas de aislamiento, cobro y recuperación con evidencia. Todavía no publicar funciones incompletas.

## 2. Aplicar la marca y preparar la entrada al producto

- [ ] **F2.1 — Sistema visual.** Aplicar paleta, tipografía, botones, formularios, tablas y estados de la propuesta aprobada. **Termina cuando:** los componentes compartidos conservan coherencia en móvil y escritorio, con foco de teclado y contraste legibles.
- [ ] **F2.2 — Portada comercial única.** Resolver la duplicación de landings y su relación con el login. Mostrar rubros, funciones disponibles y $23.000 IVA incluido. **Termina cuando:** visitante puede entender la oferta y llegar al registro; no se promete inventario o reservas aún no entregados.
- [ ] **F2.3 — Marca completa.** Actualizar login, recuperación, navegación, favicon, iconos PWA, manifest y correos. **Termina cuando:** no quedan mezclas visuales y el negocio mantiene su nombre/logo en el espacio de Soly.
- [ ] **F2.4 — Onboarding por rubro.** Pedir nombre, rubro, zona horaria y datos mínimos; proponer ejemplos editables. **Termina cuando:** un dueño crea su espacio y entiende el siguiente paso sin configurar servicios técnicos.
- [ ] **F2.5 — Lenguaje común.** Usar “Profesional”, “Servicio”, “Cliente”, “Inicio” y “Suscripción” donde corresponda; adaptar ejemplos por rubro. **Termina cuando:** un centro de estética no encuentra campos obligatorios exclusivos de barbería. Mantener compatibilidad de identificadores internos y migrar solo cuando sea necesario.

**Hito: demo de marca.** Mostrar registro y recorrido con datos ficticios claramente identificados. No confundir la demo con una certificación de producción.

## 3. Completar las funciones del local

- [ ] **F3.1 — Clientes.** Completar alta, edición, búsqueda, historial, validación de contacto y tratamiento de duplicados. **Termina cuando:** se encuentra y selecciona un cliente aunque esté fuera de la primera página; los errores se explican y eliminar respeta permisos y política de conservación.
- [ ] **F3.2 — Catálogo de servicios.** Crear pantalla para nombre, precio, duración, estado activo y categoría opcional. **Termina cuando:** una cita puede seleccionar un servicio real; cambios posteriores no alteran el precio o duración históricos de citas existentes.
- [ ] **F3.3 — Profesionales y equipo.** Separar profesional que presta servicios de cuenta que inicia sesión; asignar servicios y permisos. **Termina cuando:** se administra el equipo, se desactiva un profesional conservando su historial y se controla el límite de cuentas del plan.
- [ ] **F3.4 — Horarios y recursos.** Configurar jornada, descansos y excepciones por profesional. Para estética, definir si el piloto necesita cabina/equipo; si lo necesita, modelarlo antes de activar reservas que dependan de él. **Termina cuando:** disponibilidad utiliza la zona horaria del negocio y respeta ausencias y recursos habilitados.
- [ ] **F3.5 — Importación asistida.** Ajustar plantillas por rubro, previsualización, errores por fila y deduplicación. **Termina cuando:** importar dos veces no duplica datos y el usuario conoce cuántos registros se aceptaron o rechazaron.
- [ ] **F3.6 — Salida de datos.** Exportar clientes y citas con permisos; definir solicitudes de eliminación y conservación. **Termina cuando:** el dueño puede obtener sus datos sin acceder a los de otro negocio y las operaciones sensibles quedan registradas.

**Cierre de etapa:** cada negocio de ensayo configura su equipo, carga clientes y servicios y queda listo para agendar.

## 4. Convertir el registro de citas en una agenda operativa

- [ ] **F4.1 — Calendario del equipo.** Vistas diaria/semanal y filtro por profesional, manteniendo alternativa de lista. **Termina cuando:** se puede consultar, crear y editar una cita desde móvil y escritorio.
- [ ] **F4.2 — Disponibilidad real.** Combinar duración de servicio, horario, bloqueos y recursos requeridos. **Termina cuando:** los horarios ofrecidos coinciden con la capacidad real, incluyendo cambios de hora de la zona configurada.
- [ ] **F4.3 — Evitar sobrecupos.** Validar solapamientos en servidor bajo concurrencia. **Termina cuando:** dos solicitudes simultáneas para el mismo profesional/recurso no reservan el mismo intervalo; el conflicto se informa sin perder datos del formulario.
- [ ] **F4.4 — Estados y cambios.** Confirmar, reprogramar, cancelar, completar y marcar inasistencia; registrar actor y cambios relevantes. **Termina cuando:** reprogramar libera el horario anterior y los estados afectan disponibilidad y reportes de forma consistente.
- [ ] **F4.5 — Flujo de recepción.** Probar una jornada completa con cada rubro piloto. **Termina cuando:** recepción registra clientes, asigna servicio/profesional y gestiona cambios sin asistencia técnica.

**Cierre de etapa:** agenda interna usable. Las reservas públicas dependen de F4.2 y F4.3; no se habilitan antes.

## 5. Reportes confiables y piloto pagado

- [ ] **F5.1 — Métricas definidas.** Acordar cálculo de citas completadas, inasistencia, importes y ocupación. Separar importe registrado de dinero efectivamente cobrado. **Termina cuando:** dashboard y reportes coinciden con un conjunto de citas de resultado conocido.
- [ ] **F5.2 — Reportes útiles.** Filtrar por fecha, servicio y profesional; usar horarios disponibles para calcular ocupación. **Termina cuando:** el dueño responde cuánto se registró, qué servicios se realizaron y cómo se utilizó el equipo, sin sumar cancelaciones incorrectamente.
- [ ] **F5.3 — Costos y soporte.** Medir infraestructura, consumo, importación y minutos de ayuda por negocio. **Termina cuando:** existe contribución estimada con costos observados al precio final acordado; no tratar IVA como ingreso.
- [ ] **F5.4 — Preparar cinco pilotos.** Reclutar con autorización del fundador, acordar alcance/soporte y acompañar carga inicial. Distribución propuesta: dos barberías, un salón y dos centros de estética o estudios. **Termina cuando:** los cinco completan cliente → servicio/profesional → cita → reporte.
- [ ] **F5.5 — Observar uso y corregir.** Registrar semanalmente activación, uso, errores y solicitudes por rubro. **Termina cuando:** no quedan incidentes críticos y las tareas recurrentes pueden completarse sin asistencia técnica.
- [ ] **F5.6 — Validar pago y renovación.** Medir conversión y primera/segunda renovación. **Termina cuando:** hay decisión documentada de continuar, ajustar o extender piloto basada en uso y pago; meta orientativa inicial: al menos tres de cinco pagan. Una cohorte tan pequeña no valida todo el mercado.

**Hito: piloto pagado.** Requiere etapas 0–4, reportes verificados, cobro y recuperación funcionales, alcance y soporte acordados. Observar la segunda renovación lleva tiempo de calendario; no reemplazarla por una prueba simulada.

## 6. Reservas online y lanzamiento público

- [ ] **F6.1 — Página pública por negocio.** Mostrar servicios, profesionales y horarios disponibles con identidad del local. **Termina cuando:** se puede reservar sin cuenta de administración y sin exponer datos de otros clientes.
- [ ] **F6.2 — Gestión de reserva.** Confirmación y enlaces seguros para cancelar/reprogramar, con políticas configuradas. **Termina cuando:** el flujo público respeta disponibilidad, recursos y permisos; aplicar control de abuso y prevenir enumeración de clientes.
- [ ] **F6.3 — Recordatorios por correo.** Programar envío con registro de estado, reintentos y deduplicación. **Termina cuando:** reprogramar/cancelar actualiza los recordatorios y los errores son observables. Consentimientos y preferencias según el uso del canal.
- [ ] **F6.4 — Operación comercial.** Completar términos, política de datos, documento tributario, soporte y proceso de baja. **Termina cuando:** precio final, renovación y responsabilidades coinciden en web, pago y comunicación al cliente.
- [ ] **F6.5 — Experiencia y capacidad.** Verificar recorridos de propietario, recepción y cliente final; teclado, móvil, carga y sesiones. Medir capacidad con volumen representativo del piloto y crecimiento previsto. **Termina cuando:** hay resultados registrados y se corrigen fallos que impiden completar tareas.
- [ ] **F6.6 — Release público.** Revisar checklist, configuración, versión, monitoreo y reversión; desplegar de forma controlada. **Termina cuando:** registro → configuración → reserva → atención → reporte y pago de Soly funcionan en destino con pruebas controladas.

**Hito: lanzamiento público.** Requiere estabilidad del piloto, costos observados compatibles con el plan, recorridos completos y soporte preparado. La renovación manual es admisible solo si se ofrece explícitamente como tal.

## 7. Completar funciones avanzadas según demanda

Orden tentativo. Antes de iniciar cada función, registrar quién la necesita, problema frecuente, costo de operar y criterio de adopción. La existencia de tablas o una idea comercial no significa que el módulo esté disponible.

- [ ] **F7.1 — Inventario.** Productos, entradas/salidas, ajustes, stock mínimo y movimientos auditables. **Termina cuando:** existencias coinciden con movimientos y operaciones concurrentes no producen saldos inválidos. Aprovechar y revisar las tablas existentes.
- [ ] **F7.2 — Paquetes de sesiones.** Venta/registro, saldo, vencimiento y consumo por atención. **Termina cuando:** completar una cita descuenta una sola sesión y anularla aplica una regla explícita y auditable.
- [ ] **F7.3 — Comisiones del equipo.** Reglas por servicio/profesional, período y ajustes. **Termina cuando:** un cierre reproduce el cálculo acordado, conservando reglas históricas y evitando duplicados.
- [ ] **F7.4 — WhatsApp.** Confirmaciones/recordatorios mediante integración oficial, preferencias y control de consumo. **Termina cuando:** entrega, errores, reintentos y costo por negocio están medidos. Definir presupuesto o cargo adicional antes de incluir consumo en el plan de $23.000.
- [ ] **F7.5 — Retención de clientes.** Identificar clientes sin visitas recientes y facilitar seguimiento autorizado. **Termina cuando:** segmentos usan historial correcto, exclusiones se respetan y se mide retorno sin prometer resultados garantizados.
- [ ] **F7.6 — Asistencia con IA.** Empezar por una tarea concreta de valor demostrado, con límites y trazabilidad. **Termina cuando:** su resultado es revisable, no cruza datos entre negocios y el consumo encaja en el margen.
- [ ] **F7.7 — Varias sucursales.** Evaluar después del uso en un local: permisos, agenda, recursos y reportes por sucursal. **Termina cuando:** alcance y precio están definidos antes de desarrollar y se verifica separación de acceso entre sucursales.

No incluido en este roadmap inicial: fichas clínicas, gestión de procedimientos médicos, contabilidad completa o marketplace. Se requeriría definir un nuevo alcance si aparece demanda.

## Decisiones al llegar a cada tarea

| Decisión | Momento | Propuesta de partida |
|---|---|---|
| País y zona horaria del piloto | F0.2 / F2.4 | Chile; zona horaria configurable |
| Renovación manual o automática | F1.6 | Elegir antes de cobrar pilotos; reflejar exactamente en la oferta |
| Permisos de recepción y profesionales | F1.2 / F3.3 | Menor acceso necesario, verificado en servidor |
| Cabinas/equipos para estética | F3.4 | Incluir si un piloto depende de ellos para atender sin conflictos |
| Costos de mensajería e IA | F7.4 / F7.6 | Límites medidos; no prometer consumo ilimitado |

Estas decisiones se resuelven cuando afectan la siguiente entrega. No impiden comenzar F0.1.

## Registro de avance

### Preparación ya realizada

- [x] SaaS para varios negocios y rubros de belleza/cuidado personal definidos por el fundador.
- [x] Dirección visual aprobada; propuesta HTML creada. Aplicación completa a la interfaz pendiente en F2.
- [x] Precio final de $23.000 IVA incluido definido y ajustado en código local y documentos. Publicación pendiente.
- [x] Diagnóstico inicial del repositorio y comparación comercial documentados.
- [x] Build local aprobado tras cambio de precio. Seis pruebas frontend aprobadas durante el diagnóstico previo; no certifican cobros ni aislamiento.
- [x] Roadmap creado con dependencias, criterios de cierre e hitos.

### Bitácora de implementación

| Fecha | Tarea | Estado | Evidencia / verificación | Publicación |
|---|---|---|---|---|
| 2026-09-10 | F0.4 (inventario estático) | Parcial | ESTADO-IMPLEMENTACION.md; check y 6 tests aprobados; recorrido en navegador pendiente | No publicada |

Al cerrar una tarea: actualizar su casilla, esta tabla y “Trabajo actual”. Si una prueba falla, mantener pendiente la tarea y registrar el impedimento concreto y siguiente acción.
