# Rollback Runbook — `app.cliqs.io`

> **Cluster:** deployment · **Tags:** vercel, rollback, incident, runbook, soc2, change-management · **Related:** [INFRASTRUCTURE.md](INFRASTRUCTURE.md), [SOC2-GAP-ASSESSMENT.md](security/SOC2-GAP-ASSESSMENT.md), [README.md](security/README.md)

**Rehearsed against live production on 2026-08-17.** Every number below was measured during that drill, not estimated. This replaces the previous "rollback is fast, but nobody has rehearsed it — do not record this as a working control" caveat in [INFRASTRUCTURE.md](INFRASTRUCTURE.md).

---

## The short version

```bash
vercel rollback <previous-deployment-url> --yes
```

Back on the previous build in **under 10 seconds**, with **no error served to users**. You do not need a git revert, a rebuild, or CI. Rolling back does **not** change `main`.

---

## Drill results, 2026-08-17

Method: poll `https://app.cliqs.io/` once per second throughout, recording HTTP status and the Next.js `buildId`, then switch production twice — back one deployment, then forward again.

| Measure | Rollback | Roll-forward |
| --- | --- | --- |
| CLI wall time | **3.0 s** | **3.9 s** |
| First request served by the target build | **t+4.5 s** | **t+7.1 s** |
| Fully settled on the target build | **t+9 s** | **t+8 s** |
| Non-200 responses | **0** | **0** |

**58 samples across the whole drill, 100% HTTP 200.** There was no downtime and no error window in either direction.

Deployments used: `dpl_3CxtzUWT572MCoGqQ4TmFx3XHhJJ` (commit `6420f60`) ⇄ `dpl_gGTdr4oNPcUu639iEVHReRPRgqKv` (commit `0960113`). Production was returned to `6420f60` and verified identical to the pre-drill state — same deployment id, same `buildId`, same commit.

### The one finding that matters

**The switch is not atomic across edges.** At **t+7.9 s** — three seconds *after* the new build had begun serving — one request was still answered by the **old** build. Expect a **mixed-serving window of roughly 5–10 seconds** where some users get the old build and some the new one.

Consequences to plan for:

- A user can load HTML from one build and fetch a chunk or an API response from the other. Next.js asset filenames are content-hashed, so a stale HTML reference to a since-removed chunk 404s rather than executing the wrong code.
- **Never roll back across a breaking API-contract change without expecting that window.** If a deploy changed a request or response shape, some in-flight clients will be on the wrong side of it for several seconds.
- Do not judge whether a rollback worked from a single `curl`. Sample for at least 15 seconds — the drill's own straggler would have produced exactly that false negative.

---

## Procedure

### 1. Identify what is live and what to go back to

```bash
vercel ls cliqs-web-app
```

Or, with commit SHAs attached (more useful during an incident):

```bash
TOKEN=$(cat "$HOME/Library/Application Support/com.vercel.cli/auth.json" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -sS -H "Authorization: Bearer $TOKEN" \
  "https://api.vercel.com/v6/deployments?projectId=prj_iTlVqki62iErJysdgwyLedsHTX8P&teamId=team_vKtHO2mWwIlSwyVgcirolUIt&target=production&limit=5" \
  | python3 -c "
import json,sys,datetime
for x in json.loads(sys.stdin.read(),strict=False)['deployments']:
    m=x.get('meta',{}) or {}
    ts=datetime.datetime.fromtimestamp(x['created']/1000).strftime('%H:%M:%S')
    print(ts, x['uid'], (m.get('githubCommitSha') or '')[:8], x.get('readyState'), 'https://'+x['url'])"
```

**Write down the id and URL of the deployment that is live right now.** That is your way back if the rollback target is also bad.

### 2. Roll back

```bash
vercel rollback <previous-deployment-url> --yes
```

### 3. Verify — for at least 15 seconds, not once

```bash
for i in $(seq 1 15); do
  code=$(curl -sS -o /tmp/rb.html -w '%{http_code}' https://app.cliqs.io/)
  echo "$code $(grep -o '"buildId":"[^"]*"' /tmp/rb.html | head -1)"
  sleep 1
done
```

Every line should read `200`, and the `buildId` should settle on one value. A single mismatched sample in the first ~10 seconds is the expected edge straggler, not a failure.

### 4. Go forward again when the fix is ready

```bash
vercel promote <good-deployment-url> --yes
```

`promote` is also how you undo a rollback that did not help — it targets an explicit deployment, so it works in either direction.

---

## Important: rollback does not touch `main`

`main` **auto-deploys production** (see [INFRASTRUCTURE.md](INFRASTRUCTURE.md)). A rollback only re-points the production alias at an older build. It does **not** revert the commit.

So after any rollback:

1. The bad commit is still the head of `main`.
2. **The next merge to `main` ships whatever is on `main` — including the bad commit you just rolled away from**, plus the new change on top.

**Therefore: after rolling back, either revert the bad commit on `main` or freeze merges until it is fixed.** Rolling back and then merging an unrelated PR silently re-ships the problem. This is the most likely way to turn one incident into two.

---

## What this control does and does not cover

- **Covers:** a bad build that is live and needs to stop being live, fast, with no rebuild.
- **Does not cover:** anything that has already been written to the database. Rolling back the app does not roll back data. A migration or a destructive route that ran under the bad build stays run.
- **Does not cover:** environment-variable changes. Those apply to new deployments; re-check them separately.
- **Not rehearsed:** rollback during an actual incident under load. The drill ran against normal traffic on a healthy site.

---

*Drill run 2026-08-17 by re-pointing production twice and sampling once per second throughout. Re-run it after any change to the deploy pipeline, and update the measured numbers above rather than leaving stale ones in place.*
