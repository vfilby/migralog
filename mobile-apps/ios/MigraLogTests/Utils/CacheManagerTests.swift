import XCTest
@testable import MigraLog

final class CacheManagerTests: XCTestCase {
    private var cache: CacheManager!

    override func setUp() {
        super.setUp()
        cache = CacheManager()
    }

    override func tearDown() {
        cache.clearAll()
        cache = nil
        super.tearDown()
    }

    // MARK: - Get/Set

    func testSetAndGetValue() {
        cache.set("key1", value: "hello", ttl: 60)
        let result: String? = cache.get("key1")
        XCTAssertEqual(result, "hello")
    }

    func testGetNonExistentKey() {
        let result: String? = cache.get("nonexistent")
        XCTAssertNil(result)
    }

    func testSetOverwritesPrevious() {
        cache.set("key1", value: "first", ttl: 60)
        cache.set("key1", value: "second", ttl: 60)
        let result: String? = cache.get("key1")
        XCTAssertEqual(result, "second")
    }

    func testGetDifferentTypes() {
        cache.set("int_key", value: 42, ttl: 60)
        cache.set("string_key", value: "text", ttl: 60)
        cache.set("array_key", value: [1, 2, 3], ttl: 60)

        let intResult: Int? = cache.get("int_key")
        let stringResult: String? = cache.get("string_key")
        let arrayResult: [Int]? = cache.get("array_key")

        XCTAssertEqual(intResult, 42)
        XCTAssertEqual(stringResult, "text")
        XCTAssertEqual(arrayResult, [1, 2, 3])
    }

    func testGetWrongTypeReturnsNil() {
        cache.set("key1", value: 42, ttl: 60)
        let result: String? = cache.get("key1")
        XCTAssertNil(result)
    }

    // MARK: - TTL Expiration

    func testExpiredEntryReturnsNil() {
        cache.set("key1", value: "expired", ttl: 0.001)
        // Wait for expiration
        Thread.sleep(forTimeInterval: 0.01)
        let result: String? = cache.get("key1")
        XCTAssertNil(result)
    }

    func testNonExpiredEntryReturnsValue() {
        cache.set("key1", value: "still valid", ttl: 60)
        let result: String? = cache.get("key1")
        XCTAssertEqual(result, "still valid")
    }

    // MARK: - Invalidate

    func testInvalidateKey() {
        cache.set("key1", value: "value1", ttl: 60)
        cache.set("key2", value: "value2", ttl: 60)

        cache.invalidate("key1")

        let result1: String? = cache.get("key1")
        let result2: String? = cache.get("key2")
        XCTAssertNil(result1)
        XCTAssertEqual(result2, "value2")
    }

    func testInvalidateNonExistentKeyNoError() {
        // Should not crash
        cache.invalidate("nonexistent")
    }

    // MARK: - Invalidate by Pattern

    func testInvalidateByPattern() {
        cache.set("analytics_7", value: "data7", ttl: 60)
        cache.set("analytics_30", value: "data30", ttl: 60)
        cache.set("episodes_list", value: "episodes", ttl: 60)

        cache.invalidateByPattern("analytics_")

        let result1: String? = cache.get("analytics_7")
        let result2: String? = cache.get("analytics_30")
        let result3: String? = cache.get("episodes_list")

        XCTAssertNil(result1)
        XCTAssertNil(result2)
        XCTAssertEqual(result3, "episodes")
    }

    func testInvalidateByPatternNoMatch() {
        cache.set("key1", value: "value1", ttl: 60)
        cache.invalidateByPattern("nonexistent_")
        let result: String? = cache.get("key1")
        XCTAssertEqual(result, "value1")
    }

    // MARK: - Clear All

    func testClearAll() {
        cache.set("key1", value: "value1", ttl: 60)
        cache.set("key2", value: "value2", ttl: 60)
        cache.set("key3", value: "value3", ttl: 60)

        cache.clearAll()

        let result1: String? = cache.get("key1")
        let result2: String? = cache.get("key2")
        let result3: String? = cache.get("key3")

        XCTAssertNil(result1)
        XCTAssertNil(result2)
        XCTAssertNil(result3)
    }

    func testClearAllEmptyCache() {
        // Should not crash
        cache.clearAll()
    }

    // MARK: - Thread Safety

    func testConcurrentAccess() {
        let expectation = self.expectation(description: "Concurrent access")
        expectation.expectedFulfillmentCount = 20

        for i in 0..<10 {
            DispatchQueue.global().async {
                self.cache.set("key_\(i)", value: i, ttl: 60)
                expectation.fulfill()
            }
            DispatchQueue.global().async {
                let _: Int? = self.cache.get("key_\(i)")
                expectation.fulfill()
            }
        }

        wait(for: [expectation], timeout: 5.0)
    }
}
