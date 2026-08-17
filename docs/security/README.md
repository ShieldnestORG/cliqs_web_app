# Security Docs

> **Cluster:** security · **Tags:** soc2, security, index, api-auth, ssrf, headers · **Related:** [SOC2-GAP-ASSESSMENT.md](SOC2-GAP-ASSESSMENT.md), [INFRASTRUCTURE.md](../INFRASTRUCTURE.md), [README.md](../../README.md)

Index for `docs/security/`.

| Doc | What it covers |
| --- | --- |
| [SOC2-GAP-ASSESSMENT.md](SOC2-GAP-ASSESSMENT.md) | Canonical security document. Security-TSC technical-controls gap assessment: nine control domains, the full 38-route API inventory with an auth column, what PR #31 remediated, and the prioritized follow-up list (L1–L6 plus CSP). |

Security facts documented elsewhere:

- [INFRASTRUCTURE.md](../INFRASTRUCTURE.md) — "Edge & outbound controls": the security headers `next.config.js` sets and the BYODB SSRF host validation, in operational terms.
- [SETUP.md](../../SETUP.md) — "Data retention & deletion (hosted MongoDB)": what is stored, what auto-expires, and the member-authorized export/wipe/delete controls.
- [README.md](../../README.md) — "Known Issues": the `elliptic` position (present but unreachable; two copies ship, only one visible to npm).

Standing caveats, current as of 2026-08-16 — do not describe any of these as done:

- Uniform authorization across the remaining API routes (follow-up L1). Only 3 of 38 routes enforce ADR-36 today.
- No security audit log (L2), no rate limiting (L3), no Content-Security-Policy.
- Dependency remediation (PR #29) is **open and unmerged**.
