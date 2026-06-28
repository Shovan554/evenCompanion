import XCTest
@testable import EvenReminderCore

// MARK: - FakeRemindersStore (in-memory, for testing)

final class FakeRemindersStore: RemindersProviding, @unchecked Sendable {
    private var items: [Reminder]
    private var completedIDs: Set<String> = []

    init(items: [Reminder] = []) {
        self.items = items
    }

    func requestAccess() async -> Bool { true }

    func upcoming(limit: Int) async -> [Reminder] {
        let active = items.filter { !completedIDs.contains($0.id) }
        // Sort: non-nil due ascending, nil due last
        let sorted = active.sorted { a, b in
            switch (a.due, b.due) {
            case let (da?, db?): return da < db
            case (nil, _?): return false
            case (_?, nil): return true
            case (nil, nil): return false
            }
        }
        return Array(sorted.prefix(limit))
    }

    func complete(id: String) async {
        completedIDs.insert(id)
    }
}

// MARK: - isOverdue tests

final class IsOverdueTests: XCTestCase {

    func testIsOverdue_nilDue_returnsFalse() {
        XCTAssertFalse(isOverdue(due: nil, now: 1_000_000))
    }

    func testIsOverdue_dueLessThanNow_returnsTrue() {
        XCTAssertTrue(isOverdue(due: 999_999, now: 1_000_000))
    }

    func testIsOverdue_dueEqualNow_returnsFalse() {
        // due == now means not yet overdue (strict less-than)
        XCTAssertFalse(isOverdue(due: 1_000_000, now: 1_000_000))
    }

    func testIsOverdue_dueGreaterThanNow_returnsFalse() {
        XCTAssertFalse(isOverdue(due: 1_000_001, now: 1_000_000))
    }
}

// MARK: - FakeRemindersStore tests

final class FakeRemindersStoreTests: XCTestCase {

    func testComplete_marksItemSoItNoLongerAppearsInUpcoming() async {
        let store = FakeRemindersStore(items: [
            Reminder(id: "a", title: "Task A", due: nil, overdue: false),
            Reminder(id: "b", title: "Task B", due: nil, overdue: false),
        ])
        await store.complete(id: "a")
        let upcoming = await store.upcoming(limit: 10)
        XCTAssertEqual(upcoming.count, 1)
        XCTAssertEqual(upcoming[0].id, "b")
    }

    func testUpcoming_respectsLimit() async {
        let items = (1...5).map { i in
            Reminder(id: "\(i)", title: "Task \(i)", due: 1_000_000 + i, overdue: false)
        }
        let store = FakeRemindersStore(items: items)
        let upcoming = await store.upcoming(limit: 3)
        XCTAssertEqual(upcoming.count, 3)
    }

    func testUpcoming_sortsByDueAscendingNilLast() async {
        let store = FakeRemindersStore(items: [
            Reminder(id: "c", title: "No Due",     due: nil,       overdue: false),
            Reminder(id: "b", title: "Far Future",  due: 2_000_000, overdue: false),
            Reminder(id: "a", title: "Near Future", due: 1_000_000, overdue: false),
        ])
        let upcoming = await store.upcoming(limit: 10)
        XCTAssertEqual(upcoming.map(\.id), ["a", "b", "c"])
    }

    func testUpcoming_emptyAfterAllCompleted() async {
        let store = FakeRemindersStore(items: [
            Reminder(id: "x", title: "Task X", due: nil, overdue: false),
        ])
        await store.complete(id: "x")
        let upcoming = await store.upcoming(limit: 10)
        XCTAssertTrue(upcoming.isEmpty)
    }

    func testUpcoming_limitZeroReturnsEmpty() async {
        let store = FakeRemindersStore(items: [
            Reminder(id: "z", title: "Task Z", due: nil, overdue: false),
        ])
        let upcoming = await store.upcoming(limit: 0)
        XCTAssertTrue(upcoming.isEmpty)
    }

    func testRequestAccess_returnsTrue() async {
        let store = FakeRemindersStore()
        let result = await store.requestAccess()
        XCTAssertTrue(result)
    }
}
