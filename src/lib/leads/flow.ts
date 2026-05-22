// Lead flow configuration — the source of truth for step ORDER.
//
// To rearrange the maintenance intake flow (e.g. move contact AFTER
// qualifier for the contact-after-qualifier conversion experiment),
// rearrange the array. Every consumer of step order — total step
// count, current step's label, "what comes next" navigation — reads
// from this single config.
//
// What this config does NOT do (intentionally):
//   - Render components (that's the orchestrator's switch statement)
//   - Own per-step state (the orchestrator's useState + formData
//     already cover this; per-step state would be premature)
//   - Define handlers (each step's continue/back logic is currently in
//     the orchestrator; moving them here would couple the config to
//     too many implementation details too soon)
//
// The minimal contract: ids + labels + a way to look up a step's
// index. That's enough to reorder safely without touching renderer
// or handler code.

export type MaintenanceStepId =
  | "address"
  | "contact"
  | "qualifier"
  | "referral"
  | "quote";

export interface MaintenanceStepDef {
  id: MaintenanceStepId;
  /** Short label for the progress bar — "Step 2 of 5: Your pool" */
  label: string;
}

/**
 * The maintenance lead intake flow, in order. Index 0 is the first
 * step the user sees after the modal opens (assuming no smart-skip
 * via prefill).
 */
export const MAINTENANCE_FLOW: readonly MaintenanceStepDef[] = [
  { id: "address", label: "Address" },
  { id: "contact", label: "Your info" },
  { id: "qualifier", label: "Your pool" },
  { id: "referral", label: "How you found us" },
  { id: "quote", label: "Your quote" },
] as const;

/**
 * Convenience: how many steps are in the flow. The orchestrator uses
 * this for the "Step X of N" progress label and for clamping
 * goNext/goBack.
 */
export const MAINTENANCE_FLOW_STEPS = MAINTENANCE_FLOW.length;

/**
 * Look up a step by its 1-indexed position. Returns null if out of
 * range — callers should treat that as "no current step" (e.g. modal
 * just opened and currentStep=0).
 */
export function getStepAt(position: number): MaintenanceStepDef | null {
  if (!Number.isInteger(position) || position < 1 || position > MAINTENANCE_FLOW.length) {
    return null;
  }
  return MAINTENANCE_FLOW[position - 1] ?? null;
}

/**
 * Look up a step's 1-indexed position by id. Returns -1 if the id
 * isn't in the flow.
 */
export function getStepPosition(id: MaintenanceStepId): number {
  const idx = MAINTENANCE_FLOW.findIndex((s) => s.id === id);
  return idx >= 0 ? idx + 1 : -1;
}
