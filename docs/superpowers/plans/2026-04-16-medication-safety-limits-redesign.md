# Medication Safety Limits Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the all-categories-visible Medication Safety Limits screen with a clean list-of-configured-limits + modal Add/Edit sheet, including preset auto-fill for NSAIDs and Triptans.

**Architecture:** SwiftUI `List` showing only configured limits; toolbar `+` opens a `.sheet` (`CategoryLimitEditorSheet`) for add/edit. Swipe-to-delete removes a row. No schema or repository changes — existing `CategoryUsageLimit`, `CategoryUsageLimitRepository`, and `CategoryLimitsViewModel` are reused, with small additive changes on the view model. Presets live as a static extension on `MedicationCategory`.

**Tech Stack:** Swift 5.9+, SwiftUI (iOS 17 target), `@Observable` view models, XCTest, xcodegen (project generation), GRDB (already wired — no changes).

**Spec:** `docs/superpowers/specs/2026-04-16-medication-safety-limits-redesign-design.md`

---

## File Structure

- **Modified**: `mobile-apps/ios/MigraLog/Models/Enums.swift` — add `mohPreset` computed property to `MedicationCategory`.
- **Modified**: `mobile-apps/ios/MigraLog/ViewModels/CategoryLimitsViewModel.swift` — add `availableCategoriesForAdd` and `canAddMoreLimits` computed properties.
- **Created**: `mobile-apps/ios/MigraLog/Views/Settings/CategoryLimitEditorSheet.swift` — add/edit modal sheet.
- **Rewritten body**: `mobile-apps/ios/MigraLog/Views/Settings/CategoryLimitsScreen.swift` — list of configured limits + empty state + sheet presentation.
- **Created**: `mobile-apps/ios/MigraLogTests/ViewModels/CategoryLimitsViewModelTests.swift` — tests for the view model (did not exist previously).
- **Created**: `mobile-apps/ios/MigraLogTests/Models/MedicationCategoryTests.swift` — tests for `mohPreset`.

The xcodeproj is regenerated from `project.yml` via `xcodegen` — sources are picked up automatically from `path: MigraLog` and `path: MigraLogTests`, so no manual `project.pbxproj` edits are needed.

---

## Task 1: Add MOH preset to MedicationCategory

**Files:**
- Create: `mobile-apps/ios/MigraLogTests/Models/MedicationCategoryTests.swift`
- Modify: `mobile-apps/ios/MigraLog/Models/Enums.swift` (append at end of file, after the `MedicationCategory` enum)

- [ ] **Step 1: Write the failing tests**

Create `mobile-apps/ios/MigraLogTests/Models/MedicationCategoryTests.swift`:

```swift
import XCTest
@testable import MigraLog

final class MedicationCategoryTests: XCTestCase {
    func test_mohPreset_forNSAID_is15DaysIn30Days() {
        let preset = MedicationCategory.nsaid.mohPreset
        XCTAssertEqual(preset?.maxDays, 15)
        XCTAssertEqual(preset?.windowDays, 30)
    }

    func test_mohPreset_forTriptan_is10DaysIn30Days() {
        let preset = MedicationCategory.triptan.mohPreset
        XCTAssertEqual(preset?.maxDays, 10)
        XCTAssertEqual(preset?.windowDays, 30)
    }

    func test_mohPreset_forOTC_isNil() {
        XCTAssertNil(MedicationCategory.otc.mohPreset)
    }

    func test_mohPreset_forCGRP_isNil() {
        XCTAssertNil(MedicationCategory.cgrp.mohPreset)
    }

    func test_mohPreset_forPreventive_isNil() {
        XCTAssertNil(MedicationCategory.preventive.mohPreset)
    }

    func test_mohPreset_forSupplement_isNil() {
        XCTAssertNil(MedicationCategory.supplement.mohPreset)
    }

    func test_mohPreset_forOther_isNil() {
        XCTAssertNil(MedicationCategory.other.mohPreset)
    }
}
```

- [ ] **Step 2: Regenerate xcodeproj so the new test file is picked up**

Run (from `mobile-apps/ios`):
```bash
cd mobile-apps/ios && xcodegen generate
```
Expected: "Loaded project..." then "Created project at ...MigraLog.xcodeproj".

- [ ] **Step 3: Run tests to verify they fail**

Run:
```bash
cd mobile-apps/ios && xcodebuild test -scheme MigraLog -destination 'platform=iOS Simulator,name=iPhone 15' -only-testing:MigraLogTests/MedicationCategoryTests 2>&1 | tail -30
```
Expected: Compilation error — `Value of type 'MedicationCategory' has no member 'mohPreset'`.

- [ ] **Step 4: Add the preset extension**

Append to `mobile-apps/ios/MigraLog/Models/Enums.swift` directly after the closing `}` of `enum MedicationCategory` (currently line 152), *before* the `// MARK: - Daily Status Enums` comment:

```swift
extension MedicationCategory {
    /// Common MOH (medication overuse headache) guideline defaults used to pre-fill
    /// the Add Limit sheet. Informational only — not medical advice.
    var mohPreset: (maxDays: Int, windowDays: Int)? {
        switch self {
        case .nsaid:   return (15, 30)
        case .triptan: return (10, 30)
        case .otc, .cgrp, .preventive, .supplement, .other:
            return nil
        }
    }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run:
```bash
cd mobile-apps/ios && xcodebuild test -scheme MigraLog -destination 'platform=iOS Simulator,name=iPhone 15' -only-testing:MigraLogTests/MedicationCategoryTests 2>&1 | tail -20
```
Expected: `Test Suite 'MedicationCategoryTests' passed`, 7 tests passing.

- [ ] **Step 6: Commit**

```bash
git add mobile-apps/ios/MigraLog/Models/Enums.swift mobile-apps/ios/MigraLogTests/Models/MedicationCategoryTests.swift mobile-apps/ios/MigraLog.xcodeproj
git commit -m "feat(ios): add MOH preset to MedicationCategory"
```

---

## Task 2: Extend CategoryLimitsViewModel with availableCategoriesForAdd / canAddMoreLimits

**Files:**
- Create: `mobile-apps/ios/MigraLogTests/ViewModels/CategoryLimitsViewModelTests.swift`
- Modify: `mobile-apps/ios/MigraLog/ViewModels/CategoryLimitsViewModel.swift`

- [ ] **Step 1: Write the failing tests**

Create `mobile-apps/ios/MigraLogTests/ViewModels/CategoryLimitsViewModelTests.swift`:

```swift
import XCTest
@testable import MigraLog

@MainActor
final class CategoryLimitsViewModelTests: XCTestCase {
    private var mockRepo: MockCategoryUsageLimitRepository!
    private var sut: CategoryLimitsViewModel!

    override func setUp() {
        super.setUp()
        mockRepo = MockCategoryUsageLimitRepository()
        sut = CategoryLimitsViewModel(repository: mockRepo)
    }

    override func tearDown() {
        sut = nil
        mockRepo = nil
        super.tearDown()
    }

    // MARK: - loadLimits

    func test_loadLimits_populatesLimitsMapKeyedByCategory() {
        let nsaid = CategoryUsageLimit(category: .nsaid, maxDays: 15, windowDays: 30)
        let triptan = CategoryUsageLimit(category: .triptan, maxDays: 10, windowDays: 30)
        mockRepo.limits = [.nsaid: nsaid, .triptan: triptan]

        sut.loadLimits()

        XCTAssertEqual(sut.limits[.nsaid], nsaid)
        XCTAssertEqual(sut.limits[.triptan], triptan)
        XCTAssertNil(sut.limits[.otc])
    }

    // MARK: - availableCategoriesForAdd

    func test_availableCategoriesForAdd_whenEmpty_returnsAllCategories() {
        sut.loadLimits()

        XCTAssertEqual(Set(sut.availableCategoriesForAdd), Set(MedicationCategory.allCases))
    }

    func test_availableCategoriesForAdd_excludesConfiguredCategories() {
        mockRepo.limits = [
            .nsaid: CategoryUsageLimit(category: .nsaid, maxDays: 15, windowDays: 30)
        ]
        sut.loadLimits()

        XCTAssertFalse(sut.availableCategoriesForAdd.contains(.nsaid))
        XCTAssertTrue(sut.availableCategoriesForAdd.contains(.triptan))
        XCTAssertEqual(sut.availableCategoriesForAdd.count, MedicationCategory.allCases.count - 1)
    }

    func test_availableCategoriesForAdd_preservesAllCasesOrder() {
        mockRepo.limits = [
            .triptan: CategoryUsageLimit(category: .triptan, maxDays: 10, windowDays: 30)
        ]
        sut.loadLimits()

        let expected = MedicationCategory.allCases.filter { $0 != .triptan }
        XCTAssertEqual(sut.availableCategoriesForAdd, expected)
    }

    // MARK: - canAddMoreLimits

    func test_canAddMoreLimits_whenEmpty_isTrue() {
        sut.loadLimits()
        XCTAssertTrue(sut.canAddMoreLimits)
    }

    func test_canAddMoreLimits_whenAllConfigured_isFalse() {
        var map: [MedicationCategory: CategoryUsageLimit] = [:]
        for c in MedicationCategory.allCases {
            map[c] = CategoryUsageLimit(category: c, maxDays: 1, windowDays: 1)
        }
        mockRepo.limits = map
        sut.loadLimits()

        XCTAssertFalse(sut.canAddMoreLimits)
    }

    // MARK: - saveLimit

    func test_saveLimit_addsToLimitsMap() {
        let limit = CategoryUsageLimit(category: .nsaid, maxDays: 15, windowDays: 30)
        sut.saveLimit(limit)

        XCTAssertEqual(sut.limits[.nsaid], limit)
        XCTAssertTrue(mockRepo.setLimitCalled)
    }

    // MARK: - clearLimit

    func test_clearLimit_removesFromLimitsMap() {
        mockRepo.limits = [
            .nsaid: CategoryUsageLimit(category: .nsaid, maxDays: 15, windowDays: 30)
        ]
        sut.loadLimits()
        XCTAssertNotNil(sut.limits[.nsaid])

        sut.clearLimit(.nsaid)

        XCTAssertNil(sut.limits[.nsaid])
        XCTAssertTrue(mockRepo.clearLimitCalled)
    }
}
```

- [ ] **Step 2: Regenerate xcodeproj**

Run:
```bash
cd mobile-apps/ios && xcodegen generate
```
Expected: "Created project at ...MigraLog.xcodeproj".

- [ ] **Step 3: Run tests to verify they fail**

Run:
```bash
cd mobile-apps/ios && xcodebuild test -scheme MigraLog -destination 'platform=iOS Simulator,name=iPhone 15' -only-testing:MigraLogTests/CategoryLimitsViewModelTests 2>&1 | tail -30
```
Expected: Compilation error — `Value of type 'CategoryLimitsViewModel' has no member 'availableCategoriesForAdd'` (and `canAddMoreLimits`).

- [ ] **Step 4: Add the computed properties**

Modify `mobile-apps/ios/MigraLog/ViewModels/CategoryLimitsViewModel.swift` — add the following computed properties inside the class, immediately after the `private let repository: CategoryUsageLimitRepositoryProtocol` line and before the `init`:

```swift
    /// Categories not yet configured — used to populate the Add Limit picker.
    /// Preserves `MedicationCategory.allCases` order.
    var availableCategoriesForAdd: [MedicationCategory] {
        MedicationCategory.allCases.filter { limits[$0] == nil }
    }

    /// Whether the toolbar "+" should be enabled.
    var canAddMoreLimits: Bool {
        !availableCategoriesForAdd.isEmpty
    }

```

- [ ] **Step 5: Run tests to verify they pass**

Run:
```bash
cd mobile-apps/ios && xcodebuild test -scheme MigraLog -destination 'platform=iOS Simulator,name=iPhone 15' -only-testing:MigraLogTests/CategoryLimitsViewModelTests 2>&1 | tail -20
```
Expected: `Test Suite 'CategoryLimitsViewModelTests' passed`, all tests passing.

- [ ] **Step 6: Commit**

```bash
git add mobile-apps/ios/MigraLog/ViewModels/CategoryLimitsViewModel.swift mobile-apps/ios/MigraLogTests/ViewModels/CategoryLimitsViewModelTests.swift mobile-apps/ios/MigraLog.xcodeproj
git commit -m "feat(ios): add availableCategoriesForAdd + canAddMoreLimits to CategoryLimitsViewModel"
```

---

## Task 3: Create CategoryLimitEditorSheet

This task creates the add/edit modal sheet. SwiftUI views in this codebase are not covered by automated tests; correctness is verified by (a) compiling, (b) the view model it drives being covered by tests from Task 2, and (c) manual verification in Task 5.

**Files:**
- Create: `mobile-apps/ios/MigraLog/Views/Settings/CategoryLimitEditorSheet.swift`

- [ ] **Step 1: Create the sheet file**

Create `mobile-apps/ios/MigraLog/Views/Settings/CategoryLimitEditorSheet.swift` with the full contents below:

```swift
import SwiftUI

/// Modal sheet for adding or editing a single `CategoryUsageLimit`.
/// In add mode the user picks a category from the supplied list and the fields
/// auto-fill with the category's `mohPreset` if one exists. In edit mode the
/// category is locked and the fields are pre-populated from the existing limit.
struct CategoryLimitEditorSheet: View {
    enum Mode: Equatable {
        case add(available: [MedicationCategory])
        case edit(existing: CategoryUsageLimit)
    }

    let mode: Mode
    let onSave: (CategoryUsageLimit) -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var selectedCategory: MedicationCategory?
    @State private var maxDaysText: String = ""
    @State private var windowDaysText: String = ""

    var body: some View {
        NavigationStack {
            Form {
                categorySection
                limitSection
                guidanceSection
            }
            .navigationTitle(navigationTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .accessibilityIdentifier("limit-editor-cancel")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(!isValid)
                        .accessibilityIdentifier("limit-editor-save")
                }
            }
            .onAppear(perform: configureInitialState)
            .presentationDetents([.medium])
        }
    }

    // MARK: - Sections

    @ViewBuilder
    private var categorySection: some View {
        switch mode {
        case .add(let available):
            Section("Category") {
                Picker("Category", selection: $selectedCategory) {
                    Text("Select a category").tag(MedicationCategory?.none)
                    ForEach(available) { category in
                        Text(category.displayName).tag(Optional(category))
                    }
                }
                .accessibilityIdentifier("limit-editor-category-picker")
                .onChange(of: selectedCategory) { _, newValue in
                    applyPresetIfAvailable(for: newValue)
                }
            }
        case .edit(let existing):
            Section("Category") {
                Text(existing.category.displayName)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var limitSection: some View {
        Section("Limit") {
            TextField("Max days", text: $maxDaysText)
                .keyboardType(.numberPad)
                .accessibilityIdentifier("limit-editor-max-days")

            TextField("Window (days)", text: $windowDaysText)
                .keyboardType(.numberPad)
                .accessibilityIdentifier("limit-editor-window-days")

            if let warning = validationWarning {
                Text(warning)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }
        }
    }

    private var guidanceSection: some View {
        Section {
            EmptyView()
        } footer: {
            Text("Based on common MOH (medication overuse headache) guidelines — informational only. Talk to your doctor about thresholds appropriate for your situation. This app does not provide medical advice.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - State / actions

    private var navigationTitle: String {
        switch mode {
        case .add: return "Add Limit"
        case .edit(let existing): return existing.category.displayName
        }
    }

    private var parsedMaxDays: Int? {
        guard let v = Int(maxDaysText), v > 0 else { return nil }
        return v
    }

    private var parsedWindowDays: Int? {
        guard let v = Int(windowDaysText), v > 0 else { return nil }
        return v
    }

    private var resolvedCategory: MedicationCategory? {
        switch mode {
        case .add:                 return selectedCategory
        case .edit(let existing):  return existing.category
        }
    }

    private var isValid: Bool {
        guard resolvedCategory != nil,
              let maxDays = parsedMaxDays,
              let windowDays = parsedWindowDays else {
            return false
        }
        return maxDays <= windowDays
    }

    private var validationWarning: String? {
        guard let maxDays = parsedMaxDays, let windowDays = parsedWindowDays else {
            return nil
        }
        return maxDays > windowDays ? "Max days can't exceed the window." : nil
    }

    private func configureInitialState() {
        if case .edit(let existing) = mode {
            maxDaysText = String(existing.maxDays)
            windowDaysText = String(existing.windowDays)
        }
    }

    private func applyPresetIfAvailable(for category: MedicationCategory?) {
        guard case .add = mode, let category, let preset = category.mohPreset else {
            return
        }
        maxDaysText = String(preset.maxDays)
        windowDaysText = String(preset.windowDays)
    }

    private func save() {
        guard let category = resolvedCategory,
              let maxDays = parsedMaxDays,
              let windowDays = parsedWindowDays,
              maxDays <= windowDays else {
            return
        }
        let limit = CategoryUsageLimit(
            category: category,
            maxDays: maxDays,
            windowDays: windowDays
        )
        onSave(limit)
        dismiss()
    }
}
```

- [ ] **Step 2: Regenerate xcodeproj**

Run:
```bash
cd mobile-apps/ios && xcodegen generate
```
Expected: "Created project at ...MigraLog.xcodeproj".

- [ ] **Step 3: Build to verify it compiles**

Run:
```bash
cd mobile-apps/ios && xcodebuild build -scheme MigraLog -destination 'platform=iOS Simulator,name=iPhone 15' 2>&1 | tail -20
```
Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 4: Commit**

```bash
git add mobile-apps/ios/MigraLog/Views/Settings/CategoryLimitEditorSheet.swift mobile-apps/ios/MigraLog.xcodeproj
git commit -m "feat(ios): add CategoryLimitEditorSheet for add/edit of usage limits"
```

---

## Task 4: Rewrite CategoryLimitsScreen

This task replaces the old all-categories layout with the list-of-configured-limits + empty-state + sheet-presentation design. The view model already has everything needed after Task 2.

**Files:**
- Modify (full rewrite of body): `mobile-apps/ios/MigraLog/Views/Settings/CategoryLimitsScreen.swift`

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `mobile-apps/ios/MigraLog/Views/Settings/CategoryLimitsScreen.swift` with:

```swift
import SwiftUI

/// Settings screen listing the user's configured medication usage limits.
/// Users add a new limit via the toolbar "+" (or the empty-state button),
/// tap a row to edit, and swipe to delete. At most one limit per category.
struct CategoryLimitsScreen: View {
    @State private var viewModel = CategoryLimitsViewModel()
    @State private var editorMode: CategoryLimitEditorSheet.Mode?

    var body: some View {
        Group {
            if viewModel.limits.isEmpty {
                emptyState
            } else {
                limitsList
            }
        }
        .navigationTitle("Medication Safety Limits")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    presentAddSheet()
                } label: {
                    Image(systemName: "plus")
                }
                .disabled(!viewModel.canAddMoreLimits)
                .accessibilityIdentifier("category-limits-add")
            }
        }
        .sheet(item: $editorMode) { mode in
            CategoryLimitEditorSheet(mode: mode) { limit in
                viewModel.saveLimit(limit)
            }
        }
        .task {
            viewModel.loadLimits()
        }
    }

    // MARK: - Empty state

    private var emptyState: some View {
        ContentUnavailableView {
            Label("No Limits Configured", systemImage: "shield.lefthalf.filled")
        } description: {
            Text("Optional warnings for medication-overuse headache risk. These are informational only — talk to your doctor before relying on them.")
        } actions: {
            Button {
                presentAddSheet()
            } label: {
                Text("Add Limit")
                    .fontWeight(.semibold)
            }
            .buttonStyle(.borderedProminent)
            .accessibilityIdentifier("category-limits-empty-add")
        }
    }

    // MARK: - List

    private var limitsList: some View {
        List {
            Section {
                ForEach(configuredLimitsInOrder) { limit in
                    Button {
                        editorMode = .edit(existing: limit)
                    } label: {
                        limitRow(limit)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("limit-row-\(limit.category.rawValue)")
                    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                        Button(role: .destructive) {
                            viewModel.clearLimit(limit.category)
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                        .accessibilityIdentifier("limit-row-delete-\(limit.category.rawValue)")
                    }
                }
            } footer: {
                Text("Informational warnings only — not medical advice. The app will not block you from logging doses. Talk to your doctor about appropriate thresholds. Common guidelines: NSAIDs 15/30, Triptans 10/30.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func limitRow(_ limit: CategoryUsageLimit) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(limit.category.displayName)
                    .font(.body)
                Text("\(limit.maxDays) days in any \(limit.windowDays) days")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.footnote)
                .foregroundStyle(.tertiary)
        }
        .contentShape(Rectangle())
    }

    // MARK: - Helpers

    private var configuredLimitsInOrder: [CategoryUsageLimit] {
        MedicationCategory.allCases.compactMap { viewModel.limits[$0] }
    }

    private func presentAddSheet() {
        editorMode = .add(available: viewModel.availableCategoriesForAdd)
    }
}

// MARK: - Sheet Identifiable

extension CategoryLimitEditorSheet.Mode: Identifiable {
    var id: String {
        switch self {
        case .add:                 return "__add__"
        case .edit(let existing):  return existing.category.rawValue
        }
    }
}
```

- [ ] **Step 2: Build to verify it compiles**

Run:
```bash
cd mobile-apps/ios && xcodebuild build -scheme MigraLog -destination 'platform=iOS Simulator,name=iPhone 15' 2>&1 | tail -20
```
Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 3: Run the full test suite to catch regressions**

Run:
```bash
cd mobile-apps/ios && xcodebuild test -scheme MigraLog -destination 'platform=iOS Simulator,name=iPhone 15' 2>&1 | tail -30
```
Expected: All tests pass, including `MedicationCategoryTests` and `CategoryLimitsViewModelTests`.

- [ ] **Step 4: Commit**

```bash
git add mobile-apps/ios/MigraLog/Views/Settings/CategoryLimitsScreen.swift
git commit -m "feat(ios): redesign CategoryLimitsScreen with Add flow and swipe-to-delete"
```

---

## Task 5: Manual verification in iOS Simulator

SwiftUI views have no snapshot or UI-test coverage in this project, so this task is a manual walkthrough to confirm the design matches the spec. Capture screenshots where indicated.

**Files:** none (verification only).

- [ ] **Step 1: Launch the app in the Simulator**

Run:
```bash
cd mobile-apps/ios && xcodebuild build -scheme MigraLog -destination 'platform=iOS Simulator,name=iPhone 15' 2>&1 | tail -5
```
Then open `MigraLog.xcodeproj` in Xcode and run on the iPhone 15 simulator, or use:
```bash
xcrun simctl launch booted com.eff3.migralog
```

- [ ] **Step 2: Verify the empty state**

Navigate: Settings → Medication Safety Limits (on a fresh install with no limits configured).

Expected:
- Centered icon + "No Limits Configured" heading.
- Description paragraph mentioning MOH risk and doctor consultation.
- Prominent "Add Limit" button.
- Toolbar `+` visible and enabled.

If any configured limits already exist from prior runs, clear them via swipe-to-delete first.

- [ ] **Step 3: Verify the add flow with a preset**

Tap toolbar `+` (or the empty-state "Add Limit" button). Expected: sheet slides up at medium detent with title "Add Limit", Cancel (left) / Save (right, disabled), a category picker reading "Select a category", empty Max days / Window days fields, and the footer guidance text.

Pick **NSAID** from the picker. Expected: fields auto-fill to 15 and 30; Save becomes enabled.

Tap Save. Expected: sheet dismisses; a row appears reading "NSAID" with subtitle "15 days in any 30 days".

- [ ] **Step 4: Verify the add flow without a preset**

Tap the `+` again. Pick **CGRP**. Expected: fields remain empty (no preset); Save stays disabled until valid numbers are entered.

Enter `3` and `30`. Tap Save. Expected: new CGRP row appears.

- [ ] **Step 5: Verify picker filtering**

Tap `+` again. Open the category picker. Expected: NSAID and CGRP do NOT appear in the options. Triptan, OTC, Preventive, Supplement, Other do appear.

Dismiss with Cancel.

- [ ] **Step 6: Verify edit mode**

Tap the NSAID row. Expected: sheet opens with title "NSAID", category section shows "NSAID" as a locked row (no picker), Max days = 15, Window days = 30.

Change Window days to `60`. Tap Save. Expected: row subtitle updates to "15 days in any 60 days".

- [ ] **Step 7: Verify validation**

Tap the NSAID row. Change Max days to `100`, Window days to `30`. Expected: red helper text "Max days can't exceed the window." appears; Save is disabled.

Change Max days back to `15`. Save re-enables. Cancel.

- [ ] **Step 8: Verify swipe-to-delete**

Swipe left on the CGRP row. Tap the red Delete action. Expected: row animates out of the list. Open the `+` picker; CGRP is once again available.

- [ ] **Step 9: Verify "all configured" disables Add**

Add limits for every remaining category (Triptan, OTC, Preventive, Supplement, Other). Expected: after the seventh limit is saved, the toolbar `+` becomes disabled.

Delete one row. Expected: `+` becomes enabled again.

- [ ] **Step 10: Verify footer text is present**

With at least one limit configured, scroll to the bottom of the list. Expected: footer reads "Informational warnings only — not medical advice…" with the common-guidelines examples.

- [ ] **Step 11: Commit any final fixes**

If Steps 2–10 uncover a visual or behavioral issue, fix it in the relevant file and commit with a `fix(ios): …` message. Otherwise this task is complete.

Final sanity:
```bash
git status
```
Expected: clean working tree.

---

## Self-Review Notes

- All spec requirements mapped to tasks: empty state (Task 4), list row format (Task 4), toolbar `+` (Task 4), swipe-to-delete (Task 4), add sheet with category picker and preset auto-fill (Task 3), edit sheet with locked category (Task 3), validation rule `maxDays <= windowDays` (Task 3), footer warning (Tasks 3 & 4), preset values (Task 1), view model additions (Task 2). No gaps.
- No placeholders: every step includes the actual code or command.
- Types and names are consistent across tasks: `CategoryLimitEditorSheet.Mode.add(available:)` / `.edit(existing:)`, `CategoryUsageLimit(category:maxDays:windowDays:)`, `availableCategoriesForAdd`, `canAddMoreLimits`, `mohPreset`. `CategoryLimitsScreen` calls `.sheet(item:)` which requires `Mode: Identifiable` — that conformance is added in Task 4.
