# astroclaw

**astroclaw** is a P10-compliant fork of [openclaw](https://github.com/openclaw/openclaw) — a personal AI assistant you run on your own devices.

The source is continuously processed against NASA P10 coding standards: simplified control flow, no implicit dynamic dispatch in hot paths, bounded loops, minimal preprocessor complexity. The result is a codebase that is easier to audit, extend, and patch against.

Feature set and runtime behavior are identical to upstream openclaw. The distinction is code quality and auditability, not capability.

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
npm install -g openclaw@latest
# or
pnpm add -g openclaw@latest

openclaw onboard --install-daemon
```

The npm package name and CLI command remain `openclaw` for runtime compatibility.
The astroclaw repository is the P10-processed source.

## Quick start

```bash
openclaw gateway --port 18789 --verbose

# Send to any paired channel
openclaw agent --message "What's on my calendar?"
```

Full setup walkthrough: [Getting started](https://docs.openclaw.ai/start/getting-started)

Upgrading: [Updating guide](https://docs.openclaw.ai/install/updating) — run `openclaw doctor` after.

## Security defaults

Default DM policy (`dmPolicy="pairing"`): unknown senders receive a pairing code; no message is processed until approved.

Approve: `openclaw pairing approve <channel> <code>`

For group/multi-user deployments, set `agents.defaults.sandbox.mode: "non-main"` to run non-primary sessions in sandboxes. Full guide: [Security](https://docs.openclaw.ai/gateway/security) · [Sandboxing](https://docs.openclaw.ai/gateway/sandboxing)

## Docs

Upstream openclaw docs apply directly — runtime behavior is identical:

| Topic           | Link                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------- |
| Getting started | [docs.openclaw.ai/start/getting-started](https://docs.openclaw.ai/start/getting-started) |
| Channels        | [docs.openclaw.ai/channels](https://docs.openclaw.ai/channels)                           |
| Configuration   | [docs.openclaw.ai/gateway/configuration](https://docs.openclaw.ai/gateway/configuration) |
| Security        | [docs.openclaw.ai/gateway/security](https://docs.openclaw.ai/gateway/security)           |
| Tools & Skills  | [docs.openclaw.ai/tools](https://docs.openclaw.ai/tools)                                 |
| Docker          | [docs.openclaw.ai/install/docker](https://docs.openclaw.ai/install/docker)               |
| Architecture    | [docs.openclaw.ai/concepts/architecture](https://docs.openclaw.ai/concepts/architecture) |

## Derivation

```
openclaw/openclaw  ──►  astroclaw  (this repo)
```

Commits on `main` are blessed from a `p10-pending` staging branch. Each file passes through a NASA P10 compliance scan before promotion. Only scan-green, test-green, human-reviewed commits land on `main` and are published here.

P10 processing targets:

- Explicit control flow (no `eval`, no dynamic `require` on hot paths)
- Bounded iteration on performance-sensitive loops
- Minimal preprocessor surface
- Narrowed variable scope
- Checked return values on non-void calls

## Contributing

Upstream feature contributions belong at [openclaw/openclaw](https://github.com/openclaw/openclaw).

P10 compliance issues, audit findings, or patch-layer work: open an issue here.

## License

MIT — see [LICENSE](LICENSE)
