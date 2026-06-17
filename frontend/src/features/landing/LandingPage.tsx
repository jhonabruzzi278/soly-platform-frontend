import { Link } from "react-router-dom";
import { MaterialIcon } from "../../components/common/MaterialIcon";

const FEATURES = [
  { icon: "calendar_month", title: "Agenda inteligente", desc: "Gestiona citas, horarios y disponibilidad en tiempo real." },
  { icon: "group", title: "Gestión de clientes", desc: "Historial completo, contactos y seguimiento de cada cliente." },
  { icon: "bar_chart", title: "Reportes y KPIs", desc: "Revenue, ocupación y métricas de crecimiento al instante." },
  { icon: "inventory_2", title: "Control de inventario", desc: "Stock, productos y alertas de reabastecimiento integradas." },
  { icon: "badge", title: "Multi-usuario", desc: "Hasta 20 usuarios con roles y permisos diferenciados." },
  { icon: "support_agent", title: "Soporte en español", desc: "Equipo local disponible para ayudarte cuando lo necesitas." },
];

const PLAN_FEATURES = [
  "Hasta 20 usuarios",
  "Hasta 10.000 archivos",
  "Gestión de clientes",
  "Citas y agenda",
  "Reportes y KPIs",
  "Inventario",
  "Dashboard avanzado",
  "Soporte prioritario",
];

const BUSINESSES = ["Barberías", "Salones de belleza", "Clínicas", "Centros de fitness", "Spas", "Talleres"];

export const LandingPage = () => (
  <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]" style={{ fontFamily: "inherit" }}>

    {/* Nav */}
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--primary)] text-xs font-bold text-[var(--primary-foreground)]">S</div>
          <span className="text-sm font-semibold tracking-tight">Soly</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
          >
            Iniciar sesión
          </Link>
          <Link
            to="/login?tab=signup"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 text-xs font-semibold text-[var(--primary-foreground)] shadow-[var(--neu-shadow-raised)] transition-all hover:opacity-90 active:scale-[0.97]"
          >
            <MaterialIcon name="rocket_launch" size={13} />
            Empezar gratis
          </Link>
        </div>
      </div>
    </header>

    {/* Hero */}
    <section className="relative overflow-hidden py-20 sm:py-28">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 50% 0%, color-mix(in srgb, var(--primary) 12%, transparent), transparent)"
        }}
      />
      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/8 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[var(--primary)]">
          <MaterialIcon name="location_on" size={11} />
          Para negocios chilenos
        </span>

        <h1 className="mt-5 text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
          Tu negocio,<br />
          <span className="text-[var(--primary)]">simplificado.</span>
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[var(--muted-foreground)] text-balance">
          Agenda, clientes, inventario y reportes — todo en un solo lugar.
          Diseñado para barberías, salones, clínicas y más.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/login?tab=signup"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-6 text-sm font-semibold text-[var(--primary-foreground)] shadow-[var(--neu-shadow-raised)] transition-all hover:opacity-90 active:scale-[0.97] sm:w-auto"
          >
            <MaterialIcon name="card_giftcard" size={17} />
            Probar gratis — 14 días
          </Link>
          <Link
            to="/login?tab=signup&redirect=/billing%3FskipTrial=1"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[var(--primary)]/40 bg-[var(--card)] px-6 text-sm font-semibold text-[var(--primary)] shadow-[var(--neu-shadow-raised)] transition-all hover:border-[var(--primary)]/70 active:scale-[0.97] sm:w-auto"
          >
            <MaterialIcon name="credit_card" size={17} />
            Suscribirse · $49.000/mes
          </Link>
        </div>

        <p className="mt-4 text-xs text-[var(--muted-foreground)]">
          Sin tarjeta de crédito requerida para la prueba · Cancela cuando quieras
        </p>

        {/* Business types pill row */}
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {BUSINESSES.map((b) => (
            <span key={b} className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs text-[var(--muted-foreground)] shadow-[var(--neu-shadow-raised)]">
              {b}
            </span>
          ))}
        </div>
      </div>
    </section>

    {/* Features */}
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">Todo lo que necesitas</h2>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">Un sistema completo para gestionar y crecer.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-transparent bg-[var(--card)] p-5 shadow-[var(--neu-shadow-raised)] transition-transform duration-150 hover:-translate-y-0.5"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
                <MaterialIcon name={f.icon} size={20} />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-[var(--muted-foreground)]">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Pricing */}
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-md px-4 sm:px-6">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">Precio único, sin sorpresas</h2>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">Un plan con todo incluido para tu negocio.</p>
        </div>

        <div className="rounded-2xl border-2 border-[var(--primary)]/50 bg-[var(--card)] shadow-[var(--neu-shadow-raised)] overflow-hidden">
          <div className="bg-[var(--primary)] px-4 py-2.5 text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--primary-foreground)]">Business · Todo incluido</span>
          </div>
          <div className="p-6 space-y-5">
            <div className="flex items-end gap-2">
              <span className="text-5xl font-bold tracking-tight tabular-nums">$49.000</span>
              <span className="pb-1 text-sm text-[var(--muted-foreground)] leading-snug">CLP<br />/ mes</span>
            </div>

            <ul className="grid grid-cols-2 gap-y-2.5 gap-x-4">
              {PLAN_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <MaterialIcon name="check" size={13} className="shrink-0 text-[var(--primary)]" />
                  {f}
                </li>
              ))}
            </ul>

            <div className="space-y-3 pt-1">
              {/* Trial CTA */}
              <Link
                to="/login?tab=signup"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--primary)]/40 bg-[var(--card)] text-sm font-semibold text-[var(--primary)] shadow-[var(--neu-shadow-raised)] transition-all hover:border-[var(--primary)]/70 active:scale-[0.97]"
              >
                <MaterialIcon name="card_giftcard" size={16} />
                Prueba gratis 14 días
              </Link>

              {/* Direct pay CTA */}
              <Link
                to="/login?tab=signup&redirect=/billing%3FskipTrial=1"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] text-sm font-semibold text-[var(--primary-foreground)] shadow-[var(--neu-shadow-raised)] transition-all hover:opacity-90 active:scale-[0.97]"
              >
                <MaterialIcon name="credit_card" size={16} />
                Pagar ahora · $49.000/mes
              </Link>
            </div>

            <p className="text-center text-xs text-[var(--muted-foreground)]">
              IVA incluido · Facturación mensual · Cancela cuando quieras
            </p>
          </div>
        </div>
      </div>
    </section>

    {/* Trust */}
    <section className="border-t border-[var(--border)] py-12">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="grid grid-cols-3 gap-6 text-center sm:gap-8">
          <div className="space-y-1.5">
            <MaterialIcon name="lock" size={22} className="mx-auto text-[var(--primary)]" />
            <p className="text-sm font-semibold">Pago seguro</p>
            <p className="text-xs text-[var(--muted-foreground)]">SSL 256-bit</p>
          </div>
          <div className="space-y-1.5">
            <MaterialIcon name="verified_user" size={22} className="mx-auto text-[var(--primary)]" />
            <p className="text-sm font-semibold">Flow.cl</p>
            <p className="text-xs text-[var(--muted-foreground)]">Pasarela líder Chile</p>
          </div>
          <div className="space-y-1.5">
            <MaterialIcon name="sentiment_satisfied" size={22} className="mx-auto text-[var(--primary)]" />
            <p className="text-sm font-semibold">Sin permanencia</p>
            <p className="text-xs text-[var(--muted-foreground)]">Cancela cuando quieras</p>
          </div>
        </div>
      </div>
    </section>

    {/* Footer */}
    <footer className="border-t border-[var(--border)] py-6">
      <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
        <p className="text-xs text-[var(--muted-foreground)]">
          © {new Date().getFullYear()} Soly · Hecho en Chile 🇨🇱 ·{" "}
          <Link to="/login" className="hover:text-[var(--primary)] transition-colors">Iniciar sesión</Link>
        </p>
      </div>
    </footer>
  </div>
);
