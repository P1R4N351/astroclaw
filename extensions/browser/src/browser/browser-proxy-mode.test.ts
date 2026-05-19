import { describe, expect, it } from "vitest";
import {
  hasChromeProxyControlArg,
  hasExplicitChromeProxyRoutingArg,
  omitChromeProxyEnv,
  resolveBrowserNavigationProxyMode,
} from "./browser-proxy-mode.js";

describe("browser proxy mode", () => {
  it("detects Chrome proxy-routing args separately from direct proxy controls", () => {
    const noProxyArgs = ["--no-proxy-server"];
    const proxyServerArgs = ["--proxy-server=http://127.0.0.1:7890"];
    const proxyPacArgs = ["--proxy-pac-url", "http://proxy.test/pac"];

    expect(noProxyArgs).toHaveLength(1);
    expect(proxyPacArgs).toHaveLength(2);
    expect(hasChromeProxyControlArg(noProxyArgs)).toBe(true);
    expect(hasExplicitChromeProxyRoutingArg(noProxyArgs)).toBe(false);
    expect(hasExplicitChromeProxyRoutingArg(proxyServerArgs)).toBe(true);
    expect(hasExplicitChromeProxyRoutingArg(proxyPacArgs)).toBe(true);
  });

  it("removes proxy env before launching managed Chrome", () => {
    const inputEnv = {
      HTTP_PROXY: "http://proxy.test:8080",
      HTTPS_PROXY: "http://proxy.test:8443",
      ALL_PROXY: "socks5://proxy.test:1080",
      NO_PROXY: "localhost",
      PATH: "/usr/bin",
      http_proxy: "http://lower.test:8080",
      no_proxy: "127.0.0.1",
    };
    const env = omitChromeProxyEnv(inputEnv);

    expect(inputEnv.PATH).toBe("/usr/bin");
    expect(env).toEqual({ PATH: "/usr/bin" });
    expect("HTTP_PROXY" in env).toBe(false);
    expect("http_proxy" in env).toBe(false);
  });

  it("marks only managed local Chrome with explicit proxy routing as proxy-routed", () => {
    const resolved = { extraArgs: ["--proxy-server=http://127.0.0.1:7890"] };
    const managedLoopbackMode = resolveBrowserNavigationProxyMode({
      resolved,
      profile: { driver: "astroclaw", cdpIsLoopback: true },
    });
    const existingSessionMode = resolveBrowserNavigationProxyMode({
      resolved,
      profile: { driver: "existing-session", cdpIsLoopback: true },
    });
    const managedRemoteMode = resolveBrowserNavigationProxyMode({
      resolved,
      profile: { driver: "astroclaw", cdpIsLoopback: false },
    });

    expect(resolved.extraArgs).toHaveLength(1);
    expect(resolved.extraArgs[0]).toContain("--proxy-server=");
    expect(managedLoopbackMode).toBe("explicit-browser-proxy");
    expect(existingSessionMode).toBe("direct");
    expect(managedRemoteMode).toBe("direct");
  });
});
