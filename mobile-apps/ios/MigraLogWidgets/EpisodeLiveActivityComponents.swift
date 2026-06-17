import ActivityKit
import SwiftUI
import WidgetKit

// MARK: - Duration

/// Live-ticking duration. While active it counts up from the episode start via
/// `Text(_:style:.timer)`; once ended it shows the frozen total.
struct DurationText: View {
    let attributes: EpisodeActivityAttributes
    let state: EpisodeActivityAttributes.ContentState

    var body: some View {
        if let endedAt = state.endedAt {
            Text(LiveActivityStyle.durationLabel(from: attributes.startDate, to: endedAt))
        } else {
            Text(attributes.startDate, style: .timer)
        }
    }
}

// MARK: - Last rescue med

struct LastMedLabel: View {
    let state: EpisodeActivityAttributes.ContentState
    var alignment: HorizontalAlignment = .leading

    var body: some View {
        if let name = state.lastRescueMedName, let takenAt = state.lastRescueMedAt {
            VStack(alignment: alignment, spacing: 1) {
                Text(name)
                    .font(.caption.weight(.medium))
                    .lineLimit(1)
                Text(takenAt, style: .relative)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            // Combine so VoiceOver reads the name together with the relative time
            // (e.g. "Advil, 45 minutes") instead of two separate elements.
            .accessibilityElement(children: .combine)
        }
    }
}

// MARK: - Stat chip

struct StatChip: View {
    let systemImage: String
    let text: String

    var body: some View {
        Label(text, systemImage: systemImage)
            .font(.caption.weight(.medium))
            .labelStyle(.titleAndIcon)
    }
}

// MARK: - Quick actions

/// The Log / Open / End deep-link action row shown on the Lock Screen and at the
/// bottom of the expanded Dynamic Island.
struct ActionRow: View {
    let episodeId: String

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            ActionLink(
                title: "Log",
                systemImage: "pills.fill",
                url: EpisodeActivityDeepLink.logRescueMed(episodeId: episodeId)
            )
            ActionLink(
                title: "Open",
                systemImage: "chevron.right.circle.fill",
                url: EpisodeActivityDeepLink.openEpisode(episodeId: episodeId)
            )
            ActionLink(
                title: "End",
                systemImage: "stop.circle.fill",
                url: EpisodeActivityDeepLink.endEpisode(episodeId: episodeId),
                tint: LiveActivityStyle.activeColor
            )
        }
    }
}

struct ActionLink: View {
    let title: String
    let systemImage: String
    let url: URL
    var tint: Color = .secondary

    var body: some View {
        Link(destination: url) {
            Label(title, systemImage: systemImage)
                .font(.caption2.weight(.semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 5)
                .background(.quaternary, in: Capsule())
                .foregroundStyle(tint == .secondary ? Color.primary : tint)
        }
    }
}

// MARK: - Dynamic Island expanded regions

struct ExpandedLeadingView: View {
    let state: EpisodeActivityAttributes.ContentState

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Image(systemName: "bolt.heart.fill")
                .foregroundStyle(state.isEnded ? LiveActivityStyle.calmColor : LiveActivityStyle.activeColor)
            if let intensity = LiveActivityStyle.intensityLabel(state.currentIntensity) {
                Text(intensity)
                    .font(.caption.weight(.semibold))
            }
        }
    }
}

struct ExpandedTrailingView: View {
    let attributes: EpisodeActivityAttributes
    let state: EpisodeActivityAttributes.ContentState

    var body: some View {
        VStack(alignment: .trailing, spacing: 2) {
            DurationText(attributes: attributes, state: state)
                .font(.title3.monospacedDigit().weight(.semibold))
                .foregroundStyle(state.isEnded ? LiveActivityStyle.calmColor : LiveActivityStyle.activeColor)
            Text(state.isEnded ? "ended" : "elapsed")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }
}

// MARK: - Minimal

struct PulsingDot: View {
    let color: Color

    var body: some View {
        Circle()
            .fill(color)
            .frame(width: 8, height: 8)
            .accessibilityLabel("Active migraine episode")
    }
}
