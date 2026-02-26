import { getRoutesFRecordById } from "./store";

export type Status = "draft" | "published" | "archived" | "active" | "inactive";

const allowedTransitions: Record<Status, Status[]> = {
  draft: ["published", "inactive"],
  published: ["archived", "inactive"],
  archived: ["inactive"],
  active: ["inactive"],
  inactive: ["active"],
};

export function validateTransition(id: string, target: string) {
  if (!id || !target) return { ok: false, error: "missing-input" };

  const rec = getRoutesFRecordById(id);
  if (!rec) return { ok: false, error: "not-found" };

  const current = (rec.status as Status) || "inactive";
  const t = target as Status;

  if (!Object.prototype.hasOwnProperty.call(allowedTransitions, current)) {
    return { ok: false, error: "invalid-current-status" };
  }

  const allowed = allowedTransitions[current].includes(t);
  const reasons: Array<{ code: string; message: string }> = [];
  if (!allowed) {
    reasons.push({ code: "transition-not-allowed", message: `cannot transition ${current} -> ${t}` });
  }

  return { ok: true, allowed, reasons };
}
