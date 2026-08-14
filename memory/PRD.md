# PRD — Sistema de Gestión de Préstamos

## Original problem statement (resumen)
Aplicación profesional, moderna, segura y responsive para prestamistas: administración completa de clientes, créditos, cuotas, cobranzas, renovaciones, ingresos, egresos y reportes financieros. Moneda: Guaraníes (Gs.) con separador de miles.

## Personas
- Prestamista/propietario: administra su cartera, cobra cuotas y controla caja.
- Cobrador de calle: usa vista móvil para cobros rápidos y consulta de saldos.

## Core requirements (estáticos)
1. Autenticación segura (email/password JWT) — multi-tenant por user_id.
2. Dashboard con 15 KPIs y gráfico de cobros 7 días.
3. CRUD de clientes con código automático e historial completo.
4. Calculadora de préstamos con modalidad diario/semanal/quincenal/mensual.
5. Cronograma de cuotas con estados (pendiente/pagada/vencida/cancelada/pago parcial).
6. Cobro de cuotas (completo, parcial, adelantado) con historial de pagos.
7. Cancelación anticipada con monto editable.
8. Renovación de créditos vinculada al préstamo anterior.
9. Registro de egresos y extracciones separados.
10. Caja diaria con cierre y persistencia del historial.
11. Reportes filtrables (fecha, modalidad, estado) exportables a PDF (window.print).
12. Configuración del prestamista (negocio, datos, texto de recibos).
13. Compartir detalle vía WhatsApp (wa.me).
14. Trazabilidad: no se elimina data histórica; cancelaciones/renovaciones marcan estado.

## What's been implemented — 2026-02
- Backend FastAPI + MongoDB: auth completo (register/login/logout/me/forgot/reset), settings, clients CRUD, loans (calculate/create/detail/pay/cancel/renew), expenses, withdrawals, cash today/close, dashboard stats, reports, overdue list.
- Frontend React con: Layout responsive (sidebar desktop + bottom nav móvil), Login/Register/Forgot/Reset, Dashboard (15 KPIs + chart), Clientes (list + create + detail), Préstamos (list + nuevo + detalle), Cobros integrados en detalle, Cancelación anticipada, Renovación, Caja diaria con cierre, Finanzas (egresos/extracciones), Reportes, Configuración.
- Diseño: paleta verde bosque + rust, tipografías IBM Plex Sans + Space Grotesk, fondo #FAFAFA con tarjetas blancas y bordes 1px.
- Admin seed automático: nutricrispy@gmail.com / Prestamos2026!.

## Backlog (P1/P2)
- P1: Login social Google (Emergent-managed).
- P1: PDFs con librería (jspdf) para descarga real; actualmente window.print.
- P1: Renovaciones/Overdue como páginas dedicadas.
- P2: Copias de seguridad de la BD (export JSON).
- P2: Multi-usuario/roles adicionales.
- P2: Push/recordatorios de vencimientos.
