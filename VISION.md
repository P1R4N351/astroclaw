## astroclaw Vision

**astroclaw** is [openclaw](https://github.com/openclaw/openclaw), held to a higher code standard.

The goal is a personal AI assistant that is easy to audit, safe to patch against, and simple to extend — without sacrificing any capability of the upstream runtime.

### What P10 compliance means here

The source is continuously rewritten against NASA P10 coding standards adapted for TypeScript:

- No implicit control flow in hot paths
- Bounded loops on performance-sensitive iteration
- Minimal preprocessor surface
- Narrow variable scope
- Checked return values

The result is a base that is easier to read, diff, and reason about — which makes it a better substrate for downstream patches.

### Commit gate

No commit lands on `main` unless it is:

1. **Scan-green** — P10 compliance pass (`p10-scan.py` against the rewritten file)
2. **Test-green** — upstream test suite (TypeScript build + vitest + integration)
3. **Bless-promoted** from `p10-pending` — the staging branch where the worker accumulates per-file rewrites. The bless step fast-forwards `main`, then pushes to the public mirror with additional safety gates (no namespace leakage, no force-push to public, no unauthored content)

### Relationship to upstream

Feature development, channel support, and product direction belong to [openclaw/openclaw](https://github.com/openclaw/openclaw). astroclaw tracks upstream and applies the P10 layer. It does not diverge on features.

When upstream openclaw releases a new version, the worker processes the changed files through the same nasa-code-agent pipeline and emits P10-compliant equivalents on `p10-pending`. The bless gate promotes them to `main` and to the public mirror.

### What we will not change

- **Runtime behavior** — the product is openclaw; astroclaw is its P10-processed source, not a feature fork
- **CLI interface** — `astroclaw` commands work identically to `openclaw` commands
- **Channel compatibility** — every channel adapter behaves the same
- **Plugin API surface** — third-party plugins built against openclaw work against astroclaw

### What we will change

- **Internal control flow** — early returns instead of nested if/else, explicit state machines instead of implicit ones
- **Iteration patterns** — fixed-bound loops instead of unbounded
- **Type narrowness** — checked discriminated unions instead of `any` escape hatches
- **Assertion density** — pre- and post-conditions at function boundaries
- **Dead code** — removed when surfaced by the scan

These changes are invisible to runtime consumers. They are visible to source-level consumers (auditors, plugin authors, patch maintainers) — which is the audience astroclaw serves.
