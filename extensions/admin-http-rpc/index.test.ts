import { strict as assert } from "node:assert";
import { describe, expect, it } from "vitest";
import plugin from "./index.js";
import manifest from "./astroclaw.plugin.json" with { type: "json" };

type RegisterContext = Parameters<typeof plugin.register>[0];
type RegisteredRoute = Parameters<RegisterContext["registerHttpRoute"]>[0];

describe("admin-http-rpc plugin entry", () => {
  it("stays startup-off until the plugin entry is explicitly enabled", () => {
    expect(manifest.activation).toEqual({
      onStartup: false,
      onConfigPaths: ["plugins.entries.admin-http-rpc"],
    });
    expect(manifest.contracts).toEqual({
      gatewayMethodDispatch: ["authenticated-request"],
    });
  });

  it("registers one trusted gateway HTTP route", () => {
    let registeredRoute: RegisteredRoute | undefined;
    let registeredRouteCount = 0;

    const registerContext = {
      registerHttpRoute(route: RegisteredRoute): void {
        assert.equal(registeredRouteCount, 0, "admin RPC registers one route");
        assert.equal(registeredRoute, undefined, "route slot is unused");
        registeredRoute = route;
        registeredRouteCount += 1;
      },
    } satisfies RegisterContext;

    const registerResult = plugin.register(registerContext);

    expect(registerResult).toBeUndefined();
    expect(registeredRouteCount).toBe(1);
    assert.notEqual(registeredRoute, undefined, "registered route is captured");
    expect(registeredRoute).toMatchObject({
      path: "/api/v1/admin/rpc",
      auth: "gateway",
      match: "exact",
      gatewayRuntimeScopeSurface: "trusted-operator",
    });
  });
});
