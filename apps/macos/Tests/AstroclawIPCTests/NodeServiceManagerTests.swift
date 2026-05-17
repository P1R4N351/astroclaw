import Foundation
import Testing
@testable import Astroclaw

@Suite(.serialized) struct NodeServiceManagerTests {
    @Test func `builds node service commands with current CLI shape`() async throws {
        try await TestIsolation.withUserDefaultsValues(["astroclaw.gatewayProjectRootPath": nil]) {
            let tmp = try makeTempDirForTests()
            CommandResolver.setProjectRoot(tmp.path)

            let astroclawPath = tmp.appendingPathComponent("node_modules/.bin/astroclaw")
            try makeExecutableForTests(at: astroclawPath)

            let start = NodeServiceManager._testServiceCommand(["start"])
            #expect(start == [astroclawPath.path, "node", "start", "--json"])

            let stop = NodeServiceManager._testServiceCommand(["stop"])
            #expect(stop == [astroclawPath.path, "node", "stop", "--json"])
        }
    }
}
