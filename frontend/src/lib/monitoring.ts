import * as Sentry from "@sentry/react";

// Wraps Sentry.metrics calls with metric names and options.
// Tags are embedded in metric names (name.tag_value) since @sentry/react v10
// MetricOptions does not expose a typed tags field.
export const track = {
  // Auth
  login: (success: boolean) =>
    Sentry.metrics.count(`auth.login.${success ? "ok" : "fail"}`, 1),
  signup: () =>
    Sentry.metrics.count("auth.signup", 1),

  // Session
  sessionLoadTime: (ms: number, source: "db" | "metadata") =>
    Sentry.metrics.distribution(`session.load_ms.${source}`, ms),

  // Customers
  customerCreated: () =>
    Sentry.metrics.count("customer.created", 1),
  customerDeleted: () =>
    Sentry.metrics.count("customer.deleted", 1),
  customerBulkDeleted: (count: number) => {
    Sentry.metrics.count("customer.bulk_deleted", 1);
    Sentry.metrics.distribution("customer.bulk_delete_size", count);
  },

  // Appointments
  appointmentCreated: () =>
    Sentry.metrics.count("appointment.created", 1),
  appointmentUpdated: () =>
    Sentry.metrics.count("appointment.updated", 1),

  // Import
  importCompleted: (imported: number, skipped: number, source: string) => {
    Sentry.metrics.count(`import.completed.${source}`, 1);
    Sentry.metrics.distribution("import.rows_imported", imported);
    Sentry.metrics.distribution("import.rows_skipped", skipped);
  },
  importFailed: () =>
    Sentry.metrics.count("import.failed", 1),

  // Edge functions — name encoded as metric suffix to keep filtering simple
  edgeFunctionDuration: (name: string, ms: number, success: boolean) =>
    Sentry.metrics.distribution(
      `edge_fn.${name}.${success ? "ok" : "fail"}_ms`,
      ms
    ),

  // Billing
  subscriptionStarted: () =>
    Sentry.metrics.count("billing.subscription_started", 1),
  subscriptionCancelled: () =>
    Sentry.metrics.count("billing.subscription_cancelled", 1),
};
