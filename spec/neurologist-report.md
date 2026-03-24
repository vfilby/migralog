# Neurologist Report Specification

PDF report generated from MigraLog data, designed for sharing with healthcare providers at in-person appointments. Provides a comprehensive view of migraine patterns, medication usage, and treatment response over a configurable date range.

## Data Sources

- **Primary**: SQLite database (`.db` file) — reads all tables directly
- **Fallback**: JSON export (`.json`) — limited by export truncation (see [issue #357](https://github.com/vfilby/migralog/issues/357))

SQLite is strongly preferred as the JSON export currently truncates episodes and doses.

## Report Pages

### 1. Title Page

Summary dashboard with headline stats for the full date range:
- Total episodes
- Total headache days
- Average peak intensity
- Total rescue doses
- Notable periods (calendar overlays) listed with date ranges

### 2. Monthly Overview

Three charts with companion data tables:

- **Headache Days per Month** — bar chart with count per month. Partial months show included/total days (e.g., "Oct 2025 (27/31 days)").
- **Severity Breakdown** — stacked bar chart. Episodes binned into Mild (0–3), Moderate (3–5), Severe (5–7), Very Severe (7–10) by peak intensity.
- **Average Episode Duration** — bar chart showing mean hours per month.

Each chart has a matching numerical table underneath with the same categories.

### 3. Medication

Three sections:

- **Rescue Medication Doses** — grouped bar chart per rescue medication per month, with per-medication totals. NSAID subtotals shown as a separate row (identified by category or known drug names).
- **Preventative Adherence** — percentage of scheduled doses taken per month per preventative medication.
- **Rescue Dose Trend** — rolling median with IQR (25th–75th percentile) band, using a data-point window (not calendar). Lines break when data gaps exceed 14 days to avoid interpolation across empty periods.

### 4. Rescue Medication Effectiveness

Per rescue medication, two scatter plots with rolling median + IQR:

- **Time to Episode End** — hours from dose to episode `endTime`
- **Time to Pain Drop** — hours from dose to first intensity reading below the dose-time intensity

Only includes doses with the relevant outcome data. Rolling statistics use a window of 7 data points.

### 5. CGRP Response (Vyepti)

Headache hours per day in a window around each Vyepti (fremanezumab) infusion:
- **Pre-window**: 14 days before infusion
- **Post-window**: 90 days after infusion
- Bars colored by peak severity that day
- 7-day rolling average overlay line

Infusion dates are currently hardcoded. Future: read from medication dose log.

### 6. Daily Status

Synthesized daily red/yellow/green status:

- **Stacked bar chart** — green, yellow, red day counts per month with data table
- **% Non-Green trend** — line chart showing percentage of yellow + red days over time, with a 50% reference guide line

**Status synthesis logic**: The `daily_status_logs` table only contains days the user explicitly logged. Days with active episodes are treated as red regardless of logged status. This prevents months with many headache days from showing as "all green" due to missing logs.

### 7. Trend Analysis

Three time-series charts across the full date range:

- **Episode Timeline** — stem plot of each episode at its start date, height = peak intensity
- **Rolling 14-Day Frequency** — count of episodes starting in a trailing 14-day window
- **Duration Over Time** — scatter of episode durations in hours

### 8. Pattern Analysis

Horizontal bar charts showing frequency of:

- **Pain Locations** — e.g., left temple, right eye
- **Triggers** — e.g., stress, weather change, lack of sleep
- **Symptoms** — e.g., nausea, light sensitivity, aura

### 9. Calendar Heatmap

Continuous weekly heatmap (GitHub contribution graph style):
- Rows = weeks (top to bottom, chronological)
- Columns = Monday through Sunday
- Cell color = daily status (green/yellow/red/no-data)
- Cell text = peak intensity for that day (if headache)
- Month boundaries marked with lines and labels on the left
- Notable periods (calendar overlays) highlighted with colored borders and labels

### 10. Monthly Summary Table

Tabular reference with one row per month:
- Episode count, headache days, average peak intensity, average duration, rescue doses, total doses

## Analysis Details

### Severity Binning

Episodes are classified by their **peak intensity reading** (highest value across all `intensity_readings` for that episode):

| Bin | Range | Color |
|-----|-------|-------|
| Mild | 0–3 | Green (#81C784) |
| Moderate | 3–5 | Orange (#FFB74D) |
| Severe | 5–7 | Red (#E57373) |
| Very Severe | 7–10 | Dark Red (#C62828) |

Boundary is exclusive on the low end (a reading of exactly 3.0 falls in Moderate).

### Rolling Median with IQR

Used for trend lines on medication effectiveness and rescue dose charts:
- Window size: 7 data points (not calendar days), adapts to data density
- Effective window clamped to `min(7, max(3, N/2))`
- Shows median line, 25th–75th percentile shaded band, and faint Q25/Q75 lines
- **Gap handling**: Lines break (NaN) when consecutive data points are >14 days apart, preventing misleading interpolation across no-data periods

### Partial Month Handling

The first and last months in the date range may be partial. All month labels include the count of included days vs total days in that month (e.g., "14/31 days" for a mid-month cutoff). Statistics are computed only over included days.

### NSAID Identification

Medications are identified as NSAIDs by:
1. `category = 'nsaid'` in the medications table, OR
2. Known NSAID drug names (e.g., Indomethacin) that may be categorized differently in the database

## Implementation

The report is generated by `spec/generate_report.py`, a standalone Python script using matplotlib's `PdfPages` backend. It requires a virtual environment at `spec/.venv/` with: matplotlib, numpy, pandas, scipy.

```
cd spec
source .venv/bin/activate
python generate_report.py <input.db> [output.pdf]
```

## Future Enhancements

- Read Vyepti infusion dates from medication dose log instead of hardcoding
- Offer as an in-app feature (website/app export)
- Weather correlation analysis
- Time-of-day pattern analysis
- Configurable date range selection
