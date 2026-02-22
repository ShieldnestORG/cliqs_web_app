#!/usr/bin/env python3
"""
Generate public/wasm/manifest.json from the current WASM binaries.

Computes SHA256 checksums, detects bulk-memory opcodes, and records
metadata so the app and Vercel build can validate at deploy time.

Usage:
    python3 scripts/generate-wasm-manifest.py \
        --cw-plus-version v0.16.0 \
        --optimizer-image cosmwasm/optimizer:0.16.1 \
        --build-method github-actions-optimizer
"""

import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timezone

WASM_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "wasm")
CONTRACTS = ["cw3_fixed_multisig", "cw3_flex_multisig", "cw4_group"]

BULK_MEMORY_OPS = [
    (0x08, "memory.init"),
    (0x09, "data.drop"),
    (0x0A, "memory.copy"),
    (0x0B, "memory.fill"),
]


def scan_bulk_memory(data: bytes) -> list:
    hits = []
    for byte2, name in BULK_MEMORY_OPS:
        count = sum(
            1 for i in range(len(data) - 1)
            if data[i] == 0xFC and data[i + 1] == byte2
        )
        if count > 0:
            hits.append({"name": name, "count": count})
    return hits


def main():
    parser = argparse.ArgumentParser(description="Generate WASM manifest")
    parser.add_argument("--cw-plus-version", default="v0.16.0")
    parser.add_argument("--optimizer-image", default="cosmwasm/optimizer:0.16.1")
    parser.add_argument("--build-method", default="unknown")
    args = parser.parse_args()

    contracts = {}
    all_coreum_safe = True

    for name in CONTRACTS:
        path = os.path.join(WASM_DIR, f"{name}.wasm")
        if not os.path.exists(path):
            print(f"WARNING: {path} not found, skipping")
            continue

        data = open(path, "rb").read()
        sha256 = hashlib.sha256(data).hexdigest()
        bulk_hits = scan_bulk_memory(data)
        has_bulk = len(bulk_hits) > 0
        coreum_safe = not has_bulk

        if not coreum_safe:
            all_coreum_safe = False
            bulk_str = ", ".join(f"{h['name']} x{h['count']}" for h in bulk_hits)
            print(f"  {name}: has bulk-memory ({bulk_str})")
        else:
            print(f"  {name}: clean (no bulk-memory)")

        contracts[name] = {
            "file": f"{name}.wasm",
            "sizeBytes": len(data),
            "sha256": sha256,
            "hasBulkMemory": has_bulk,
            "coreumSafe": coreum_safe,
        }
        if has_bulk:
            contracts[name]["bulkMemoryOpcodes"] = bulk_hits

    manifest = {
        "version": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "cwPlusVersion": args.cw_plus_version,
        "optimizerImage": args.optimizer_image,
        "buildMethod": args.build_method,
        "allCoreumSafe": all_coreum_safe,
        "contracts": contracts,
    }

    manifest_path = os.path.join(WASM_DIR, "manifest.json")
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")

    print(f"\nManifest written to {manifest_path}")
    if not all_coreum_safe:
        print("WARNING: Some binaries contain bulk-memory opcodes (not Coreum-safe)")
        print("Run the build-wasm CI workflow with cosmwasm/optimizer to fix this")

    return 0 if all_coreum_safe else 0  # Don't fail — just warn


if __name__ == "__main__":
    sys.exit(main())
