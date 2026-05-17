# astroclaw

**astroclaw** is a P10-compliant fork of [astroclaw](https://github.com/astroclaw/astroclaw) — a personal AI assistant you run on your own devices.

The source is continuously processed against NASA P10 coding standards: simplified control flow, no implicit dynamic dispatch in hot paths, bounded loops, minimal preprocessor complexity. The result is a codebase that is easier to audit, extend, and patch against.

Feature set and runtime behavior are identical to upstream astroclaw. The distinction is code quality and auditability, not capability.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

## What it does

Personal, single-user AI assistant that answers on the channels you already use.

Supported channels: WhatsApp · Telegram · Slack · Discord · Signal · iMessage · Google Chat · IRC · Microsoft Teams · Matrix · Feishu · LINE · Mattermost · Nextcloud Talk · Nostr · Synology Chat · Tlon · Twitch · Zalo · WeChat · QQ · WebChat

- **Voice**: Wake words + talk mode on macOS, iOS, and Android
- **Canvas**: Agent-driven live visual workspace with A2UI
- **Multi-channel routing**: Assign channels and accounts to isolated agent sessions
- **First-class tools**: Browser, canvas, cron, sessions, Discord/Slack actions
- **Skills**: Bundled + workspace + registry ([ClawHub](https://clawhub.ai))
- **Companion apps**: macOS menu bar, iOS and Android nodes

## Install

Runtime: **Node 24 (recommended) or Node 22.16+**

```bash
npm install -g astroclaw@latest
# or
pnpm add -g astroclaw@latest

astroclaw onboard --install-daemon
```

The npm package name and CLI command remain `astroclaw` for runtime compatibility.
The astroclaw repository is the P10-processed source.

## Quick start

```bash
astroclaw gateway --port 18789 --verbose

# Send to any paired channel
astroclaw agent --message "What's on my calendar?"
```

Full setup walkthrough: [Getting started](https://docs.astroclaw.ai/start/getting-started)

Upgrading: [Updating guide](https://docs.astroclaw.ai/install/updating) — run `astroclaw doctor` after.

## Security defaults

Default DM policy (`dmPolicy="pairing"`): unknown senders receive a pairing code; no message is processed until approved.

Approve: `astroclaw pairing approve <channel> <code>`

For group/multi-user deployments, set `agents.defaults.sandbox.mode: "non-main"` to run non-primary sessions in sandboxes. Full guide: [Security](https://docs.astroclaw.ai/gateway/security) · [Sandboxing](https://docs.astroclaw.ai/gateway/sandboxing)

## Docs

Upstream astroclaw docs apply directly — runtime behavior is identical:

| Topic           | Link                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------- |
| Getting started | [docs.astroclaw.ai/start/getting-started](https://docs.astroclaw.ai/start/getting-started) |
| Channels        | [docs.astroclaw.ai/channels](https://docs.astroclaw.ai/channels)                           |
| Configuration   | [docs.astroclaw.ai/gateway/configuration](https://docs.astroclaw.ai/gateway/configuration) |
| Security        | [docs.astroclaw.ai/gateway/security](https://docs.astroclaw.ai/gateway/security)           |
| Tools & Skills  | [docs.astroclaw.ai/tools](https://docs.astroclaw.ai/tools)                                 |
| Docker          | [docs.astroclaw.ai/install/docker](https://docs.astroclaw.ai/install/docker)               |
| Architecture    | [docs.astroclaw.ai/concepts/architecture](https://docs.astroclaw.ai/concepts/architecture) |

## Derivation

```
astroclaw/astroclaw  ──►  astroclaw  (this repo)
```

Commits on `main` are blessed from a `p10-pending` staging branch. Each file passes through a NASA P10 compliance scan before promotion. Only scan-green, test-green, human-reviewed commits land on `main` and are published here.

P10 processing targets:

- Explicit control flow (no `eval`, no dynamic `require` on hot paths)
- Bounded iteration on performance-sensitive loops
- Minimal preprocessor surface
- Narrowed variable scope
- Checked return values on non-void calls

## Contributing

Upstream feature contributions belong at [astroclaw/astroclaw](https://github.com/astroclaw/astroclaw).

P10 compliance issues, audit findings, or patch-layer work: open an issue here.

## License

MIT — see [LICENSE](LICENSE)
