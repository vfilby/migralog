# Features

## Implemented Features

### Episode Tracking

Track migraine episodes with detailed information:

- Start/end times with duration calculation
- Real-time intensity tracking (0-10 scale)
- Timestamped notes during episodes
- GPS location of episode onset
- Multi-day episode support

**Screens**: `NewEpisodeScreen`, `EpisodeDetailScreen`, `EpisodesScreen`

### Medication Management

Comprehensive medication tracking:

- Medication catalog (preventative and rescue)
- Dosage logging with timestamps
- Medication schedules and reminders
- Local notifications for scheduled medications
- Medication history and effectiveness tracking

**Screens**: `AddMedicationScreen`, `LogMedicationScreen`, `MedicationsScreen`

### Daily Status Tracking (Red/Yellow/Green Days)

Track daily well-being beyond just episodes:

- **Green Days**: Clear, no symptoms
- **Yellow Days**: Not clear (prodrome, postdrome, anxiety)
- **Red Days**: Active episode (auto-logged)

Features:
- Monthly calendar view on Dashboard
- Manual daily status logging
- Auto-red day creation when episodes start
- Pattern analysis over time

**Screens**: `DailyStatusPromptScreen`, `DashboardScreen` (calendar view)

**Documentation**: See [Daily Status Tracking Plan](../features/daily-status-tracking.md)

### Analytics

View patterns and trends:

- Episode frequency statistics
- Intensity trends
- Medication usage tracking
- Day status distribution

**Screen**: `AnalyticsScreen`

### Data Management

Robust backup and recovery system:

- Manual backup creation
- Automatic backups before migrations
- Restore from backup
- Export/import via file sharing
- Automatic cleanup of old backups

**Service**: `backupService.ts`
**Screen**: `SettingsScreen`

### Theme Support

Full light and dark mode support:

- Three modes: light, dark, system
- Theme preference persists across sessions
- All UI components support both modes
- Smooth transitions between themes

**Implementation**: `src/theme/`

### Location Tracking

GPS location capture for episode onset:

- Automatic location capture when starting episode
- Permission handling
- Map display on episode detail
- Accuracy tracking

**Service**: `locationService.ts`

## Planned Features

### Enhanced Analytics

- 3-6 month moving averages
- Correlation analysis (weather, medication, triggers)
- Pattern detection and insights
- Exportable reports (PDF, CSV)

### Notification Enhancements

- Daily status check-in prompts
- Customizable notification times
- Notification action buttons
- Smart reminders based on patterns

### Data Sync & Cloud Backup

- HIPAA-compliant cloud storage
- Multi-device sync
- Encrypted data at rest and in transit
- Automatic backup scheduling

### Customization

- Custom symptom and trigger lists
- Configurable pain scales
- Custom day status types
- Personalized insights

### Advanced Features

- ML-based episode predictions
- Weather correlation tracking
- Sleep tracking integration
- Healthcare provider report generation

## Feature Requests

Have an idea for a new feature? [Submit an issue](https://github.com/vfilby/MigraineTracker/issues/new) with the "enhancement" label.

## Feature Documentation

Detailed planning documents for features:

- [Daily Status Tracking](../features/daily-status-tracking.md)
- More feature docs coming soon...
