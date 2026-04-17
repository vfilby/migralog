# Medication Safety Limits — Redesign

**Date:** 2026-04-16
**Platform:** iOS (Swift / SwiftUI)
**Scope:** `mobile-apps/ios` — Settings → Medication Safety Limits

## Problem

The current `CategoryLimitsScreen` renders every `MedicationCategory` (OTC, NSAID, Triptan, CGRP, Preventive, Supplement, Other) as its own form section with "Max days" / "Window (days)" text fields and Save / Clear buttons — regardless of whether the user wants a limit for that category. The result is visually noisy, makes it hard to see which limits are actually configured, and feels amateurish. MOH-risk limits apply to only a couple of categories for most users, so the bulk of the screen is dead weight.

## Goals

- Show only the limits the user has configured.
- Provide a clean "Add Limit" flow that lets the user pick a category, set a max-days / window, and save.
- Keep the "one rule per category" constraint (sufficient for current needs; revisit only if a concrete use case emerges).
- Reduce friction for common cases (NSAIDs, Triptans) by pre-filling well-established ICHD MOH thresholds, without implying medical advice.
- Preserve the existing doctor-consultation warning; make it more prominent inside the add/edit flow where thresholds are being chosen.

## Non-goals

- Changing the data model or repository layer. The existing `CategoryUsageLimit` and `CategoryUsageLimitRepository` already support everything needed.
- Multiple rules per category.
- Changing how limits are evaluated or surfaced in dose logging / dashboard warnings. Only the configuration UI changes.
- Adding new MOH evaluation logic.

## Design

### Main screen — `CategoryLimitsScreen`

- **Navigation**: title `"Medication Safety Limits"`, inline display mode.
- **Toolbar**: trailing `+` button. Disabled iff every `MedicationCategory` already has a configured limit.
- **Empty state** (no limits configured):
  - Centered `ContentUnavailableView` (or equivalent) with a shield / medical icon, heading "No Limits Configured", and a one-sentence description that these are optional MOH-risk warnings.
  - Primary button "Add Limit" that opens the add sheet (same action as the toolbar `+`).
- **Populated state**: a SwiftUI `List` of rows, one per configured limit, sorted by `MedicationCategory.allCases` order.
  - Row shows the category `displayName` as the primary label and a secondary subtitle of the form `"{maxDays} days in any {windowDays} days"` (e.g., "15 days in any 30 days").
  - Tapping a row opens the editor sheet in edit mode for that category.
  - Swipe-from-trailing reveals a red "Delete" action that calls `viewModel.clearLimit(category)`.
- **Footer** (populated state only): the existing "informational warnings only — not medical advice — talk to your doctor" text, followed by the "Common examples: NSAIDs 15/30, Triptans 10/30" guidance. In the empty state, the empty-state description carries the warning instead.

### Add / Edit sheet — `CategoryLimitEditorSheet`

- **Presentation**: `.sheet` with `.presentationDetents([.medium])`. Drag-to-dismiss is enabled; dismissing without tapping Save discards changes.
- **Navigation** (inside the sheet):
  - Title: `"Add Limit"` (add mode) or the locked category's `displayName` (edit mode).
  - Leading toolbar item: `Cancel` — dismisses without saving.
  - Trailing toolbar item: `Save` — disabled until the form is valid (both integers > 0 and `maxDays <= windowDays`).
- **Body** (SwiftUI `Form`):
  1. **Category section**
     - *Add mode*: a `Picker` bound to the selected category, whose options are `viewModel.availableCategoriesForAdd` (categories not already configured). No default selection; Save is disabled until a category is chosen.
     - *Edit mode*: a single disabled row displaying the locked category (or omit the section and rely on the navigation title).
  2. **Limit section**: two rows — "Max days" and "Window (days)" — each a `TextField` with `.numberPad` keyboard. Validation shown inline (disabled Save is the primary signal; an inline red helper text appears only when the user has entered both values and they violate `maxDays <= windowDays`).
  3. **Footer**: plain-text section footer: *"Based on common MOH (medication overuse headache) guidelines — informational only. Talk to your doctor about thresholds appropriate for your situation. This app does not provide medical advice."*
- **Preset auto-fill** (add mode only): when the user selects a category in the picker, if `MedicationCategory.mohPreset` returns a value for that category, populate the Max days and Window fields with those values. The user can edit the prefilled values freely before saving. In edit mode, the fields are populated from the existing limit; presets are never applied.

### Presets

Added as a static extension on `MedicationCategory`:

```
extension MedicationCategory {
    /// Common MOH guideline defaults used to pre-fill the Add Limit sheet.
    /// Presets are informational only and must not be treated as medical advice.
    var mohPreset: (maxDays: Int, windowDays: Int)? {
        switch self {
        case .nsaid:   return (15, 30)
        case .triptan: return (10, 30)
        default:       return nil  // OTC, CGRP, Preventive, Supplement, Other have no preset
        }
    }
}
```

OTC is intentionally excluded because the category is too heterogeneous (acetaminophen, caffeine blends, combined analgesics, etc.) to pick a single defensible default.

### View model — `CategoryLimitsViewModel`

Existing responsibilities (`loadLimits`, `saveLimit`, `clearLimit`, error surfacing) are preserved. Adds:

- `var availableCategoriesForAdd: [MedicationCategory]` — computed: `MedicationCategory.allCases.filter { limits[$0] == nil }`.
- A helper for the "can add" state the toolbar `+` uses: `var canAddMoreLimits: Bool { !availableCategoriesForAdd.isEmpty }`.

No repository or database changes.

### User flows

1. **First-time user** — opens Settings → Medication Safety Limits → sees empty state → taps "Add Limit" → picks NSAID → fields auto-fill to 15 / 30 → taps Save → sheet dismisses → NSAID row appears in list with subtitle "15 days in any 30 days".
2. **Editing an existing limit** — taps the NSAID row → sheet opens with title "NSAID", fields populated with current values, category locked → edits Window from 30 to 90 → Save → row subtitle updates.
3. **Removing a limit** — swipes left on the NSAID row → taps red Delete → row animates out → next time "Add Limit" is opened, NSAID reappears in the picker.
4. **All categories configured** — after seven limits are added the toolbar `+` becomes disabled (a rare case in practice but handled).

## Files changed

- **`mobile-apps/ios/MigraLog/Views/Settings/CategoryLimitsScreen.swift`** — full rewrite of the body to present the configured list, empty state, toolbar add button, and swipe-to-delete.
- **`mobile-apps/ios/MigraLog/ViewModels/CategoryLimitsViewModel.swift`** — add `availableCategoriesForAdd` and `canAddMoreLimits`.
- **New: `mobile-apps/ios/MigraLog/Views/Settings/CategoryLimitEditorSheet.swift`** — add/edit sheet described above.
- **`mobile-apps/ios/MigraLog/Models/Enums.swift`** — add `mohPreset` extension on `MedicationCategory`.
- **`mobile-apps/ios/MigraLog.xcodeproj/project.pbxproj`** — register the new source file.

## Testing

- **ViewModel tests** (`CategoryLimitsViewModelTests`, extend existing)
  - `availableCategoriesForAdd` returns all seven categories when nothing is configured.
  - After `saveLimit` for NSAID, `availableCategoriesForAdd` omits NSAID.
  - `canAddMoreLimits` is false when all seven categories have limits and true otherwise.
- **Preset tests** (new, in `MedicationCategoryTests` or a suitable existing file)
  - `mohPreset` returns `(15, 30)` for `.nsaid`, `(10, 30)` for `.triptan`, and `nil` for every other case.
- **Screen / UI tests** — rewrite the existing `CategoryLimitsScreen` tests that assumed the all-categories-always-visible layout:
  - Empty state renders the "No Limits Configured" view and Add button.
  - Populated list renders one row per configured limit with the expected subtitle format.
  - Tapping a row presents the editor sheet in edit mode with the category locked and fields populated.
  - Tapping toolbar `+` presents the editor sheet in add mode with no category preselected.
  - Picking NSAID in the add sheet auto-fills 15 / 30; picking CGRP leaves fields empty.
  - Save is disabled when fields are empty, when values are non-integer or ≤ 0, or when `maxDays > windowDays`; otherwise enabled.
  - Swipe-to-delete on a row calls the view model's `clearLimit` for the right category and removes the row from the list.
  - When all seven categories are configured, the toolbar `+` is disabled.

## Open questions

None.
