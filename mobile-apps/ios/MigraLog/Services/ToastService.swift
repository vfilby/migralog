import Foundation

// MARK: - Toast Types

enum ToastType: Equatable, Sendable {
    case success
    case error
    case info
}

struct Toast: Equatable, Sendable {
    let id: String
    let message: String
    let type: ToastType
    let timestamp: Date

    init(
        id: String = UUID().uuidString,
        message: String,
        type: ToastType,
        timestamp: Date = Date()
    ) {
        self.id = id
        self.message = message
        self.type = type
        self.timestamp = timestamp
    }
}

// MARK: - Toast Service

@Observable
final class ToastService {
    var currentToast: Toast?

    private var dismissTask: Task<Void, Never>?
    private let autoDismissSeconds: TimeInterval

    init(autoDismissSeconds: TimeInterval = 3.0) {
        self.autoDismissSeconds = autoDismissSeconds
    }

    // MARK: - Show

    func showSuccess(_ message: String) {
        show(Toast(message: message, type: .success))
    }

    func showError(_ message: String) {
        show(Toast(message: message, type: .error))
    }

    func showInfo(_ message: String) {
        show(Toast(message: message, type: .info))
    }

    // MARK: - Dismiss

    func dismiss() {
        dismissTask?.cancel()
        dismissTask = nil
        currentToast = nil
    }

    // MARK: - Private

    private func show(_ toast: Toast) {
        // Cancel any pending dismiss
        dismissTask?.cancel()

        currentToast = toast

        // Schedule auto-dismiss
        dismissTask = Task { @MainActor [weak self] in
            guard let self = self else { return }
            try? await Task.sleep(for: .seconds(self.autoDismissSeconds))
            guard !Task.isCancelled else { return }
            // Only dismiss if the same toast is still showing
            if self.currentToast?.id == toast.id {
                self.currentToast = nil
            }
        }
    }
}
