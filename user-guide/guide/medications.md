# Medications

MigraLog keeps a record of the medications you use, lets you log each dose, and
can warn you when you are taking a medication too soon after the last one or too
often over time. This page explains how to add a medication and how to set up
**cooldowns** and **safety limits**.

## Adding a medication

Open **Add Medication** (you can reach it from the Log Medication screen). As you 
type a name, MigraLog suggests common medications for you.

**Required details**

- **Name** — what you call the medication.
- **Type** — one of:
  - **Rescue** — taken to treat an attack in progress.
  - **Preventative** — taken on a schedule to reduce how often attacks occur.
  - **Other** — anything that does not fit the above.
- **Dose amount** and **unit** — for example `500` and `mg`, or `1` and
  `tablet`.

**Optional details**

- **Default quantity** — how many you usually take at once (for example `2`
  tablets). This is used for quick logging.
- **Category** — the medication class: **OTC**, **NSAID**, **Triptan**,
  **CGRP**, **Preventive**, **Supplement**, or **Other**. The category is
  important: it is what allows you to apply class-wide cooldowns and
  overuse limits (see below).
- **Minimum time between doses** — a per-medication cooldown, in hours.
- **Notes** — anything else you want to remember.

**For preventative medications** you can also set a **schedule** (daily, monthly,
or quarterly) and a **reminder time**, and turn the reminder on or off. Reminders can be sent as time sensitive, and optionally you have have a critical follow up notification set that will alert you even if your phone is in do not distrub.

## Logging a dose

From **Log Medication**, each medication appears as a card. You have two ways to
record a dose:

- **Quick log** — tap the dose button on the card to record your default
  quantity at the current time.
- **Details** — open the sheet to adjust the **quantity**, set the **time** (you
  can backdate a dose you forgot to log), and add **notes**.

If you log a dose while an episode is ongoing, MigraLog associates it with that
episode so it appears on the episode timeline.

## Cooldowns — spacing out doses

A **cooldown** is a minimum amount of time you want between doses. It
never prevents you from logging a dose; it simply shows a clear warning so you
can make an informed decision. There are two kinds.

### Per-medication cooldown

Set the **Minimum time between doses** (in hours) on an individual medication.
When you have taken that medication recently, its card shows how long ago the
last dose was and, if you are still inside the cooldown, how long remains — for
example *"Last dose 2h ago — wait 4h"*, highlighted in amber.

This is set on the medication itself and is independent of the category rules in
**Settings → Medication Safety Limits** — it neither appears there nor is
affected by them.

### Per-category cooldown

You can also require a gap between *any* medications in the same class — useful
for triptans, for instance, where the concern is the class as a whole rather than
one specific drug.

Set this in **Settings → Medication Safety Limits**: add a rule, choose a
**category**, choose the **Cooldown** rule type, and enter the minimum hours
between doses. MigraLog suggests common defaults (for example, two hours between
triptans) which you can accept or change.

When a category cooldown is active, the warning names the medication that
triggered it — for example *"Last Triptan (Sumatriptan) 1h ago — wait 1h"* —
even if you are about to log a different medication in that class.

## Safety limits — avoiding overuse

Taking acute (rescue) medication on too many days can, over time, lead to
medication-overuse headache. MigraLog can track this for you against the class
guidelines used in clinical practice.

Set a limit in **Settings → Medication Safety Limits**: add a rule, choose a
**category**, choose the **Period Limit** rule type, and set **"max days taken"**
within a **rolling window** of a given number of days. Suggested defaults follow
common guidance — for example, NSAIDs no more than 15 days in any 30, and
triptans no more than 10 days in any 30.

The suggested defaults are general starting points, not a recommendation for your
situation. **Consult your neurologist to determine the right limits for you** —
the appropriate thresholds depend on your medications, your history, and your
care plan, and your clinician's guidance always takes precedence.

A few things worth knowing about how limits are counted:

- Limits count **days of use**, not the number of doses. Two doses on the same
  day count as one day.
- The window is **rolling** — "the last 30 days" from today, not the current
  calendar month.

As you approach a limit, the medication shows an **amber** warning (for example
*"NSAIDs used 13 of 15 days in last 30"*). At or over the limit, the warning
turns **red**.

> **These warnings are informational only.** They do not block you from taking or
> logging anything, and they are not medical advice. They are there to help you
> notice a pattern and to give you something concrete to discuss with your
> doctor. Always follow your clinician's guidance over any in-app warning.

## Where to see it all together

Each medication has a detail screen showing its information, its schedule and
reminders (for preventatives), recent doses, and any active safety warnings. Your
medication use over time — including overuse-risk trends and how quickly each
rescue medication tends to work — appears in
[Trends and analytics](trends-and-analytics.md).
