import SwiftUI

// MARK: - Episode Action Buttons

struct EpisodeActionButtons: View {
    let episode: Episode
    let episodeId: String
    let viewModel: EpisodeDetailViewModel
    @Binding var showLogUpdate: Bool
    @Binding var customEndTime: Date
    @Binding var showEndTimePicker: Bool

    var body: some View {
        VStack(spacing: 8) {
            Button {
                showLogUpdate = true
            } label: {
                Label("Log Update", systemImage: "plus.circle")
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.blue.opacity(0.1))
                    .foregroundStyle(.blue)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .accessibilityIdentifier("log-update-button")

            HStack(spacing: 8) {
                Button {
                    Task {
                        await viewModel.endEpisode(episodeId, at: TimestampHelper.now)
                    }
                } label: {
                    Text("End Now")
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.red.opacity(0.1))
                        .foregroundStyle(.red)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .accessibilityIdentifier("end-now-button")

                Button {
                    customEndTime = Date()
                    showEndTimePicker = true
                } label: {
                    Text("End...")
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.orange.opacity(0.1))
                        .foregroundStyle(.orange)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .accessibilityIdentifier("end-custom-button")
            }
        }
    }
}

// MARK: - Custom End Time Sheet

struct CustomEndTimeSheet: View {
    @Binding var customEndTime: Date
    var minimumDate: Date? = nil
    let onConfirm: () -> Void
    let onCancel: () -> Void

    var body: some View {
        VStack {
            DatePicker(
                "End Time",
                selection: $customEndTime,
                in: (minimumDate ?? .distantPast)...Date()
            )
            .datePickerStyle(.wheel)

            HStack {
                Button("Cancel", action: onCancel)
                    .buttonStyle(.bordered)
                Spacer()
                Button("Confirm", action: onConfirm)
                    .buttonStyle(.borderedProminent)
            }
            .padding()
        }
        .navigationTitle("Custom End Time")
        .navigationBarTitleDisplayMode(.inline)
    }
}
