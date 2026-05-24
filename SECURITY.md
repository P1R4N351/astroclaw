# Security Policy

**astroclaw** is an automated P10-processing downstream of [openclaw](https://github.com/openclaw/openclaw). This policy splits security reports along that boundary:

- **Runtime security** (auth, channel adapters, plugin sandboxing, tool boundaries, exec approvals, network proxy, etc.) — issues that exist in both openclaw and astroclaw because they're in the runtime code → **report upstream to openclaw**.
- **Pipeline security** (bless gate bypass, leak through public mirror, scan ruleset miss, worker auth) — issues specific to how astroclaw is produced and published → **report here**.

## Report runtime vulnerabilities upstream

If you found a security issue in:

- The CLI / gateway / agents / channels / tools / plugins / sandboxing
- Any runtime behavior identical between openclaw and astroclaw

→ Report to **[openclaw/openclaw](https://github.com/openclaw/openclaw)** via their [private security advisory](https://github.com/openclaw/openclaw/security/advisories/new) or upstream security contact. The fix lands upstream and flows into astroclaw automatically via the next worker pass.

For the full upstream threat model — operator trust assumptions, what is/isn't a vulnerability under their model, scope decisions on prompt injection, plugin trust, multi-tenant assumptions, exec approvals, etc. — see openclaw's security policy and trust documentation:

- [openclaw security guide](https://docs.openclaw.ai/gateway/security)
- [openclaw trust model](https://docs.openclaw.ai/concepts/trust)

astroclaw inherits all of openclaw's trust assumptions. We do not run a separate threat model.

## Report pipeline vulnerabilities here

These are specific to astroclaw's production process — file as a private [GitHub Security Advisory](https://github.com/P1R4N351/astroclaw/security/advisories/new) on this repo:

- **Bless gate bypass** — a path to land a commit on `main` (and through to public github) without passing the worker-author + diff-size + safe-file + no-leak gates
- **Worker authentication weakness** — a way for non-worker commits to acquire the worker author signature and pass the author gate
- **Pre-push hook bypass** — a path to publish github-bound content that contains internal references the hook is supposed to block
- **Leak through public mirror** — content that should not be public (internal infrastructure references, secrets, tokens, private filesystem paths) reaching `github.com/P1R4N351/astroclaw/main`
- **P10 scan false negative** — a class of P10 violation that ships green because the scanner doesn't check it. Tag the report `scan-ruleset`.

## What we want in a pipeline report

- **Exact path** — which file/script/cron entry has the issue
- **Reproducer** — minimal steps OR a commit demonstrating the bypass
- **Affected output** — what would have leaked / which gate failed open
- **Suggested remediation** — if you have one

## What we don't want

- Upstream runtime issues filed here. Those go to openclaw.
- Scanner-only output without a working reproducer.
- "The P10 scan is missing some other rule" without a concrete violation that landed on `main` because of it.

## Out of scope

Same out-of-scope set as upstream openclaw. Highlights:

- Reports requiring shared-gateway multi-tenant isolation (astroclaw's deployment model is single trusted operator, inherited from openclaw)
- Prompt-injection-only chains without a documented boundary bypass
- Trusted-operator local actions described as remote injection
- Test-only harnesses and maintainer debugging tools
- Public-internet exposure of operator surfaces

See upstream openclaw's policy for the complete list.

## Runtime requirements

astroclaw inherits openclaw's runtime requirements:

- **Node.js 22.16.0 or later** (LTS)
- Same Docker hardening recommendations as upstream

## Pipeline-specific hardening already in place

- **Worker-authored gate**: bless walk rejects commits not signed by the worker author identity
- **Diff-size gate**: commits >500 lines must touch only safe-file classes (`.lock`, `.md`, `.txt`, `.svg`)
- **No-leak gate**: bless walk rejects commits adding strings matching the internal-namespace regex set
- **Pre-push hook**: independent regex check on github-bound pushes (different layer from the bless gate)
- **Public-mirror scanner**: periodic cron audit of `github.com/P1R4N351/astroclaw/main`; alarm on detection

The bless gate is defense-in-depth: scan-green + tests-green is necessary but not sufficient — the additional safety gates above prevent classes of leak the scan can't catch.
