---
summary: "WeChat channel setup through the external astroclaw-weixin plugin"
read_when:
  - You want to connect Astroclaw to WeChat or Weixin
  - You are installing or troubleshooting the astroclaw-weixin channel plugin
  - You need to understand how external channel plugins run beside the Gateway
title: "WeChat"
---

Astroclaw connects to WeChat through Tencent's external
`@tencent-weixin/astroclaw-weixin` channel plugin.

Status: external plugin. Direct chats and media are supported. Group chats are not
advertised by the current plugin capability metadata.

## Naming

- **WeChat** is the user-facing name in these docs.
- **Weixin** is the name used by Tencent's package and by the plugin id.
- `astroclaw-weixin` is the Astroclaw channel id.
- `@tencent-weixin/astroclaw-weixin` is the npm package.

Use `astroclaw-weixin` in CLI commands and config paths.

## How it works

The WeChat code does not live in the Astroclaw core repo. Astroclaw provides the
generic channel plugin contract, and the external plugin provides the
WeChat-specific runtime:

1. `astroclaw plugins install` installs `@tencent-weixin/astroclaw-weixin`.
2. The Gateway discovers the plugin manifest and loads the plugin entrypoint.
3. The plugin registers channel id `astroclaw-weixin`.
4. `astroclaw channels login --channel astroclaw-weixin` starts QR login.
5. The plugin stores account credentials under the Astroclaw state directory.
6. When the Gateway starts, the plugin starts its Weixin monitor for each
   configured account.
7. Inbound WeChat messages are normalized through the channel contract, routed to
   the selected Astroclaw agent, and sent back through the plugin outbound path.

That separation matters: Astroclaw core should stay channel-agnostic. WeChat login,
Tencent iLink API calls, media upload/download, context tokens, and account
monitoring are owned by the external plugin.

## Install

Quick install:

```bash
npx -y @tencent-weixin/astroclaw-weixin-cli install
```

Manual install:

```bash
astroclaw plugins install "@tencent-weixin/astroclaw-weixin"
astroclaw config set plugins.entries.astroclaw-weixin.enabled true
```

Restart the Gateway after install:

```bash
astroclaw gateway restart
```

## Login

Run QR login on the same machine that runs the Gateway:

```bash
astroclaw channels login --channel astroclaw-weixin
```

Scan the QR code with WeChat on your phone and confirm the login. The plugin saves
the account token locally after a successful scan.

To add another WeChat account, run the same login command again. For multiple
accounts, isolate direct-message sessions by account, channel, and sender:

```bash
astroclaw config set session.dmScope per-account-channel-peer
```

## Access control

Direct messages use the normal Astroclaw pairing and allowlist model for channel
plugins.

Approve new senders:

```bash
astroclaw pairing list astroclaw-weixin
astroclaw pairing approve astroclaw-weixin <CODE>
```

For the full access-control model, see [Pairing](/channels/pairing).

## Compatibility

The plugin checks the host Astroclaw version at startup.

| Plugin line | Astroclaw version        | npm tag  |
| ----------- | ----------------------- | -------- |
| `2.x`       | `>=2026.3.22`           | `latest` |
| `1.x`       | `>=2026.1.0 <2026.3.22` | `legacy` |

If the plugin reports that your Astroclaw version is too old, either update
Astroclaw or install the legacy plugin line:

```bash
astroclaw plugins install @tencent-weixin/astroclaw-weixin@legacy
```

## Sidecar process

The WeChat plugin can run helper work beside the Gateway while it monitors the
Tencent iLink API. In issue #68451, that helper path exposed a bug in Astroclaw's
generic stale-Gateway cleanup: a child process could try to clean up the parent
Gateway process, causing restart loops under process managers such as systemd.

Current Astroclaw startup cleanup excludes the current process and its ancestors,
so a channel helper must not kill the Gateway that launched it. This fix is
generic; it is not a WeChat-specific path in core.

## Troubleshooting

Check install and status:

```bash
astroclaw plugins list
astroclaw channels status --probe
astroclaw --version
```

If the channel shows as installed but does not connect, confirm that the plugin is
enabled and restart:

```bash
astroclaw config set plugins.entries.astroclaw-weixin.enabled true
astroclaw gateway restart
```

If the Gateway restarts repeatedly after enabling WeChat, update both Astroclaw and
the plugin:

```bash
npm view @tencent-weixin/astroclaw-weixin version
astroclaw plugins install "@tencent-weixin/astroclaw-weixin" --force
astroclaw gateway restart
```

If startup reports that the installed plugin package `requires compiled runtime
output for TypeScript entry`, the npm package was published without the compiled
JavaScript runtime files Astroclaw needs. Update/reinstall after the plugin
publisher ships a fixed package, or temporarily disable/uninstall the plugin.

Temporary disable:

```bash
astroclaw config set plugins.entries.astroclaw-weixin.enabled false
astroclaw gateway restart
```

## Related docs

- Channel overview: [Chat Channels](/channels)
- Pairing: [Pairing](/channels/pairing)
- Channel routing: [Channel Routing](/channels/channel-routing)
- Plugin architecture: [Plugin Architecture](/plugins/architecture)
- Channel plugin SDK: [Channel Plugin SDK](/plugins/sdk-channel-plugins)
- External package: [@tencent-weixin/astroclaw-weixin](https://www.npmjs.com/package/@tencent-weixin/astroclaw-weixin)
