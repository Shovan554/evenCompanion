import XCTest
@testable import EvenReminderCore

final class SnapshotContractTests: XCTestCase {

    // MARK: - Fixtures

    private func makeFullSnapshot() -> Snapshot {
        Snapshot(
            ts: 1_700_000_000,
            host: "test-mac",
            vitals: Vitals(
                cpu: 12.5,
                ramUsedGB: 8.0,
                ramTotalGB: 16.0,
                ramPressure: "normal",
                diskFreeGB: 250.0,
                diskTotalGB: 500.0,
                ssdHealth: "Verified",
                ssdWearPct: 3.7
            ),
            netProc: NetProc(
                upKBs: 100.0,
                downKBs: 500.0,
                topProc: TopProc(name: "Xcode", cpu: 45.2),
                battery: Battery(pct: 82, charging: false)
            ),
            ports: [Port(port: 8080, proc: "node")],
            reminders: [Reminder(id: "abc-123", title: "Call dentist", due: 1_700_010_000, overdue: false)]
        )
    }

    private func makeNilOptionalsSnapshot() -> Snapshot {
        Snapshot(
            ts: 1_700_000_001,
            host: "test-mac",
            vitals: Vitals(
                cpu: 5.0,
                ramUsedGB: 4.0,
                ramTotalGB: 16.0,
                ramPressure: "normal",
                diskFreeGB: 100.0,
                diskTotalGB: 500.0,
                ssdHealth: "Verified",
                ssdWearPct: nil       // <-- nil
            ),
            netProc: NetProc(
                upKBs: 0.0,
                downKBs: 0.0,
                topProc: nil,         // <-- nil
                battery: nil          // <-- nil
            ),
            ports: [],
            reminders: [Reminder(id: "xyz-999", title: "Buy milk", due: nil, overdue: false)]
        )
    }

    // MARK: - Helper

    private func encodedDict(_ s: Snapshot) throws -> [String: Any] {
        let json = snapshotJSON(s)
        let data = json.data(using: .utf8)!
        return try JSONSerialization.jsonObject(with: data) as! [String: Any]
    }

    // MARK: - Tests

    func testFullSnapshotEncodesAllContractKeys() throws {
        let dict = try encodedDict(makeFullSnapshot())

        // Top-level keys
        XCTAssertEqual(Set(dict.keys), Set(["ts", "host", "vitals", "netProc", "ports", "reminders"]))

        // vitals keys
        let vitalsDict = try XCTUnwrap(dict["vitals"] as? [String: Any])
        XCTAssertEqual(
            Set(vitalsDict.keys),
            Set(["cpu", "ramUsedGB", "ramTotalGB", "ramPressure", "diskFreeGB", "diskTotalGB", "ssdHealth", "ssdWearPct"])
        )

        // netProc keys
        let netProcDict = try XCTUnwrap(dict["netProc"] as? [String: Any])
        XCTAssertEqual(Set(netProcDict.keys), Set(["upKBs", "downKBs", "topProc", "battery"]))

        // port keys
        let portsArray = try XCTUnwrap(dict["ports"] as? [[String: Any]])
        XCTAssertEqual(portsArray.count, 1)
        XCTAssertEqual(Set(portsArray[0].keys), Set(["port", "proc"]))

        // reminder keys
        let remindersArray = try XCTUnwrap(dict["reminders"] as? [[String: Any]])
        XCTAssertEqual(remindersArray.count, 1)
        XCTAssertEqual(Set(remindersArray[0].keys), Set(["id", "title", "due", "overdue"]))
    }

    func testNilOptionalsEncodeAsExplicitNull() throws {
        let s = makeNilOptionalsSnapshot()
        let json = snapshotJSON(s)
        let data = json.data(using: .utf8)!

        // String-level checks: keys must be present with null value
        XCTAssertTrue(json.contains("\"ssdWearPct\":null"),
                      "ssdWearPct should be explicitly null in JSON, got: \(json)")
        XCTAssertTrue(json.contains("\"topProc\":null"),
                      "topProc should be explicitly null in JSON, got: \(json)")
        XCTAssertTrue(json.contains("\"battery\":null"),
                      "battery should be explicitly null in JSON, got: \(json)")
        XCTAssertTrue(json.contains("\"due\":null"),
                      "due should be explicitly null in JSON, got: \(json)")

        // JSONSerialization NSNull checks
        let dict = try JSONSerialization.jsonObject(with: data) as! [String: Any]

        let vitalsDict = dict["vitals"] as! [String: Any]
        XCTAssertTrue(vitalsDict["ssdWearPct"] is NSNull,
                      "vitals.ssdWearPct should deserialize as NSNull")

        let netProcDict = dict["netProc"] as! [String: Any]
        XCTAssertTrue(netProcDict["topProc"] is NSNull,
                      "netProc.topProc should deserialize as NSNull")
        XCTAssertTrue(netProcDict["battery"] is NSNull,
                      "netProc.battery should deserialize as NSNull")

        let remindersArray = dict["reminders"] as! [[String: Any]]
        XCTAssertTrue(remindersArray[0]["due"] is NSNull,
                      "reminder.due should deserialize as NSNull")
    }

    func testRoundTrip() throws {
        let original = makeFullSnapshot()
        let json = snapshotJSON(original)
        let data = json.data(using: .utf8)!
        let decoded = try JSONDecoder().decode(Snapshot.self, from: data)
        XCTAssertEqual(original, decoded)
    }

    func testRoundTripWithNilOptionals() throws {
        let original = makeNilOptionalsSnapshot()
        let json = snapshotJSON(original)
        let data = json.data(using: .utf8)!
        let decoded = try JSONDecoder().decode(Snapshot.self, from: data)
        XCTAssertEqual(original, decoded)
    }
}
