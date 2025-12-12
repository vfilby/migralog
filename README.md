# MigraLog

**Take control of your pain.** MigraLog is a comprehensive mobile app designed to help you track, understand, and manage your chronic pain episodes. Whether you experience migraines, headaches, or other episodic pain conditions, MigraLog provides the tools you need to identify patterns, optimize treatment, and communicate effectively with your healthcare providers.

## Why MigraLog?

### 🎯 **Comprehensive Tracking**
Track every aspect of your pain episodes in one place:
- **Pain Episodes**: Record start and end times with custom timestamps
- **Intensity Levels**: Log pain intensity on a 0-10 scale
- **Symptoms**: Document associated symptoms (nausea, light sensitivity, dizziness, and more)
- **Triggers**: Identify what might be causing your episodes (stress, sleep, weather, diet)
- **Daily Status**: Mark your days as green (good), yellow (warning signs), or red (pain episode)

### 💊 **Medication Management**
Stay on top of your treatment plan:
- **Preventative Medications**: Schedule and track daily preventative medications
- **Rescue Medications**: Log when you take rescue medications during episodes
- **Dose Tracking**: Record exact doses and timing
- **Medication History**: View your complete medication history and effectiveness

### 📊 **Insights & Analytics**
Discover patterns and optimize your treatment:
- **Visual Calendar**: See your good days, warning days, and pain days at a glance
- **Episode Timeline**: View detailed timelines of your pain intensity and symptom changes
- **Trend Analysis**: Identify patterns in your episodes over time
- **Treatment Effectiveness**: Understand which medications and strategies work best

### 🔒 **Privacy First**
Your health data stays with you:
- **Offline-First**: All data stored locally on your device with SQLite
- **No Cloud Required**: Works completely offline (cloud sync coming soon)
- **HIPAA Considerations**: Built with healthcare data privacy in mind
- **Backup & Restore**: Export and import your data for safekeeping

## Features

### ✅ Available Now
- ✅ **Episode Tracking**: Start, end, and manage pain episodes with custom timestamps
- ✅ **Intensity Logging**: Track pain levels throughout episodes
- ✅ **Symptom Tracking**: Record symptoms during episodes
- ✅ **Medication Management**: Track preventative and rescue medications
- ✅ **Daily Status Tracking**: Mark each day's wellness status
- ✅ **Visual Calendar**: See your patterns at a glance
- ✅ **Analytics Dashboard**: View trends and insights
- ✅ **Offline Support**: Full functionality without internet connection
- ✅ **Backup & Restore**: Export and import your data

### ✅ Recent Additions  
- ✅ **Photo Attachments**: Add photos to medications for easy identification
- ✅ **Notifications**: Medication reminders and daily check-ins
- ✅ **Archived Medications**: Manage discontinued medications
- ✅ **Error Monitoring**: Integrated Sentry for app stability

### 🔜 Future Considerations
- 📱 **Live Activities** (iOS): Track episodes directly from your Lock Screen
- 🤖 **Pattern Recognition**: AI-powered insights and suggestions
- ☁️ **Weather Integration**: Track how weather affects your episodes
- 📄 **Report Generation**: Create professional reports for your healthcare provider

## Getting Started

### Installation

**iOS** (Primary Platform)  
- **TestFlight**: Currently available for beta testing ([App Store ID: 6753635113](https://apps.apple.com/app/id6753635113))
- **App Store**: Production release coming soon
- **Build from source**: See [DEVELOPMENT.md](DEVELOPMENT.md) for developer setup

**Android**  
- Under evaluation for future release
- Build from source available (see [DEVELOPMENT.md](DEVELOPMENT.md))

### Quick Start Guide

1. **Create Your First Episode**
   - Tap the "Start Episode" button on the home screen
   - Add symptoms and triggers as they occur
   - Log your pain intensity throughout the episode
   - End the episode when your pain resolves

2. **Track Your Medications**
   - Add your preventative medications in the Medications tab
   - Set up schedules for daily medications
   - Log rescue medications when you take them during episodes

3. **Monitor Your Patterns**
   - View the calendar in the Analytics tab to see your good and bad days
   - Review episode history to identify triggers and patterns
   - Use insights to adjust your treatment strategy

4. **Daily Status Tracking**
   - Each day, mark your status: green (good), yellow (warning signs), or red (episode)
   - Add notes about prodrome symptoms or triggers you notice
   - Build a complete picture of your pain patterns

## Support & Feedback

### Getting Help
- 📖 Check out our [User Guide](docs/user-guide.md) _(coming soon)_
- 💬 Open an issue on [GitHub](https://github.com/vfilby/migralog/issues)
- 📧 Contact: _(email coming soon)_

### Report a Bug
Found something that's not working right? [Open an issue](https://github.com/vfilby/migralog/issues) and we'll get it fixed.

### Feature Requests
Have an idea for making MigraLog better? We'd love to hear it! [Share your idea](https://github.com/vfilby/migralog/issues) and we'll consider it for future releases.

## Contributing

MigraLog is open source and welcomes contributions! Whether you're a developer, designer, or healthcare professional, there are many ways to help:

- 🐛 **Report Bugs**: Help us identify and fix issues
- 💡 **Suggest Features**: Share ideas for new functionality
- 💻 **Code Contributions**: Submit pull requests
- 📝 **Documentation**: Improve our guides and documentation
- 🌐 **Translations**: Help make MigraLog available in more languages

See [DEVELOPMENT.md](DEVELOPMENT.md) for developer setup instructions and [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## Developer Tools

### 🔧 iOS Simulator Files Access

If you're testing the app and need to access files saved to the iOS Files app in simulators:

```bash
# Access Files.app directory in iOS Simulator
npm run sim:files
```

This utility script:
- Lists all booted iOS simulators
- Finds the correct Files.app local storage path
- Shows contents including debug archives and exported files
- Opens the directory in Finder for easy access

Perfect for retrieving debug archives created by the comprehensive debugging feature in Developer Tools.

## About

MigraLog was created to help people with chronic pain conditions better understand and manage their health. The app is designed with input from pain management specialists and people who live with chronic pain.

**Built with:** React Native, Expo, TypeScript, SQLite

## License

MIT License - See [LICENSE](LICENSE) for details

---

**Disclaimer**: MigraLog is a tracking and management tool, not a medical diagnosis or treatment app. Always consult with healthcare professionals about your pain management strategy.
