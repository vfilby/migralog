import XCTest
@testable import MigraLog

@MainActor
final class CategoryLimitsViewModelTests: XCTestCase {
    private var mockRepo: MockCategoryUsageLimitRepository!
    private var sut: CategoryLimitsViewModel!

    override func setUp() {
        super.setUp()
        mockRepo = MockCategoryUsageLimitRepository()
        sut = CategoryLimitsViewModel(repository: mockRepo)
    }

    override func tearDown() {
        sut = nil
        mockRepo = nil
        super.tearDown()
    }

    // MARK: - loadLimits

    func test_loadLimits_populatesLimitsMapKeyedByCategory() {
        let nsaid = CategoryUsageLimit(category: .nsaid, maxDays: 15, windowDays: 30)
        let triptan = CategoryUsageLimit(category: .triptan, maxDays: 10, windowDays: 30)
        mockRepo.limits = [.nsaid: nsaid, .triptan: triptan]

        sut.loadLimits()

        XCTAssertEqual(sut.limits[.nsaid], nsaid)
        XCTAssertEqual(sut.limits[.triptan], triptan)
        XCTAssertNil(sut.limits[.otc])
    }

    // MARK: - availableCategoriesForAdd

    func test_availableCategoriesForAdd_whenEmpty_returnsAllCategories() {
        sut.loadLimits()

        XCTAssertEqual(Set(sut.availableCategoriesForAdd), Set(MedicationCategory.allCases))
    }

    func test_availableCategoriesForAdd_excludesConfiguredCategories() {
        mockRepo.limits = [
            .nsaid: CategoryUsageLimit(category: .nsaid, maxDays: 15, windowDays: 30)
        ]
        sut.loadLimits()

        XCTAssertFalse(sut.availableCategoriesForAdd.contains(.nsaid))
        XCTAssertTrue(sut.availableCategoriesForAdd.contains(.triptan))
        XCTAssertEqual(sut.availableCategoriesForAdd.count, MedicationCategory.allCases.count - 1)
    }

    func test_availableCategoriesForAdd_preservesAllCasesOrder() {
        mockRepo.limits = [
            .triptan: CategoryUsageLimit(category: .triptan, maxDays: 10, windowDays: 30)
        ]
        sut.loadLimits()

        let expected = MedicationCategory.allCases.filter { $0 != .triptan }
        XCTAssertEqual(sut.availableCategoriesForAdd, expected)
    }

    // MARK: - canAddMoreLimits

    func test_canAddMoreLimits_whenEmpty_isTrue() {
        sut.loadLimits()
        XCTAssertTrue(sut.canAddMoreLimits)
    }

    func test_canAddMoreLimits_whenAllConfigured_isFalse() {
        var map: [MedicationCategory: CategoryUsageLimit] = [:]
        for c in MedicationCategory.allCases {
            map[c] = CategoryUsageLimit(category: c, maxDays: 1, windowDays: 1)
        }
        mockRepo.limits = map
        sut.loadLimits()

        XCTAssertFalse(sut.canAddMoreLimits)
    }

    // MARK: - saveLimit

    func test_saveLimit_addsToLimitsMap() {
        let limit = CategoryUsageLimit(category: .nsaid, maxDays: 15, windowDays: 30)
        sut.saveLimit(limit)

        XCTAssertEqual(sut.limits[.nsaid], limit)
        XCTAssertTrue(mockRepo.setLimitCalled)
    }

    // MARK: - clearLimit

    func test_clearLimit_removesFromLimitsMap() {
        mockRepo.limits = [
            .nsaid: CategoryUsageLimit(category: .nsaid, maxDays: 15, windowDays: 30)
        ]
        sut.loadLimits()
        XCTAssertNotNil(sut.limits[.nsaid])

        sut.clearLimit(.nsaid)

        XCTAssertNil(sut.limits[.nsaid])
        XCTAssertTrue(mockRepo.clearLimitCalled)
    }
}
