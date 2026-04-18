# Per-Category Cooldown — Design

**Date:** 2026-04-18
**Status:** Draft — awaiting implementation
**Platform:** iOS (Swift)

## Summary

Add optional per-category cooldown rules alongside the existing per-category MOH
(medication overuse headache) day-count limits. A cooldown warns the user when they
are about to log a dose in a category shortly after logging any medication in the
same category. The motivating example: a user is about to take Naproxen but took
Advil one hour ago — both are NSAIDs, so we surface "Last NSAID (Advil) 1h ago —
wait 3h" on the log surfaces. Per-medication cooldown already exists and stays
unchanged.

Warnings are informational only; they never block logging.

## Goals

- Allow the user to configure a category-wide minimum interval between doses.
- Display the category cooldown warning on every surface where a dose can be
  logged, alongside (not replacing) per-med cooldown and MOH warnings.
- Keep the settings entry point, navigation title, and external UI vocabulary
  ("Medication Safety Limits") unchanged so existing users' muscle memory holds.
- Structure the data model so new rule types can be added later without a
  CloudKit schema migration.

## Non-goals

- Blocking or confirming the user before logging (warnings only, per existing
  philosophy).
- Changing per-medication cooldown behavior or UI.
- Cross-category rules (e.g. "NSAID + acetaminophen combined").
- React Native parity.

---

## Data model

### Table rename and restructure

`category_usage_limits` is renamed to `category_safety_rules` and becomes a
row-per-rule table with a `type` discriminator. This structure lets us add new
rule types as new rows rather than new columns, which matters because CloudKit
sync (planned) requires schema immutability.

```sql
CREATE TABLE category_safety_rules (
    id TEXT PRIMARY KEY,                 -- UUID, for CloudKit record-name stability
    category TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('cooldown','period_limit')),
    period_hours REAL NOT NULL,          -- cooldown: min gap; period_limit: window length
    max_count INTEGER,                   -- NULL for cooldown; count cap for period_limit
    created_at INTEGER NOT NULL,
    UNIQUE(category, type)
);
CREATE INDEX idx_category_safety_rules_category ON category_safety_rules(category);
```

- `period_hours` is a duration — 4.0 for a 4h cooldown, 720.0 for a 30-day window.
- `max_count` is a count. For `period_limit` rows this is "days with any dose" in
  the window. Named `max_count` (not `max_days`) so future rule types can reuse
  the column without a schema change.
- `UNIQUE(category, type)` enforces at most one cooldown and one period-limit per
  category. Additional rule types in the future get their own `type` value.

### Migration

1. Create `category_safety_rules`.
2. Copy each existing `category_usage_limits` row as:
   - `id = UUID()`
   - `type = 'period_limit'`
   - `period_hours = window_days * 24`
   - `max_count = max_days`
   - `created_at = now()` (no created_at existed previously; acceptable since
     these rows are user-configured and mutable).
3. Drop `category_usage_limits`.

All three steps run inside a single GRDB migration, guarded by the migration's
identifier so it only runs once.

### Swift model

```swift
enum CategorySafetyRuleType: String, CaseIterable, Equatable, Sendable {
    case cooldown
    case periodLimit = "period_limit"
}

struct CategorySafetyRule: Identifiable, Equatable, Sendable {
    let id: String
    let category: MedicationCategory
    let type: CategorySafetyRuleType
    let periodHours: Double
    let maxCount: Int?          // nil for .cooldown; required for .periodLimit
    let createdAt: Date
}
```

`CategoryUsageLimit` is deleted. Call sites that used it migrate to
`CategorySafetyRule` with `type == .periodLimit`.

### Repository

`CategoryUsageLimitRepository` renames to `CategorySafetyRuleRepository`.

```swift
protocol CategorySafetyRuleRepositoryProtocol {
    func getAllRules() throws -> [CategorySafetyRule]
    func getRules(for category: MedicationCategory) throws -> [CategorySafetyRule]
    func getRule(category: MedicationCategory, type: CategorySafetyRuleType) throws -> CategorySafetyRule?
    func upsert(_ rule: CategorySafetyRule) throws
    func delete(id: String) throws

    /// Count of distinct local days with any 'taken' dose in the category within
    /// the rolling window ending at `now`. Used to evaluate a period_limit rule.
    func countUsageDays(category: MedicationCategory, windowDays: Int, now: Date) throws -> Int
}
```

`countUsageDays` keeps its existing semantics but accepts `windowDays` computed
from the rule's `periodHours / 24.0` (rounded). Period-limit rules are conceptually
day-oriented even though stored in hours; the UI enforces day-granularity on input.

### New query on `MedicationRepository`

```swift
/// Most recent 'taken' dose in the category (any medication in that category)
/// on or before `now`. Returns the dose with its medication's display name for
/// banner rendering. Nil when no such dose exists.
func getLastTakenDoseInCategory(
    _ category: MedicationCategory,
    now: Date
) throws -> (dose: MedicationDose, medicationName: String)?
```

SQL:
```sql
SELECT d.*, m.name AS medication_name
FROM medication_doses d
INNER JOIN medications m ON m.id = d.medication_id
WHERE m.category = ?
  AND d.status = 'taken'
  AND d.timestamp <= ?
ORDER BY d.timestamp DESC
LIMIT 1;
```

Lives on `MedicationRepository` — dose queries are its natural home, and keeping
it there avoids coupling the rule repo to dose storage.

---

## Evaluation logic

New pure-function module `CategoryCooldown` mirrors `MedicationCooldown`:

```swift
enum CategoryCooldown {
    struct Status: Equatable {
        let isOnCooldown: Bool
        let hoursSinceLastDose: Double?
        let hoursUntilNextDose: Double
        let minIntervalHours: Double?
        let lastMedicationName: String?   // for banner wording
    }

    static func evaluate(
        category: MedicationCategory,
        lastDoseInCategory: (dose: MedicationDose, medicationName: String)?,
        cooldownRule: CategorySafetyRule?,
        now: Date = Date()
    ) -> Status
}
```

Rules:
- If `cooldownRule` is nil → `isOnCooldown=false`, `minIntervalHours=nil`. Banner
  is not shown.
- If `lastDoseInCategory` is nil → `isOnCooldown=false`, `minIntervalHours` from
  rule, no `lastMedicationName`. Banner is not shown (nothing meaningful to
  display yet).
- Otherwise → same math as `MedicationCooldown`: `elapsed = now − lastDose.date`,
  `remaining = max(0, periodHours − elapsed)`.

"Last dose in category" includes doses of the medication being logged — we bias
toward oversharing rather than hiding information.

`CategoryUsageStatus.evaluate` (already exists for MOH) adapts to take a
`CategorySafetyRule?` instead of `CategoryUsageLimit?`. Signature change only.

---

## UI

### `CategoryLimitsScreen` (settings → Medication Safety Limits)

Renamed in code to `CategorySafetyRulesScreen`. External label unchanged.

- Lists one row per rule (not per category). NSAID with both limit and cooldown
  appears as two rows, ordered by category then type (limit, cooldown).
- Row content:
  - Limit: `NSAIDs — 15 days / 30 days`
  - Cooldown: `NSAIDs — 4h between doses`
- Swipe-to-delete targets a single rule. Deleting the last rule for a category
  removes the category from the list.
- "Add" button presents the editor sheet in add mode with the category picker
  scoped to categories that still have a missing rule type.

### `CategoryLimitEditorSheet`

Renamed in code to `CategorySafetyRuleEditorSheet`. Mode becomes:

```swift
enum Mode {
    case add(available: [(MedicationCategory, Set<CategorySafetyRuleType>)])
    case edit(existing: CategorySafetyRule)
}
```

- In add mode, the user picks category first, then picks rule type from the
  types still available for that category.
- Form fields shown depend on type:
  - `cooldown` → one field: "Minimum time between doses" (hours, numeric).
  - `period_limit` → two fields: "Max days taken" and "In any rolling window of
    (days)". Same as today.
- Preset auto-fill (on add only, after picking category + type):
  - `MedicationCategory.mohPreset` continues to auto-fill period-limit rules.
  - New `MedicationCategory.cooldownPreset: Double?` auto-fills cooldown rules.
    Ship with **Triptan = 2h**. NSAID intentionally empty (guidelines vary by
    specific drug). Other categories empty.
- Validation:
  - `cooldown`: `periodHours > 0`.
  - `period_limit`: `maxCount > 0` and `windowDays > 0` and `maxCount ≤ windowDays`.

### `MedicationSafetyBanners`

Add a third optional banner:

```swift
struct MedicationSafetyBanners: View {
    var cooldown: MedicationCooldown.Status?
    var categoryCooldown: CategoryCooldown.Status?    // new
    var categoryStatus: CategoryUsageStatus?
    var medicationCategory: MedicationCategory?
    var medicationId: String?
}
```

Render order inside the VStack (max 3 lines):
1. Per-med cooldown (existing rules).
2. Category cooldown (new). Shown whenever `categoryCooldown.minIntervalHours`
   and `lastMedicationName` are both set. Orange `clock.arrow.2.circlepath` icon
   when on cooldown; secondary color when expired. Wording:
   - On cooldown: `Last NSAID (Advil) 1h ago — wait 3h`
   - Expired: `Last NSAID (Advil) 4h ago`
3. Category MOH status (existing rules).

Accessibility identifier: `category-cooldown-warning-<medicationId>`.

### Surfaces that render the banners

No structural change — the three existing surfaces already pass `cooldown` and
`categoryStatus` to `MedicationSafetyBanners`. Each call site gains one more
argument and one more fetch:

- Dashboard rows (via `DashboardViewModel`)
- Log Medication cards (via `LogMedicationViewModel`)
- Log Dose sheets (single-med sheet plus the grouped variant)

Each view model fetches the category cooldown rule (if any) and the last dose
in category for the medication's category, then calls
`CategoryCooldown.evaluate`. Cached next to the existing cooldown/MOH state.

---

## Testing

### Unit tests

- `CategoryCooldownTests`:
  - `evaluate` with no rule → not on cooldown, nil interval.
  - No prior dose → not on cooldown, no name.
  - On cooldown (different med in category) → correct remaining, correct name.
  - On cooldown (same med in category) → still reports (oversharing).
  - Just expired → not on cooldown, reports `hoursSinceLastDose`.
  - Skipped doses are ignored.
- `CategorySafetyRuleEditorSheetTests`:
  - Validation passes for cooldown-only, period-limit-only.
  - Triptan cooldown preset auto-fills on add.
  - Edit mode locks category + type, prefills fields.
  - Category picker in add mode filters out fully-configured categories.
- `CategorySafetyRuleRepositoryTests`:
  - Upsert then fetch round-trip.
  - `UNIQUE(category, type)` prevents duplicates (second upsert of same pair
    replaces the first).
  - Delete by id.
  - Migration test: an existing `category_usage_limits` row migrates correctly.
- `MedicationRepositoryTests`:
  - `getLastTakenDoseInCategory` returns latest across meds in the category.
  - Ignores skipped doses, doses of meds in other categories, doses after `now`.

### UI / snapshot

- `MedicationSafetyBanners` renders 0, 1, 2, and 3 banners for the expected
  combinations.
- `CategorySafetyRulesScreen` shows 2 rows for a category with both rules,
  1 row for a category with one rule, empty state when none exist.

---

## Rollout

Single PR. No feature flag — the feature is optional per user (no rule → no
warning) and carries its own migration.

## Open items

None.
