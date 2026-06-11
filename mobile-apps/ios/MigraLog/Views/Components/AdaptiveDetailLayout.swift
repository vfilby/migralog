import SwiftUI

/// Lays out detail-screen content as a single scrolling column on narrow
/// widths (iPhone and compact split panes) or as two side-by-side columns on
/// wide panes (iPad landscape and large detail panes).
///
/// The decision is driven by the container's own width via `GeometryReader`,
/// **not** the horizontal size class, so iPhone layouts are never affected and
/// the same detail view adapts as the iPad split pane grows/shrinks (rotation,
/// Split View / Slide Over multitasking).
///
/// `footer` follows the content on narrow widths; on wide panes it joins the
/// bottom of the primary column rather than spanning both columns.
struct AdaptiveDetailLayout<Primary: View, Secondary: View, Footer: View>: View {
    /// Width at or above which the two-column layout is used.
    var breakpoint: CGFloat = 760
    /// Horizontal gap between the two columns when wide.
    var columnSpacing: CGFloat = 20
    /// Vertical gap between stacked sections.
    var sectionSpacing: CGFloat = 16

    @ViewBuilder var primary: () -> Primary
    @ViewBuilder var secondary: () -> Secondary
    @ViewBuilder var footer: () -> Footer

    var body: some View {
        GeometryReader { geo in
            ScrollView {
                VStack(alignment: .leading, spacing: sectionSpacing) {
                    if geo.size.width >= breakpoint {
                        // Wide: footer joins the primary column so actions sit
                        // with the summary instead of stretching pane-wide
                        // below both columns.
                        HStack(alignment: .top, spacing: columnSpacing) {
                            VStack(alignment: .leading, spacing: sectionSpacing) {
                                primary()
                                footer()
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)

                            VStack(alignment: .leading, spacing: sectionSpacing) {
                                secondary()
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    } else {
                        primary()
                        secondary()
                        footer()
                    }
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}

extension AdaptiveDetailLayout where Footer == EmptyView {
    init(
        breakpoint: CGFloat = 760,
        columnSpacing: CGFloat = 20,
        sectionSpacing: CGFloat = 16,
        @ViewBuilder primary: @escaping () -> Primary,
        @ViewBuilder secondary: @escaping () -> Secondary
    ) {
        self.init(
            breakpoint: breakpoint,
            columnSpacing: columnSpacing,
            sectionSpacing: sectionSpacing,
            primary: primary,
            secondary: secondary,
            footer: { EmptyView() }
        )
    }
}
