// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(name: "SQLCipher.swift", path: "../../vendor/SQLCipher.swift"),
        .package(name: "capacitor-swift-pm", path: "../../vendor/capacitor-swift-pm"),
        .package(name: "CapacitorCommunitySqlite", path: "../../../../../node_modules/.pnpm/@capacitor-community+sqlite@8.1.1_@capacitor+core@8.6.2/node_modules/@capacitor-community/sqlite"),
        .package(name: "CapacitorApp", path: "../../../../../node_modules/.pnpm/@capacitor+app@8.1.2_@capacitor+core@8.6.2/node_modules/@capacitor/app"),
        .package(name: "CapacitorClipboard", path: "../../../../../node_modules/.pnpm/@capacitor+clipboard@8.0.1_@capacitor+core@8.6.2/node_modules/@capacitor/clipboard"),
        .package(name: "CapacitorFilesystem", path: "../../../../../node_modules/.pnpm/@capacitor+filesystem@8.1.5_@capacitor+core@8.6.2/node_modules/@capacitor/filesystem")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "SQLCipher", package: "SQLCipher.swift"),
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorCommunitySqlite", package: "CapacitorCommunitySqlite"),
                .product(name: "CapacitorApp", package: "CapacitorApp"),
                .product(name: "CapacitorClipboard", package: "CapacitorClipboard"),
                .product(name: "CapacitorFilesystem", package: "CapacitorFilesystem")
            ]
        )
    ]
)
