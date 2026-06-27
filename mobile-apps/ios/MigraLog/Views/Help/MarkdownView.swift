import SwiftUI

/// A lightweight block-level Markdown renderer for the bundled user guide.
///
/// This is intentionally small — it covers the subset of Markdown the user-guide
/// content uses (headings, paragraphs, bullet/ordered lists, block quotes,
/// tables, and horizontal rules) rather than aiming to be a complete CommonMark
/// implementation. Inline formatting (**bold**, *italic*, `code`, and links) is
/// delegated to `AttributedString`'s own Markdown parsing.
///
/// Relative `*.md` links are preserved so the host screen can intercept them and
/// navigate between articles; see `HelpArticleScreen`.
struct MarkdownView: View {
    let markdown: String

    var body: some View {
        let blocks = MarkdownParser.parse(markdown)
        VStack(alignment: .leading, spacing: 14) {
            ForEach(Array(blocks.enumerated()), id: \.offset) { _, block in
                view(for: block)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    @ViewBuilder
    private func view(for block: MarkdownBlock) -> some View {
        switch block {
        case let .heading(level, text):
            Text(inline(text))
                .font(headingFont(level))
                .fontWeight(level <= 2 ? .bold : .semibold)
                .padding(.top, level <= 2 ? 10 : 2)

        case let .paragraph(text):
            Text(inline(text))
                .font(.body)

        case let .bulletList(items):
            VStack(alignment: .leading, spacing: 8) {
                ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text("•")
                            .foregroundStyle(DesignTokens.Brand.orange)
                        Text(inline(item))
                            .font(.body)
                    }
                }
            }

        case let .orderedList(items):
            VStack(alignment: .leading, spacing: 8) {
                ForEach(Array(items.enumerated()), id: \.offset) { idx, item in
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text("\(idx + 1).")
                            .foregroundStyle(DesignTokens.Brand.orange)
                            .fontWeight(.semibold)
                            .monospacedDigit()
                        Text(inline(item))
                            .font(.body)
                    }
                }
            }

        case let .quote(text):
            HStack(spacing: 10) {
                RoundedRectangle(cornerRadius: 2)
                    .fill(DesignTokens.Brand.orange)
                    .frame(width: 3)
                Text(inline(text))
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 10))

        case let .table(header, rows):
            tableView(header: header, rows: rows)

        case .divider:
            Divider().padding(.vertical, 4)
        }
    }

    private func headingFont(_ level: Int) -> Font {
        switch level {
        case 1: return .title
        case 2: return .title2
        case 3: return .title3
        default: return .headline
        }
    }

    /// Renders inline Markdown (bold/italic/code/links). Falls back to plain text
    /// if parsing fails for any reason.
    private func inline(_ string: String) -> AttributedString {
        (try? AttributedString(
            markdown: string,
            options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        )) ?? AttributedString(string)
    }

    @ViewBuilder
    private func tableView(header: [String], rows: [[String]]) -> some View {
        VStack(spacing: 0) {
            tableRow(header, isHeader: true)
            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                Divider()
                tableRow(row, isHeader: false)
            }
        }
        .padding(.vertical, 4)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 10))
    }

    private func tableRow(_ cells: [String], isHeader: Bool) -> some View {
        HStack(alignment: .top, spacing: 8) {
            ForEach(Array(cells.enumerated()), id: \.offset) { _, cell in
                Text(inline(cell))
                    .font(isHeader ? .subheadline.bold() : .subheadline)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }
}

// MARK: - Parsing

enum MarkdownBlock {
    case heading(level: Int, text: String)
    case paragraph(String)
    case bulletList([String])
    case orderedList([String])
    case quote(String)
    case table(header: [String], rows: [[String]])
    case divider
}

enum MarkdownParser {
    static func parse(_ markdown: String) -> [MarkdownBlock] {
        var blocks: [MarkdownBlock] = []
        let lines = markdown.components(separatedBy: .newlines)
        var i = 0

        while i < lines.count {
            let raw = lines[i]
            let trimmed = raw.trimmingCharacters(in: .whitespaces)

            if trimmed.isEmpty { i += 1; continue }

            // Horizontal rule
            if trimmed == "---" || trimmed == "***" {
                blocks.append(.divider)
                i += 1
                continue
            }

            // Heading
            if trimmed.hasPrefix("#") {
                var level = 0
                var idx = trimmed.startIndex
                while idx < trimmed.endIndex, trimmed[idx] == "#" {
                    level += 1
                    idx = trimmed.index(after: idx)
                }
                let text = trimmed[idx...].trimmingCharacters(in: .whitespaces)
                blocks.append(.heading(level: min(level, 6), text: text))
                i += 1
                continue
            }

            // Table — consecutive lines starting with "|"
            if trimmed.hasPrefix("|") {
                var tableLines: [String] = []
                while i < lines.count {
                    let t = lines[i].trimmingCharacters(in: .whitespaces)
                    guard t.hasPrefix("|") else { break }
                    tableLines.append(t)
                    i += 1
                }
                if let table = parseTable(tableLines) {
                    blocks.append(table)
                }
                continue
            }

            // Block quote
            if trimmed.hasPrefix(">") {
                var quoteLines: [String] = []
                while i < lines.count {
                    var t = lines[i].trimmingCharacters(in: .whitespaces)
                    guard t.hasPrefix(">") else { break }
                    t.removeFirst()
                    quoteLines.append(t.trimmingCharacters(in: .whitespaces))
                    i += 1
                }
                blocks.append(.quote(quoteLines.joined(separator: " ")))
                continue
            }

            // Bullet list
            if isBullet(raw) {
                blocks.append(.bulletList(collectListItems(lines, &i, ordered: false)))
                continue
            }

            // Ordered list
            if orderedPrefixLength(raw) != nil {
                blocks.append(.orderedList(collectListItems(lines, &i, ordered: true)))
                continue
            }

            // Paragraph — gather consecutive plain lines (soft-wrapped source)
            var paragraph: [String] = []
            while i < lines.count {
                let l = lines[i]
                let t = l.trimmingCharacters(in: .whitespaces)
                if t.isEmpty { break }
                if t.hasPrefix("#") || t.hasPrefix("|") || t.hasPrefix(">")
                    || t == "---" || t == "***"
                    || isBullet(l) || orderedPrefixLength(l) != nil {
                    break
                }
                paragraph.append(t)
                i += 1
            }
            blocks.append(.paragraph(paragraph.joined(separator: " ")))
        }

        return blocks
    }

    // MARK: Helpers

    private static func isBullet(_ line: String) -> Bool {
        let t = line.trimmingCharacters(in: .whitespaces)
        return t.hasPrefix("- ") || t.hasPrefix("* ")
    }

    /// Returns the number of leading digits if `line` begins an ordered-list item
    /// ("12. text"), otherwise nil.
    private static func orderedPrefixLength(_ line: String) -> Int? {
        let t = Substring(line.drop(while: { $0 == " " }))
        var idx = t.startIndex
        var digits = 0
        while idx < t.endIndex, t[idx].isNumber {
            idx = t.index(after: idx)
            digits += 1
        }
        guard digits > 0, idx < t.endIndex, t[idx] == "." else { return nil }
        let after = t.index(after: idx)
        guard after < t.endIndex, t[after] == " " else { return nil }
        return digits
    }

    /// Collects items for a bullet or ordered list starting at `i`, folding
    /// indented continuation lines into the preceding item. Advances `i` past the
    /// list.
    private static func collectListItems(_ lines: [String], _ i: inout Int, ordered: Bool) -> [String] {
        var items: [String] = []
        while i < lines.count {
            let l = lines[i]
            let t = l.trimmingCharacters(in: .whitespaces)
            if t.isEmpty { break }

            if ordered, let digits = orderedPrefixLength(l) {
                var content = t
                content.removeFirst(digits + 2) // digits + ". "
                items.append(content)
                i += 1
            } else if !ordered, isBullet(l) {
                var content = t
                content.removeFirst(2) // "- "
                items.append(content)
                i += 1
            } else if l.hasPrefix(" "), !items.isEmpty {
                // Indented continuation of the current item.
                items[items.count - 1] += " " + t
                i += 1
            } else {
                break
            }
        }
        return items
    }

    private static func parseTable(_ lines: [String]) -> MarkdownBlock? {
        guard lines.count >= 2 else { return nil }
        let header = cells(lines[0])
        // lines[1] is the "| --- | --- |" separator; data rows follow.
        let rows = lines.dropFirst(2).map { cells($0) }
        return .table(header: header, rows: Array(rows))
    }

    private static func cells(_ row: String) -> [String] {
        var r = row
        if r.hasPrefix("|") { r.removeFirst() }
        if r.hasSuffix("|") { r.removeLast() }
        return r.components(separatedBy: "|").map { $0.trimmingCharacters(in: .whitespaces) }
    }
}
