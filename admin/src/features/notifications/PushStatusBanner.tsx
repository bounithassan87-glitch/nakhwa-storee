/**
 * Says why push notifications are not arriving.
 *
 * Registration is best-effort everywhere else in this feature — an order must
 * never be held up by a notification — but "fails quietly" had turned into
 * "fails invisibly": a device that never registered looked exactly like one
 * that did, from the dashboard and from the database alike. This is the one
 * place that reports the reason. It renders nothing once push is working.
 */
import { useNotifications } from "./NotificationsContext";
import { adviceFor } from "./pushAdvice";

export function PushStatusBanner() {
  const { pushStatus, notificationPermission, requestNotificationPermission } = useNotifications();

  const advice = adviceFor(pushStatus?.outcome, notificationPermission, pushStatus?.detail);
  if (!advice) return null;

  const warn = advice.tone === "warn";
  const Icon = advice.icon;

  return (
    <div
      role="status"
      className={
        "mx-4 mt-4 rounded-2xl border p-4 md:mx-6 " +
        (warn ? "border-danger/30 bg-danger/5" : "border-brand/25 bg-brand-soft")
      }
    >
      <div className="flex items-start gap-3">
        <Icon className={"mt-0.5 h-5 w-5 shrink-0 " + (warn ? "text-danger" : "text-brand-dark")} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">{advice.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">{advice.body}</p>

          {advice.steps && (
            <ol className="mt-2 space-y-1 text-sm text-muted">
              {advice.steps.map((step, i) => (
                <li key={step} className="flex gap-2">
                  <span className="font-bold text-brand-dark">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          )}

          {advice.detail && (
            <p
              dir="ltr"
              className="mt-2 overflow-x-auto rounded-lg bg-bg px-2 py-1 text-start font-mono text-xs text-faint"
            >
              {advice.detail}
            </p>
          )}

          {advice.action && (
            <button
              onClick={requestNotificationPermission}
              className="mt-3 inline-flex h-9 items-center justify-center rounded-xl bg-brand px-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-dark active:scale-[.98]"
            >
              {advice.action}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
