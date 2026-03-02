import * as CanonicalBuilderMod from "../../../lib/tx/canonical-builder";

export type GasEstimate = { gas: number; bytes: number; model: "real" | "heuristic" };

function toBytesLen(x: unknown): number {
  try {
    return Buffer.from(JSON.stringify(x)).length;
  } catch {
    return 0;
  }
}

export async function estimateGas(input: { msgs: unknown[]; memo?: string }): Promise<GasEstimate> {
  // Try to use a real estimate if your CanonicalTxBuilder exposes it
  const CanonicalTxBuilder: any =
    (CanonicalBuilderMod as any).CanonicalTxBuilder ?? (CanonicalBuilderMod as any).default;

  if (CanonicalTxBuilder) {
    try {
      const builder = new CanonicalTxBuilder();
      const fn = builder.estimateGas || builder.simulate || builder.estimate || null;

      if (typeof fn === "function") {
        const res = await fn.call(builder, input);
        const gas = Number(res?.gas ?? res?.gasUsed ?? res ?? NaN);
        if (Number.isFinite(gas)) {
          return { gas, bytes: toBytesLen(input), model: "real" };
        }
      }
    } catch {
      // fall through to heuristic
    }
  }

  // Heuristic model (stable + CI-safe)
  // - base cost
  // - per-msg cost
  // - per-byte cost
  const bytes = toBytesLen(input);
  const base = 50_000;
  const perMsg = 30_000 * input.msgs.length;
  const perByte = Math.floor(bytes * 12); // rough pressure factor
  return { gas: base + perMsg + perByte, bytes, model: "heuristic" };
}
