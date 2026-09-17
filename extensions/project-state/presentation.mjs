/**
 * project-state presentation — read-only command rendering
 *
 * Pure formatting helpers for the three inspection commands. They read from
 * already-loaded state/record documents and never touch the filesystem, so the
 * commands stay read-only.
 */

/**
 * Render the current resume projection for `/session-status`.
 *
 * `currentUsage` is the aggregated usage of the live session, when known.
 */
export function formatStatus(state, currentUsage) {
  const spec = state?.activeSpec;
  const specLine = spec?.number
    ? `spec: #${spec.number}${state?.phase ? ` (${state.phase})` : ""}`
    : "spec: (none)";
  const cost =
    currentUsage?.cost?.total != null
      ? `$${currentUsage.cost.total.toFixed(4)} (${currentUsage.totalTokens ?? 0} tokens)`
      : "unknown";
  return [
    `branch: ${state?.branch ?? "(none)"}`,
    specLine,
    `phase: ${state?.phase ?? "(none)"}`,
    `pending: ${state?.pendingWork ?? "(none)"}`,
    `last session: ${state?.lastSessionId ?? "(none)"}`,
    `current session cost: ${cost}`,
  ].join("\n");
}

/**
 * Render recent session records for `/session-history` as one line each:
 * date, spec, outcome, known cost, and a concise summary when present.
 */
export function formatHistory(records, { limit = 10 } = {}) {
  const list = (records ?? []).slice(0, limit);
  if (list.length === 0) return "No recorded sessions yet.";
  return list
    .map((r) => {
      const date = (r.finalizedAt ?? r.startedAt ?? "").slice(0, 10) || "-";
      const spec = r.activeSpec?.number ? `#${r.activeSpec.number}` : "-";
      const outcome = r.outcome ?? "-";
      const cost = r.usage?.cost?.total != null ? `$${r.usage.cost.total.toFixed(4)}` : "-";
      const summary = r.summary ? ` — ${r.summary}` : "";
      return `${date}  spec=${spec}  outcome=${outcome}  cost=${cost}${summary}`;
    })
    .join("\n");
}

/**
 * Render current, recent, and project-aggregate known cost for `/session-cost`.
 * Sessions without reported cost are counted as gaps, never guessed.
 */
export function formatCost(currentUsage, records, { limit = 10 } = {}) {
  const current = currentUsage?.cost?.total;
  const recent = (records ?? []).slice(0, limit);

  const recentTotal = sumKnownCost(recent);
  const aggregateTotal = sumKnownCost(records ?? []);

  const currentLine =
    current != null ? `$${current.toFixed(4)}` : "unknown";
  const recentLine =
    recentTotal.known > 0 ? `$${recentTotal.cost.toFixed(4)}` : "unknown";
  const aggregateLine =
    aggregateTotal.known > 0 ? `$${aggregateTotal.cost.toFixed(4)}` : "unknown";

  return [
    `current session: ${currentLine}`,
    `recent (${recentTotal.known} of ${recent.length}): ${recentLine}`,
    `project aggregate (${aggregateTotal.known} sessions): ${aggregateLine}`,
  ].join("\n");
}

function sumKnownCost(records) {
  let cost = 0;
  let known = 0;
  for (const r of records ?? []) {
    const total = r?.usage?.cost?.total;
    if (typeof total === "number" && Number.isFinite(total)) {
      cost += total;
      known += 1;
    }
  }
  return { cost, known };
}
