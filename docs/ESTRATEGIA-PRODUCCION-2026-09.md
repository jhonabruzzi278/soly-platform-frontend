# Soly: rebranding, producto y modelo de negocio

Fecha: 10 de septiembre de 2026. Propuesta inicial para decisión del fundador.

## Decisión recomendada

Convertir Soly en un producto de gestión para negocios de belleza y cuidado personal: barberías, salones de belleza, centros de estética, estudios de uñas y pestañas, y spas. Mantener la dirección visual aprobada y una marca común. Como hipótesis inicial de operación, trabajar con locales chilenos de un establecimiento y equipos de 3 a 10 profesionales. Empezar con cinco negocios piloto, implementación acompañada y un solo plan.

El fundador confirmó la venta SaaS B2B y la ampliación a varios rubros, incluyendo estética, conservando la misma línea de marca. La categoría de belleza y cuidado personal reúne estos rubros por su operación compartida: clientes, servicios, citas y profesionales. Chile, tamaño del negocio y disposición a pagar siguen pendientes de validación. No hay evidencia de ventas, costos reales o retención en lo revisado.

**Estado: base funcional con bloqueos para lanzamiento comercial abierto.** Compilar no demuestra que cobros, aislamiento de datos y operación estén listos. La revisión es del repositorio local; no certifica el despliegue, las migraciones aplicadas ni la experiencia en navegador con usuarios reales.

## Qué existe y qué puede prometerse

| Área | Evidencia local | Lectura comercial |
|---|---|---|
| Clientes | CustomersPage, useCustomers, API e importadores | Registro e historial de clientes |
| Citas | AppointmentsPage permite crear y editar registros con fecha, hora, servicio y estado | Gestión de citas; todavía no vender disponibilidad automática ni motor de reservas |
| Analítica | DashboardPage, ReportsPage, hooks y RPCs | Reportes de actividad e importes registrados; validar definición de ingresos y ocupación |
| Importación | ExcelUploadPage y función import-data | Migración de datos como parte del acompañamiento |
| Equipos | Memberships, invitaciones y roles | Acceso por equipo; falta ejecutar pruebas de permisos en entorno de ensayo |
| Cobro | flow-create-subscription usa payment/create | Pago individual con acceso por 30 días; renovación automática pendiente |
| Inventario | Tablas y triggers en 0003_domain_crm.sql | Base de datos existente, sin módulo de usuario en rutas actuales |
| IA | Configuración y fallback de mapeo en importación | Ayuda para importar; no prometer asistente comercial o automatizaciones no verificadas |

Fuentes principales: `frontend/src/app/AppRoutes.tsx`, `frontend/src/features/appointments/AppointmentsPage.tsx`, `frontend/src/lib/features.ts`, `backend/supabase/functions/flow-create-subscription/index.ts`.

## Riesgos que condicionan producción

Hallazgos de inspección estática, no incidentes reproducidos contra producción.

| Prioridad | Hallazgo y evidencia | Acción y criterio de cierre |
|---|---|---|
| P0 | flow-webhook exige parámetro `s` antes de consultar el token. La documentación oficial describe callback con token y consulta posterior de estado. | Probar callback real en sandbox y ajustar contrato: validar mediante consulta autenticada al proveedor, orden, monto y moneda. Un pago válido debe activar exactamente la orden correspondiente. |
| P0 | El webhook no comprueba los errores devueltos por varias actualizaciones; marca eventos procesados y el catch responde 200. | Procesamiento durable y recuperable: no marcar completado si falla la aplicación; simular fallo de DB y demostrar recuperación sin perder ni duplicar acceso. |
| P0 | El índice de idempotencia de 0008 usa `raw_payload.id`; el webhook busca `flowOrder`. | Unificar clave del proveedor y procesamiento atómico. Dos callbacks concurrentes deben producir un único efecto. |
| P0 | Fallback de cobro por correo y selección de primera membresía owner. No se compara monto/moneda esperados en el webhook. | Vincular orden, suscripción y tenant de manera inequívoca; rechazar discrepancias. Probar usuario con dos organizaciones. |
| P0 | Hay suite SQL de aislamiento, pero CI solo ejecuta frontend y esta revisión no la ejecutó. | Crear DB de ensayo con migraciones desde cero; probar tenants A/B, roles, storage y RPCs. No ejecutar pruebas de fixtures contra clientes reales. |
| P1 | Pago aprobado activa 30 días; no hay creación de suscripción recurrente en el flujo inspeccionado. | Elegir renovación manual explícita para piloto o completar cobro recurrente. Probar vencimiento, renovación, cancelación y pago fallido sin cortar períodos ya pagados. |
| P1 | `/` redirige a login; LandingPage no está montada. Existe además `landing/index.html`. | Decidir un único sitio comercial y destino de app. Confirmar dónde se despliega cada uno y probar recorrido visitante → registro → primer valor. |
| P1 | Las dos portadas anuncian inventario y audiencia muy amplia. | Alinear mensajes y límites con capacidades entregadas. Precio y metadatos corregidos localmente a $23.000 CLP, IVA incluido; despliegue pendiente. |
| P1 | No se comprobaron secretos, cron, alertas, respaldo ni restauración del entorno desplegado. | Verificar configuración sin exponer secretos; ejecutar restauración y alerta sintética; registrar responsables y procedimiento de incidentes. |
| P1 | Git tiene cambios previos y renumeración de migración 0026/0027. | Comparar historial local/remoto antes de desplegar; no borrar ni renumerar migraciones ya aplicadas. Preparar release reproducible. |
| P2 | Advertencias de hooks y bundle principal grande. | Revisar sesión y cobros por riesgo funcional; medir carga móvil y optimizar según resultados. |

Flow documenta callbacks mediante token y `payment/getStatus`; la firma de solicitudes salientes no debe confundirse con un contrato de firma entrante. [Referencia oficial Flow](https://developers.flow.cl/api).

Supabase requiere políticas de acceso además de habilitar RLS; su existencia en SQL no prueba que el entorno desplegado esté aislado. [Documentación RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Posicionamiento y rebranding

**Nombre de trabajo:** Soly. No se ha comprobado disponibilidad registral, de dominio ni redes. Mantenerlo permite probar valor antes de invertir en otro nombre; si se cambia, evaluar memorabilidad, pronunciación en español y disponibilidad antes de publicar.

**Descriptor:** Gestión para belleza y cuidado personal.

**Promesa:** Tu negocio, en orden.

**Explicación:** Clientes, citas y reportes claros para llevar el día a día de tu equipo.

**Diferencia a validar:** puesta en marcha acompañada, importación de datos y revisión semanal que ayude al dueño a entender la operación. Es una oferta de servicio propuesta, no un resultado demostrado.

**Personalidad:** cercana, precisa, tranquila y profesional. Usar lenguaje del dueño: clientes, equipo, citas, ingresos registrados. Cambiar “Revenue”, “features” y “tenant” en pantallas comerciales. Evitar “todo incluido”, “inteligente” y resultados de crecimiento garantizados.

**Dirección visual:** editorial cálida. Fondo marfil `#F6F2E9`, texto tinta `#182D29`, verde profundo `#234A40`, acento lima suave `#D9EB91`. Titulares con serif expresiva; interfaz con sans legible. Reservar la serif para marketing, mantener números y tablas claros. Superficies planas, líneas finas y sombras discretas. Fotos reales del negocio cuando estén disponibles y autorizadas.

La aplicación debe distinguir marca del producto y marca del negocio: Soly firma navegación y soporte; el nombre y logo del local identifican el espacio activo. No reemplazar indiscriminadamente identificadores internos `soly`, productos de billing ni referencias existentes.

**Portada propuesta:**

> Soly · Gestión para belleza y cuidado personal  
> Tu negocio, en orden.  
> Reúne tus clientes, registra tus citas y entiende la actividad de tu equipo desde un solo lugar.  
> Solicitar una demo

Orden de contenido: promesa → vista real del producto → tres tareas que resuelve → acompañamiento → plan y condiciones → preguntas → demo. Usar capturas con datos ficticios identificados. No inventar testimonios, cifras de clientes o ahorro.

Aplicación posterior de identidad: portada única, login, onboarding, navegación, tablas, correos, favicon, iconos PWA, manifest, metadatos y pantallas de cobro. Validar móvil, teclado, contraste, errores y estados vacíos.

Se acompaña una lámina HTML de dirección de marca; es un prototipo para revisión, no una web comercial publicada.

### Una marca, varios rubros

La portada general presenta barberías, salones, estética, uñas y pestañas, y spas. Cada página por rubro conserva colores, tipografía, tono y estructura; adapta titular, fotografías y ejemplos: “Tu barbería, en orden”, “Tu salón, en orden” y “Tu centro de estética, en orden”.

En onboarding, proponer selección de rubro y nombre del negocio. En el producto compartido usar “Profesional”, “Servicio” y “Cliente”; revisar etiquetas existentes como “Barbero”. El rubro configura vocabulario y ejemplos, sin crear aplicaciones separadas ni alterar el aislamiento de datos. Esta configuración es trabajo propuesto, todavía no implementado.

| Rubro | Ejemplos para demos y plantillas | Necesidades por validar antes de prometerlas |
|---|---|---|
| Barberías | Corte, barba, perfilado | Duración y disponibilidad por profesional |
| Salones de belleza | Corte, color, peinado | Servicios con varias etapas y tiempos de espera |
| Centros de estética | Limpieza facial, cuidado corporal | Cabinas, equipos y paquetes de sesiones |
| Uñas y pestañas | Manicura, extensiones, mantenimiento | Duraciones variables y repetición de visitas |
| Spas | Masajes y rituales de bienestar | Salas compartidas y recursos por servicio |

El núcleo inicial sigue siendo gestión de clientes, registro de citas y reportes. Cabinas, reservas con recursos, paquetes y automatizaciones pasan al backlog según evidencia del piloto. El alcance inicial de estética es gestión comercial y operativa; no se ofrece ficha clínica ni gestión de procedimientos médicos.

## Mercado: referencia breve

| Alternativa | Oferta observada en fuente oficial | Implicación para Soly |
|---|---|---|
| Setmore | Plan gratuito hasta cuatro usuarios; Pro anunciado desde US$5 por usuario/mes con facturación anual; reservas y recordatorios | La agenda genérica ya tiene alternativas gratuitas y de bajo precio. Competir exige un beneficio específico y evidencia. |
| Fresha | Plataforma de reservas para belleza con suscripción y funciones complementarias | El foco en belleza por sí solo no diferencia. Validar implementación local y claridad operativa. |
| AgendaPro | Oferta para negocios con agenda y venta asistida en página chilena | La demostración y el acompañamiento deben explicar por qué cambiar desde una solución existente. |

Fuentes consultadas el 10/09/2026: [Setmore](https://www.setmore.com/pricing), [Fresha](https://www.fresha.com/pricing), [AgendaPro Chile](https://get.agendapro.com/agendapro-cl-planes). No se atribuyen precios locales a Fresha o AgendaPro porque no se obtuvo una cotización chilena comparable. Esta comparación no sustituye entrevistas ni análisis exhaustivo de competidores.

## Modelo de negocio propuesto

**Cliente comprador:** dueño o administrador de un negocio de belleza y cuidado personal de un local; usuarios: administración, recepción y profesionales. Problema a validar: datos dispersos y poca claridad sobre actividad e ingresos registrados. Si solo necesita una agenda gratuita, probablemente no sea cliente inicial adecuado.

**Oferta inicial:** Soly Gestión, un plan por negocio, con clientes, registro de citas, reportes e importación. Mantener temporalmente el límite actual de 20 cuentas para evitar un cambio de permisos sin validar. Un local es condición comercial del piloto; no implica que haya gestión de sucursales implementada. Revisar almacenamiento por tamaño y costo antes de ofrecer 10.000 archivos como argumento de venta.

**Precio final definido por el fundador:** $23.000 CLP mensuales por negocio, IVA incluido, para todos los rubros. No sumar IVA sobre ese importe. Con IVA del 19%, el desglose aproximado al peso es $19.328 netos y $3.672 de IVA; cálculo base: 23.000 / 1,19. La disposición a pagar y rentabilidad siguen por validar, pero el precio de la oferta queda fijado. Fuente de la tasa: [SII](https://www.sii.cl/preguntas_frecuentes/impuestos_mensuales/001_130_0572.htm). El cambio de importe en Flow no implementa por sí mismo la emisión de documentos tributarios.

**Experimento:** entrevistar diez dueños repartidos entre barberías, salones y estética, incluyendo uñas/pestañas o spas. Ofrecer cinco pilotos: dos barberías, un salón y dos centros de estética o estudios especializados. Es una muestra exploratoria, insuficiente para validar todos los rubros. Medir activación, soporte, valor percibido y conversión por rubro. Mantener el precio final de $23.000 CLP, IVA incluido, y onboarding acompañado; registrar objeciones y costos sin introducir precios alternativos. Un plan común inicial para todos los rubros.

**Implementación:** durante el piloto, importación y capacitación acompañadas sin cargo adicional. Medir horas para definir un onboarding sostenible dentro del precio mensual. Cualquier servicio adicional futuro requiere una oferta separada y explícita; no forma parte del plan definido.

**Cobro inicial:** si se mantiene la arquitectura actual, explicar “acceso por 30 días, renovación manual”. Para vender suscripción automática, completar y verificar el ciclo recurrente antes. No ofrecer descuentos anuales hasta conocer retención y capacidad de soporte.

**Costos:** infraestructura, base de datos y archivos, comisión de cobro, correo, consumo de IA cuando corresponda, horas de soporte, onboarding, adquisición y desarrollo. No vender IA ni mensajería ilimitadas. Registrar consumo por negocio antes de incluirlas en un plan.

### Escenarios ilustrativos, no proyección

Precio final: $23.000 con IVA. Ingreso neto por cuenta: 23.000 / 1,19 = $19.327,73 aproximadamente. Supuesto de costo variable neto por cuenta/mes: $10.000, todavía por validar. Se excluye IVA de los ingresos para calcular contribución. Los importes se calculan sin redondear la base y se muestran redondeados al peso; el margen excluye costos fijos, desarrollo, impuesto a la renta y adquisición.

| Cuentas pagadoras | Cobro mensual con IVA | Ingreso neto mensual | Costos variables | Contribución mensual |
|---|---:|---:|---:|---:|
| 10 | $230.000 | $193.277 | $100.000 | $93.277 |
| 30 | $690.000 | $579.832 | $300.000 | $279.832 |
| 100 | $2.300.000 | $1.932.773 | $1.000.000 | $932.773 |

Contribución por cuenta: aproximadamente $9.328. Con costos fijos hipotéticos de $1.000.000, equilibrio operativo en 108 cuentas, sin adquisición ni desarrollo inicial. Si el costo variable baja a $5.000, se requieren 70 cuentas. Si sube a $20.000, la contribución pasa a ser negativa y crecer no permite alcanzar equilibrio. Con este precio, estandarizar onboarding y soporte es una prioridad. No usar estos escenarios para comprometer gasto sin reemplazar supuestos por datos.

Medir: activación (primeros clientes cargados, primera cita y primer reporte), negocios activos semanalmente, conversión de piloto a pago, segunda renovación, cancelaciones, minutos de soporte por cuenta y costo de adquisición. CAC = gasto de adquisición / nuevos clientes pagadores; recuperación = CAC / contribución mensual por cliente. No estimar LTV con una cohorte pequeña y sin historial.

## Plan de salida: seis semanas como hipótesis de trabajo

**Actualización:** usar el [roadmap operativo](ROADMAP.md) para ejecutar y marcar avances. El calendario de esta sección queda como referencia inicial; el roadmap lo sustituye con dependencias y criterios de cierre, sin fechas comprometidas.

| Etapa | Entregable | Criterio para avanzar | Responsable propuesto |
|---|---|---|---|
| Semana 1 | Entrevistas y oferta enfocada; priorización técnica | Diez entrevistas, problema recurrente identificado y cinco interesados en probar | Fundador/producto |
| Semanas 1–2 | Cobros corregidos, pruebas de aislamiento, release y respaldo | Ningún P0 abierto; pago y restauración demostrados en ensayo | Ingeniería |
| Semanas 2–3 | Rebranding aplicado y onboarding | Un dueño completa carga inicial, cita y consulta de reporte sin intervención técnica | Diseño/producto |
| Semanas 3–4 | Cinco pilotos acompañados | Uso real, errores registrados y tiempo de soporte medido | Fundador/soporte |
| Semanas 5–6 | Evaluación comercial | Meta propuesta: tres de cinco pagan y se documentan razones de compra/rechazo | Fundador |
| Posterior | Segunda renovación y expansión | Evidencia de renovación antes de escalar publicidad | Producto/comercial |

El calendario depende de capacidad, acceso a cuentas y gravedad de los fallos. La segunda renovación puede ocurrir fuera de estas seis semanas. Si los pilotos solo valoran reservas online, resolver esa necesidad o cambiar la propuesta antes de invertir en adquisición.

Antes de producción abierta: autenticación y recuperación verificadas, roles y datos aislados, cobro recuperable, restauración ensayada, soporte con responsable y horarios, términos y política de datos acordes al servicio, canal para exportación/eliminación de información y monitoreo operativo. Son entregables pendientes de implementación/verificación, no requisitos ya satisfechos.

## Validación local de esta revisión

- ESLint: terminó con cero errores y diez advertencias; varias son de hooks en sesión y cobro.
- Build: terminó correctamente, incluyendo generación PWA; advirtió bundle principal de 599,40 kB y datos Browserslist antiguos.
- Vitest: dos archivos, seis pruebas aprobadas. Cubren normalización de importación y hook de KPIs; no cubren el ciclo de cobro, aislamiento SQL ni recorridos completos.
- Suite SQL RLS: encontrada, no ejecutada. CI actual no la integra.
- No se inspeccionó producción ni se realizaron pagos, despliegues o cambios en la base de datos.
- Se preservaron cambios previos del repositorio. La entrega inicial agregó documentación y una propuesta visual; la decisión posterior de precio actualizó también importes locales de frontend, landing, metadatos y creación de pagos Flow. No se desplegaron estos cambios.

## Decisiones pendientes del fundador

Venta SaaS a varios negocios y ampliación a belleza y cuidado personal: confirmadas. Dirección visual: aceptada. Quedan por definir país inicial, validación del nombre Soly, capacidad de acompañar pilotos y renovación manual o automática. La propuesta ofrece una base concreta; estas decisiones pueden cambiar el plan antes de aplicar el rebranding al producto.
