import Testing
@testable import Astroclaw

@Suite(.serialized) struct AstroclawAppDelegateTests {
    @Test @MainActor func resolvesRegistryModelBeforeViewTaskAssignsDelegateModel() {
        let registryModel = NodeAppModel()
        AstroclawAppModelRegistry.appModel = registryModel
        defer { AstroclawAppModelRegistry.appModel = nil }

        let delegate = AstroclawAppDelegate()

        #expect(delegate._test_resolvedAppModel() === registryModel)
    }

    @Test @MainActor func prefersExplicitDelegateModelOverRegistryFallback() {
        let registryModel = NodeAppModel()
        let explicitModel = NodeAppModel()
        AstroclawAppModelRegistry.appModel = registryModel
        defer { AstroclawAppModelRegistry.appModel = nil }

        let delegate = AstroclawAppDelegate()
        delegate.appModel = explicitModel

        #expect(delegate._test_resolvedAppModel() === explicitModel)
    }
}
