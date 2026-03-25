import SwiftUI

struct WelcomeScreen: View {
    @Environment(AppState.self) private var appState
    @State private var currentStep = 0
    @State private var notificationGranted = false
    @State private var locationGranted = false

    private let totalSteps = 4

    var body: some View {
        VStack {
            // Progress
            HStack(spacing: 8) {
                ForEach(0..<totalSteps, id: \.self) { step in
                    RoundedRectangle(cornerRadius: 2)
                        .fill(step <= currentStep ? Color.accentColor : Color(.systemGray4))
                        .frame(height: 4)
                }
            }
            .padding(.horizontal)
            .padding(.top)

            TabView(selection: $currentStep) {
                // Step 1: Welcome
                WelcomeStepView()
                    .tag(0)

                // Step 2: Disclaimer
                DisclaimerStepView()
                    .tag(1)

                // Step 3: Notifications
                NotificationPermissionStepView(isGranted: $notificationGranted) {
                    currentStep = 3
                }
                .tag(2)

                // Step 4: Location
                LocationPermissionStepView(isGranted: $locationGranted) {
                    appState.completeOnboarding()
                }
                .tag(3)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .animation(.easeInOut, value: currentStep)

            // Continue button (for steps 0, 1)
            if currentStep < 2 {
                Button {
                    withAnimation { currentStep += 1 }
                } label: {
                    Text("Continue")
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.accentColor)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .padding(.horizontal)
                .padding(.bottom)
            }
        }
    }
}

// MARK: - Step Views

struct WelcomeStepView: View {
    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "brain.head.profile")
                .font(.system(size: 80))
                .foregroundStyle(Color.accentColor)

            Text("Welcome to MigraLog")
                .font(.largeTitle.weight(.bold))

            VStack(alignment: .leading, spacing: 16) {
                FeatureRow(icon: "bolt.heart", title: "Track Episodes", description: "Log migraine episodes with intensity, symptoms, and triggers")
                FeatureRow(icon: "pills", title: "Medication Tracking", description: "Track preventative and rescue medications")
                FeatureRow(icon: "chart.bar", title: "Insights", description: "Discover patterns and trends over time")
            }
            .padding(.horizontal)
            Spacer()
        }
    }
}

struct DisclaimerStepView: View {
    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "heart.text.square")
                .font(.system(size: 60))
                .foregroundStyle(.red)

            Text("Medical Disclaimer")
                .font(.title2.weight(.bold))

            Text("MigraLog is a personal tracking tool and is not a substitute for professional medical advice. Always consult your healthcare provider for medical decisions.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .padding(.horizontal)
            Spacer()
        }
    }
}

struct NotificationPermissionStepView: View {
    @Binding var isGranted: Bool
    let onContinue: () -> Void

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "bell.badge")
                .font(.system(size: 60))
                .foregroundStyle(.blue)

            Text("Notification Permissions")
                .font(.title2.weight(.bold))

            Text("Enable notifications for medication reminders and daily check-ins.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .padding(.horizontal)

            Button {
                Task {
                    let service = NotificationService.shared
                    isGranted = await service.requestPermission()
                    onContinue()
                }
            } label: {
                Text("Continue")
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.accentColor)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .padding(.horizontal)
            Spacer()
        }
    }
}

struct LocationPermissionStepView: View {
    @Binding var isGranted: Bool
    let onComplete: () -> Void

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "location")
                .font(.system(size: 60))
                .foregroundStyle(.green)

            Text("Location Services")
                .font(.title2.weight(.bold))

            Text("Location helps identify environmental triggers for your migraines.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .padding(.horizontal)

            Button {
                LocationService.shared.requestPermission()
                // Give time for permission dialog
                DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
                    isGranted = LocationService.shared.authorizationStatus == .authorizedWhenInUse
                    onComplete()
                }
            } label: {
                Text("Finish Setup")
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.accentColor)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .padding(.horizontal)
            Spacer()
        }
    }
}

// MARK: - Feature Row

struct FeatureRow: View {
    let icon: String
    let title: String
    let description: String

    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundStyle(Color.accentColor)
                .frame(width: 40)
            VStack(alignment: .leading) {
                Text(title)
                    .font(.headline)
                Text(description)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }
}
