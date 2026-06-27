# How tracking works in MigraLog

MigraLog is built around a simple idea: a migraine is not a single moment, it is
a **course of events over time**. Rather than asking you to summarise an attack
after it is over, MigraLog lets you record what is happening *as it happens* and
assembles those moments into a continuous timeline.

## Why a timeline

A migraine changes from hour to hour. The pain may begin in one place and move,
intensity rises and falls, symptoms come and go, and the medication you take has
an effect that unfolds over the following hours.

A single end-of-day note cannot capture any of that. A timeline can. By recording
each change with its own timestamp, MigraLog can reconstruct the **shape** of an
attack — when it started, how it built, what you did about it, and how it
responded. That shape is what reveals patterns, and it is what a clinician can
actually use.

## The three layers of tracking

MigraLog records your health at three levels of detail. They work together, and
each answers a different question.

### 1. Episodes — the detailed record of an attack

An **episode** is a single migraine, tracked from start to finish. It is the
heart of the app.

- **Start Episode** begins tracking. You can start an episode the moment one
  begins, or backdate the start time if you are catching up later.
- While an episode is ongoing it has no end time and is shown as **Ongoing**.
  The main action on the dashboard becomes **Log Update**, inviting you to keep
  adding to the record as things change.
- **End Episode** closes it and sets the final time. If you close one by
  mistake, you can reopen it and carry on.

An episode can span more than one day — for example beginning late one night and
ending the following afternoon. MigraLog handles this correctly across the whole
duration.

### 2. The episode timeline — moments within an attack

Inside an ongoing episode you can record events as they occur. Every event is
timestamped independently and merged into one chronological **Timeline**:

- **Intensity updates** — your pain level on a 0–10 scale, logged as often as it
  changes. These also drive a sparkline that shows the attack's intensity
  trajectory at a glance.
- **Symptoms** — recorded with an onset time, and marked as resolved when they
  pass (for example, "Nausea — onset" and later "Nausea — resolved").
- **Pain locations** — where the pain is, and how that changes during the
  attack.
- **Medications taken** — rescue and other doses logged against the episode, so
  you can see exactly when you treated and how the attack responded afterwards.
- **Notes** — free text for anything else worth remembering.

Because everything shares a single timeline, you can see medication timing,
symptom changes, and intensity peaks all in relation to one another.

To correct or update an entry, **press and hold** it on the timeline and choose
to edit it. Nothing is set in stone — if you logged the wrong time, intensity, or
detail, you can fix it after the fact.

### 3. Daily status — the day-by-day overview

Not every day contains a full migraine, and the days *between* attacks matter
too. **Daily status** captures each day at a glance:

- Days with an episode are recorded automatically as migraine days.
- Other days can be logged as **Clear** or **Not Clear** — the latter covering
  states such as prodrome (warning signs), postdrome (recovery), or anxiety
  about an attack.

This is the layer you see in the calendar, and it is what turns scattered
episodes into a long-term picture of how often you are well. See
[The calendar](calendar.md) for how day status is shown and logged.

## What you are encouraged to capture

You do not have to log everything, and partial records are still useful. But the
app is most valuable when you treat an episode as a living record:

- Log the **start** as early as you reasonably can.
- Add an **intensity update** whenever the pain meaningfully changes.
- Record **medications** at the time you take them.
- Note **symptoms** as they appear and resolve.
- **End** the episode when it is over.

Captured this way, your history becomes something you can genuinely learn from —
and something your clinician can read in minutes. The patterns that emerge are
covered in [Trends and analytics](trends-and-analytics.md).

## A note on your data

MigraLog treats your records as sensitive health information. Tracking is for
your own insight and for sharing with your care team on your terms; it is not a
diagnostic tool and does not replace medical advice.
