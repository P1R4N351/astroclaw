## astroclaw Vision

astroclaw is openclaw, held to a higher code standard.

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

1. Scan-green (P10 compliance pass)
2. Test-green (upstream test suite)
3. Human-reviewed (bless gate — scan/test pass alone is not sufficient)

### Relationship to upstream

Feature development, channel support, and product direction belong to [openclaw/openclaw](https://github.com/openclaw/openclaw). astroclaw tracks upstream and applies the P10 layer. It does not diverge on features.

### What we will not change

- Runtime behavior — the product is openclaw, not a fork in the feature sense
- CLI interface — `openclaw` commands work identically
- Channel compatibility
- Plugin API surface
