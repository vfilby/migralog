import Foundation
import Observation

@Observable
final class OverlayViewModel {
    // MARK: - State

    var overlays: [CalendarOverlay] = []
    var isLoading = false
    var error: String?

    // MARK: - Dependencies

    private let overlayRepository: CalendarOverlayRepositoryProtocol

    // MARK: - Init

    init(overlayRepository: CalendarOverlayRepositoryProtocol = OverlayRepository(dbManager: DatabaseManager.shared)) {
        self.overlayRepository = overlayRepository
    }

    // MARK: - Actions

    @MainActor
    func loadOverlays() async {
        isLoading = true
        error = nil
        do {
            overlays = try await overlayRepository.getAllOverlays()
            isLoading = false
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "OverlayViewModel"])
            self.error = error.localizedDescription
            isLoading = false
        }
    }

    @MainActor
    func createOverlay(
        startDate: String,
        endDate: String? = nil,
        label: String,
        notes: String? = nil,
        excludeFromStats: Bool = false
    ) async {
        let now = TimestampHelper.now
        let overlay = CalendarOverlay(
            id: UUID().uuidString,
            startDate: startDate,
            endDate: endDate,
            label: label,
            notes: notes,
            excludeFromStats: excludeFromStats,
            createdAt: now,
            updatedAt: now
        )
        do {
            let saved = try await overlayRepository.createOverlay(overlay)
            overlays.append(saved)
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "OverlayViewModel"])
            self.error = error.localizedDescription
        }
    }

    @MainActor
    func updateOverlay(_ overlay: CalendarOverlay) async {
        do {
            try await overlayRepository.updateOverlay(overlay)
            if let index = overlays.firstIndex(where: { $0.id == overlay.id }) {
                overlays[index] = overlay
            }
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "OverlayViewModel"])
            self.error = error.localizedDescription
        }
    }

    @MainActor
    func deleteOverlay(_ id: String) async {
        do {
            try await overlayRepository.deleteOverlay(id)
            overlays.removeAll { $0.id == id }
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "OverlayViewModel"])
            self.error = error.localizedDescription
        }
    }
}
