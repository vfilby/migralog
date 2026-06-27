import SwiftUI

/// One open-source dependency and its license, shown under Settings → Open
/// Source Licenses. Keep `OpenSourceLicense.all` in sync with the packages
/// declared in `project.yml`. Versions are deliberately omitted: the weekly
/// dependency bump (swift-deps-update.yml) would silently make a hard-coded
/// version stale, and the attribution + license text are what matter here.
struct OpenSourceLicense: Identifiable {
    let name: String
    let url: String
    let licenseName: String
    let licenseText: String

    var id: String { name }

    static let all: [OpenSourceLicense] = [
        OpenSourceLicense(
            name: "GRDB.swift",
            url: "https://github.com/groue/GRDB.swift",
            licenseName: "MIT License",
            licenseText: mitLicense(copyright: "Copyright (C) 2015-2025 Gwendal Roué")
        ),
        OpenSourceLicense(
            name: "Sentry (sentry-cocoa)",
            url: "https://github.com/getsentry/sentry-cocoa",
            licenseName: "MIT License",
            licenseText: mitLicense(copyright: "Copyright (c) 2015 Sentry")
        )
    ]

    /// The standard MIT license body with the given copyright line.
    private static func mitLicense(copyright: String) -> String {
        """
        The MIT License (MIT)

        \(copyright)

        Permission is hereby granted, free of charge, to any person obtaining a copy \
        of this software and associated documentation files (the "Software"), to deal \
        in the Software without restriction, including without limitation the rights \
        to use, copy, modify, merge, publish, distribute, sublicense, and/or sell \
        copies of the Software, and to permit persons to whom the Software is \
        furnished to do so, subject to the following conditions:

        The above copyright notice and this permission notice shall be included in all \
        copies or substantial portions of the Software.

        THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR \
        IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, \
        FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE \
        AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER \
        LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, \
        OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE \
        SOFTWARE.
        """
    }
}

/// Lists the open-source packages MigraLog ships with; each row opens the full
/// license text.
struct LicensesScreen: View {
    var body: some View {
        List {
            Section {
                ForEach(OpenSourceLicense.all) { license in
                    NavigationLink {
                        LicenseDetailScreen(license: license)
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(license.name)
                            Text(license.licenseName)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .accessibilityIdentifier("license-\(license.id)")
                }
            } footer: {
                Text("MigraLog is built with these open source packages. "
                    + "Thank you to their authors and contributors.")
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Open Source Licenses")
        .readableContentWidth()
    }
}

/// Full, selectable license text for a single dependency.
struct LicenseDetailScreen: View {
    let license: OpenSourceLicense

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let url = URL(string: license.url) {
                    Link(destination: url) {
                        Label(license.url, systemImage: "link")
                            .font(.footnote)
                    }
                }

                Text(license.licenseText)
                    .font(.footnote)
                    .textSelection(.enabled)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
        }
        .navigationTitle(license.name)
        .navigationBarTitleDisplayMode(.inline)
        .readableContentWidth()
    }
}
