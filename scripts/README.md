# MigraineTracker Scripts

This directory contains utility scripts for the MigraineTracker project.

## 📱 iOS Simulator Files.app Utility

### `open-simulator-files.sh`

A utility script that helps you access files saved to the iOS Files app in simulators.

**Usage:**
```bash
# From the app directory
npm run sim:files

# Or directly
bash ../scripts/open-simulator-files.sh
```

**What it does:**
1. **Lists all booted iOS simulators** with their names and device IDs
2. **Prompts you to select a simulator** (auto-selects if only one is running)
3. **Finds the Files.app local storage path** using `xcrun simctl listapps`
4. **Shows directory contents** including debug archives and saved files
5. **Opens in Finder** (optional) or copies path to clipboard

**Why this is useful:**
- Debug archives saved via "Save to Files" in the app are stored here
- Much easier than manually navigating the complex simulator directory structure
- Works with any simulator and automatically finds the correct paths
- Perfect for retrieving debug archives for notification debugging

**Example output:**
```
📱 iOS Simulator Files.app Utility
Found booted simulators:

1) iPhone 17 Pro Max 
   ID: F01B3E01-E484-4FED-9797-9496AF2EB629

✅ Selected: iPhone 17 Pro Max
✅ Files.app Local Storage found:
/Users/vfilby/Library/Developer/CoreSimulator/Devices/.../File Provider Storage

Contents:
debug_archive_2025-12-12_08-13-51.zip
debug_archive_2025-12-12_15-32-20.zip
migralog_export_2025-11-30.json
```

**Key paths found:**
- **Main directory:** App group container for `group.com.apple.FileProvider.LocalStorage`
- **File storage:** `File Provider Storage/` subdirectory contains saved files
- **Debug archives:** ZIP files created by the debug archive feature
- **App exports:** JSON exports and database backups

This utility solves the challenge of finding files saved to the iOS Files app in simulators, making it easy to retrieve debug archives and other app exports.