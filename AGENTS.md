# Continuidad del proyecto Soly

Antes de analizar o modificar el producto, leer:

1. `docs/ROADMAP.md`: tareas, dependencias, estado y criterios de cierre.
2. `docs/ESTADO-IMPLEMENTACION.md`: inventario de código existente, hallazgos y verificaciones pendientes.
3. `docs/ESTRATEGIA-PRODUCCION-2026-09.md`: decisiones de negocio y alcance.

## Decisiones vigentes del usuario

- SaaS B2B para varios negocios de belleza y cuidado personal: barberías, salones, estética, uñas/pestañas y spas.
- Soly; promesa “Tu negocio, en orden”; dirección visual en `docs/soly-direccion-de-marca.html` aprobada, todavía pendiente de aplicación completa al producto.
- Plan de $23.000 CLP mensuales por negocio, IVA incluido. No sumar IVA de nuevo al importe enviado a Flow.

## Estado y evidencia

- El inventario es una fotografía fechada, no una garantía de producción. Contrastar con el código actual antes de editar.
- Distinguir “implementado en código”, “verificado con pruebas”, “publicado” y “pendiente”. No marcar una tarea completa por existir un componente o una tabla.
- Reutilizar los módulos descritos; no reconstruir CRUD, importación, auth o billing sin revisar su implementación actual.
- Preservar los cambios locales ajenos. El historial de migraciones 0026/0027 requiere revisión antes de modificar la base de datos.
- No incorporar valores de secretos ni datos reales de clientes en documentación, ejemplos o pruebas.
- Al terminar una tarea, actualizar su estado y evidencia en el roadmap y corregir el inventario si cambió la funcionalidad.

## Cuando se trabaje con varios agentes

Usar IDs del roadmap para acotar tareas. Acordar responsabilidad de archivos compartidos (API, tipos, rutas, features y migraciones) y evitar ediciones concurrentes del mismo archivo. Un integrador mantiene el roadmap coherente con los resultados verificados. El inventario incluye una propuesta de división por áreas.

Estas pautas no crean tareas ni solicitan delegación automática: seguir el alcance autorizado por el usuario.
