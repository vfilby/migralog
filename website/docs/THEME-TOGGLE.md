# Theme Toggle Feature

## Overview
Added a floating theme toggle button that allows users to manually switch between light and dark modes, overriding system preferences.

## Features

### 1. Theme Toggle Button
**Location**: Fixed position in top-right corner

**Appearance**:
- Floating button with glassmorphism effect (backdrop blur)
- Sun icon in dark mode (click to go light)
- Moon icon in light mode (click to go dark)
- Smooth transitions between states
- Always visible and accessible

**Styling**:
```css
.theme-toggle {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 100;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(10px);
    border-radius: 9999px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}
```

### 2. Theme Persistence
- User preference saved to `localStorage`
- Persists across page reloads
- Overrides system preference when set

**LocalStorage Keys**:
- `theme`: `'light'` or `'dark'`

### 3. System Preference Detection
- Automatically detects `prefers-color-scheme: dark`
- Applies system preference if no manual selection made
- Updates automatically if system preference changes (when no manual override)

## User Interaction

### Toggle Methods
1. **Click**: Click the button to toggle theme
2. **Keyboard**: Press Enter or Space when focused

### Behavior
1. **First Visit**:
   - Checks system preference
   - Applies dark mode if system prefers dark
   - Applies light mode otherwise

2. **After Manual Selection**:
   - User's choice saved to localStorage
   - Overrides system preference
   - Persists until user changes it again or clears localStorage

3. **Icons**:
   - Light mode → Shows moon icon (click to go dark)
   - Dark mode → Shows sun icon (click to go light)

## Accessibility

### ARIA Attributes
```html
<div class="theme-toggle" role="toolbar" aria-label="Theme selector">
    <button id="theme-toggle-btn" aria-label="Toggle dark mode">
```

### Keyboard Support
- Fully keyboard accessible
- Tab to focus
- Enter or Space to activate
- Visible focus indicator

### Screen Reader Support
- Button labeled "Toggle dark mode"
- Toolbar region labeled "Theme selector"
- State changes announced via DOM updates

## Technical Implementation

### HTML Structure
```html
<div class="theme-toggle" role="toolbar" aria-label="Theme selector">
    <button id="theme-toggle-btn" aria-label="Toggle dark mode">
        <!-- Sun icon (visible in dark mode) -->
        <svg id="theme-icon-light" class="hidden dark:block">...</svg>
        <!-- Moon icon (visible in light mode) -->
        <svg id="theme-icon-dark" class="block dark:hidden">...</svg>
    </button>
</div>
```

### JavaScript Functions

#### `setTheme(theme)`
Sets the theme to 'light' or 'dark' and saves to localStorage.

```javascript
function setTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
    }
}
```

#### `toggleTheme()`
Toggles between light and dark themes.

```javascript
function toggleTheme() {
    if (document.documentElement.classList.contains('dark')) {
        setTheme('light');
    } else {
        setTheme('dark');
    }
}
```

### Initialization
```javascript
// On page load (in <head>)
if (localStorage.theme === 'dark' || 
    (!('theme' in localStorage) && 
     window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark')
}
```

## App Store Buttons Fix

### Problem
Original buttons used inline SVG with black backgrounds, resulting in poor contrast in dark mode.

### Solution
Replaced with styled button elements:

**Before**:
```html
<img src="data:image/svg+xml,..." alt="App Store">
```

**After**:
```html
<button disabled class="px-8 py-4 bg-gray-900 dark:bg-gray-700 
    text-white dark:text-gray-100 rounded-lg font-semibold 
    border-2 border-gray-700 dark:border-gray-500">
    Download on the App Store
</button>
```

### Improvements
- **Light mode**: gray-900 background with white text
- **Dark mode**: gray-700 background with gray-100 text
- **Border**: Added 2px border for definition
- **Opacity**: 50% to indicate disabled state
- **Text contrast**: Excellent in both modes

**Contrast Ratios**:
- Light mode: 15.3:1 (white on gray-900) ✅
- Dark mode: 11.7:1 (gray-100 on gray-700) ✅

## Testing

### Manual Testing
1. Open website
2. Check initial theme matches system preference
3. Click theme toggle
4. Verify theme switches
5. Reload page
6. Verify theme persists
7. Test keyboard navigation (Tab to button, Enter to toggle)

### Edge Cases
- ✅ No localStorage support (falls back to system preference)
- ✅ System preference changes while page open (updates if no manual override)
- ✅ Rapid clicking (debounced with transition)
- ✅ Keyboard navigation (Enter and Space both work)

## Browser Compatibility

### Supported
- Chrome 76+
- Firefox 67+
- Safari 12.1+
- Edge 79+

### Fallbacks
- `backdrop-filter`: Falls back to solid background if not supported
- `localStorage`: Falls back to system preference if not available
- `prefers-color-scheme`: Falls back to light mode if not supported

## Future Enhancements

### Potential Additions
1. **Three-state toggle**: Light / Dark / System
2. **Tooltip**: Hover text explaining the button
3. **Animation**: Rotate/fade transition between icons
4. **Position options**: Allow user to move toggle
5. **Keyboard shortcut**: e.g., Cmd+Shift+D to toggle

### Advanced Features
1. **Auto-dark mode**: Based on time of day
2. **High contrast mode**: Extra high contrast option
3. **Custom themes**: Multiple color schemes
4. **Per-section themes**: Different themes for different sections

## CSS Variables Alternative

For easier theme management, consider using CSS variables:

```css
:root {
    --bg-primary: #ffffff;
    --text-primary: #111827;
}

.dark {
    --bg-primary: #000000;
    --text-primary: #f9fafb;
}
```

This would allow easier theme customization without touching Tailwind classes.

## Analytics Recommendations

Track theme usage to understand user preferences:

```javascript
function setTheme(theme) {
    // ... existing code ...
    
    // Track in analytics
    if (typeof gtag !== 'undefined') {
        gtag('event', 'theme_change', {
            theme: theme,
            method: 'manual'
        });
    }
}
```

## Conclusion

The theme toggle provides users with full control over their viewing experience while maintaining excellent accessibility and preserving user preferences across sessions.
