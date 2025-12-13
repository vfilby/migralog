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

### `unpack-debug-archive.sh`

A utility script that unpacks debug archives and restores databases to iOS simulators for investigation.

**Usage:**
```bash
# From the app directory
npm run sim:unpack

# Or directly with archive path
bash ../scripts/unpack-debug-archive.sh /path/to/debug_archive.zip

# Or directly (will prompt for archive path)
bash ../scripts/unpack-debug-archive.sh
```

**What it does:**
1. **Extracts debug archive** and validates structure
2. **Lists all booted iOS simulators** for selection
3. **Finds MigraineTracker app directory** automatically
4. **Backs up current database** before restoration
5. **Restores database snapshot** from the archive
6. **Provides debug files** for manual inspection

**Features:**
- **Safe restoration** with automatic backup of current database
- **Multi-simulator support** with selection prompt
- **Database validation** ensures archive contains usable data
- **Comprehensive error handling** with clear feedback
- **Debug file access** for logs, notifications, and mappings analysis

**Why this is essential:**
- **Reproduce issues** by restoring exact database state when problem occurred
- **Investigate notification problems** with complete context restoration
- **Time-travel debugging** - restore app to problematic state
- **Complete workflow** - pack issue state, unpack for investigation

**Example workflow:**
```
1. Issue occurs → Generate debug archive
2. Archive contains: database snapshot + logs + notification state
3. Later: Unpack archive → Restore database → Investigate in simulator
4. App now has exact same state as when issue occurred
```

**Archive contents restored:**
- **SQLite database**: Complete application state
- **Debug files**: Logs, notifications, mappings for analysis  
- **Metadata**: Environment info from when issue occurred

This transforms debug archives from static data into actionable investigation tools by making the database state reproducible.