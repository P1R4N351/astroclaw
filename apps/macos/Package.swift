// swift-tools-version: 6.2
// Package manifest for the Astroclaw macOS companion (menu bar app + IPC library).

import PackageDescription

let package = Package(
    name: "Astroclaw",
    platforms: [
        .macOS(.v15),
    ],
    products: [
        .library(name: "AstroclawIPC", targets: ["AstroclawIPC"]),
        .library(name: "AstroclawDiscovery", targets: ["AstroclawDiscovery"]),
        .executable(name: "Astroclaw", targets: ["Astroclaw"]),
        .executable(name: "astroclaw-mac", targets: ["AstroclawMacCLI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/orchetect/MenuBarExtraAccess", exact: "1.3.0"),
        .package(url: "https://github.com/swiftlang/swift-subprocess.git", from: "0.4.0"),
        .package(url: "https://github.com/apple/swift-log.git", from: "1.10.1"),
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.9.0"),
        .package(url: "https://github.com/steipete/Peekaboo.git", exact: "3.0.0"),
        .package(path: "../shared/AstroclawKit"),
        .package(path: "../swabble"),
    ],
    targets: [
        .target(
            name: "AstroclawIPC",
            dependencies: [],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "AstroclawDiscovery",
            dependencies: [
                .product(name: "AstroclawKit", package: "AstroclawKit"),
            ],
            path: "Sources/AstroclawDiscovery",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "Astroclaw",
            dependencies: [
                "AstroclawIPC",
                "AstroclawDiscovery",
                .product(name: "AstroclawKit", package: "AstroclawKit"),
                .product(name: "AstroclawChatUI", package: "AstroclawKit"),
                .product(name: "AstroclawProtocol", package: "AstroclawKit"),
                .product(name: "SwabbleKit", package: "swabble"),
                .product(name: "MenuBarExtraAccess", package: "MenuBarExtraAccess"),
                .product(name: "Subprocess", package: "swift-subprocess"),
                .product(name: "Logging", package: "swift-log"),
                .product(name: "Sparkle", package: "Sparkle"),
                .product(name: "PeekabooBridge", package: "Peekaboo"),
                .product(name: "PeekabooAutomationKit", package: "Peekaboo"),
            ],
            exclude: [
                "Resources/Info.plist",
            ],
            resources: [
                .copy("Resources/Astroclaw.icns"),
                .copy("Resources/DeviceModels"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "AstroclawMacCLI",
            dependencies: [
                "AstroclawDiscovery",
                .product(name: "AstroclawKit", package: "AstroclawKit"),
                .product(name: "AstroclawProtocol", package: "AstroclawKit"),
            ],
            path: "Sources/AstroclawMacCLI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "AstroclawIPCTests",
            dependencies: [
                "AstroclawIPC",
                "Astroclaw",
                "AstroclawMacCLI",
                "AstroclawDiscovery",
                .product(name: "AstroclawProtocol", package: "AstroclawKit"),
                .product(name: "SwabbleKit", package: "swabble"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
