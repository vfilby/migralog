import SwiftUI

/// Shown when the database fails to initialize, giving the user a chance
/// to export their database file for recovery before the data is lost.
struct DatabaseErrorView: View {
    @State private var showShareSheet = false

    private var error: Error? {
        DatabaseManager.initializationError
    }

    private var databaseFileExists: Bool {
        guard let url = DatabaseManager.databaseFileURL else { return false }
        return FileManager.default.fileExists(atPath: url.path)
    }

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 56))
                .foregroundStyle(.orange)

            Text("Database Error")
                .font(.title)
                .fontWeight(.bold)

            Text("MigraLog was unable to open its database. Your data may still be on this device.")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            if let error {
                Text(error.localizedDescription)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }

            if databaseFileExists {
                VStack(spacing: 12) {
                    Text("You can export the database file so it can be recovered or sent to support.")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)

                    Button {
                        showShareSheet = true
                    } label: {
                        Label("Export Database File", systemImage: "square.and.arrow.up")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .padding(.horizontal, 32)
                }
            } else {
                Text("No database file was found on this device.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }

            Spacer()
        }
        .sheet(isPresented: $showShareSheet) {
            if let url = DatabaseManager.databaseFileURL {
                ShareSheet(items: [url])
            }
        }
    }
}
