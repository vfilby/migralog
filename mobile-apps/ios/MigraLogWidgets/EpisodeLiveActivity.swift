import ActivityKit
import SwiftUI
import WidgetKit

/// Live Activity for an active migraine episode: Lock Screen banner plus the
/// three Dynamic Island presentations (compact / expanded / minimal). The quick
/// actions are `migralog://` deep links; they become functional once the app
/// registers and routes the URL scheme (Phase 3).
struct EpisodeLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: EpisodeActivityAttributes.self) { context in
            EpisodeLockScreenView(context: context)
                .activityBackgroundTint(Color.black.opacity(0.45))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            dynamicIsland(for: context)
        }
    }

    private func dynamicIsland(for context: ActivityViewContext<EpisodeActivityAttributes>) -> DynamicIsland {
        DynamicIsland {
            DynamicIslandExpandedRegion(.leading) {
                ExpandedLeadingView(state: context.state)
            }
            DynamicIslandExpandedRegion(.trailing) {
                ExpandedTrailingView(attributes: context.attributes, state: context.state)
            }
            DynamicIslandExpandedRegion(.center) {
                LastMedLabel(state: context.state, alignment: .center)
            }
            DynamicIslandExpandedRegion(.bottom) {
                if !context.state.isEnded {
                    ActionRow(episodeId: context.attributes.episodeId)
                }
            }
        } compactLeading: {
            Image(systemName: "bolt.heart.fill")
                .foregroundStyle(tint(for: context.state))
                .accessibilityHidden(true)
        } compactTrailing: {
            // No accessibilityLabel here: it would override the live timer's
            // spoken value. VoiceOver reads the elapsed time, and the minimal
            // presentation already labels the activity as a migraine episode.
            DurationText(attributes: context.attributes, state: context.state)
                .font(.caption2.monospacedDigit())
                .frame(maxWidth: 52)
        } minimal: {
            PulsingDot(color: tint(for: context.state))
        }
        .keylineTint(tint(for: context.state))
    }

    private func tint(for state: EpisodeActivityAttributes.ContentState) -> Color {
        state.isEnded ? LiveActivityStyle.calmColor : LiveActivityStyle.activeColor
    }
}

// MARK: - Lock Screen

struct EpisodeLockScreenView: View {
    let context: ActivityViewContext<EpisodeActivityAttributes>

    var body: some View {
        if context.state.isEnded {
            EpisodeClosedView(attributes: context.attributes, state: context.state)
                .padding()
        } else {
            activeBody
                .padding()
        }
    }

    private var activeBody: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Label {
                    Text("In migraine")
                        .font(.subheadline.weight(.semibold))
                } icon: {
                    Image(systemName: "bolt.heart.fill")
                        .foregroundStyle(LiveActivityStyle.activeColor)
                }
                Spacer()
                DurationText(attributes: context.attributes, state: context.state)
                    .font(.title3.monospacedDigit().weight(.semibold))
                    .foregroundStyle(LiveActivityStyle.activeColor)
            }
            // Read "In migraine, <elapsed>" as one element.
            .accessibilityElement(children: .combine)
            HStack(spacing: DesignTokens.Spacing.md) {
                if let intensity = LiveActivityStyle.intensityLabel(context.state.currentIntensity) {
                    StatChip(systemImage: "gauge.with.dots.needle.50percent", text: intensity)
                        .accessibilityLabel("Pain intensity \(intensity)")
                }
                LastMedLabel(state: context.state, alignment: .leading)
                Spacer()
            }
            ActionRow(episodeId: context.attributes.episodeId)
        }
    }
}

/// Warm post-episode close shown briefly before the activity is dismissed.
struct EpisodeClosedView: View {
    let attributes: EpisodeActivityAttributes
    let state: EpisodeActivityAttributes.ContentState

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(closingLine)
                .font(.subheadline.weight(.semibold))
            Text("Take care.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    private var closingLine: String {
        guard let endedAt = state.endedAt else { return "Episode ended." }
        let duration = LiveActivityStyle.durationLabel(from: attributes.startDate, to: endedAt)
        return "Made it through \(duration)."
    }
}
