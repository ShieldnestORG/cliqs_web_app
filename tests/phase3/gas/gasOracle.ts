import type { GasEstimate } from "./gasEstimator";

export const GAS_BUDGETS = {
  normal: 1_500_000,
  stressed: 3_000_000,
  nearLimit: 5_000_000,
};

export function classify(est: GasEstimate) {
  if (est.gas <= GAS_BUDGETS.normal) return "normal";
  if (est.gas <= GAS_BUDGETS.stressed) return "stressed";
  if (est.gas <= GAS_BUDGETS.nearLimit) return "nearLimit";
  return "overLimit";
}
