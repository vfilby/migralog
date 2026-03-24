# Playwright Testing with Expo Web

## Overview
The app now supports running on web via Expo, which allows you to test with Playwright for browser automation and debugging.

## Running the App on Web

1. Start the Expo web server:
   ```bash
   cd app
   npm run web
   ```

2. The app will be available at `http://localhost:8081`

## Using Playwright

The app is accessible via the MCP Playwright tools built into Claude Code. You can:

- Take screenshots of the app
- Click buttons and interact with elements
- Fill forms
- Navigate between screens
- Inspect the DOM
- Test user flows

### Example Commands

```bash
# Take a screenshot
browser_take_screenshot

# Click the "Start Episode" button
browser_click element="Start Episode button" ref="..."

# Navigate to a URL
browser_navigate url="http://localhost:8081"

# Get page snapshot
browser_snapshot
```

## Limitations

Note that some features may have limited functionality on web:
- **SQLite Database**: expo-sqlite uses a web-compatible implementation on web (likely WebSQL or IndexedDB polyfill)
- **DateTimePicker**: May render differently on web vs native
- **Native features**: Camera, notifications, etc. won't work on web

## Debugging

- Open browser console at `http://localhost:8081` to see React logs
- Use Playwright to automate testing flows
- Check Metro bundler output for build errors

## Testing Workflows

You can now test complete user flows:
1. Starting a new episode
2. Logging pain intensity
3. Adding medications
4. Viewing episode details
5. Analytics and trends
