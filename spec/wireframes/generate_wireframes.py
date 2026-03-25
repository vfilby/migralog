#!/usr/bin/env python3
"""Generate Excalidraw wireframe files for all MigraineTracker screens.

Uses the actual app's design system:
- Colors from app/src/theme/colors.ts
- Typography, spacing, border radius matching the real UI
- Icons from Ionicons library
- Pain scale gradient colors from utils/painScale.ts
"""

import json
import uuid
import os

# iPhone dimensions
PHONE_W = 375
PHONE_H = 812
STATUS_BAR_H = 44
HEADER_H = 100  # includes safe area (60pt top padding + title + bottom padding)
TAB_BAR_H = 84
PADDING = 16
CONTENT_W = PHONE_W - 2 * PADDING

# ============================================================
# ACTUAL APP COLORS (from theme/colors.ts - Light Mode)
# ============================================================
C = {
    # Backgrounds
    "bg": "#F2F2F7",
    "bgSecondary": "#FFFFFF",
    "card": "#FFFFFF",
    # Text
    "text": "#000000",
    "textSecondary": "#6C6C70",
    "textTertiary": "#909090",
    # Interactive
    "primary": "#0062CC",
    "primaryText": "#FFFFFF",
    # Status
    "danger": "#D30F00",
    "dangerText": "#FFFFFF",
    "success": "#248A3D",
    "successText": "#FFFFFF",
    "warning": "#C77700",
    "warningText": "#FFFFFF",
    # Borders
    "border": "#E5E5EA",
    "borderLight": "#F2F2F7",
    # Ongoing badge
    "ongoing": "#D30F00",
    "ongoingText": "#FFFFFF",
    # Shadow
    "shadow": "#000000",
    # Tab bar
    "tabBg": "#FFFFFF",
    "tabBorder": "#E5E5EA",
    "tabInactive": "#6C6C70",
    "tabActive": "#0062CC",
    # Calendar status dots
    "calClear": "#4CAF50",
    "calNotClear": "#FFC107",
    "calEpisode": "#F44336",
    # Pain scale gradient
    "pain0": "#2E7D32",
    "pain3": "#F9A825",
    "pain5": "#EF6C00",
    "pain8": "#C62828",
    "pain10": "#AB47BC",
    # Symptom diff
    "addedBg": "#E8F5E9",
    "addedText": "#2E7D32",
    "removedBg": "#FFEBEE",
    "removedText": "#C62828",
    # Frame
    "frame": "#1C1C1E",
}


def uid():
    return str(uuid.uuid4())[:8]


def make_element(etype, x, y, w, h, **kwargs):
    eid = uid()
    el = {
        "id": eid,
        "type": etype,
        "x": x,
        "y": y,
        "width": w,
        "height": h,
        "angle": 0,
        "strokeColor": kwargs.get("strokeColor", C["frame"]),
        "backgroundColor": kwargs.get("backgroundColor", "transparent"),
        "fillStyle": kwargs.get("fillStyle", "solid"),
        "strokeWidth": kwargs.get("strokeWidth", 1),
        "strokeStyle": kwargs.get("strokeStyle", "solid"),
        "roughness": 0,
        "opacity": kwargs.get("opacity", 100),
        "groupIds": kwargs.get("groupIds", []),
        "frameId": None,
        "roundness": {"type": 3} if etype == "rectangle" else None,
        "seed": abs(hash(eid)) % 2000000000,
        "version": 1,
        "versionNonce": abs(hash(eid + "v")) % 2000000000,
        "isDeleted": False,
        "boundElements": None,
        "updated": 1,
        "link": None,
        "locked": False,
    }
    if etype == "text":
        el["text"] = kwargs.get("text", "")
        el["fontSize"] = kwargs.get("fontSize", 16)
        el["fontFamily"] = kwargs.get("fontFamily", 1)
        el["textAlign"] = kwargs.get("textAlign", "left")
        el["verticalAlign"] = kwargs.get("verticalAlign", "top")
        el["containerId"] = None
        el["originalText"] = el["text"]
        el["lineHeight"] = 1.25
        el["autoResize"] = True
        del el["roundness"]
    if etype == "line" or etype == "arrow":
        el["points"] = kwargs.get("points", [[0, 0], [w, 0]])
        el["lastCommittedPoint"] = None
        el["startBinding"] = None
        el["endBinding"] = None
        el["startArrowhead"] = None
        el["endArrowhead"] = "arrow" if etype == "arrow" else None
    if etype == "ellipse":
        el["roundness"] = {"type": 2}
    return el


# ============================================================
# PRIMITIVE COMPONENTS
# ============================================================

def phone_frame(x_off=0, y_off=0):
    """Phone outline with status bar."""
    els = []
    # Phone body
    els.append(make_element("rectangle", x_off, y_off, PHONE_W, PHONE_H,
                            strokeWidth=2, strokeColor=C["frame"],
                            backgroundColor=C["bg"]))
    # Status bar area
    els.append(make_element("rectangle", x_off, y_off, PHONE_W, STATUS_BAR_H,
                            strokeColor="transparent",
                            backgroundColor=C["bgSecondary"]))
    # Status bar indicators
    els.append(make_element("text", x_off + 16, y_off + 14, 40, 16,
                            text="9:41", fontSize=14, fontFamily=1,
                            strokeColor=C["text"]))
    els.append(make_element("text", x_off + PHONE_W - 70, y_off + 14, 54, 16,
                            text="●●● ▶", fontSize=12,
                            strokeColor=C["text"], textAlign="right"))
    return els


def header_bar(title, x_off=0, y_off=0, left_text=None, right_icon=None,
               large_title=True):
    """App header bar matching real app style."""
    els = []
    hy = y_off + STATUS_BAR_H
    header_h = HEADER_H - STATUS_BAR_H

    # Header background
    els.append(make_element("rectangle", x_off, y_off, PHONE_W, HEADER_H,
                            backgroundColor=C["bgSecondary"],
                            strokeColor="transparent"))
    # Bottom border
    els.append(make_element("line", x_off, y_off + HEADER_H, PHONE_W, 0,
                            strokeColor=C["border"]))

    if left_text:
        els.append(make_element("text", x_off + 16, hy + 12, 80, 20,
                                text=left_text, fontSize=17,
                                strokeColor=C["primary"]))

    if large_title:
        # Large title style (34px bold)
        els.append(make_element("text", x_off + 20, hy + 8, PHONE_W - 80, 40,
                                text=title, fontSize=34,
                                strokeColor=C["text"]))
    else:
        # Compact centered title (17px semibold)
        tw = len(title) * 9
        els.append(make_element("text", x_off + (PHONE_W - tw) // 2, hy + 14,
                                tw, 22, text=title, fontSize=17,
                                strokeColor=C["text"], textAlign="center"))

    if right_icon:
        els.append(make_element("text", x_off + PHONE_W - 48, hy + 14, 32, 22,
                                text=right_icon, fontSize=17,
                                strokeColor=C["primary"], textAlign="right"))
    return els


def tab_bar(active_index=0, x_off=0, y_off=0):
    """Bottom tab bar with Ionicons-style icons."""
    tabs = [
        ("⌂", "Dashboard"),
        ("☰", "Episodes"),
        ("💊", "Medications"),
        ("📊", "Analytics"),
    ]
    els = []
    tab_y = y_off + PHONE_H - TAB_BAR_H

    # Tab bar background
    els.append(make_element("rectangle", x_off, tab_y, PHONE_W, TAB_BAR_H,
                            backgroundColor=C["tabBg"],
                            strokeColor="transparent"))
    # Top border
    els.append(make_element("line", x_off, tab_y, PHONE_W, 0,
                            strokeColor=C["tabBorder"]))

    tab_w = PHONE_W // len(tabs)
    for i, (icon, label) in enumerate(tabs):
        color = C["tabActive"] if i == active_index else C["tabInactive"]
        cx = x_off + tab_w * i + tab_w // 2

        # Icon
        els.append(make_element("text", cx - 12, tab_y + 8, 24, 24,
                                text=icon, fontSize=22, textAlign="center",
                                strokeColor=color))
        # Label
        els.append(make_element("text", x_off + tab_w * i, tab_y + 36, tab_w, 14,
                                text=label, fontSize=11, textAlign="center",
                                strokeColor=color))
        # Active dot
        if i == active_index:
            els.append(make_element("ellipse", cx - 2, tab_y + 54, 4, 4,
                                    backgroundColor=color, strokeColor=color))
    return els


def app_card(x, y, w, h, **kwargs):
    """Card matching app style: white bg, 12px radius, subtle shadow."""
    els = []
    # Shadow (offset rectangle)
    els.append(make_element("rectangle", x + 1, y + 2, w, h,
                            backgroundColor="#E5E5EA", strokeColor="transparent",
                            opacity=30))
    # Card
    els.append(make_element("rectangle", x, y, w, h,
                            backgroundColor=C["card"],
                            strokeColor=C["border"],
                            strokeWidth=1))
    return els


def section_label(x, y, text_str, font_size=20):
    """Section title text matching app style."""
    return [make_element("text", x, y, CONTENT_W, font_size + 4,
                         text=text_str, fontSize=font_size,
                         strokeColor=C["text"])]


def body_text(x, y, text_str, color=None, font_size=15, w=None):
    """Body text."""
    return [make_element("text", x, y, w or CONTENT_W, font_size + 4,
                         text=text_str, fontSize=font_size,
                         strokeColor=color or C["text"])]


def secondary_text(x, y, text_str, font_size=14, w=None):
    """Secondary/muted text."""
    return [make_element("text", x, y, w or CONTENT_W, font_size + 4,
                         text=text_str, fontSize=font_size,
                         strokeColor=C["textSecondary"])]


def tertiary_text(x, y, text_str, font_size=12, w=None):
    """Tertiary/very muted text."""
    return [make_element("text", x, y, w or CONTENT_W, font_size + 4,
                         text=text_str, fontSize=font_size,
                         strokeColor=C["textTertiary"])]


def primary_button(x, y, w, h, label):
    """Primary action button: blue bg, white text."""
    els = []
    els.append(make_element("rectangle", x, y, w, h,
                            backgroundColor=C["primary"],
                            strokeColor=C["primary"]))
    els.append(make_element("text", x + 8, y + (h - 17) // 2, w - 16, 17,
                            text=label, fontSize=17, textAlign="center",
                            strokeColor=C["primaryText"]))
    return els


def secondary_button(x, y, w, h, label):
    """Secondary button: white bg, blue border & text."""
    els = []
    els.append(make_element("rectangle", x, y, w, h,
                            backgroundColor=C["card"],
                            strokeColor=C["primary"]))
    els.append(make_element("text", x + 8, y + (h - 17) // 2, w - 16, 17,
                            text=label, fontSize=17, textAlign="center",
                            strokeColor=C["primary"]))
    return els


def danger_button(x, y, w, h, label):
    """Danger button: red bg, white text."""
    els = []
    els.append(make_element("rectangle", x, y, w, h,
                            backgroundColor=C["danger"],
                            strokeColor=C["danger"]))
    els.append(make_element("text", x + 8, y + (h - 16) // 2, w - 16, 16,
                            text=label, fontSize=16, textAlign="center",
                            strokeColor=C["dangerText"]))
    return els


def small_button(x, y, w, h, label, bg=None, text_color=None, border_color=None):
    """Small action button."""
    els = []
    els.append(make_element("rectangle", x, y, w, h,
                            backgroundColor=bg or C["primary"],
                            strokeColor=border_color or bg or C["primary"]))
    els.append(make_element("text", x + 4, y + (h - 12) // 2, w - 8, 12,
                            text=label, fontSize=12, textAlign="center",
                            strokeColor=text_color or C["primaryText"]))
    return els


def text_input(x, y, w, h=44, placeholder=""):
    """Text input field."""
    els = []
    els.append(make_element("rectangle", x, y, w, h,
                            strokeColor=C["border"],
                            backgroundColor=C["bgSecondary"]))
    if placeholder:
        els.append(make_element("text", x + 12, y + (h - 15) // 2, w - 24, 15,
                                text=placeholder, fontSize=15,
                                strokeColor=C["textTertiary"]))
    return els


def toggle_switch(x, y, on=True):
    """iOS-style toggle switch."""
    els = []
    bg = C["success"] if on else C["border"]
    els.append(make_element("rectangle", x, y, 51, 31,
                            backgroundColor=bg, strokeColor=bg))
    circle_x = x + 22 if on else x + 2
    els.append(make_element("ellipse", circle_x, y + 2, 27, 27,
                            backgroundColor="#FFFFFF", strokeColor="#FFFFFF"))
    return els


def divider_line(x, y, w):
    """Thin divider line."""
    return [make_element("line", x, y, w, 0, strokeColor=C["border"])]


def chip(x, y, label, selected=False, color=None):
    """Selectable chip/tag with 16px border radius."""
    w = len(label) * 8 + 24
    if selected:
        bg = color or C["primary"]
        border = bg
        text_color = C["primaryText"]
    else:
        bg = "transparent"
        border = C["border"]
        text_color = C["text"]
    els = []
    els.append(make_element("rectangle", x, y, w, 32,
                            backgroundColor=bg, strokeColor=border))
    els.append(make_element("text", x + 12, y + 8, w - 24, 14,
                            text=label, fontSize=14, textAlign="center",
                            strokeColor=text_color))
    return els, w


def chip_row(x, y, labels, selected=None, max_w=CONTENT_W):
    """Row of chips that wraps to next line."""
    els = []
    cx, cy = x, y
    if selected is None:
        selected = []
    for label in labels:
        chip_els, w = chip(cx, cy, label, label in selected)
        if cx + w > x + max_w and cx != x:
            cx = x
            cy += 40
            chip_els, w = chip(cx, cy, label, label in selected)
        els.extend(chip_els)
        cx += w + 8
    return els, cy + 40 - y


def info_chip(x, y, label, bg_color, text_color):
    """Read-only info chip (symptoms, triggers)."""
    w = len(label) * 7 + 20
    els = []
    els.append(make_element("rectangle", x, y, w, 28,
                            backgroundColor=bg_color, strokeColor="transparent"))
    els.append(make_element("text", x + 10, y + 6, w - 20, 14,
                            text=label, fontSize=14,
                            strokeColor=text_color))
    return els, w


def info_chip_row(x, y, labels, bg_color=None, text_color=None, max_w=CONTENT_W):
    """Row of read-only chips."""
    bg = bg_color or C["borderLight"]
    tc = text_color or C["text"]
    els = []
    cx, cy = x, y
    for label in labels:
        chip_els, w = info_chip(cx, cy, label, bg, tc)
        if cx + w > x + max_w and cx != x:
            cx = x
            cy += 34
            chip_els, w = info_chip(cx, cy, label, bg, tc)
        els.extend(chip_els)
        cx += w + 8
    return els, cy + 34 - y


def intensity_slider(x, y, w, value=5, max_val=10):
    """Intensity slider with pain-scale colors."""
    els = []
    # Track
    track_y = y + 10
    els.append(make_element("rectangle", x, track_y, w, 4,
                            backgroundColor=C["border"],
                            strokeColor="transparent"))
    # Filled portion with pain color
    fill_w = int(w * value / max_val)
    pain_color = get_pain_color(value)
    els.append(make_element("rectangle", x, track_y, fill_w, 4,
                            backgroundColor=pain_color,
                            strokeColor="transparent"))
    # Thumb
    thumb_x = x + fill_w - 14
    els.append(make_element("ellipse", thumb_x, y, 28, 28,
                            backgroundColor="#FFFFFF",
                            strokeColor=pain_color,
                            strokeWidth=2))
    # Value inside thumb
    els.append(make_element("text", thumb_x + 6, y + 6, 16, 16,
                            text=str(value), fontSize=13, textAlign="center",
                            strokeColor=pain_color))
    return els


def get_pain_color(intensity):
    """Get color from pain scale gradient."""
    if intensity <= 1:
        return C["pain0"]
    elif intensity <= 3:
        return C["pain3"]
    elif intensity <= 5:
        return C["pain5"]
    elif intensity <= 8:
        return C["pain8"]
    else:
        return C["pain10"]


def badge_dot(x, y, color, size=12):
    """Small colored dot/badge."""
    return [make_element("ellipse", x, y, size, size,
                         backgroundColor=color, strokeColor=color)]


def ongoing_badge(x, y):
    """Red 'Ongoing' badge."""
    els = []
    els.append(make_element("rectangle", x, y, 70, 24,
                            backgroundColor=C["ongoing"],
                            strokeColor="transparent"))
    els.append(make_element("text", x + 10, y + 4, 50, 14,
                            text="Ongoing", fontSize=12, textAlign="center",
                            strokeColor=C["ongoingText"]))
    return els


def sparkline(x, y, w, h, values=None):
    """Intensity sparkline using colored line segments and dots."""
    if values is None:
        values = [3, 4, 6, 7, 8, 6, 5, 3]
    els = []
    # Background
    els.append(make_element("rectangle", x, y, w, h,
                            backgroundColor=C["borderLight"],
                            strokeColor="transparent",
                            opacity=50))
    n = len(values)
    if n < 2:
        return els
    # Plot points and connecting lines
    for i in range(n):
        px = x + int(i * w / (n - 1))
        py = y + h - int(values[i] * h / 10) - 3
        color = get_pain_color(values[i])
        # Dot
        els.append(make_element("ellipse", px - 3, py - 3, 6, 6,
                                backgroundColor=color, strokeColor="#FFFFFF",
                                strokeWidth=1))
    # Connect with lines
    for i in range(n - 1):
        x1 = x + int(i * w / (n - 1))
        y1 = y + h - int(values[i] * h / 10) - 3
        x2 = x + int((i + 1) * w / (n - 1))
        y2 = y + h - int(values[i + 1] * h / 10) - 3
        color = get_pain_color(values[i])
        els.append(make_element("line", x1, y1, x2 - x1, y2 - y1,
                                points=[[0, 0], [x2 - x1, y2 - y1]],
                                strokeColor=color, strokeWidth=2))
    return els


def timeline_item(x, y, time_str, title, subtitle=None, intensity=None,
                  dot_color=None, has_line=True, chips=None,
                  added_chips=None, removed_chips=None):
    """Timeline event with bullet dot, connecting line, and content."""
    els = []
    time_col_w = 70
    dot_col_w = 24
    content_x = x + time_col_w + dot_col_w + 8
    content_w = CONTENT_W - time_col_w - dot_col_w - 8

    # Time label (right-aligned)
    els.append(make_element("text", x, y + 2, time_col_w - 8, 14,
                            text=time_str, fontSize=14, textAlign="right",
                            strokeColor=C["textSecondary"]))

    # Timeline dot (12px)
    dot_cx = x + time_col_w + 6
    dot_cy = y + 2
    dc = dot_color or C["border"]
    if intensity is not None:
        dc = get_pain_color(intensity)
    els.append(make_element("ellipse", dot_cx, dot_cy, 12, 12,
                            backgroundColor=dc, strokeColor="#FFFFFF",
                            strokeWidth=2))

    # Connecting line to next item
    if has_line:
        line_x = dot_cx + 5
        els.append(make_element("line", line_x, dot_cy + 14, 0, 40,
                                points=[[0, 0], [0, 40]],
                                strokeColor=C["borderLight"],
                                strokeWidth=1))

    # Event title
    els.extend(body_text(content_x, y, title, font_size=16, w=content_w))
    cy = y + 22

    # Intensity bar
    if intensity is not None:
        pain_color = get_pain_color(intensity)
        bar_w = int(content_w * 0.6)
        fill_w = int(bar_w * intensity / 10)
        els.append(make_element("rectangle", content_x, cy, bar_w, 20,
                                backgroundColor=C["borderLight"],
                                strokeColor="transparent"))
        els.append(make_element("rectangle", content_x, cy, fill_w, 20,
                                backgroundColor=pain_color,
                                strokeColor="transparent"))
        els.append(make_element("text", content_x + bar_w + 8, cy + 2, 60, 16,
                                text=f"{intensity}/10", fontSize=14,
                                strokeColor=pain_color))
        cy += 26

    # Subtitle
    if subtitle:
        els.extend(secondary_text(content_x, cy, subtitle, font_size=14, w=content_w))
        cy += 20

    # Chips (symptoms, locations)
    if chips:
        chip_els, ch = info_chip_row(content_x, cy, chips, max_w=content_w)
        els.extend(chip_els)
        cy += ch

    # Added chips (green)
    if added_chips:
        for ac in added_chips:
            ac_els, aw = info_chip(content_x, cy, f"+ {ac}",
                                   C["addedBg"], C["addedText"])
            els.extend(ac_els)
            content_x_temp = content_x + aw + 6
            # Simple single-row for wireframe
        cy += 34

    # Removed chips (red)
    if removed_chips:
        for rc in removed_chips:
            rc_els, rw = info_chip(content_x, cy, f"− {rc}",
                                   C["removedBg"], C["removedText"])
            els.extend(rc_els)
        cy += 34

    return els


def settings_row(x, y, w, label, value_text=None, has_toggle=False,
                 has_chevron=True, toggle_on=True):
    """Settings list item."""
    els = []
    els.append(make_element("text", x + 16, y + 14, w - 120, 18,
                            text=label, fontSize=17,
                            strokeColor=C["text"]))
    if has_toggle:
        els.extend(toggle_switch(x + w - 67, y + 9, on=toggle_on))
    elif value_text:
        els.append(make_element("text", x + w - 100, y + 16, 70, 16,
                                text=value_text, fontSize=15, textAlign="right",
                                strokeColor=C["textSecondary"]))
    if has_chevron and not has_toggle:
        els.append(make_element("text", x + w - 24, y + 14, 12, 18,
                                text="›", fontSize=20,
                                strokeColor=C["textTertiary"]))
    els.extend(divider_line(x + 16, y + 48, w - 16))
    return els


def progress_dots(x, y, total, active):
    """Onboarding progress dots."""
    els = []
    dot_spacing = 20
    start_x = x + (PHONE_W - total * dot_spacing) // 2
    for i in range(total):
        bg = C["primary"] if i <= active else C["border"]
        els.append(make_element("ellipse", start_x + i * dot_spacing, y, 10, 10,
                                backgroundColor=bg, strokeColor=bg))
    return els


def calendar_grid(x, y, w):
    """Monthly calendar with status dots."""
    els = []
    h = 240
    # Card background
    els.extend(app_card(x, y, w, h))

    # Month nav header
    els.append(make_element("text", x + 12, y + 12, 20, 20,
                            text="‹", fontSize=24, strokeColor=C["primary"]))
    els.append(make_element("text", x + w // 2 - 40, y + 14, 80, 20,
                            text="March 2026", fontSize=17, textAlign="center",
                            strokeColor=C["text"]))
    els.append(make_element("text", x + w - 32, y + 12, 20, 20,
                            text="›", fontSize=24, strokeColor=C["primary"],
                            textAlign="right"))

    # Weekday headers
    days = ["S", "M", "T", "W", "T", "F", "S"]
    col_w = (w - 16) // 7
    for i, d in enumerate(days):
        els.append(make_element("text", x + 8 + col_w * i, y + 44, col_w, 14,
                                text=d, fontSize=12, textAlign="center",
                                strokeColor=C["textSecondary"]))

    # Day cells with status dots
    cell_h = 30
    status_pattern = [
        # Row 0: starts on Sunday
        [None, None, None, None, None, None, None],
        ["clear", "clear", "clear", "episode", "episode", "clear", "clear"],
        ["clear", "notclear", "clear", "clear", "clear", "episode", "clear"],
        ["clear", "clear", "clear", "notclear", "clear", "clear", None],
        ["clear", None, None, None, None, None, None],  # future
        [None, None, None, None, None, None, None],
    ]
    status_colors = {
        "clear": C["calClear"],
        "notclear": C["calNotClear"],
        "episode": C["calEpisode"],
    }

    for row in range(5):
        for col in range(7):
            day_num = row * 7 + col + 1
            if day_num > 31:
                continue
            cx = x + 8 + col_w * col
            cy = y + 62 + row * cell_h
            # Day number
            els.append(make_element("text", cx, cy, col_w, 14,
                                    text=str(day_num), fontSize=14,
                                    textAlign="center",
                                    strokeColor=C["text"] if day_num <= 21 else C["textTertiary"]))
            # Status dot
            if row < len(status_pattern):
                status = status_pattern[row][col]
                if status and status in status_colors:
                    dot_x = cx + col_w // 2 - 4
                    els.extend(badge_dot(dot_x, cy + 16, status_colors[status], 8))

            # Today highlight
            if day_num == 21:
                els.append(make_element("rectangle", cx + 2, cy - 4, col_w - 4, cell_h,
                                        backgroundColor="transparent",
                                        strokeColor=C["primary"],
                                        strokeWidth=2))

    # Legend
    legend_y = y + h - 28
    legend_items = [("Clear", C["calClear"]), ("Not Clear", C["calNotClear"]),
                    ("Episode", C["calEpisode"])]
    lx = x + 16
    for label, color in legend_items:
        els.extend(badge_dot(lx, legend_y + 3, color, 10))
        els.append(make_element("text", lx + 14, legend_y, 50, 14,
                                text=label, fontSize=12,
                                strokeColor=C["textSecondary"]))
        lx += 70

    return els


def histogram_bar(x, y, w, bar_h, max_h, count, intensity):
    """Single histogram bar with pain color."""
    els = []
    color = get_pain_color(intensity)
    actual_h = max(4, int(bar_h * max_h))

    # Bar
    els.append(make_element("rectangle", x, y + (max_h - actual_h), w, actual_h,
                            backgroundColor=color, strokeColor="transparent"))
    # Count above
    if count > 0:
        els.append(make_element("text", x, y + (max_h - actual_h) - 16, w, 14,
                                text=str(count), fontSize=10, textAlign="center",
                                strokeColor=C["text"]))
    # Intensity below
    els.append(make_element("text", x, y + max_h + 4, w, 14,
                            text=str(intensity), fontSize=10, textAlign="center",
                            strokeColor=C["textSecondary"]))
    return els


def make_excalidraw(elements):
    return {
        "type": "excalidraw",
        "version": 2,
        "source": "claude-code-generator",
        "elements": elements,
        "appState": {
            "gridSize": None,
            "viewBackgroundColor": "#ffffff"
        },
        "files": {}
    }


def save(filename, elements):
    data = make_excalidraw(elements)
    filepath = os.path.join(os.path.dirname(os.path.abspath(__file__)), filename)
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2)
    print(f"  {filename}: {len(elements)} elements")


# ============================================================
# SCREEN GENERATORS
# ============================================================

def gen_dashboard():
    els = []
    els.extend(phone_frame())
    els.extend(header_bar("MigraLog", right_icon="⚙"))
    y = HEADER_H + 8

    # --- Daily Status Widget ---
    card_h = 100
    els.extend(app_card(PADDING, y, CONTENT_W, card_h))
    els.extend(body_text(PADDING + 16, y + 16, "How was yesterday?", font_size=17))
    # Green + Yellow buttons
    btn_w = (CONTENT_W - 48) // 2
    els.extend(small_button(PADDING + 16, y + 48, btn_w, 40, "Clear",
                            bg=C["success"], text_color=C["successText"]))
    els.extend(small_button(PADDING + 24 + btn_w, y + 48, btn_w, 40, "Not Clear",
                            bg=C["warning"], text_color=C["warningText"]))
    y += card_h + 8

    # --- Today's Medications ---
    card_h = 160
    els.extend(app_card(PADDING, y, CONTENT_W, card_h))
    els.extend(body_text(PADDING + 16, y + 16, "Today's Medications", font_size=20))

    med_y = y + 44
    meds = [
        ("Topiramate 50mg", "8:00 AM", "pending"),
        ("Magnesium 400mg", "8:00 AM", "taken"),
        ("Riboflavin 200mg", "8:00 AM", "skipped"),
    ]
    for name, time, status in meds:
        els.extend(body_text(PADDING + 16, med_y, name, font_size=14, w=160))
        els.extend(secondary_text(PADDING + 180, med_y, time, font_size=13, w=60))
        if status == "pending":
            els.extend(small_button(PADDING + CONTENT_W - 108, med_y - 2, 48, 28,
                                    "Log", bg=C["primary"]))
            els.extend(small_button(PADDING + CONTENT_W - 56, med_y - 2, 44, 28,
                                    "Skip", bg=C["danger"]))
        elif status == "taken":
            els.append(make_element("text", PADDING + CONTENT_W - 90, med_y + 2, 78, 14,
                                    text="✓ Taken", fontSize=12,
                                    strokeColor=C["success"], textAlign="right"))
        elif status == "skipped":
            els.append(make_element("text", PADDING + CONTENT_W - 90, med_y + 2, 78, 14,
                                    text="✕ Skipped", fontSize=12,
                                    strokeColor=C["textSecondary"], textAlign="right"))
        els.extend(divider_line(PADDING + 16, med_y + 28, CONTENT_W - 32))
        med_y += 34
    y += card_h + 8

    # --- Quick Actions ---
    els.extend(primary_button(PADDING, y, CONTENT_W, 48, "Start Episode"))
    y += 56
    els.extend(secondary_button(PADDING, y, CONTENT_W, 48, "Log Medication"))
    y += 60

    # --- Recent Episodes ---
    card_h = 200
    els.extend(app_card(PADDING, y, CONTENT_W, card_h))
    els.extend(body_text(PADDING + 16, y + 16, "Recent Episodes", font_size=20))

    ep_y = y + 44
    episodes = [
        ("Mon, Mar 18 · 2:30 PM", "4h 20m", [3, 5, 7, 8, 6, 4, 2]),
        ("Fri, Mar 15 · 10:00 AM", "8h 15m", [2, 4, 6, 9, 8, 7, 5, 3]),
        ("Wed, Mar 12 · 6:00 PM", "2h 10m", [4, 5, 4, 3]),
    ]
    for date, duration, intensities in episodes:
        els.extend(body_text(PADDING + 16, ep_y, date, font_size=15, w=200))
        els.extend(secondary_text(PADDING + 16, ep_y + 20, duration, font_size=14, w=100))
        # Sparkline
        els.extend(sparkline(PADDING + CONTENT_W - 136, ep_y + 4, 120, 36, intensities))
        els.extend(divider_line(PADDING + 16, ep_y + 46, CONTENT_W - 32))
        ep_y += 50

    els.extend(tab_bar(active_index=0))
    save("01-dashboard.excalidraw", els)


def gen_episodes_list():
    els = []
    els.extend(phone_frame())
    els.extend(header_bar("Episodes"))
    y = HEADER_H + 8

    # Active episode card
    els.extend(app_card(PADDING, y, CONTENT_W, 90))
    els.extend(body_text(PADDING + 16, y + 12, "Mon, Mar 21 · 10:00 AM", font_size=17))
    els.extend(ongoing_badge(PADDING + CONTENT_W - 86, y + 12))
    els.extend(secondary_text(PADDING + 16, y + 36, "Right temple"))
    els.extend(secondary_text(PADDING + 16, y + 56, "2h 30m and ongoing", font_size=15))
    els.extend(sparkline(PADDING + CONTENT_W - 136, y + 44, 120, 36, [3, 4, 5, 6, 6]))
    y += 100

    # Closed episodes
    closed = [
        ("Thu, Mar 18 · 2:30 PM", "Right temple, Eye", "4h 20m", [3, 5, 7, 8, 6, 4, 2]),
        ("Mon, Mar 15 · 10:00 AM", "Left temple", "8h 15m", [2, 4, 6, 9, 8, 7, 5, 3]),
        ("Fri, Mar 12 · 6:00 PM", "Forehead", "2h 10m", [4, 5, 4, 3]),
        ("Tue, Mar 9 · 8:00 AM", "Right temple, Neck", "6h", [2, 3, 5, 7, 6, 4]),
    ]
    for date, location, duration, intensities in closed:
        els.extend(app_card(PADDING, y, CONTENT_W, 80))
        els.extend(body_text(PADDING + 16, y + 10, date, font_size=17))
        els.extend(secondary_text(PADDING + 16, y + 32, location))
        els.extend(secondary_text(PADDING + 16, y + 52, duration, font_size=15))
        els.extend(sparkline(PADDING + CONTENT_W - 136, y + 34, 120, 36, intensities))
        y += 88

    els.extend(tab_bar(active_index=1))
    save("02-episodes-list.excalidraw", els)


def gen_episode_detail():
    els = []
    els.extend(phone_frame())
    els.extend(header_bar("Episode Details", left_text="‹ Back", right_icon="Edit",
                          large_title=False))
    y = HEADER_H + 8

    # --- Status Card ---
    els.extend(app_card(PADDING, y, CONTENT_W, 120))
    els.extend(body_text(PADDING + 16, y + 12, "Monday, Mar 21, 2026", font_size=18))
    els.extend(ongoing_badge(PADDING + CONTENT_W - 86, y + 12))
    # Detail rows
    rows = [
        ("Started:", "10:00 AM"),
        ("Duration:", "2h 30m"),
        ("Location:", "Right temple →"),
    ]
    ry = y + 40
    for label, val in rows:
        els.extend(secondary_text(PADDING + 16, ry, label, font_size=14, w=80))
        color = C["primary"] if "→" in val else C["text"]
        els.extend(body_text(PADDING + 100, ry, val, font_size=14, w=160, color=color))
        ry += 22

    # Quick action buttons in status card
    half_btn = (CONTENT_W - 48) // 2
    els.extend(small_button(PADDING + 16, y + 92, half_btn, 20, "Log Update",
                            bg=C["bgSecondary"], text_color=C["text"],
                            border_color=C["border"]))
    els.extend(small_button(PADDING + 24 + half_btn, y + 92, half_btn, 20, "Log Medication",
                            bg=C["bgSecondary"], text_color=C["text"],
                            border_color=C["border"]))
    y += 128

    # --- Info Cards (Pain Quality) ---
    els.extend(app_card(PADDING, y, CONTENT_W, 60))
    els.extend(body_text(PADDING + 16, y + 10, "Pain Quality", font_size=18))
    pq_els, _ = info_chip_row(PADDING + 16, y + 34, ["Pulsating", "Throbbing"],
                              max_w=CONTENT_W - 32)
    els.extend(pq_els)
    y += 68

    # --- Info Cards (Triggers) ---
    els.extend(app_card(PADDING, y, CONTENT_W, 60))
    els.extend(body_text(PADDING + 16, y + 10, "Possible Triggers", font_size=18))
    tr_els, _ = info_chip_row(PADDING + 16, y + 34, ["Stress", "Sleep Deprivation"],
                              max_w=CONTENT_W - 32)
    els.extend(tr_els)
    y += 68

    # --- Timeline Card ---
    els.extend(app_card(PADDING, y, CONTENT_W, 340))
    els.extend(body_text(PADDING + 16, y + 12, "Timeline", font_size=18))

    # Sparkline in timeline
    els.extend(sparkline(PADDING + 16, y + 38, CONTENT_W - 32, 60, [3, 4, 5, 6, 7, 6, 5]))
    ty = y + 108

    # Timeline events with dots and lines
    els.extend(timeline_item(PADDING + 8, ty, "10:00", "Episode started",
                             intensity=3, has_line=True))
    ty += 56
    els.extend(timeline_item(PADDING + 8, ty, "10:30", "Intensity update",
                             intensity=6, has_line=True))
    ty += 56
    els.extend(timeline_item(PADDING + 8, ty, "11:00", "Sumatriptan 50mg",
                             subtitle="Medication taken",
                             dot_color=C["primary"], has_line=True))
    ty += 56
    els.extend(timeline_item(PADDING + 8, ty, "11:15", "Symptoms changed",
                             has_line=False, dot_color=C["text"],
                             added_chips=["Nausea"],
                             removed_chips=["Aura"]))

    y += 348

    # --- Bottom Action Bar ---
    bar_y = PHONE_H - 80
    els.append(make_element("rectangle", 0, bar_y, PHONE_W, 80,
                            backgroundColor=C["card"], strokeColor="transparent"))
    els.extend(divider_line(0, bar_y, PHONE_W))
    half = (PHONE_W - 48) // 2
    els.extend(danger_button(PADDING, bar_y + 16, half, 48, "End Now"))
    els.extend(secondary_button(PADDING + half + 16, bar_y + 16, half, 48, "End..."))

    save("03-episode-detail.excalidraw", els)


def gen_new_episode():
    els = []
    els.extend(phone_frame())
    els.extend(header_bar("Start New Episode", left_text="Cancel", large_title=False))
    y = HEADER_H + 12

    # Start Time
    els.extend(section_label(PADDING, y, "Start Time", font_size=17))
    y += 28
    els.extend(text_input(PADDING, y, CONTENT_W, 44, "Mar 21, 2026 · 10:00 AM"))
    y += 52

    # Pain Locations
    els.extend(section_label(PADDING, y, "Pain Locations", font_size=17))
    y += 28
    half = CONTENT_W // 2 - 4
    els.extend(secondary_text(PADDING, y, "Left Side", w=half))
    els.extend(secondary_text(PADDING + half + 8, y, "Right Side", w=half))
    y += 22
    locations = ["Temple", "Eye", "Forehead", "Back of head", "Neck"]
    for loc in locations:
        l_els, _ = chip(PADDING, y, loc, loc == "Temple")
        r_els, _ = chip(PADDING + half + 8, y, loc, False)
        els.extend(l_els)
        els.extend(r_els)
        y += 38

    # Symptoms
    els.extend(section_label(PADDING, y, "Symptoms", font_size=17))
    y += 28
    symptoms = ["Nausea", "Vomiting", "Aura", "Light sens.", "Sound sens.",
                "Smell sens.", "Dizziness", "Visual dist.", "Confusion"]
    sym_els, sym_h = chip_row(PADDING, y, symptoms,
                              selected=["Nausea", "Light sens."])
    els.extend(sym_els)
    y += sym_h + 8

    # Triggers
    els.extend(section_label(PADDING, y, "Triggers", font_size=17))
    y += 28
    triggers = ["Stress", "Sleep", "Weather", "Lights", "Sounds",
                "Alcohol", "Caffeine", "Food", "Hormonal"]
    trig_els, trig_h = chip_row(PADDING, y, triggers, selected=["Stress"])
    els.extend(trig_els)
    y += trig_h + 8

    # Intensity
    els.extend(section_label(PADDING, y, "Initial Intensity", font_size=17))
    y += 28
    els.extend(intensity_slider(PADDING, y, CONTENT_W, value=4))
    y += 44

    # Save
    els.extend(primary_button(PADDING, y, CONTENT_W, 48, "Save Episode"))

    save("04-new-episode.excalidraw", els)


def gen_log_update():
    els = []
    els.extend(phone_frame())
    els.extend(header_bar("Log Update", left_text="Cancel", large_title=False))
    y = HEADER_H + 16

    # Intensity
    els.extend(section_label(PADDING, y, "Current Intensity", font_size=17))
    y += 28
    els.extend(intensity_slider(PADDING, y, CONTENT_W, value=6))
    y += 44

    # Pain Locations
    els.extend(section_label(PADDING, y, "Pain Locations", font_size=17))
    y += 28
    locs = ["L-Temple", "R-Temple", "L-Eye", "R-Eye", "Forehead", "Neck"]
    loc_els, loc_h = chip_row(PADDING, y, locs, selected=["R-Temple"])
    els.extend(loc_els)
    y += loc_h + 8

    # Symptoms
    els.extend(section_label(PADDING, y, "Symptoms", font_size=17))
    y += 28
    symptoms = ["Nausea", "Vomiting", "Aura", "Light sens.", "Sound sens.",
                "Dizziness", "Visual dist."]
    sym_els, sym_h = chip_row(PADDING, y, symptoms, selected=["Nausea"])
    els.extend(sym_els)
    y += sym_h + 8

    # Notes
    els.extend(section_label(PADDING, y, "Notes", font_size=17))
    y += 28
    els.extend(text_input(PADDING, y, CONTENT_W, 80, "Add notes..."))
    y += 96

    els.extend(primary_button(PADDING, y, CONTENT_W, 48, "Save Update"))

    save("05-log-update.excalidraw", els)


def gen_edit_intensity():
    els = []
    els.extend(phone_frame())
    els.extend(header_bar("Edit Intensity", left_text="Cancel", large_title=False))
    y = HEADER_H + 32

    els.extend(section_label(PADDING, y, "Intensity Level", font_size=17))
    y += 32
    # Large value display
    els.append(make_element("text", PHONE_W // 2 - 16, y, 32, 40,
                            text="6", fontSize=36, textAlign="center",
                            strokeColor=get_pain_color(6)))
    y += 48
    els.extend(intensity_slider(PADDING, y, CONTENT_W, value=6))
    y += 48

    els.extend(section_label(PADDING, y, "Timestamp", font_size=17))
    y += 28
    els.extend(text_input(PADDING, y, CONTENT_W, 44, "Mar 21, 2026 · 10:30 AM"))
    y += 64

    els.extend(primary_button(PADDING, y, CONTENT_W, 48, "Save"))

    save("06-edit-intensity.excalidraw", els)


def gen_edit_symptoms():
    els = []
    els.extend(phone_frame())
    els.extend(header_bar("Edit Symptoms", left_text="Cancel", large_title=False))
    y = HEADER_H + 24

    els.extend(section_label(PADDING, y, "Symptoms", font_size=17))
    y += 28
    symptoms = ["Nausea", "Vomiting", "Aura", "Light sensitivity",
                "Sound sensitivity", "Smell sensitivity", "Dizziness",
                "Visual disturbances", "Confusion"]
    sym_els, sym_h = chip_row(PADDING, y, symptoms,
                              selected=["Nausea", "Light sensitivity"])
    els.extend(sym_els)
    y += sym_h + 16

    els.extend(section_label(PADDING, y, "Timestamp", font_size=17))
    y += 28
    els.extend(text_input(PADDING, y, CONTENT_W, 44, "Mar 21, 2026 · 11:15 AM"))
    y += 64

    els.extend(primary_button(PADDING, y, CONTENT_W, 48, "Save"))

    save("07-edit-symptoms.excalidraw", els)


def gen_edit_pain_location():
    els = []
    els.extend(phone_frame())
    els.extend(header_bar("Edit Pain Location", left_text="Cancel", large_title=False))
    y = HEADER_H + 24

    els.extend(section_label(PADDING, y, "Pain Locations", font_size=17))
    y += 28
    half = CONTENT_W // 2 - 4
    els.extend(secondary_text(PADDING, y, "Left Side", w=half))
    els.extend(secondary_text(PADDING + half + 8, y, "Right Side", w=half))
    y += 22
    locations = ["Temple", "Eye", "Forehead", "Back of head", "Neck"]
    for loc in locations:
        l_els, _ = chip(PADDING, y, loc, False)
        r_els, _ = chip(PADDING + half + 8, y, loc, loc == "Temple")
        els.extend(l_els)
        els.extend(r_els)
        y += 38

    els.extend(section_label(PADDING, y, "Timestamp", font_size=17))
    y += 28
    els.extend(text_input(PADDING, y, CONTENT_W, 44, "Mar 21, 2026 · 10:00 AM"))
    y += 64

    els.extend(primary_button(PADDING, y, CONTENT_W, 48, "Save"))

    save("08-edit-pain-location.excalidraw", els)


def gen_edit_note():
    els = []
    els.extend(phone_frame())
    els.extend(header_bar("Episode Note", left_text="Cancel", large_title=False))
    y = HEADER_H + 24

    els.extend(section_label(PADDING, y, "Note", font_size=17))
    y += 28
    els.extend(text_input(PADDING, y, CONTENT_W, 160, "Write your note here..."))
    y += 176

    els.extend(section_label(PADDING, y, "Timestamp", font_size=17))
    y += 28
    els.extend(text_input(PADDING, y, CONTENT_W, 44, "Mar 21, 2026 · 11:00 AM"))
    y += 64

    els.extend(primary_button(PADDING, y, CONTENT_W, 48, "Save"))

    save("09-edit-note.excalidraw", els)


def gen_medications_list():
    els = []
    els.extend(phone_frame())
    els.extend(header_bar("Medications", right_icon="📁"))
    y = HEADER_H + 8

    # Preventative section
    els.extend(section_label(PADDING, y, "Preventative", font_size=18))
    y += 28
    preventatives = [
        ("Topiramate", "50mg · Daily at 8:00 AM", "Anticonvulsant"),
        ("Magnesium", "400mg · Daily at 8:00 AM", "Supplement"),
        ("Riboflavin", "200mg · Daily at 8:00 AM", "Supplement"),
    ]
    for name, detail, category in preventatives:
        els.extend(app_card(PADDING, y, CONTENT_W, 64))
        els.extend(body_text(PADDING + 16, y + 10, name, font_size=17))
        els.extend(secondary_text(PADDING + 16, y + 32, detail))
        # Type badge
        els.extend(info_chip(PADDING + CONTENT_W - 110, y + 10, "Preventative",
                             C["addedBg"], C["addedText"])[0])
        y += 72

    # Rescue section
    els.extend(section_label(PADDING, y, "Rescue", font_size=18))
    y += 28
    rescues = [
        ("Sumatriptan", "50mg · As needed"),
        ("Ibuprofen", "400mg · As needed"),
    ]
    for name, detail in rescues:
        els.extend(app_card(PADDING, y, CONTENT_W, 64))
        els.extend(body_text(PADDING + 16, y + 10, name, font_size=17))
        els.extend(secondary_text(PADDING + 16, y + 32, detail))
        els.extend(info_chip(PADDING + CONTENT_W - 75, y + 10, "Rescue",
                             C["removedBg"], C["removedText"])[0])
        y += 72

    # FAB
    fab_x = PHONE_W // 2 - 28
    fab_y = PHONE_H - TAB_BAR_H - 68
    els.append(make_element("ellipse", fab_x, fab_y, 56, 56,
                            backgroundColor=C["primary"],
                            strokeColor=C["primary"]))
    els.append(make_element("text", fab_x + 16, fab_y + 12, 24, 32,
                            text="+", fontSize=28, textAlign="center",
                            strokeColor=C["primaryText"]))

    els.extend(tab_bar(active_index=2))
    save("10-medications-list.excalidraw", els)


def gen_medication_detail():
    els = []
    els.extend(phone_frame())
    els.extend(header_bar("Medication", left_text="‹ Back", right_icon="Edit",
                          large_title=False))
    y = HEADER_H + 8

    # Medication header card
    els.extend(app_card(PADDING, y, CONTENT_W, 90))
    els.extend(body_text(PADDING + 16, y + 12, "Topiramate", font_size=20))
    els.extend(secondary_text(PADDING + 16, y + 36, "50mg tablet"))
    els.extend(secondary_text(PADDING + 16, y + 56, "Category: Anticonvulsant"))
    els.extend(info_chip(PADDING + CONTENT_W - 110, y + 12, "Preventative",
                         C["addedBg"], C["addedText"])[0])
    y += 98

    # Schedule card
    els.extend(app_card(PADDING, y, CONTENT_W, 60))
    els.extend(body_text(PADDING + 16, y + 10, "Schedule", font_size=18))
    els.extend(secondary_text(PADDING + 16, y + 34, "Daily at 8:00 AM · Notifications enabled"))
    y += 68

    # Last 7 Days
    els.extend(app_card(PADDING, y, CONTENT_W, 70))
    els.extend(body_text(PADDING + 16, y + 10, "Last 7 Days", font_size=18))
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    statuses = ["✓", "✓", "✓", "✓", "✓", "✕", "···"]
    colors_list = [C["success"]] * 5 + [C["textSecondary"], C["textTertiary"]]
    day_w = (CONTENT_W - 32) // 7
    for i, (day, status, col) in enumerate(zip(days, statuses, colors_list)):
        dx = PADDING + 16 + day_w * i
        els.append(make_element("text", dx, y + 34, day_w, 12,
                                text=day, fontSize=11, textAlign="center",
                                strokeColor=C["textSecondary"]))
        els.append(make_element("text", dx, y + 50, day_w, 16,
                                text=status, fontSize=14, textAlign="center",
                                strokeColor=col))
    y += 78

    # Action buttons
    els.extend(primary_button(PADDING, y, CONTENT_W, 48, "Log Dose"))
    y += 56
    els.extend(secondary_button(PADDING, y, CONTENT_W, 44, "View Full Log"))
    y += 52
    els.extend(secondary_button(PADDING, y, CONTENT_W, 44, "Archive Medication"))

    save("11-medication-detail.excalidraw", els)


def gen_add_medication():
    els = []
    els.extend(phone_frame())
    els.extend(header_bar("Add Medication", left_text="Cancel", large_title=False))
    y = HEADER_H + 12

    # Type toggle
    els.extend(section_label(PADDING, y, "Type", font_size=17))
    y += 28
    half = CONTENT_W // 2 - 4
    els.extend(small_button(PADDING, y, half, 40, "Preventative",
                            bg=C["primary"], text_color=C["primaryText"]))
    els.extend(small_button(PADDING + half + 8, y, half, 40, "Rescue",
                            bg=C["bgSecondary"], text_color=C["text"],
                            border_color=C["border"]))
    y += 52

    # Name
    els.extend(section_label(PADDING, y, "Medication Name", font_size=17))
    y += 28
    els.extend(text_input(PADDING, y, CONTENT_W, 44, "Search medications..."))
    y += 52

    # Category
    els.extend(section_label(PADDING, y, "Category", font_size=17))
    y += 28
    els.extend(text_input(PADDING, y, CONTENT_W, 44, "Select category..."))
    y += 52

    # Dosage
    els.extend(section_label(PADDING, y, "Dosage", font_size=17))
    y += 28
    two_thirds = int(CONTENT_W * 0.65)
    unit_w = CONTENT_W - two_thirds - 8
    els.extend(text_input(PADDING, y, two_thirds, 44, "Amount"))
    els.extend(text_input(PADDING + two_thirds + 8, y, unit_w, 44, "mg"))
    y += 52

    # Photo
    els.extend(section_label(PADDING, y, "Photo (optional)", font_size=17))
    y += 28
    els.extend(secondary_button(PADDING, y, 130, 40, "Add Photo"))
    y += 52

    # Notes
    els.extend(section_label(PADDING, y, "Notes (optional)", font_size=17))
    y += 28
    els.extend(text_input(PADDING, y, CONTENT_W, 60, "Add notes..."))
    y += 72

    # Schedule
    els.extend(section_label(PADDING, y, "Schedule", font_size=17))
    y += 28
    third = CONTENT_W // 3 - 4
    els.extend(small_button(PADDING, y, third, 36, "Daily",
                            bg=C["primary"], text_color=C["primaryText"]))
    els.extend(small_button(PADDING + third + 6, y, third, 36, "Weekly",
                            bg=C["bgSecondary"], text_color=C["text"],
                            border_color=C["border"]))
    els.extend(small_button(PADDING + (third + 6) * 2, y, third, 36, "As Needed",
                            bg=C["bgSecondary"], text_color=C["text"],
                            border_color=C["border"]))
    y += 44
    els.extend(text_input(PADDING, y, CONTENT_W, 44, "8:00 AM"))
    y += 56

    els.extend(primary_button(PADDING, y, CONTENT_W, 48, "Save Medication"))

    save("12-add-medication.excalidraw", els)


def gen_log_medication():
    els = []
    els.extend(phone_frame())
    els.extend(header_bar("Log Medication", left_text="Cancel", large_title=False))
    y = HEADER_H + 24

    els.extend(section_label(PADDING, y, "Medication", font_size=17))
    y += 28
    els.extend(text_input(PADDING, y, CONTENT_W, 44, "Select medication..."))
    y += 56

    els.extend(section_label(PADDING, y, "Dosage", font_size=17))
    y += 28
    els.extend(text_input(PADDING, y, CONTENT_W, 44, "50mg"))
    y += 56

    els.extend(section_label(PADDING, y, "Time", font_size=17))
    y += 28
    els.extend(text_input(PADDING, y, CONTENT_W, 44, "Mar 21, 2026 · 11:00 AM"))
    y += 64

    els.extend(primary_button(PADDING, y, CONTENT_W, 48, "Log Dose"))

    save("13-log-medication.excalidraw", els)


def gen_medication_log():
    els = []
    els.extend(phone_frame())
    els.extend(header_bar("Medication Log", left_text="‹ Back", large_title=False))
    y = HEADER_H + 8

    els.extend(text_input(PADDING, y, CONTENT_W, 40, "Filter by medication..."))
    y += 48

    entries = [
        ("Topiramate 50mg", "Mar 21, 8:00 AM", "✓ Taken", C["success"]),
        ("Magnesium 400mg", "Mar 21, 8:00 AM", "✓ Taken", C["success"]),
        ("Sumatriptan 50mg", "Mar 20, 2:30 PM", "✓ Taken", C["success"]),
        ("Topiramate 50mg", "Mar 20, 8:00 AM", "✓ Taken", C["success"]),
        ("Magnesium 400mg", "Mar 20, 8:05 AM", "✓ Taken", C["success"]),
        ("Topiramate 50mg", "Mar 19, 8:00 AM", "✕ Skipped", C["textSecondary"]),
        ("Riboflavin 200mg", "Mar 19, 8:00 AM", "✓ Taken", C["success"]),
        ("Ibuprofen 400mg", "Mar 18, 3:00 PM", "✓ Taken", C["success"]),
    ]
    for name, time, status, color in entries:
        els.extend(body_text(PADDING + 16, y + 6, name, font_size=15, w=200))
        els.extend(secondary_text(PADDING + 16, y + 26, time, font_size=13, w=160))
        els.append(make_element("text", PADDING + CONTENT_W - 80, y + 12, 64, 16,
                                text=status, fontSize=13, textAlign="right",
                                strokeColor=color))
        els.extend(divider_line(PADDING + 16, y + 48, CONTENT_W - 16))
        y += 52

    save("14-medication-log.excalidraw", els)


def gen_edit_dose():
    els = []
    els.extend(phone_frame())
    els.extend(header_bar("Edit Dose", left_text="Cancel", large_title=False))
    y = HEADER_H + 24

    els.extend(section_label(PADDING, y, "Dosage Amount", font_size=17))
    y += 28
    els.extend(text_input(PADDING, y, CONTENT_W, 44, "50mg"))
    y += 56

    els.extend(section_label(PADDING, y, "Timestamp", font_size=17))
    y += 28
    els.extend(text_input(PADDING, y, CONTENT_W, 44, "Mar 21, 2026 · 8:00 AM"))
    y += 56

    els.extend(section_label(PADDING, y, "Notes", font_size=17))
    y += 28
    els.extend(text_input(PADDING, y, CONTENT_W, 80, "Add notes..."))
    y += 100

    els.extend(primary_button(PADDING, y, CONTENT_W, 48, "Save"))
    y += 60
    els.extend(danger_button(PADDING, y, CONTENT_W, 44, "Delete Dose"))

    save("15-edit-dose.excalidraw", els)


def gen_archived_medications():
    els = []
    els.extend(phone_frame())
    els.extend(header_bar("Archived", left_text="‹ Back", large_title=False))
    y = HEADER_H + 8

    meds = [
        ("Propranolol", "40mg · Was daily"),
        ("Amitriptyline", "25mg · Was daily"),
    ]
    for name, detail in meds:
        els.extend(app_card(PADDING, y, CONTENT_W, 70))
        els.extend(body_text(PADDING + 16, y + 12, name, font_size=17))
        els.extend(secondary_text(PADDING + 16, y + 34, detail))
        els.extend(small_button(PADDING + CONTENT_W - 100, y + 38, 84, 24, "Unarchive",
                                bg=C["bgSecondary"], text_color=C["primary"],
                                border_color=C["primary"]))
        y += 78

    save("16-archived-medications.excalidraw", els)


def gen_analytics():
    els = []
    els.extend(phone_frame())
    els.extend(header_bar("Trends & Analytics"))
    y = HEADER_H + 4

    # Calendar
    els.extend(calendar_grid(PADDING, y, CONTENT_W))
    y += 248

    # Time range selector (sticky)
    range_labels = ["7d", "14d", "30d", "60d", "90d"]
    btn_w = (CONTENT_W - 32) // len(range_labels)
    for i, label in enumerate(range_labels):
        if i == 2:  # 30d selected
            els.extend(small_button(PADDING + i * (btn_w + 8), y, btn_w, 36, label,
                                    bg=C["primary"], text_color=C["primaryText"]))
        else:
            els.extend(small_button(PADDING + i * (btn_w + 8), y, btn_w, 36, label,
                                    bg=C["card"], text_color=C["text"],
                                    border_color=C["border"]))
    y += 44

    # Statistics header
    els.extend(section_label(PADDING, y, "Statistics", font_size=20))
    y += 28

    # Stats cards (2x2 grid)
    stats = [("4", "Total Episodes"), ("5.2h", "Avg Duration"),
             ("6.1", "Avg Intensity"), ("8", "Migraine Days")]
    half = CONTENT_W // 2 - 6
    for i, (val, label) in enumerate(stats):
        cx = PADDING + (i % 2) * (half + 12)
        cy = y + (i // 2) * 72
        els.extend(app_card(cx, cy, half, 64))
        els.append(make_element("text", cx + 16, cy + 12, half - 32, 28,
                                text=val, fontSize=28, textAlign="center",
                                strokeColor=C["primary"]))
        els.extend(secondary_text(cx + 16, cy + 42, label, w=half - 32))
    y += 152

    # Intensity histogram
    els.extend(section_label(PADDING, y, "Peak Intensity Distribution", font_size=18))
    y += 28
    els.extend(app_card(PADDING, y, CONTENT_W, 140))
    bar_y = y + 16
    bar_max_h = 90
    bar_w = (CONTENT_W - 52) // 10
    counts = [0, 1, 2, 3, 5, 4, 3, 2, 1, 1]  # distribution
    max_count = max(counts) or 1
    for i in range(10):
        bx = PADDING + 16 + i * (bar_w + 2)
        els.extend(histogram_bar(bx, bar_y, bar_w,
                                 counts[i] / max_count, bar_max_h,
                                 counts[i], i + 1))
    y += 148

    # Medication usage
    els.extend(section_label(PADDING, y, "Medication Usage", font_size=18))
    y += 28
    els.extend(app_card(PADDING, y, CONTENT_W, 64))
    els.extend(secondary_text(PADDING + 16, y + 12, "Topiramate: 28/30 taken (93%)"))
    els.extend(secondary_text(PADDING + 16, y + 34, "Sumatriptan: 4 rescue doses"))

    els.extend(tab_bar(active_index=3))
    save("17-analytics.excalidraw", els)


def gen_welcome_step(step_num, title, content_fn):
    """Generic welcome step generator."""
    els = []
    els.extend(phone_frame())
    y = STATUS_BAR_H + 16
    els.extend(progress_dots(0, y, 4, step_num - 1))
    y += 32

    els.append(make_element("text", PHONE_W // 2 - 100, y, 200, 32,
                            text=title, fontSize=24, textAlign="center",
                            strokeColor=C["text"]))
    y += 44

    y = content_fn(els, y)

    # Navigation buttons
    if step_num > 1:
        half = (CONTENT_W - 12) // 2
        els.extend(secondary_button(PADDING, PHONE_H - 80, half, 48, "Back"))
        finish_label = "Finish" if step_num == 4 else "Continue"
        els.extend(primary_button(PADDING + half + 12, PHONE_H - 80, half, 48, finish_label))
    else:
        els.extend(primary_button(PADDING, PHONE_H - 80, CONTENT_W, 48, "Continue"))

    return els


def gen_welcome_step1():
    def content(els, y):
        features = [
            "Track migraine episodes in detail",
            "Monitor medication schedules",
            "Analyze patterns and triggers",
            "Generate reports for your doctor",
        ]
        for feat in features:
            els.append(make_element("text", PADDING + 28, y, CONTENT_W - 28, 20,
                                    text=f"•  {feat}", fontSize=16,
                                    strokeColor=C["text"]))
            y += 36
        return y
    els = gen_welcome_step(1, "Welcome to\nMigraLog", content)
    save("18-welcome-step1.excalidraw", els)


def gen_welcome_step2():
    def content(els, y):
        els.extend(app_card(PADDING, y, CONTENT_W, 200))
        disclaimer_lines = [
            "This app is not a substitute for",
            "professional medical advice,",
            "diagnosis, or treatment.",
            "",
            "Always seek the advice of your",
            "physician or qualified health",
            "provider with any questions",
            "about a medical condition.",
        ]
        ly = y + 16
        for line in disclaimer_lines:
            if line:
                els.extend(body_text(PADDING + 16, ly, line, font_size=15, w=CONTENT_W - 32))
            ly += 22
        y += 216
        c_els, _ = chip(PADDING, y, "I understand and agree", selected=True)
        els.extend(c_els)
        return y + 40
    els = gen_welcome_step(2, "Medical Disclaimer", content)
    save("19-welcome-step2.excalidraw", els)


def gen_welcome_step3():
    def content(els, y):
        benefits = [
            "•  Medication reminders at scheduled times",
            "•  Daily check-in prompts",
            "•  Episode follow-up alerts",
        ]
        for b in benefits:
            els.extend(body_text(PADDING + 16, y, b, font_size=16, w=CONTENT_W - 16))
            y += 36
        y += 12
        els.extend(primary_button(PADDING, y, CONTENT_W, 48, "Enable Notifications"))
        y += 56
        els.extend(secondary_button(PADDING, y, CONTENT_W, 44, "Skip for now"))
        return y + 52
    els = gen_welcome_step(3, "Notifications", content)
    save("20-welcome-step3.excalidraw", els)


def gen_welcome_step4():
    def content(els, y):
        els.extend(body_text(PADDING, y, "Location data helps track\nweather and barometric\npressure as potential triggers.",
                             font_size=16, w=CONTENT_W))
        y += 72
        els.extend(primary_button(PADDING, y, CONTENT_W, 48, "Enable Location"))
        y += 56
        els.extend(secondary_button(PADDING, y, CONTENT_W, 44, "Skip for now"))
        return y + 52
    els = gen_welcome_step(4, "Location Access", content)
    save("21-welcome-step4.excalidraw", els)


def gen_settings():
    els = []
    els.extend(phone_frame())
    els.extend(header_bar("Settings", right_icon="✕", large_title=False))
    y = HEADER_H + 8

    # Theme section
    els.extend(section_label(PADDING, y, "Appearance", font_size=17))
    y += 28
    third = CONTENT_W // 3 - 4
    els.extend(small_button(PADDING, y, third, 40, "Light",
                            bg=C["primary"], text_color=C["primaryText"]))
    els.extend(small_button(PADDING + third + 6, y, third, 40, "Dark",
                            bg=C["bgSecondary"], text_color=C["text"],
                            border_color=C["border"]))
    els.extend(small_button(PADDING + (third + 6) * 2, y, third, 40, "System",
                            bg=C["bgSecondary"], text_color=C["text"],
                            border_color=C["border"]))
    y += 56

    # Settings items
    els.extend(settings_row(PADDING, y, CONTENT_W, "Notifications"))
    y += 50
    els.extend(settings_row(PADDING, y, CONTENT_W, "Location"))
    y += 50
    els.extend(settings_row(PADDING, y, CONTENT_W, "Data & Backups"))
    y += 62

    # Developer section
    els.extend(section_label(PADDING, y, "Developer", font_size=17))
    y += 28
    els.extend(settings_row(PADDING, y, CONTENT_W, "Developer Mode",
                            has_toggle=True, has_chevron=False))
    y += 50
    els.extend(settings_row(PADDING, y, CONTENT_W, "Developer Tools"))
    y += 62

    # Version
    els.extend(tertiary_text(PADDING, y, "Version 1.1.144", w=CONTENT_W))

    save("22-settings.excalidraw", els)


def gen_notification_settings():
    els = []
    els.extend(phone_frame())
    els.extend(header_bar("Notifications", left_text="‹ Settings", large_title=False))
    y = HEADER_H + 8

    els.extend(app_card(PADDING, y, CONTENT_W, 40))
    els.extend(body_text(PADDING + 16, y + 10, "Permission: Granted",
                         font_size=15, color=C["success"]))
    y += 52

    els.extend(section_label(PADDING, y, "Daily Check-in", font_size=17))
    y += 28
    els.extend(settings_row(PADDING, y, CONTENT_W, "Enable Daily Check-in",
                            has_toggle=True, has_chevron=False))
    y += 50
    els.extend(settings_row(PADDING, y, CONTENT_W, "Check-in Time",
                            value_text="8:00 PM", has_chevron=False))
    y += 62

    els.extend(section_label(PADDING, y, "Medication Reminders", font_size=17))
    y += 28
    els.extend(settings_row(PADDING, y, CONTENT_W, "Medication Reminders",
                            has_toggle=True, has_chevron=False))
    y += 50
    els.extend(settings_row(PADDING, y, CONTENT_W, "Follow-up Reminders",
                            has_toggle=True, has_chevron=False))

    save("23-notification-settings.excalidraw", els)


def gen_location_settings():
    els = []
    els.extend(phone_frame())
    els.extend(header_bar("Location", left_text="‹ Settings", large_title=False))
    y = HEADER_H + 24

    els.extend(app_card(PADDING, y, CONTENT_W, 40))
    els.extend(body_text(PADDING + 16, y + 10, "Permission: When In Use",
                         font_size=15, color=C["success"]))
    y += 56

    els.extend(body_text(PADDING, y,
                         "Location is used to automatically\ncapture weather and barometric\npressure data when you log\nan episode.",
                         font_size=16))
    y += 96

    els.extend(primary_button(PADDING, y, CONTENT_W, 48, "Update Permission"))

    save("24-location-settings.excalidraw", els)


def gen_data_settings():
    els = []
    els.extend(phone_frame())
    els.extend(header_bar("Data & Backups", left_text="‹ Settings", large_title=False))
    y = HEADER_H + 8

    els.extend(section_label(PADDING, y, "Backups", font_size=17))
    y += 28
    els.extend(primary_button(PADDING, y, CONTENT_W, 48, "Create Backup"))
    y += 56

    backups = [
        ("Mar 20, 2026 8:00 PM", "2.1 MB"),
        ("Mar 15, 2026 8:00 PM", "1.9 MB"),
        ("Mar 10, 2026 8:00 PM", "1.8 MB"),
    ]
    for date, size in backups:
        els.extend(body_text(PADDING + 16, y + 6, date, font_size=15, w=200))
        els.extend(secondary_text(PADDING + 220, y + 8, size, font_size=13, w=40))
        els.append(make_element("text", PADDING + CONTENT_W - 64, y + 8, 48, 16,
                                text="Restore", fontSize=14,
                                strokeColor=C["primary"], textAlign="right"))
        els.extend(divider_line(PADDING + 16, y + 40, CONTENT_W - 16))
        y += 44

    y += 16
    els.extend(section_label(PADDING, y, "Export", font_size=17))
    y += 28
    els.extend(secondary_button(PADDING, y, CONTENT_W, 48, "Export Data as JSON"))

    save("25-data-settings.excalidraw", els)


def gen_developer_tools():
    els = []
    els.extend(phone_frame())
    els.extend(header_bar("Developer Tools", left_text="‹ Settings", large_title=False))
    y = HEADER_H + 8

    sections = [
        ("Logger", [("Log Level", "DEBUG"), ("Log Count", "142")]),
        ("Database", [("Health", "OK")]),
        ("Navigation", [("View Logs", None), ("View Errors", None),
                        ("View Performance", None), ("View Notifications", None)]),
    ]
    for sec_name, items in sections:
        els.extend(section_label(PADDING, y, sec_name, font_size=17))
        y += 28
        for label, val in items:
            els.extend(settings_row(PADDING, y, CONTENT_W, label,
                                    value_text=val, has_chevron=(val is None)))
            y += 50
        y += 8

    els.extend(section_label(PADDING, y, "Actions", font_size=17))
    y += 28
    actions = ["Reset Database", "Reset with Fixtures",
               "Test Notification", "Generate Debug Archive"]
    for action in actions:
        els.extend(secondary_button(PADDING, y, CONTENT_W, 40, action))
        y += 48

    save("26-developer-tools.excalidraw", els)


def gen_daily_status():
    els = []
    els.extend(phone_frame())
    els.extend(header_bar("Daily Status", right_icon="✕", large_title=False))
    y = HEADER_H + 12

    # Date
    els.extend(section_label(PADDING, y, "Date", font_size=17))
    y += 28
    els.extend(text_input(PADDING, y, CONTENT_W, 44, "March 21, 2026"))
    y += 56

    # Yellow Day Type
    els.extend(section_label(PADDING, y, "Yellow Day Type", font_size=17))
    y += 28
    types = ["Prodrome", "Postdrome", "Migraine Anxiety"]
    type_els, type_h = chip_row(PADDING, y, types, selected=["Prodrome"])
    els.extend(type_els)
    y += type_h + 8

    # Active Episodes
    els.extend(section_label(PADDING, y, "Active Episodes", font_size=17))
    y += 28
    els.extend(app_card(PADDING, y, CONTENT_W, 40))
    els.extend(secondary_text(PADDING + 16, y + 10, "No active episodes today"))
    y += 52

    # Active Overlays
    els.extend(section_label(PADDING, y, "Active Overlays", font_size=17))
    y += 28
    els.extend(app_card(PADDING, y, CONTENT_W, 56))
    els.extend(body_text(PADDING + 16, y + 10, "Weather: High pressure", font_size=15))
    els.extend(secondary_text(PADDING + 16, y + 30, "Mar 19 – Mar 22"))
    y += 68

    # Notes
    els.extend(section_label(PADDING, y, "Notes", font_size=17))
    y += 28
    els.extend(text_input(PADDING, y, CONTENT_W, 80, "Add a note..."))
    y += 96

    els.extend(primary_button(PADDING, y, CONTENT_W, 48, "Save"))

    save("27-daily-status.excalidraw", els)


def gen_error_logs():
    els = []
    els.extend(phone_frame())
    els.extend(header_bar("Error Logs", left_text="‹ Back", right_icon="Clear",
                          large_title=False))
    y = HEADER_H + 8

    errors = [
        ("ERROR", C["danger"], "Failed to sync backup", "Mar 21 10:30 AM"),
        ("ERROR", C["danger"], "Network timeout on weather API", "Mar 20 3:15 PM"),
        ("WARN", C["warning"], "Notification permission denied", "Mar 19 8:00 AM"),
        ("ERROR", C["danger"], "Database migration v12 failed", "Mar 18 2:00 PM"),
    ]
    for level, color, msg, time in errors:
        # Level badge
        badge_w = 52 if level == "ERROR" else 44
        els.extend(small_button(PADDING + 4, y + 6, badge_w, 20, level,
                                bg=color, text_color="#FFFFFF"))
        els.extend(body_text(PADDING + badge_w + 12, y + 4, msg, font_size=14, w=CONTENT_W - badge_w - 16))
        els.extend(tertiary_text(PADDING + badge_w + 12, y + 24, time, w=160))
        els.extend(divider_line(PADDING, y + 46, CONTENT_W))
        y += 50

    save("28-error-logs.excalidraw", els)


def gen_log_viewer():
    els = []
    els.extend(phone_frame())
    els.extend(header_bar("Logs", left_text="‹ Back", large_title=False))
    y = HEADER_H + 8

    # Filter tabs
    levels = ["DEBUG", "INFO", "WARN", "ERROR"]
    btn_w = CONTENT_W // len(levels) - 4
    for i, level in enumerate(levels):
        els.extend(small_button(PADDING + i * (btn_w + 5), y, btn_w, 32, level,
                                bg=C["primary"] if i == 0 else C["bgSecondary"],
                                text_color=C["primaryText"] if i == 0 else C["text"],
                                border_color=C["primary"] if i == 0 else C["border"]))
    y += 40

    els.extend(text_input(PADDING, y, CONTENT_W, 36, "Search logs..."))
    y += 44

    logs = [
        ("DEBUG", "10:30:01", "EpisodeStore.load()"),
        ("INFO", "10:30:00", "App initialized"),
        ("DEBUG", "10:29:59", "Database connected"),
        ("INFO", "10:29:58", "Loading preferences"),
        ("DEBUG", "10:29:57", "Cache cleared"),
        ("WARN", "10:29:55", "Slow query: 450ms"),
    ]
    level_colors = {"DEBUG": C["textSecondary"], "INFO": C["primary"],
                    "WARN": C["warning"], "ERROR": C["danger"]}
    for level, time, msg in logs:
        color = level_colors.get(level, C["textSecondary"])
        els.extend(small_button(PADDING + 4, y + 4, 48, 18, level,
                                bg=color, text_color="#FFFFFF"))
        els.extend(tertiary_text(PADDING + 58, y + 6, time, w=60))
        els.extend(body_text(PADDING + 122, y + 4, msg, font_size=13, w=CONTENT_W - 126))
        els.extend(divider_line(PADDING, y + 28, CONTENT_W))
        y += 32

    save("29-log-viewer.excalidraw", els)


def gen_performance():
    els = []
    els.extend(phone_frame())
    els.extend(header_bar("Performance", left_text="‹ Back", right_icon="↻",
                          large_title=False))
    y = HEADER_H + 12

    # Stats grid
    stats = [("1.2s", "App Start"), ("48 MB", "Memory"),
             ("60 fps", "Frame Rate"), ("12 avg", "DB Queries")]
    half = CONTENT_W // 2 - 6
    for i, (val, label) in enumerate(stats):
        cx = PADDING + (i % 2) * (half + 12)
        cy = y + (i // 2) * 76
        els.extend(app_card(cx, cy, half, 68))
        els.append(make_element("text", cx + 16, cy + 12, half - 32, 28,
                                text=val, fontSize=28, textAlign="center",
                                strokeColor=C["primary"]))
        els.extend(secondary_text(cx + 16, cy + 44, label, w=half - 32))
    y += 160

    # Screen load times
    els.extend(section_label(PADDING, y, "Screen Load Times", font_size=17))
    y += 28
    screens = [("Dashboard", "120ms"), ("Episodes", "85ms"),
               ("Analytics", "340ms"), ("Settings", "45ms")]
    for name, time in screens:
        els.extend(body_text(PADDING + 16, y + 6, name, font_size=15, w=200))
        els.append(make_element("text", PADDING + CONTENT_W - 70, y + 8, 54, 16,
                                text=time, fontSize=14, textAlign="right",
                                strokeColor=C["textSecondary"]))
        els.extend(divider_line(PADDING + 16, y + 36, CONTENT_W - 16))
        y += 40

    y += 12
    els.extend(settings_row(PADDING, y, CONTENT_W, "Auto-refresh",
                            has_toggle=True, has_chevron=False))
    y += 60
    half = CONTENT_W // 2 - 6
    els.extend(secondary_button(PADDING, y, half, 44, "Clear Data"))
    els.extend(secondary_button(PADDING + half + 12, y, half, 44, "Export"))

    save("30-performance.excalidraw", els)


def gen_scheduled_notifications():
    els = []
    els.extend(phone_frame())
    els.extend(header_bar("Notifications", left_text="‹ Back", large_title=False))
    y = HEADER_H + 8

    # Summary card
    els.extend(app_card(PADDING, y, CONTENT_W, 44))
    els.extend(body_text(PADDING + 16, y + 12, "OS: 12  |  DB: 12  |  Missing: 0",
                         font_size=14, color=C["textSecondary"]))
    y += 52

    # Filter tabs
    filters = ["All", "Reminder", "Follow-up", "Check-in"]
    btn_w = CONTENT_W // len(filters) - 4
    for i, f in enumerate(filters):
        els.extend(small_button(PADDING + i * (btn_w + 5), y, btn_w, 32, f,
                                bg=C["primary"] if i == 0 else C["bgSecondary"],
                                text_color=C["primaryText"] if i == 0 else C["text"],
                                border_color=C["primary"] if i == 0 else C["border"]))
    y += 40

    els.extend(text_input(PADDING, y, CONTENT_W, 36, "Search..."))
    y += 44

    notifs = [
        ("Reminder", "Topiramate 50mg", "Today 8:00 PM", "in 10h"),
        ("Reminder", "Magnesium 400mg", "Tomorrow 8:00 AM", "in 22h"),
        ("Check-in", "Daily Check-in", "Today 8:00 PM", "in 10h"),
        ("Follow-up", "Episode follow-up", "Today 2:00 PM", "in 4h"),
    ]
    for ntype, target, time, until in notifs:
        type_color = C["primary"] if ntype == "Reminder" else (
            C["warning"] if ntype == "Follow-up" else C["success"])
        els.extend(small_button(PADDING + 4, y + 4, len(ntype) * 7 + 12, 18, ntype,
                                bg=type_color, text_color="#FFFFFF"))
        els.extend(body_text(PADDING + 4, y + 26, target, font_size=14, w=CONTENT_W - 60))
        els.extend(tertiary_text(PADDING + 4, y + 44, time, w=CONTENT_W - 60))
        els.append(make_element("text", PADDING + CONTENT_W - 50, y + 26, 46, 16,
                                text=until, fontSize=12, textAlign="right",
                                strokeColor=C["textTertiary"]))
        els.extend(divider_line(PADDING, y + 64, CONTENT_W))
        y += 68

    save("31-scheduled-notifications.excalidraw", els)


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    print("Generating Excalidraw wireframes (high-fidelity)...")
    print()

    print("Main Tabs:")
    gen_dashboard()
    gen_episodes_list()
    gen_analytics()
    gen_medications_list()

    print("\nEpisode Screens:")
    gen_new_episode()
    gen_episode_detail()
    gen_log_update()
    gen_edit_intensity()
    gen_edit_symptoms()
    gen_edit_pain_location()
    gen_edit_note()

    print("\nMedication Screens:")
    gen_medication_detail()
    gen_add_medication()
    gen_log_medication()
    gen_medication_log()
    gen_edit_dose()
    gen_archived_medications()

    print("\nOnboarding:")
    gen_welcome_step1()
    gen_welcome_step2()
    gen_welcome_step3()
    gen_welcome_step4()

    print("\nSettings:")
    gen_settings()
    gen_notification_settings()
    gen_location_settings()
    gen_data_settings()
    gen_developer_tools()

    print("\nOther:")
    gen_daily_status()
    gen_error_logs()
    gen_log_viewer()
    gen_performance()
    gen_scheduled_notifications()

    print(f"\nDone!")
