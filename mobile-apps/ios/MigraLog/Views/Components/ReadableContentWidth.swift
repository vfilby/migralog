import SwiftUI

/// Caps a settings-style Form/List at a readable width on wide layouts
/// (iPad / regular panes) so rows and controls don't stretch edge-to-edge.
/// Narrow layouts are unaffected — the cap only bites when the container
/// is wider than `maxWidth`.
///
/// The surrounding area is filled with the grouped background so the
/// centered form doesn't sit on a mismatched color.
struct ReadableContentWidth: ViewModifier {
    var maxWidth: CGFloat = 700

    func body(content: Content) -> some View {
        content
            .frame(maxWidth: maxWidth)
            .frame(maxWidth: .infinity)
            .background(Color(.systemGroupedBackground))
    }
}

extension View {
    /// Constrain settings-style content to a readable column on wide layouts.
    func readableContentWidth(maxWidth: CGFloat = 700) -> some View {
        modifier(ReadableContentWidth(maxWidth: maxWidth))
    }
}
