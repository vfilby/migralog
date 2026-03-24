#!/usr/bin/env python3
"""
MigraLog Neurologist Report Generator

Generates a PDF report from a MigraLog SQLite database or JSON export with:
- Monthly headache day counts and severity breakdowns
- Medication consumption per month
- 6-month trend analysis with statistical indicators
- Trigger and pain location analysis
- Daily status (green/yellow/red) patterns

Usage:
    python generate_report.py <input.db|input.json> [output.pdf]
"""

import json
import sqlite3
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import numpy as np
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.gridspec import GridSpec

# -- Style ------------------------------------------------------------------

COLORS = {
    'green': '#4CAF50',
    'yellow': '#FFC107',
    'red': '#F44336',
    'blue': '#2196F3',
    'purple': '#9C27B0',
    'orange': '#FF9800',
    'teal': '#009688',
    'grey': '#9E9E9E',
    'light_grey': '#F5F5F5',
    'dark': '#212121',
}

SEVERITY_BINS = [
    (0, 3, 'Mild (0-3)', '#81C784'),
    (3, 5, 'Moderate (3-5)', '#FFB74D'),
    (5, 7, 'Severe (5-7)', '#E57373'),
    (7, 10.01, 'Very Severe (7-10)', '#C62828'),
]

# Darker versions for text on light backgrounds (e.g. calendar heatmap cells)
SEVERITY_TEXT_COLORS = [
    (0, 3, '#2E7D32'),      # dark green
    (3, 5, '#E65100'),      # dark orange
    (5, 7, '#C62828'),      # dark red
    (7, 10.01, '#7B1A1A'),  # very dark red
]

plt.rcParams.update({
    'font.family': 'Helvetica Neue',
    'font.size': 9,
    'axes.titlesize': 11,
    'axes.titleweight': 'bold',
    'axes.spines.top': False,
    'axes.spines.right': False,
    'figure.facecolor': 'white',
    'axes.facecolor': 'white',
    'figure.dpi': 150,
})


# -- Data loading -----------------------------------------------------------

def safe_json_parse(val: str | None, default=None):
    """Parse a JSON string from a SQLite column, returning default on failure."""
    if val is None:
        return default if default is not None else []
    try:
        return json.loads(val)
    except (json.JSONDecodeError, TypeError):
        return default if default is not None else []


def load_from_sqlite(path: str) -> dict:
    """Load all data from a MigraLog SQLite database into the same structure as JSON export."""
    db = sqlite3.connect(path)
    db.row_factory = sqlite3.Row

    # Metadata
    schema_version = db.execute("PRAGMA user_version").fetchone()[0]
    episode_count = db.execute("SELECT COUNT(*) FROM episodes").fetchone()[0]
    med_count = db.execute("SELECT COUNT(*) FROM medications").fetchone()[0]
    metadata = {
        'id': f'db_report_{int(datetime.now().timestamp())}',
        'timestamp': int(datetime.now().timestamp() * 1000),
        'version': 'database',
        'schemaVersion': schema_version,
        'episodeCount': episode_count,
        'medicationCount': med_count,
    }

    # Episodes
    episodes = []
    for row in db.execute("SELECT * FROM episodes ORDER BY start_time"):
        ep = {
            'id': row['id'],
            'startTime': row['start_time'],
            'endTime': row['end_time'],
            'locations': safe_json_parse(row['locations']),
            'qualities': safe_json_parse(row['qualities']),
            'symptoms': safe_json_parse(row['symptoms']),
            'triggers': safe_json_parse(row['triggers']),
            'notes': row['notes'],
            'createdAt': row['created_at'],
            'updatedAt': row['updated_at'],
        }
        if row['latitude'] is not None and row['longitude'] is not None:
            ep['location'] = {
                'latitude': row['latitude'],
                'longitude': row['longitude'],
                'accuracy': row['location_accuracy'],
                'timestamp': row['location_timestamp'],
            }
        episodes.append(ep)

    # Intensity readings
    readings = []
    for row in db.execute("SELECT * FROM intensity_readings ORDER BY timestamp"):
        readings.append({
            'id': row['id'],
            'episodeId': row['episode_id'],
            'timestamp': row['timestamp'],
            'intensity': row['intensity'],
            'createdAt': row['created_at'],
            'updatedAt': row['updated_at'],
        })

    # Symptom logs (from dedicated table, not just episode arrays)
    symptom_logs = []
    for row in db.execute("SELECT * FROM symptom_logs ORDER BY onset_time"):
        symptom_logs.append({
            'id': row['id'],
            'episodeId': row['episode_id'],
            'symptom': row['symptom'],
            'onsetTime': row['onset_time'],
            'resolutionTime': row['resolution_time'],
            'severity': row['severity'],
            'createdAt': row['created_at'],
        })

    # Pain location logs (from dedicated table)
    location_logs = []
    for row in db.execute("SELECT * FROM pain_location_logs ORDER BY timestamp"):
        location_logs.append({
            'id': row['id'],
            'episodeId': row['episode_id'],
            'timestamp': row['timestamp'],
            'painLocations': safe_json_parse(row['pain_locations']),
            'createdAt': row['created_at'],
            'updatedAt': row['updated_at'],
        })

    # Episode notes
    episode_notes = []
    for row in db.execute("SELECT * FROM episode_notes ORDER BY timestamp"):
        episode_notes.append({
            'id': row['id'],
            'episodeId': row['episode_id'],
            'timestamp': row['timestamp'],
            'note': row['note'],
            'createdAt': row['created_at'],
        })

    # Medications
    medications = []
    for row in db.execute("SELECT * FROM medications"):
        medications.append({
            'id': row['id'],
            'name': row['name'],
            'type': row['type'],
            'dosageAmount': row['dosage_amount'],
            'dosageUnit': row['dosage_unit'],
            'defaultQuantity': row['default_quantity'],
            'scheduleFrequency': row['schedule_frequency'],
            'photoUri': row['photo_uri'],
            'active': bool(row['active']),
            'notes': row['notes'],
            'category': row['category'],
            'createdAt': row['created_at'],
            'updatedAt': row['updated_at'],
        })

    # Medication doses
    doses = []
    for row in db.execute("SELECT * FROM medication_doses ORDER BY timestamp"):
        doses.append({
            'id': row['id'],
            'medicationId': row['medication_id'],
            'timestamp': row['timestamp'],
            'quantity': row['quantity'],
            'dosageAmount': row['dosage_amount'],
            'dosageUnit': row['dosage_unit'],
            'status': row['status'],
            'episodeId': row['episode_id'],
            'effectivenessRating': row['effectiveness_rating'],
            'timeToRelief': row['time_to_relief'],
            'sideEffects': safe_json_parse(row['side_effects']),
            'notes': row['notes'],
            'createdAt': row['created_at'],
            'updatedAt': row['updated_at'],
        })

    # Medication schedules
    schedules = []
    for row in db.execute("SELECT * FROM medication_schedules"):
        schedules.append({
            'id': row['id'],
            'medicationId': row['medication_id'],
            'time': row['time'],
            'timezone': row['timezone'],
            'dosage': row['dosage'],
            'enabled': bool(row['enabled']),
            'notificationId': row['notification_id'],
            'reminderEnabled': bool(row['reminder_enabled']),
        })

    # Daily status logs
    daily = []
    for row in db.execute("SELECT * FROM daily_status_logs ORDER BY date"):
        daily.append({
            'id': row['id'],
            'date': row['date'],
            'status': row['status'],
            'statusType': row['status_type'],
            'notes': row['notes'],
            'prompted': bool(row['prompted']),
            'createdAt': row['created_at'],
            'updatedAt': row['updated_at'],
        })

    # Calendar overlays
    overlays = []
    for row in db.execute("SELECT * FROM calendar_overlays ORDER BY start_date"):
        overlays.append({
            'id': row['id'],
            'startDate': row['start_date'],
            'endDate': row['end_date'],
            'label': row['label'],
            'notes': row['notes'],
            'excludeFromStats': bool(row['exclude_from_stats']),
            'createdAt': row['created_at'],
            'updatedAt': row['updated_at'],
        })

    db.close()

    return {
        'metadata': metadata,
        'episodes': episodes,
        'intensityReadings': readings,
        'symptomLogs': symptom_logs,
        'painLocationLogs': location_logs,
        'episodeNotes': episode_notes,
        'medications': medications,
        'medicationDoses': doses,
        'medicationSchedules': schedules,
        'dailyStatusLogs': daily,
        'calendarOverlays': overlays,
    }


def load_data(path: str) -> dict:
    """Load data from either a .db (SQLite) or .json file."""
    if path.endswith('.db'):
        return load_from_sqlite(path)
    with open(path) as f:
        return json.load(f)


def ts_to_date(ts_ms: int) -> datetime:
    return datetime.fromtimestamp(ts_ms / 1000)


def month_key(dt: datetime) -> str:
    return dt.strftime('%Y-%m')


def month_label(key: str) -> str:
    return datetime.strptime(key, '%Y-%m').strftime('%b %Y')


def month_label_with_days(key: str, first_date: datetime, last_date: datetime) -> str:
    """Return 'Mon YYYY\\n(N days)' where N accounts for partial first/last months."""
    import calendar
    year, mon = int(key[:4]), int(key[5:7])
    total_days = calendar.monthrange(year, mon)[1]

    month_start = datetime(year, mon, 1)
    month_end = datetime(year, mon, total_days, 23, 59, 59)

    # Clip to data range
    effective_start = max(month_start, first_date)
    effective_end = min(month_end, last_date)
    included_days = (effective_end.date() - effective_start.date()).days + 1
    included_days = max(0, min(included_days, total_days))

    label = datetime.strptime(key, '%Y-%m').strftime('%b %Y')
    if included_days < total_days:
        return f"{label}\n({included_days}/{total_days} days)"
    else:
        return f"{label}\n({total_days} days)"


# -- Analysis ---------------------------------------------------------------

def analyze(data: dict) -> dict:
    episodes = data['episodes']
    doses = data.get('medicationDoses', [])
    readings = data.get('intensityReadings', [])
    daily = data.get('dailyStatusLogs', [])
    meds = {m['id']: m for m in data.get('medications', [])}
    overlays = data.get('calendarOverlays', [])

    # Determine the data date range (earliest and latest data point)
    all_timestamps = [ep['startTime'] for ep in episodes]
    all_timestamps += [ep['endTime'] for ep in episodes if ep.get('endTime')]
    all_timestamps += [d['timestamp'] for d in doses]
    if daily:
        # daily status dates are strings, convert to timestamps
        all_timestamps += [int(datetime.strptime(d['date'], '%Y-%m-%d').timestamp() * 1000) for d in daily]
    if all_timestamps:
        data_first_date = ts_to_date(min(all_timestamps))
        data_last_date = ts_to_date(max(all_timestamps))
    else:
        data_first_date = datetime.now()
        data_last_date = datetime.now()

    # Build per-episode intensity map
    ep_intensities = defaultdict(list)
    for r in readings:
        ep_intensities[r['episodeId']].append(r['intensity'])

    # Monthly episode analysis
    monthly = defaultdict(lambda: {
        'episodes': [],
        'headache_days': set(),
        'durations': [],
        'peak_intensities': [],
        'avg_intensities': [],
        'doses_by_med': Counter(),
        'dose_count': 0,
        'rescue_doses': 0,
        'locations': Counter(),
        'triggers': Counter(),
        'symptoms': Counter(),
    })

    for ep in episodes:
        start = ts_to_date(ep['startTime'])
        end = ts_to_date(ep['endTime']) if ep.get('endTime') else start
        mk = month_key(start)
        m = monthly[mk]
        m['episodes'].append(ep)

        # Count headache days (each calendar day touched)
        d = start.date()
        while d <= end.date():
            m['headache_days'].add(d)
            d += timedelta(days=1)

        dur_hours = (ep['endTime'] - ep['startTime']) / 3600000 if ep.get('endTime') else 0
        m['durations'].append(dur_hours)

        intensities = ep_intensities.get(ep['id'], [])
        if intensities:
            m['peak_intensities'].append(max(intensities))
            m['avg_intensities'].append(sum(intensities) / len(intensities))

        for loc in ep.get('locations', []):
            m['locations'][loc] += 1
        for t in ep.get('triggers', []):
            m['triggers'][t] += 1
        for s in ep.get('symptoms', []):
            m['symptoms'][s] += 1

    # Monthly medication doses
    for dose in doses:
        if dose.get('status') == 'skipped':
            continue
        dt = ts_to_date(dose['timestamp'])
        mk = month_key(dt)
        med = meds.get(dose['medicationId'], {})
        med_name = med.get('name', 'Unknown')
        monthly[mk]['doses_by_med'][med_name] += 1
        monthly[mk]['dose_count'] += 1
        if med.get('type') == 'rescue':
            monthly[mk]['rescue_doses'] += 1

    # Daily status by month — synthesize episode days as red
    # Start with explicit daily status logs
    daily_status_map = {}  # date_str -> status
    for d in daily:
        daily_status_map[d['date']] = d['status']

    # Override/fill in red days from episodes (episode day = red)
    all_episode_dates = set()
    for ep in episodes:
        start = ts_to_date(ep['startTime'])
        end = ts_to_date(ep['endTime']) if ep.get('endTime') else start
        d = start.date()
        while d <= end.date():
            all_episode_dates.add(d)
            d += timedelta(days=1)

    # Build peak intensity per day from intensity readings
    daily_peak_intensity = {}  # date_str -> peak intensity
    for ep in episodes:
        start = ts_to_date(ep['startTime'])
        end = ts_to_date(ep['endTime']) if ep.get('endTime') else start
        ep_ints = ep_intensities.get(ep['id'], [])
        peak = max(ep_ints) if ep_ints else None
        if peak is not None:
            d = start.date()
            while d <= end.date():
                ds = d.strftime('%Y-%m-%d')
                if ds not in daily_peak_intensity or peak > daily_peak_intensity[ds]:
                    daily_peak_intensity[ds] = peak
                d += timedelta(days=1)

    for d in all_episode_dates:
        date_str = d.strftime('%Y-%m-%d')
        # Episode days are red, overriding any logged status
        daily_status_map[date_str] = 'red'

    daily_by_month = defaultdict(lambda: Counter())
    for date_str, status in daily_status_map.items():
        mk = date_str[:7]
        daily_by_month[mk][status] += 1

    # Sort months
    sorted_months = sorted(monthly.keys())

    # Overall stats
    all_peaks = []
    for ep in episodes:
        intensities = ep_intensities.get(ep['id'], [])
        if intensities:
            all_peaks.append(max(intensities))

    # Rescue medication effectiveness analysis
    # Build episode end times lookup
    ep_end_times = {ep['id']: ep.get('endTime') for ep in episodes}

    # Build intensity readings timeline per episode
    ep_readings = defaultdict(list)
    for r in readings:
        ep_readings[r['episodeId']].append((r['timestamp'], r['intensity']))
    for ep_id in ep_readings:
        ep_readings[ep_id].sort()

    rescue_effectiveness = defaultdict(list)  # med_name -> list of dicts
    for dose in doses:
        if dose.get('status') == 'skipped':
            continue
        med = meds.get(dose.get('medicationId'), {})
        if med.get('type') != 'rescue':
            continue
        ep_id = dose.get('episodeId')
        if not ep_id:
            continue

        dose_ts = dose['timestamp']
        dose_dt = ts_to_date(dose_ts)

        # Time to episode end (cap at 72h to exclude multi-day outliers)
        end_ts = ep_end_times.get(ep_id)
        hours_to_end = None
        if end_ts and end_ts > dose_ts:
            h = (end_ts - dose_ts) / 3600000
            if h < 72:
                hours_to_end = h

        # Time to first intensity drop after dose
        hours_to_drop = None
        rdgs = ep_readings.get(ep_id, [])
        before = [(ts, v) for ts, v in rdgs if ts <= dose_ts]
        after = [(ts, v) for ts, v in rdgs if ts > dose_ts]
        if before and after:
            baseline = before[-1][1]
            for ts, v in after:
                if v < baseline:
                    hours_to_drop = (ts - dose_ts) / 3600000
                    break

        rescue_effectiveness[med.get('name', 'Unknown')].append({
            'date': dose_dt,
            'hours_to_end': hours_to_end,
            'hours_to_drop': hours_to_drop,
        })

    return {
        'monthly': monthly,
        'daily_by_month': daily_by_month,
        'sorted_months': sorted_months,
        'episodes': episodes,
        'meds': meds,
        'doses': doses,
        'readings': readings,
        'daily': daily,
        'overlays': overlays,
        'ep_intensities': ep_intensities,
        'all_peaks': all_peaks,
        'rescue_effectiveness': rescue_effectiveness,
        'data_first_date': data_first_date,
        'data_last_date': data_last_date,
        'daily_status_map': daily_status_map,
        'daily_peak_intensity': daily_peak_intensity,
        'all_episode_dates': all_episode_dates,
    }


# -- Chart helpers ----------------------------------------------------------

def severity_category(intensity: float) -> str:
    for lo, hi, label, _ in SEVERITY_BINS:
        if lo <= intensity < hi:
            return label
    return SEVERITY_BINS[-1][2]


def severity_color(intensity: float) -> str:
    for lo, hi, _, color in SEVERITY_BINS:
        if lo <= intensity < hi:
            return color
    return SEVERITY_BINS[-1][3]


def severity_text_color(intensity: float) -> str:
    """Darker severity color suitable for text on light backgrounds."""
    for lo, hi, color in SEVERITY_TEXT_COLORS:
        if lo <= intensity < hi:
            return color
    return SEVERITY_TEXT_COLORS[-1][2]


def add_table_to_axis(ax_table, row_labels: list[str], row_colors: list[str],
                      col_labels: list[str], cell_data: list[list[str]]):
    """Render a styled data table into a dedicated axis.

    Args:
        ax_table: A separate matplotlib axes reserved for the table.
        row_labels: Label for each row (category names).
        row_colors: Color for each row label cell.
        col_labels: Column headers (month labels).
        cell_data: 2D list [row][col] of string values.
    """
    ax_table.axis('off')

    table = ax_table.table(
        cellText=cell_data,
        rowLabels=row_labels,
        rowColours=[c + 'CC' for c in row_colors],
        colLabels=col_labels,
        loc='center',
        cellLoc='center',
    )
    table.auto_set_font_size(False)
    table.set_fontsize(9)
    table.auto_set_column_width(list(range(len(col_labels))))
    table.scale(1.0, 1.4)

    # Style header row — smaller font to fit month labels with day counts
    for j in range(len(col_labels)):
        cell = table[0, j]
        cell.set_text_props(fontweight='bold', fontsize=7)
        cell.set_facecolor(COLORS['light_grey'])

    # Style row label cells
    for i in range(len(row_labels)):
        cell = table[i + 1, -1]  # row label column is -1
        cell.set_text_props(color='white', fontweight='bold', fontsize=9)


# -- Pages ------------------------------------------------------------------

def page_title(pdf: PdfPages, data: dict, analysis: dict):
    fig = plt.figure(figsize=(8.5, 11))

    meta = data['metadata']
    months = analysis['sorted_months']
    date_range = f"{month_label(months[0])} – {month_label(months[-1])}"
    export_date = ts_to_date(meta['timestamp']).strftime('%B %d, %Y')

    fig.text(0.5, 0.65, 'MigraLog', fontsize=36, fontweight='bold',
             ha='center', color=COLORS['dark'])
    fig.text(0.5, 0.58, 'Neurologist Report', fontsize=20,
             ha='center', color=COLORS['blue'])
    fig.text(0.5, 0.50, date_range, fontsize=14, ha='center', color=COLORS['dark'])
    fig.text(0.5, 0.44, f'Generated {export_date}', fontsize=10,
             ha='center', color=COLORS['grey'])

    # Summary box
    total_eps = len(analysis['episodes'])
    total_days = sum(len(m['headache_days']) for m in analysis['monthly'].values())
    avg_intensity = np.mean(analysis['all_peaks']) if analysis['all_peaks'] else 0
    total_rescue = sum(m['rescue_doses'] for m in analysis['monthly'].values())

    summary_y = 0.32
    summaries = [
        (f"{total_eps}", "Episodes"),
        (f"{total_days}", "Headache Days"),
        (f"{avg_intensity:.1f}", "Avg Peak Intensity"),
        (f"{total_rescue}", "Rescue Doses"),
    ]
    x_positions = [0.15, 0.38, 0.62, 0.85]
    for x, (val, label) in zip(x_positions, summaries):
        fig.text(x, summary_y, val, fontsize=24, fontweight='bold',
                 ha='center', color=COLORS['blue'])
        fig.text(x, summary_y - 0.04, label, fontsize=9,
                 ha='center', color=COLORS['grey'])

    # Overlay info
    if analysis['overlays']:
        oy = 0.20
        fig.text(0.5, oy, 'Notable Periods', fontsize=11, fontweight='bold',
                 ha='center', color=COLORS['dark'])
        for i, o in enumerate(analysis['overlays']):
            end = o.get('endDate', 'ongoing')
            fig.text(0.5, oy - 0.03 * (i + 1),
                     f"{o['label']}: {o['startDate']} to {end}",
                     fontsize=9, ha='center', color=COLORS['grey'])

    pdf.savefig(fig)
    plt.close(fig)


def page_monthly_overview(pdf: PdfPages, analysis: dict):
    months = analysis['sorted_months']
    monthly = analysis['monthly']

    fig = plt.figure(figsize=(8.5, 11))
    fig.suptitle('Monthly Overview', fontsize=16, fontweight='bold', y=0.96)
    # Chart-table pairs get separate rows; ratios: chart, table, chart, table, chart
    gs = GridSpec(5, 1, figure=fig, hspace=0.15, top=0.92, bottom=0.04,
                  left=0.12, right=0.92, height_ratios=[3, 1, 3, 1.5, 2.5])

    first = analysis['data_first_date']
    last = analysis['data_last_date']
    labels = [month_label_with_days(m, first, last) for m in months]
    x = np.arange(len(months))

    # 1. Headache days per month
    ax1 = fig.add_subplot(gs[0])
    headache_days = [len(monthly[m]['headache_days']) for m in months]
    episode_counts = [len(monthly[m]['episodes']) for m in months]
    ax1.bar(x, headache_days, color=COLORS['red'], alpha=0.7, label='Headache Days')
    ax1.bar(x, episode_counts, color=COLORS['orange'], alpha=0.7, label='Episodes')
    ax1.set_xticks(x)
    ax1.set_xticklabels([])
    ax1.set_ylabel('Count')
    ax1.set_title('Headache Days & Episode Count by Month')
    ax1.legend(fontsize=8)

    ax1_table = fig.add_subplot(gs[1])
    add_table_to_axis(
        ax1_table,
        row_labels=['Days', 'Episodes'],
        row_colors=[COLORS['red'], COLORS['orange']],
        col_labels=labels,
        cell_data=[
            [str(v) for v in headache_days],
            [str(v) for v in episode_counts],
        ],
    )

    # 2. Severity distribution per month (stacked bar)
    ax2 = fig.add_subplot(gs[2])
    severity_data = {label: [] for _, _, label, _ in SEVERITY_BINS}
    for m in months:
        peaks = monthly[m]['peak_intensities']
        counts = Counter(severity_category(p) for p in peaks)
        for _, _, label, _ in SEVERITY_BINS:
            severity_data[label].append(counts.get(label, 0))

    bottom = np.zeros(len(months))
    active_bins = []
    for _, _, label, color in SEVERITY_BINS:
        vals = np.array(severity_data[label])
        if vals.sum() > 0:
            ax2.bar(x, vals, bottom=bottom, color=color, label=label, alpha=0.85)
            bottom += vals
            active_bins.append((label, color))

    ax2.set_xticks(x)
    ax2.set_xticklabels([])
    ax2.set_ylabel('Episode Count')
    ax2.set_title('Severity Distribution by Month (Peak Intensity)')
    ax2.legend(fontsize=7, loc='upper left')

    ax2_table = fig.add_subplot(gs[3])
    if active_bins:
        short_names = {
            'Mild (0-3)': 'Mild',
            'Moderate (3-5)': 'Moderate',
            'Severe (5-7)': 'Severe',
            'Very Severe (7-10)': 'V. Severe',
        }
        add_table_to_axis(
            ax2_table,
            row_labels=[short_names.get(label, label) for label, _ in active_bins],
            row_colors=[color for _, color in active_bins],
            col_labels=labels,
            cell_data=[
                [str(v) for v in severity_data[label]]
                for label, _ in active_bins
            ],
        )
    else:
        ax2_table.axis('off')

    # 3. Average duration per month
    ax3 = fig.add_subplot(gs[4])
    avg_durations = []
    for m in months:
        durs = monthly[m]['durations']
        avg_durations.append(np.mean(durs) if durs else 0)
    ax3.bar(x, avg_durations, color=COLORS['purple'], alpha=0.7)
    ax3.set_xticks(x)
    ax3.set_xticklabels(labels, fontsize=8)
    ax3.set_ylabel('Hours')
    ax3.set_title('Average Episode Duration by Month')
    for i, v in enumerate(avg_durations):
        ax3.text(i, v + 0.3, f'{v:.0f}h', ha='center', fontsize=8)

    pdf.savefig(fig)
    plt.close(fig)


def page_medication(pdf: PdfPages, data: dict, analysis: dict):
    months = analysis['sorted_months']
    monthly = analysis['monthly']
    meds = analysis['meds']

    fig = plt.figure(figsize=(8.5, 11))
    fig.suptitle('Medication Analysis', fontsize=16, fontweight='bold', y=0.96)
    # Rows: stacked chart, table, then two bottom charts side by side
    gs = GridSpec(3, 2, figure=fig, hspace=0.3, wspace=0.3, top=0.92, bottom=0.06,
                  left=0.10, right=0.95, height_ratios=[2.5, 1.5, 2.0])

    first = analysis['data_first_date']
    last = analysis['data_last_date']
    labels = [month_label_with_days(m, first, last) for m in months]
    x = np.arange(len(months))

    # Gather all med names used
    all_med_names = set()
    for m in months:
        all_med_names.update(monthly[m]['doses_by_med'].keys())

    # Separate rescue vs preventative
    rescue_names = [n for n in all_med_names
                    if any(m.get('type') == 'rescue' for m in meds.values() if m.get('name') == n)]
    prevent_names = [n for n in all_med_names if n not in rescue_names]

    med_colors = plt.cm.Set2(np.linspace(0, 1, max(len(all_med_names), 1)))

    # 1. Rescue medication doses per month (stacked)
    ax1 = fig.add_subplot(gs[0, :])
    sorted_rescue = sorted(rescue_names) if rescue_names else []
    bottom = np.zeros(len(months))
    active_rescue = []
    for i, name in enumerate(sorted_rescue):
        vals = np.array([monthly[m]['doses_by_med'].get(name, 0) for m in months])
        if vals.sum() > 0:
            color = med_colors[i % len(med_colors)]
            ax1.bar(x, vals, bottom=bottom, label=name, alpha=0.85, color=color)
            bottom += vals
            active_rescue.append((name, matplotlib.colors.to_hex(color)))
    ax1.set_xticks(x)
    ax1.set_xticklabels([])
    ax1.set_ylabel('Doses')
    ax1.set_title('Rescue Medication Usage by Month')
    if rescue_names:
        ax1.legend(fontsize=7, loc='upper left')

    # Table for rescue meds
    ax1_table = fig.add_subplot(gs[1, :])
    if active_rescue:
        # Identify NSAID medications (by category or known names)
        nsaid_names = set()
        for med in meds.values():
            if med.get('category') == 'nsaid' or med.get('name', '').lower() in ('indomethicin', 'indomethacin'):
                nsaid_names.add(med.get('name'))

        # Build table rows: individual meds + NSAID total
        table_row_labels = [name for name, _ in active_rescue]
        table_row_colors = [color for _, color in active_rescue]
        table_cell_data = [
            [str(monthly[m]['doses_by_med'].get(name, 0)) for m in months]
            for name, _ in active_rescue
        ]

        # Add NSAID total row if there are NSAIDs
        active_nsaid_names = [name for name, _ in active_rescue if name in nsaid_names]
        if active_nsaid_names:
            nsaid_totals = []
            for m in months:
                total = sum(monthly[m]['doses_by_med'].get(n, 0) for n in active_nsaid_names)
                nsaid_totals.append(str(total))
            table_row_labels.append('Total NSAIDs')
            table_row_colors.append(COLORS['dark'])
            table_cell_data.append(nsaid_totals)

        add_table_to_axis(
            ax1_table,
            row_labels=table_row_labels,
            row_colors=table_row_colors,
            col_labels=labels,
            cell_data=table_cell_data,
        )
    else:
        ax1_table.axis('off')

    # 2. Preventative adherence (% taken vs taken+skipped)
    ax2 = fig.add_subplot(gs[2, 0])
    adherence_by_month = []
    for m in months:
        taken = 0
        total = 0
        for dose in [d for d in data.get('medicationDoses', [])
                     if month_key(ts_to_date(d['timestamp'])) == m]:
            med = meds.get(dose.get('medicationId'), {})
            if med.get('type') == 'preventative':
                total += 1
                if dose.get('status', 'taken') == 'taken':
                    taken += 1
        adherence_by_month.append(100 * taken / total if total > 0 else 0)

    ax2.bar(x, adherence_by_month, color=COLORS['teal'], alpha=0.7)
    ax2.set_xticks(x)
    ax2.set_xticklabels(labels, fontsize=7, rotation=30, ha='right')
    ax2.set_ylabel('% Taken')
    ax2.set_ylim(0, 105)
    ax2.set_title('Preventative Adherence Rate')
    for i, v in enumerate(adherence_by_month):
        ax2.text(i, v + 1.5, f'{v:.0f}%', ha='center', fontsize=7)

    # 3. Total rescue doses trend
    ax3 = fig.add_subplot(gs[2, 1])
    rescue_totals = [monthly[m]['rescue_doses'] for m in months]
    ax3.plot(x, rescue_totals, 'o-', color=COLORS['red'], linewidth=2)
    ax3.fill_between(x, rescue_totals, alpha=0.15, color=COLORS['red'])
    ax3.set_xticks(x)
    ax3.set_xticklabels(labels, fontsize=7, rotation=30, ha='right')
    ax3.set_ylabel('Doses')
    ax3.set_title('Total Rescue Dose Trend')

    pdf.savefig(fig)
    plt.close(fig)


def page_daily_status(pdf: PdfPages, analysis: dict):
    months = analysis['sorted_months']
    daily_by_month = analysis['daily_by_month']

    # Include months that have daily status data even if no episodes
    all_months = sorted(set(months) | set(daily_by_month.keys()))

    fig = plt.figure(figsize=(8.5, 11))
    fig.suptitle('Daily Status Patterns', fontsize=16, fontweight='bold', y=0.96)
    gs = GridSpec(3, 1, figure=fig, hspace=0.2, top=0.92, bottom=0.06,
                  left=0.12, right=0.92, height_ratios=[2.5, 1.2, 2.0])

    first = analysis['data_first_date']
    last = analysis['data_last_date']
    labels = [month_label_with_days(m, first, last) for m in all_months]
    x = np.arange(len(all_months))

    # 1. Stacked bar: green/yellow/red per month
    ax1 = fig.add_subplot(gs[0])
    greens = [daily_by_month[m].get('green', 0) for m in all_months]
    yellows = [daily_by_month[m].get('yellow', 0) for m in all_months]
    reds = [daily_by_month[m].get('red', 0) for m in all_months]

    ax1.bar(x, greens, color=COLORS['green'], label='Green', alpha=0.8)
    ax1.bar(x, yellows, bottom=greens, color=COLORS['yellow'], label='Yellow', alpha=0.8)
    ax1.bar(x, reds, bottom=np.array(greens) + np.array(yellows),
            color=COLORS['red'], label='Red', alpha=0.8)
    ax1.set_xticks(x)
    ax1.set_xticklabels([])
    ax1.set_ylabel('Days')
    ax1.set_title('Daily Status Distribution by Month')
    ax1.legend(fontsize=8)

    # Table
    ax1_table = fig.add_subplot(gs[1])
    add_table_to_axis(
        ax1_table,
        row_labels=['Green', 'Yellow', 'Red'],
        row_colors=[COLORS['green'], COLORS['yellow'], COLORS['red']],
        col_labels=labels,
        cell_data=[
            [str(v) for v in greens],
            [str(v) for v in yellows],
            [str(v) for v in reds],
        ],
    )

    # 2. % of non-green days trend
    ax2 = fig.add_subplot(gs[2])
    pct_bad = []
    for m in all_months:
        total = sum(daily_by_month[m].values())
        if total > 0:
            non_green = daily_by_month[m].get('yellow', 0) + daily_by_month[m].get('red', 0)
            pct_bad.append(100 * non_green / total)
        else:
            pct_bad.append(0)

    ax2.plot(x, pct_bad, 'o-', color=COLORS['red'], linewidth=2)
    ax2.fill_between(x, pct_bad, alpha=0.15, color=COLORS['red'])
    ax2.set_xticks(x)
    ax2.set_xticklabels(labels, fontsize=8)
    ax2.set_ylabel('% of Logged Days')
    ax2.set_title('Percentage of Non-Green Days (Yellow + Red)')
    ax2.set_ylim(0, 100)
    ax2.axhline(y=50, color=COLORS['grey'], linestyle='--', linewidth=1, alpha=0.7, label='50%')

    pdf.savefig(fig)
    plt.close(fig)


def page_trends(pdf: PdfPages, analysis: dict):
    """Statistical trend analysis across the full date range."""
    episodes = analysis['episodes']
    ep_intensities = analysis['ep_intensities']

    fig = plt.figure(figsize=(8.5, 11))
    fig.suptitle('Trend Analysis', fontsize=16, fontweight='bold', y=0.96)
    gs = GridSpec(3, 1, figure=fig, hspace=0.4, top=0.92, bottom=0.06,
                  left=0.12, right=0.92)

    # Sort episodes by start time
    sorted_eps = sorted(episodes, key=lambda e: e['startTime'])

    # 1. Episode timeline with intensity
    ax1 = fig.add_subplot(gs[0])
    dates = [ts_to_date(e['startTime']) for e in sorted_eps]
    peaks = []
    for e in sorted_eps:
        ints = ep_intensities.get(e['id'], [])
        peaks.append(max(ints) if ints else None)

    # Plot episodes as dots, colored by severity
    for i, (d, p) in enumerate(zip(dates, peaks)):
        if p is not None:
            ax1.scatter(d, p, c=severity_color(p), s=50, zorder=3, edgecolors='white', linewidth=0.5)
        else:
            ax1.scatter(d, 0, c=COLORS['grey'], s=30, zorder=3, marker='x', alpha=0.5)

    ax1.xaxis.set_major_formatter(mdates.DateFormatter('%b %d'))
    ax1.xaxis.set_major_locator(mdates.WeekdayLocator(interval=2))
    ax1.tick_params(axis='x', rotation=30, labelsize=7)
    ax1.set_ylabel('Peak Intensity')
    ax1.set_title('Episode Timeline with Peak Intensity')
    ax1.set_ylim(-0.5, 10.5)

    # 2. Rolling episode frequency (14-day window)
    ax2 = fig.add_subplot(gs[1])
    if dates:
        min_date = min(dates).date()
        max_date = max(dates).date()
        all_dates = []
        rolling_freq = []
        d = min_date
        while d <= max_date:
            window_start = d - timedelta(days=14)
            count = sum(1 for dt in dates if window_start <= dt.date() <= d)
            all_dates.append(d)
            rolling_freq.append(count)
            d += timedelta(days=1)

        ax2.plot(all_dates, rolling_freq, color=COLORS['blue'], linewidth=1.5)
        ax2.fill_between(all_dates, rolling_freq, alpha=0.15, color=COLORS['blue'])
        ax2.xaxis.set_major_formatter(mdates.DateFormatter('%b %d'))
        ax2.xaxis.set_major_locator(mdates.WeekdayLocator(interval=2))
        ax2.tick_params(axis='x', rotation=30, labelsize=7)

    ax2.set_ylabel('Episodes')
    ax2.set_title('Rolling 14-Day Episode Frequency')

    # 3. Episode duration trend
    ax3 = fig.add_subplot(gs[2])
    durations = []
    dur_dates = []
    for e in sorted_eps:
        if e.get('endTime'):
            dur_hours = (e['endTime'] - e['startTime']) / 3600000
            durations.append(dur_hours)
            dur_dates.append(ts_to_date(e['startTime']))

    if dur_dates:
        ax3.bar(dur_dates, durations, width=1.5, color=COLORS['purple'], alpha=0.6)
        ax3.xaxis.set_major_formatter(mdates.DateFormatter('%b %d'))
        ax3.xaxis.set_major_locator(mdates.WeekdayLocator(interval=2))
        ax3.tick_params(axis='x', rotation=30, labelsize=7)

    ax3.set_ylabel('Hours')
    ax3.set_title('Episode Duration Over Time')

    pdf.savefig(fig)
    plt.close(fig)


def _plot_rolling_iqr(ax, dates: list, values: list, color: str, window: int = 7):
    """Plot a rolling median with IQR band (25th-75th percentile).

    Uses a centered window of `window` data points (not calendar days),
    so it adapts to data density. Wider window = smoother lines.
    """
    if len(dates) < 3:
        median_h = np.median(values)
        ax.axhline(y=median_h, color=COLORS['grey'], linestyle=':', alpha=0.5, linewidth=1)
        ax.text(0.98, median_h, f'median {median_h:.0f}h', transform=ax.get_yaxis_transform(),
                fontsize=7, va='bottom', ha='right', color=COLORS['grey'])
        return

    # Sort by date
    paired = sorted(zip(dates, values), key=lambda p: p[0])
    sorted_dates, sorted_vals = zip(*paired)

    # Use at least 5 points or half the data, whichever is smaller
    effective_window = min(window, max(3, len(sorted_vals) // 2))
    half = effective_window // 2

    roll_dates = []
    roll_medians = []
    roll_q25 = []
    roll_q75 = []

    for i in range(len(sorted_vals)):
        lo = max(0, i - half)
        hi = min(len(sorted_vals), i + half + 1)
        win = sorted_vals[lo:hi]
        roll_dates.append(sorted_dates[i])
        roll_medians.append(np.median(win))
        roll_q25.append(np.percentile(win, 25))
        roll_q75.append(np.percentile(win, 75))

    # Break lines at large gaps (>14 days between data points) so we don't
    # interpolate across no-data periods
    gap_threshold = timedelta(days=14)
    masked_medians = np.array(roll_medians, dtype=float)
    masked_q25 = np.array(roll_q25, dtype=float)
    masked_q75 = np.array(roll_q75, dtype=float)
    for i in range(1, len(roll_dates)):
        if roll_dates[i] - roll_dates[i - 1] > gap_threshold:
            masked_medians[i] = np.nan
            masked_q25[i] = np.nan
            masked_q75[i] = np.nan

    ax.plot(roll_dates, masked_medians, '-', color=color, linewidth=1.5, alpha=0.9, label='Median')
    ax.fill_between(roll_dates, masked_q25, masked_q75, alpha=0.15, color=color, label='IQR (25-75%)')
    ax.plot(roll_dates, masked_q25, '-', color=color, linewidth=0.7, alpha=0.4)
    ax.plot(roll_dates, masked_q75, '-', color=color, linewidth=0.7, alpha=0.4)


def page_rescue_effectiveness(pdf: PdfPages, analysis: dict):
    """Time-to-relief analysis for each rescue medication."""
    rescue_eff = analysis['rescue_effectiveness']

    # Only include meds with enough data points
    med_names = sorted(n for n, results in rescue_eff.items() if len(results) >= 3)
    if not med_names:
        return

    fig = plt.figure(figsize=(8.5, 11))
    fig.suptitle('Rescue Medication Effectiveness', fontsize=16, fontweight='bold', y=0.96)

    n_meds = len(med_names)
    gs = GridSpec(n_meds, 2, figure=fig, hspace=0.5, wspace=0.35, top=0.92,
                  bottom=0.06, left=0.12, right=0.92)

    med_color_map = dict(zip(med_names, plt.cm.Set2(np.linspace(0, 1, max(n_meds, 1)))))

    for i, name in enumerate(med_names):
        results = rescue_eff[name]
        color = med_color_map[name]

        # Left: time to episode end over time
        ax_end = fig.add_subplot(gs[i, 0])
        end_dates = [r['date'] for r in results if r['hours_to_end'] is not None]
        end_hours = [r['hours_to_end'] for r in results if r['hours_to_end'] is not None]

        if end_dates:
            ax_end.scatter(end_dates, end_hours, c=[color], s=25, alpha=0.5,
                           edgecolors='white', linewidth=0.5, zorder=3)
            _plot_rolling_iqr(ax_end, end_dates, end_hours, matplotlib.colors.to_hex(color))
            ax_end.legend(fontsize=6, loc='upper right')

        ax_end.xaxis.set_major_formatter(mdates.DateFormatter('%b'))
        ax_end.xaxis.set_major_locator(mdates.MonthLocator())
        ax_end.tick_params(axis='x', labelsize=7)
        ax_end.set_ylabel('Hours', fontsize=8)
        ax_end.set_title(f'{name} — Time to Episode End', fontsize=9)

        # Right: time to intensity drop over time
        ax_drop = fig.add_subplot(gs[i, 1])
        drop_dates = [r['date'] for r in results if r['hours_to_drop'] is not None]
        drop_hours = [r['hours_to_drop'] for r in results if r['hours_to_drop'] is not None]

        if drop_dates:
            ax_drop.scatter(drop_dates, drop_hours, c=[color], s=25, alpha=0.5,
                            edgecolors='white', linewidth=0.5, zorder=3)
            _plot_rolling_iqr(ax_drop, drop_dates, drop_hours, matplotlib.colors.to_hex(color))
            ax_drop.legend(fontsize=6, loc='upper right')
        else:
            ax_drop.text(0.5, 0.5, 'Insufficient\nintensity data', transform=ax_drop.transAxes,
                         ha='center', va='center', fontsize=8, color=COLORS['grey'])

        ax_drop.xaxis.set_major_formatter(mdates.DateFormatter('%b'))
        ax_drop.xaxis.set_major_locator(mdates.MonthLocator())
        ax_drop.tick_params(axis='x', labelsize=7)
        ax_drop.set_ylabel('Hours', fontsize=8)
        ax_drop.set_title(f'{name} — Time to Pain Drop', fontsize=9)

    pdf.savefig(fig)
    plt.close(fig)


def page_patterns(pdf: PdfPages, analysis: dict):
    """Pain locations, triggers, and symptoms analysis."""
    monthly = analysis['monthly']
    months = analysis['sorted_months']

    # Aggregate across all months
    all_locations = Counter()
    all_triggers = Counter()
    all_symptoms = Counter()
    for m in months:
        all_locations.update(monthly[m]['locations'])
        all_triggers.update(monthly[m]['triggers'])
        all_symptoms.update(monthly[m]['symptoms'])

    fig = plt.figure(figsize=(8.5, 11))
    fig.suptitle('Patterns & Characteristics', fontsize=16, fontweight='bold', y=0.96)

    has_locations = bool(all_locations)
    has_triggers = bool(all_triggers)
    has_symptoms = bool(all_symptoms)
    n_charts = sum([has_locations, has_triggers, has_symptoms])

    if n_charts == 0:
        fig.text(0.5, 0.5, 'No location, trigger, or symptom data recorded.',
                 fontsize=12, ha='center', color=COLORS['grey'])
        pdf.savefig(fig)
        plt.close(fig)
        return

    gs = GridSpec(max(n_charts, 1), 1, figure=fig, hspace=0.45, top=0.92,
                  bottom=0.06, left=0.25, right=0.92)
    chart_idx = 0

    if has_locations:
        ax = fig.add_subplot(gs[chart_idx])
        items = all_locations.most_common(10)
        names = [n.replace('_', ' ').title() for n, _ in items]
        vals = [v for _, v in items]
        y = np.arange(len(names))
        ax.barh(y, vals, color=COLORS['blue'], alpha=0.7)
        ax.set_yticks(y)
        ax.set_yticklabels(names, fontsize=8)
        ax.invert_yaxis()
        ax.set_xlabel('Occurrences')
        ax.set_title('Most Common Pain Locations')
        chart_idx += 1

    if has_triggers:
        ax = fig.add_subplot(gs[chart_idx])
        items = all_triggers.most_common(10)
        names = [n.replace('_', ' ').title() for n, _ in items]
        vals = [v for _, v in items]
        y = np.arange(len(names))
        ax.barh(y, vals, color=COLORS['orange'], alpha=0.7)
        ax.set_yticks(y)
        ax.set_yticklabels(names, fontsize=8)
        ax.invert_yaxis()
        ax.set_xlabel('Occurrences')
        ax.set_title('Most Common Triggers')
        chart_idx += 1

    if has_symptoms:
        ax = fig.add_subplot(gs[chart_idx])
        items = all_symptoms.most_common(10)
        names = [n.replace('_', ' ').title() for n, _ in items]
        vals = [v for _, v in items]
        y = np.arange(len(names))
        ax.barh(y, vals, color=COLORS['purple'], alpha=0.7)
        ax.set_yticks(y)
        ax.set_yticklabels(names, fontsize=8)
        ax.invert_yaxis()
        ax.set_xlabel('Occurrences')
        ax.set_title('Most Common Symptoms')

    pdf.savefig(fig)
    plt.close(fig)


def page_vyepti_response(pdf: PdfPages, analysis: dict, vyepti_dates: list[str]):
    """Headache activity around each Vyepti infusion: 14 days before, 90 days after."""
    if not vyepti_dates:
        return

    episodes = analysis['episodes']
    ep_intensities = analysis['ep_intensities']
    first = analysis['data_first_date'].date()
    last = analysis['data_last_date'].date()

    # Parse and sort dates
    v_dates = sorted(datetime.strptime(d, '%Y-%m-%d').date() for d in vyepti_dates)

    # For each vyepti dose, compute daily headache hours and peak intensity
    # in the -14 to +90 day window
    dose_data = []
    for vd in v_dates:
        window_start = vd - timedelta(days=14)
        window_end = vd + timedelta(days=90)

        # Clip to data range
        eff_start = max(window_start, first)
        eff_end = min(window_end, last)

        if eff_start > last or eff_end < first:
            continue  # no data overlap

        # For each day in window, compute headache hours and peak intensity
        daily_hours = {}
        daily_peak = {}

        for ep in episodes:
            ep_start = ts_to_date(ep['startTime'])
            ep_end = ts_to_date(ep['endTime']) if ep.get('endTime') else ep_start
            ints = ep_intensities.get(ep['id'], [])
            peak = max(ints) if ints else None

            d = max(ep_start.date(), eff_start)
            while d <= min(ep_end.date(), eff_end):
                # Hours of headache on this day
                day_start = datetime.combine(d, datetime.min.time())
                day_end = datetime.combine(d, datetime.max.time())
                overlap_start = max(ep_start, day_start)
                overlap_end = min(ep_end, day_end)
                hours = max(0, (overlap_end - overlap_start).total_seconds() / 3600)

                daily_hours[d] = daily_hours.get(d, 0) + hours
                if peak is not None:
                    if d not in daily_peak or peak > daily_peak[d]:
                        daily_peak[d] = peak
                d += timedelta(days=1)

        dose_data.append({
            'date': vd,
            'eff_start': eff_start,
            'eff_end': eff_end,
            'daily_hours': daily_hours,
            'daily_peak': daily_peak,
        })

    if not dose_data:
        return

    n_doses = len(dose_data)
    fig = plt.figure(figsize=(8.5, 11))
    fig.suptitle('Vyepti Infusion Response', fontsize=16, fontweight='bold', y=0.96)
    gs = GridSpec(n_doses, 1, figure=fig, hspace=0.45, top=0.92, bottom=0.06,
                  left=0.12, right=0.92)

    for idx, dd in enumerate(dose_data):
        ax = fig.add_subplot(gs[idx])
        vd = dd['date']

        # Build day-by-day series relative to infusion (day 0 = infusion)
        d = dd['eff_start']
        rel_days = []
        hours_vals = []
        peak_vals = []
        while d <= dd['eff_end']:
            rel = (d - vd).days
            rel_days.append(rel)
            hours_vals.append(dd['daily_hours'].get(d, 0))
            peak_vals.append(dd['daily_peak'].get(d, None))
            d += timedelta(days=1)

        # Bar chart of headache hours per day, colored by peak intensity
        bar_colors = []
        for p in peak_vals:
            if p is not None:
                bar_colors.append(severity_color(p))
            else:
                bar_colors.append(COLORS['light_grey'])

        ax.bar(rel_days, hours_vals, width=1.0, color=bar_colors, alpha=0.7, edgecolor='none')

        # Vertical line at infusion day
        ax.axvline(x=0, color=COLORS['blue'], linewidth=2, linestyle='-', alpha=0.8)
        ax.text(0.5, ax.get_ylim()[1] * 0.95, 'Vyepti', ha='left', va='top',
                fontsize=8, fontweight='bold', color=COLORS['blue'])

        # 7-day rolling average of headache hours
        if len(hours_vals) >= 7:
            rolling_avg = []
            for i in range(len(hours_vals)):
                lo = max(0, i - 3)
                hi = min(len(hours_vals), i + 4)
                rolling_avg.append(np.mean(hours_vals[lo:hi]))
            ax.plot(rel_days, rolling_avg, '-', color=COLORS['red'], linewidth=1.5,
                    alpha=0.7, label='7-day avg')
            ax.legend(fontsize=7, loc='upper right')

        # Shade the pre-infusion window
        ax.axvspan(min(rel_days), 0, alpha=0.05, color=COLORS['grey'])

        ax.set_xlabel('Days relative to infusion', fontsize=8)
        ax.set_ylabel('Headache hours', fontsize=8)
        ax.set_title(f'Vyepti — {vd.strftime("%b %d, %Y")}', fontsize=10, fontweight='bold')
        ax.tick_params(labelsize=7)

        # Add week markers
        for w in range(-2, 14):
            wd = w * 7
            if wd in rel_days or (min(rel_days) <= wd <= max(rel_days)):
                ax.axvline(x=wd, color=COLORS['grey'], linewidth=0.3, alpha=0.3)

    pdf.savefig(fig)
    plt.close(fig)


def pages_calendar_heatmap(pdf: PdfPages, analysis: dict):
    """Continuous weekly heatmap — rows are weeks, columns are Mon-Sun,
    with month boundary indicators and peak severity numbers."""

    status_map = analysis['daily_status_map']
    peak_map = analysis['daily_peak_intensity']
    first = analysis['data_first_date']
    last = analysis['data_last_date']

    STATUS_COLORS = {
        'green': '#C8E6C9',
        'yellow': '#FFF9C4',
        'red': '#FFCDD2',
    }
    NO_DATA_COLOR = '#F5F5F5'
    DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

    # Build continuous date range from first Monday on or before data start
    # to last Sunday on or after data end
    start_date = first.date()
    end_date = last.date()

    # Align to Monday
    start_monday = start_date - timedelta(days=start_date.weekday())
    # Align to Sunday
    end_sunday = end_date + timedelta(days=(6 - end_date.weekday()))

    # Build list of weeks (each week = list of 7 dates)
    weeks = []
    d = start_monday
    while d <= end_sunday:
        week = [d + timedelta(days=i) for i in range(7)]
        weeks.append(week)
        d += timedelta(days=7)

    # Layout: landscape-style on portrait page
    # Each cell needs to be large enough for day number + intensity
    # ~24 weeks in 6 months, aim for all on one page if possible
    max_weeks_per_page = 26
    cell_size = 0.85  # relative size

    for page_start in range(0, len(weeks), max_weeks_per_page):
        page_weeks = weeks[page_start:page_start + max_weeks_per_page]
        n_weeks = len(page_weeks)

        fig = plt.figure(figsize=(8.5, 11))
        fig.suptitle('Calendar Heatmap', fontsize=16, fontweight='bold', y=0.97)

        ax = fig.add_axes([0.12, 0.06, 0.83, 0.87])
        ax.set_xlim(-0.5, 7)
        ax.set_ylim(-0.5, n_weeks)
        ax.set_aspect('equal')
        ax.axis('off')

        # Day name headers at the top
        for col, name in enumerate(DAY_NAMES):
            ax.text(col + 0.5, n_weeks + 0.2, name, ha='center', va='bottom',
                    fontsize=8, fontweight='bold', color=COLORS['dark'])

        # Track which months we've labelled
        labelled_months = set()

        for week_idx, week_dates in enumerate(page_weeks):
            row = n_weeks - 1 - week_idx  # top to bottom

            for col, d in enumerate(week_dates):
                date_str = d.strftime('%Y-%m-%d')

                # Color by status
                status = status_map.get(date_str)
                if d < start_date or d > end_date:
                    bg = 'white'  # outside data range
                elif status:
                    bg = STATUS_COLORS.get(status, NO_DATA_COLOR)
                else:
                    bg = NO_DATA_COLOR

                ax.add_patch(plt.Rectangle((col, row), 1, 1, facecolor=bg,
                                           edgecolor='white', linewidth=1.0))

                # Skip cells outside data range
                if d < start_date or d > end_date:
                    continue

                # Day number (small, top-left)
                ax.text(col + 0.12, row + 0.88, str(d.day), ha='left', va='top',
                        fontsize=5.5, color='#999999')

                # Peak intensity
                peak = peak_map.get(date_str)
                if peak is not None:
                    ax.text(col + 0.5, row + 0.4, f'{peak:.0f}', ha='center', va='center',
                            fontsize=9, fontweight='bold', color=severity_text_color(peak))

                # Month boundary indicator — label on the 1st of each month
                if d.day == 1:
                    month_label_str = d.strftime('%b')
                    # Draw month label to the left of the row
                    ax.text(-0.4, row + 0.5, month_label_str, ha='right', va='center',
                            fontsize=9, fontweight='bold', color=COLORS['dark'])
                    # Draw a line across the top of this week to mark the boundary
                    # Find which column the 1st falls in, draw line from there
                    ax.plot([col, 7], [row + 1, row + 1],
                            color=COLORS['dark'], linewidth=1.0, alpha=0.4)
                    if col > 0:
                        ax.plot([0, col], [row, row],
                                color=COLORS['dark'], linewidth=1.0, alpha=0.4)

        # Draw overlay (notable period) markers
        overlays = analysis.get('overlays', [])
        OVERLAY_COLORS = ['#7B1FA2', '#0277BD', '#E65100', '#2E7D32', '#C62828']
        for ov_idx, ov in enumerate(overlays):
            ov_start = datetime.strptime(ov['startDate'], '%Y-%m-%d').date()
            ov_end_str = ov.get('endDate') or ov['startDate']
            ov_end = datetime.strptime(ov_end_str, '%Y-%m-%d').date()
            ov_color = OVERLAY_COLORS[ov_idx % len(OVERLAY_COLORS)]

            # Find which cells this overlay covers on this page
            overlay_cells = []
            for week_idx, week_dates in enumerate(page_weeks):
                row = n_weeks - 1 - week_idx
                for col, d in enumerate(week_dates):
                    if ov_start <= d <= ov_end:
                        overlay_cells.append((row, col))

            if not overlay_cells:
                continue

            # Draw a border around each overlay cell
            for (row, col) in overlay_cells:
                ax.add_patch(plt.Rectangle((col, row), 1, 1, facecolor='none',
                                           edgecolor=ov_color, linewidth=1.8, zorder=5))

            # Place label at the top-right of the first cell
            first_row, first_col = overlay_cells[0]
            ax.annotate(ov['label'], xy=(first_col, first_row + 1),
                        xytext=(first_col + 0.1, first_row + 1.25),
                        fontsize=6, fontweight='bold', color=ov_color,
                        ha='left', va='bottom', zorder=6)

        # Legend at the bottom
        legend_y = 0.02
        legend_items = [
            (STATUS_COLORS['green'], 'Green Day'),
            (STATUS_COLORS['yellow'], 'Yellow Day'),
            (STATUS_COLORS['red'], 'Headache Day'),
            (NO_DATA_COLOR, 'No Data'),
        ]
        x_start = 0.12
        for i, (color, label) in enumerate(legend_items):
            lx = x_start + i * 0.17
            fig.patches.append(plt.Rectangle((lx, legend_y), 0.018, 0.012,
                                              facecolor=color, edgecolor='#CCCCCC',
                                              linewidth=0.5, transform=fig.transFigure))
            fig.text(lx + 0.023, legend_y + 0.006, label, fontsize=7, va='center',
                     color=COLORS['dark'])

        fig.text(0.85, legend_y + 0.006, 'Numbers = peak intensity', fontsize=6,
                 va='center', color=COLORS['grey'], style='italic')

        pdf.savefig(fig)
        plt.close(fig)


def page_summary_table(pdf: PdfPages, analysis: dict):
    """Per-month summary table."""
    months = analysis['sorted_months']
    monthly = analysis['monthly']

    fig = plt.figure(figsize=(8.5, 11))
    fig.suptitle('Monthly Summary Table', fontsize=16, fontweight='bold', y=0.96)

    columns = ['Month', 'Episodes', 'Headache\nDays', 'Avg Peak\nIntensity',
               'Avg Duration\n(hours)', 'Rescue\nDoses', 'Total\nDoses']

    table_data = []
    for m in months:
        d = monthly[m]
        avg_peak = f"{np.mean(d['peak_intensities']):.1f}" if d['peak_intensities'] else '—'
        avg_dur = f"{np.mean(d['durations']):.0f}" if d['durations'] else '—'
        table_data.append([
            month_label_with_days(m, analysis['data_first_date'], analysis['data_last_date']),
            str(len(d['episodes'])),
            str(len(d['headache_days'])),
            avg_peak,
            avg_dur,
            str(d['rescue_doses']),
            str(d['dose_count']),
        ])

    ax = fig.add_subplot(111)
    ax.axis('off')

    table = ax.table(
        cellText=table_data,
        colLabels=columns,
        loc='center',
        cellLoc='center',
    )
    table.auto_set_font_size(False)
    table.set_fontsize(9)
    table.scale(1.0, 1.8)

    # Style header
    for j in range(len(columns)):
        cell = table[0, j]
        cell.set_facecolor(COLORS['blue'])
        cell.set_text_props(color='white', fontweight='bold')

    # Alternating row colors
    for i in range(len(table_data)):
        for j in range(len(columns)):
            cell = table[i + 1, j]
            if i % 2 == 0:
                cell.set_facecolor(COLORS['light_grey'])

    pdf.savefig(fig)
    plt.close(fig)


# -- Main -------------------------------------------------------------------

VYEPTI_DATES = ['2025-06-16', '2025-09-08', '2025-12-05', '2026-02-28']


def generate_report(input_path: str, output_path: str | None = None):
    data = load_data(input_path)
    analysis = analyze(data)

    if output_path is None:
        output_path = str(Path(input_path).parent / f"migralog_report_{datetime.now().strftime('%Y-%m-%d')}.pdf")

    with PdfPages(output_path) as pdf:
        page_title(pdf, data, analysis)
        page_monthly_overview(pdf, analysis)
        page_medication(pdf, data, analysis)
        page_rescue_effectiveness(pdf, analysis)
        page_vyepti_response(pdf, analysis, VYEPTI_DATES)
        page_daily_status(pdf, analysis)
        page_trends(pdf, analysis)
        page_patterns(pdf, analysis)
        page_summary_table(pdf, analysis)
        pages_calendar_heatmap(pdf, analysis)

    print(f"Report generated: {output_path}")
    return output_path


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <migralog.db|export.json> [output.pdf]")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None
    generate_report(input_file, output_file)
