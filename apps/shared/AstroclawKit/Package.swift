// swift-tools-version: 6.2

import PackageDescription

let package = Package(
    name: "AstroclawKit",
    platforms: [
        .iOS(.v18),
        .macOS(.v15),
    ],
    products: [
        .library(name: "AstroclawProtocol", targets: ["AstroclawProtocol"]),
        .library(name: "AstroclawKit", targets: ["AstroclawKit"]),
        .library(name: "AstroclawChatUI", targets: ["AstroclawChatUI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/steipete/ElevenLabsKit", exact: "0.1.1"),
        .package(url: "https://github.com/gonzalezreal/textual", exact: "0.3.1"),
    ],
    targets: [
        .target(
            name: "AstroclawProtocol",
            path: "Sources/AstroclawProtocol",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "AstroclawKit",
            dependencies: [
                "AstroclawProtocol",
                .product(name: "ElevenLabsKit", package: "ElevenLabsKit"),
            ],
            path: "Sources/AstroclawKit",
            resources: [
                .process("Resources"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "AstroclawChatUI",
            dependencies: [
                "AstroclawKit",
                .product(
                    name: "Textual",
                    package: "textual",
                    condition: .when(platforms: [.macOS, .iOS])),
            ],
            path: "Sources/AstroclawChatUI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "AstroclawKitTests",
            dependencies: ["AstroclawKit", "AstroclawChatUI"],
            path: "Tests/AstroclawKitTests",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
