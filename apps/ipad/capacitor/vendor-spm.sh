#!/bin/sh
# xcodebuild's SPM binary-artifact download hangs on this machine; curl works. Vendor the
# xcframeworks as a local package and repoint CapApp-SPM at it. Rerun after every `cap sync`.
set -eu
cd "$(dirname "$0")/.."
version=$(node -p "require('@capacitor/ios/package.json').version")
[ "$version" = 8.6.2 ] || { echo 'Update the framework checksums for this Capacitor version' >&2; exit 1; }
vendor=ios/vendor/capacitor-swift-pm
mkdir -p "$vendor"
fetch() {
	name=$1 sum=$2
	[ -d "$vendor/$name.xcframework" ] && return
	curl -sSL --max-time 300 -o "$vendor/$name.zip" \
		"${3:-https://github.com/ionic-team/capacitor-swift-pm/releases/download/$version/$name.xcframework.zip}"
	echo "$sum  $vendor/$name.zip" | shasum -a 256 -c -
	unzip -q -o "$vendor/$name.zip" -d "$vendor"
	rm "$vendor/$name.zip"
}
fetch Capacitor 584538bf09d52adb2a86ecabac495c151896d60b28e0cccc286280f2c7ed7e87
fetch Cordova 63f4ec1c21340f7caf7df7263618ee262c8bc8a18bb91b9d9716602e6fda3fa3
cat > "$vendor/Package.swift" <<'EOF'
// swift-tools-version:5.3
import PackageDescription

let package = Package(
    name: "capacitor-swift-pm",
    products: [
        .library(name: "Capacitor", targets: ["Capacitor"]),
        .library(name: "Cordova", targets: ["Cordova"])
    ],
    targets: [
        .binaryTarget(name: "Capacitor", path: "Capacitor.xcframework"),
        .binaryTarget(name: "Cordova", path: "Cordova.xcframework")
    ]
)
EOF
sed -i '' 's#\.package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "[^"]*")#.package(name: "capacitor-swift-pm", path: "../../vendor/capacitor-swift-pm")#' \
	ios/App/CapApp-SPM/Package.swift
grep -q 'vendor/capacitor-swift-pm' ios/App/CapApp-SPM/Package.swift

vendor=ios/vendor/SQLCipher.swift
mkdir -p "$vendor"
fetch SQLCipher 1505174fe7f8a0fe81d6ebf87a64b17701b500c12a445ef6b68b9159f012d747 \
	'https://github.com/sqlcipher/SQLCipher.swift/releases/download/4.20.0/SQLCipher.xcframework.zip'
cat > "$vendor/Package.swift" <<'EOF'
// swift-tools-version: 6.0
import PackageDescription
let package = Package(
    name: "SQLCipher",
    platforms: [.iOS(.v15)],
    products: [.library(name: "SQLCipher", targets: ["SQLCipher"])],
    targets: [.binaryTarget(name: "SQLCipher", path: "SQLCipher.xcframework")]
)
EOF
node --input-type=module <<'EOF'
import { readFileSync, writeFileSync } from 'node:fs'
const path = 'ios/App/CapApp-SPM/Package.swift'
const source = readFileSync(path, 'utf8')
if (!source.includes('vendor/SQLCipher.swift'))
    writeFileSync(path, source
        .replace('    dependencies: [', '    dependencies: [\n        .package(name: "SQLCipher.swift", path: "../../vendor/SQLCipher.swift"),')
        .replace('            dependencies: [', '            dependencies: [\n                .product(name: "SQLCipher", package: "SQLCipher.swift"),'))
EOF
