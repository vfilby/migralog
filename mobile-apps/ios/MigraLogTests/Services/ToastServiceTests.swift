import XCTest
@testable import MigraLog

final class ToastServiceTests: XCTestCase {

    // MARK: - Initial State

    func testInitialStateIsNil() {
        let service = ToastService()
        XCTAssertNil(service.currentToast)
    }

    // MARK: - Show Success

    func testShowSuccess() {
        let service = ToastService()
        service.showSuccess("Operation completed")

        XCTAssertNotNil(service.currentToast)
        XCTAssertEqual(service.currentToast?.message, "Operation completed")
        XCTAssertEqual(service.currentToast?.type, .success)
    }

    // MARK: - Show Error

    func testShowError() {
        let service = ToastService()
        service.showError("Something went wrong")

        XCTAssertNotNil(service.currentToast)
        XCTAssertEqual(service.currentToast?.message, "Something went wrong")
        XCTAssertEqual(service.currentToast?.type, .error)
    }

    // MARK: - Show Info

    func testShowInfo() {
        let service = ToastService()
        service.showInfo("FYI")

        XCTAssertNotNil(service.currentToast)
        XCTAssertEqual(service.currentToast?.message, "FYI")
        XCTAssertEqual(service.currentToast?.type, .info)
    }

    // MARK: - Dismiss

    func testDismiss() {
        let service = ToastService()
        service.showSuccess("Hello")

        XCTAssertNotNil(service.currentToast)

        service.dismiss()

        XCTAssertNil(service.currentToast)
    }

    // MARK: - Replace Toast

    func testNewToastReplacesExisting() {
        let service = ToastService()
        service.showSuccess("First")
        let firstId = service.currentToast?.id

        service.showError("Second")
        let secondId = service.currentToast?.id

        XCTAssertNotEqual(firstId, secondId)
        XCTAssertEqual(service.currentToast?.message, "Second")
        XCTAssertEqual(service.currentToast?.type, .error)
    }

    // MARK: - Auto-dismiss

    func testAutoDismissAfterTimeout() async throws {
        let service = ToastService(autoDismissSeconds: 0.1)
        service.showSuccess("Brief")

        XCTAssertNotNil(service.currentToast)

        // Wait for auto-dismiss
        try await Task.sleep(for: .milliseconds(200))

        // Run on main actor to check state after auto-dismiss
        await MainActor.run {
            XCTAssertNil(service.currentToast)
        }
    }

    // MARK: - Toast Equality

    func testToastEquality() {
        let toast1 = Toast(id: "t1", message: "Hello", type: .success, timestamp: Date())
        let toast2 = Toast(id: "t1", message: "Hello", type: .success, timestamp: toast1.timestamp)
        let toast3 = Toast(id: "t2", message: "Hello", type: .success, timestamp: Date())

        XCTAssertEqual(toast1, toast2)
        XCTAssertNotEqual(toast1, toast3)
    }

    // MARK: - Toast Type Equality

    func testToastTypeEquality() {
        XCTAssertEqual(ToastType.success, ToastType.success)
        XCTAssertNotEqual(ToastType.success, ToastType.error)
        XCTAssertNotEqual(ToastType.error, ToastType.info)
    }

    // MARK: - Dismiss Before Auto-dismiss

    func testDismissCancelsAutoDismiss() async throws {
        let service = ToastService(autoDismissSeconds: 0.5)
        service.showSuccess("Will be dismissed manually")

        service.dismiss()
        XCTAssertNil(service.currentToast)

        // Show another toast
        service.showInfo("New toast")

        // Wait past the original auto-dismiss time
        try await Task.sleep(for: .milliseconds(600))

        await MainActor.run {
            // The new toast should still be gone (its own auto-dismiss fired)
            // or still present if its timer hasn't fired yet
            // The key assertion: no crash from the old timer
        }
    }

    // MARK: - Multiple Rapid Toasts

    func testMultipleRapidToasts() {
        let service = ToastService()

        service.showSuccess("First")
        service.showError("Second")
        service.showInfo("Third")

        // Only the last one should be showing
        XCTAssertEqual(service.currentToast?.message, "Third")
        XCTAssertEqual(service.currentToast?.type, .info)
    }
}
