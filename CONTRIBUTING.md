# Contributing to astroclaw

**astroclaw** is an automatically-processed downstream of [openclaw](https://github.com/openclaw/openclaw). The processing pipeline rewrites the upstream codebase against NASA Power of Ten compliance rules; there's no parallel feature roadmap here.

What this means for contributors:

| If you want to...                                                              | File it...                                                                                                                                                            |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add a feature (new channel, new tool, new skill, runtime behavior)             | **Upstream** at [openclaw/openclaw](https://github.com/openclaw/openclaw). It will flow into astroclaw automatically when the worker re-processes the affected files. |
| Report a runtime bug present in both openclaw and astroclaw                    | **Upstream** at [openclaw/openclaw](https://github.com/openclaw/openclaw).                                                                                            |
| Report a P10 violation that survived the scan in astroclaw `main`              | **Here** as an issue tagged `p10-scan-miss`. Include the path + line + the rule violated.                                                                             |
| Report a regression caused by a P10 rewrite (behavior changed after a rewrite) | **Here** as an issue tagged `p10-regression`. Include the pre-rewrite + post-rewrite commit SHAs + the test case that diverges.                                       |
| Suggest a new audit pattern for the P10 scan                                   | **Here** as an issue tagged `scan-ruleset`. Describe the pattern + why it matters.                                                                                    |
| Ask a usage question                                                           | **Upstream Discord**: https://discord.gg/clawd                                                                                                                        |

## Why not feature PRs here?

The pipeline is **append-only** to upstream. If a feature lives only here, the next upstream re-render either erases it or creates a conflict that blocks the worker. Routing all feature work upstream keeps the pipeline humming and avoids fork drift.

## The processing pipeline

```
github.com/openclaw/openclaw  (upstream, MIT)
        │
        │  per-file processing:
        │   1. plan   — agent reads file + P10 rules, drafts rewrite
        │   2. build  — apply rewrite, run package-build
        │   3. scan   — run p10-scan.py, fail-fast on violations
        │   4. tests  — run vitest + integration suite
        │   5. audit  — diff sanity, no scope creep
        │
        ▼
github.com/P1R4N351/astroclaw  (this repo)
   ├── main          ← published; promoted from p10-pending via `bless`
   └── p10-pending   ← worker stages commits, one file per pass
```

A periodic `astroclaw bless` step fast-forwards `main` from `p10-pending` after the new commits clear additional safety gates (worker-author signature, bounded diff, no namespace leakage). The `main` branch is then mirrored to this public repo.

## Filing a P10-related issue

Include these in the issue body:

- **File path** (`src/...` style)
- **Line number(s)**
- **The P10 rule violated** (1–10 — see [P10 Rules](https://en.wikipedia.org/wiki/The_Power_of_10:_Rules_for_Developing_Safety-Critical_Code))
- **Why the scan missed it** (if known) OR **why your rewrite preserves behavior** (for regressions)
- **A reproducer** (failing test case OR scan command + expected output)

A maintainer or the worker will pick it up on the next pass.

## Security

For security vulnerabilities in the runtime, report to upstream openclaw: **security@openclaw.ai** (PGP welcomed).

For security issues specific to the processing pipeline itself — e.g. the worker would commit malicious content, the bless gate has a bypass — file as a private GitHub Security Advisory on this repo.

## License

MIT — see [LICENSE](LICENSE). Inherits from upstream openclaw.
