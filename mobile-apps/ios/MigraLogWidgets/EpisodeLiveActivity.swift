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
            Image(systemName: LiveActivityStyle.symbol(for: context.state))
                .foregroundStyle(tint(for: context.state))
                .accessibilityHidden(true)
        } compactTrailing: {
            // No accessibilityLabel here: it would override the live duration's
            // spoken value. VoiceOver reads the elapsed time, and the minimal
            // presentation already labels the activity as a migraine episode.
            DurationText(attributes: context.attributes, state: context.state)
                .font(.caption2.monospacedDigit())
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .frame(maxWidth: 78)
        } minimal: {
            PulsingDot(
                color: tint(for: context.state),
                accessibilityLabel: context.state.isInPostdrome
                    ? "Migraine episode, post-drome recovery"
                    : "Active migraine episode"
            )
        }
        .keylineTint(tint(for: context.state))
    }

    private func tint(for state: EpisodeActivityAttributes.ContentState) -> Color {
        LiveActivityStyle.tint(for: state)
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
        let state = context.state
        let tint = LiveActivityStyle.tint(for: state)
        return VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Label {
                    Text(LiveActivityStyle.phaseLabel(for: state))
                        .font(.subheadline.weight(.semibold))
                } icon: {
                    Image(systemName: LiveActivityStyle.symbol(for: state))
                        .foregroundStyle(tint)
                }
                Spacer()
                DurationText(attributes: context.attributes, state: state)
                    .font(.title3.monospacedDigit().weight(.semibold))
                    .foregroundStyle(tint)
            }
            // Read "In migraine, <elapsed>" (or "Post-drome, …") as one element.
            .accessibilityElement(children: .combine)
            HStack(spacing: DesignTokens.Spacing.md) {
                if state.isInPostdrome {
                    // Pain intensity isn't tracked in recovery — surface the
                    // phase instead of a stale reading.
                    StatChip(systemImage: "sparkles", text: "Recovering")
                        .foregroundStyle(LiveActivityStyle.postdromeColor)
                        .accessibilityLabel("In post-drome recovery")
                } else if let intensity = LiveActivityStyle.intensityLabel(state.currentIntensity) {
                    StatChip(systemImage: "gauge.with.dots.needle.50percent", text: intensity)
                        .accessibilityLabel("Pain intensity \(intensity)")
                }
                LastMedLabel(state: state, alignment: .leading)
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
