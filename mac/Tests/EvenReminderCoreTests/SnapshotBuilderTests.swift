import XCTest
@testable import EvenReminderCore

// MARK: - FakeCommandRunner

/// A test double that returns canned outputs keyed by launchPath.
/// For args-differentiated commands (top, ps with different args), we key by the first arg.
final class FakeCommandRunner: CommandRunner, @unchecked Sendable {
    var outputs: [String: String]

    init(outputs: [String: String]) {
        self.outputs = outputs
    }

    func run(_ launchPath: String, _ args: [String]) -> String {
        // Look up by launchPath first, then by launchPath+first-arg
        if let out = outputs[launchPath] {
            return out
        }
        // Fallback: match by first arg substring
        for (key, val) in outputs {
            if args.contains(where: { $0.contains(key) }) {
                return val
            }
        }
        return ""
    }
}

// MARK: - SnapshotBuilderTests

final class SnapshotBuilderTests: XCTestCase {

    // Canned outputs matching the same fixtures used in ParserTests
    static let topOutput = """
Processes: 549 total, 5 running, 544 sleeping, 3800 threads
2026/06/28 15:35:51
Load Avg: 2.14, 1.84, 2.13
CPU usage: 5.30% user, 11.36% sys, 83.33% idle

Processes: 549 total, 2 running, 547 sleeping, 3802 threads
2026/06/28 15:35:52
Load Avg: 2.13, 1.84, 2.13
CPU usage: 3.61% user, 5.73% sys, 90.64% idle
"""

    static let vmStatOutput = """
Mach Virtual Memory Statistics: (page size of 16384 bytes)
Pages free:                                    20147.
Pages active:                                 214029.
Pages inactive:                               212882.
Pages speculative:                               497.
Pages throttled:                                   0.
Pages wired down:                             146638.
Pages purgeable:                                  60.
"Translation faults":                     2825126633.
Pages copy-on-write:                       171178546.
Pages zero filled:                        4134610258.
Pages reactivated:                         287617730.
Pages purged:                               27223925.
File-backed pages:                            146593.
Anonymous pages:                              280815.
Pages stored in compressor:                  1037148.
Pages occupied by compressor:                 419678.
Decompressions:                            199677640.
Compressions:                              237291337.
Pageins:                                    75529090.
Pageouts:                                    1787558.
Swapins:                                      853658.
Swapouts:                                    1338644.
"""

    static let dfOutput = """
Filesystem     1024-blocks      Used Available Capacity iused     ifree %iused  Mounted on
/dev/disk3s1s1   239362496  12275144  10406348    55%  458725 104063480    0%   /
"""

    static let diskutilOutput = """
   Device Identifier:         disk3s1s1
   SMART Status:              Verified
   Disk Size:                 245.1 GB (245107195904 Bytes) (exactly 478724992 512-Byte-Units)
"""

    static let lsofOutput = """
COMMAND     PID        USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
rapportd    647 shovansmini   10u  IPv4 0x9a7664961bfb0429      0t0  TCP *:49152 (LISTEN)
ControlCe   660 shovansmini   11u  IPv4 0x97eaa0738e19b253      0t0  TCP *:5000 (LISTEN)
"""

    static let netstatOutput = """
Name       Mtu   Network       Address            Ipkts Ierrs     Ibytes    Opkts Oerrs     Obytes  Coll
lo0        16384 <Link#1>                       1000     0   1000000     1000     0   1000000     0
en1        1500  <Link#15>   86:0c:13:79:f0:f9  5000     0  50000000     2000     0  20000000     0
"""
    // inBytes = 50000000 (en1), outBytes = 20000000 (en1)

    static let netstatOutput2 = """
Name       Mtu   Network       Address            Ipkts Ierrs     Ibytes    Opkts Oerrs     Obytes  Coll
lo0        16384 <Link#1>                       1000     0   1000000     1000     0   1000000     0
en1        1500  <Link#15>   86:0c:13:79:f0:f9  6000     0  51024000     2200     0  21024000     0
"""
    // inBytes = 51024000 (delta from first = 1024000), outBytes = 21024000 (delta = 1024000)

    static let pmsetOutput = "Now drawing from 'AC Power'"
    // No InternalBattery → battery = nil

    static let psOutput = """
 %CPU COMM
 16.9 Wallper
 13.1 WindowServer
"""

    // Memory constants: pass to builder so tests are deterministic
    static let memTotalBytes: UInt64 = 17_179_869_184  // 16 GB
    static let pageSize: Int = 16384

    // MARK: - Helper to build a fake runner keyed by launchPath

    func makeRunner(netstatOutput: String = SnapshotBuilderTests.netstatOutput) -> FakeCommandRunner {
        FakeCommandRunner(outputs: [
            "/usr/bin/top":       SnapshotBuilderTests.topOutput,
            "/usr/bin/vm_stat":   SnapshotBuilderTests.vmStatOutput,
            "/bin/df":            SnapshotBuilderTests.dfOutput,
            "/usr/sbin/diskutil": SnapshotBuilderTests.diskutilOutput,
            "/usr/sbin/lsof":     SnapshotBuilderTests.lsofOutput,
            "/usr/sbin/netstat":  netstatOutput,
            "/usr/bin/pmset":     SnapshotBuilderTests.pmsetOutput,
            "/bin/ps":            SnapshotBuilderTests.psOutput,
        ])
    }

    // MARK: - Tests

    func testBuild_vitals_cpu() {
        let runner = makeRunner()
        let builder = SnapshotBuilder(
            runner: runner,
            memTotalBytes: Self.memTotalBytes,
            pageSize: Self.pageSize
        )
        let (snapshot, _) = builder.build(now: 1_000_000, host: "test-mac", prev: nil)
        // 3.61 + 5.73 = 9.34
        XCTAssertEqual(snapshot.vitals.cpu, 9.34, accuracy: 0.01)
    }

    func testBuild_vitals_ram() {
        let runner = makeRunner()
        let builder = SnapshotBuilder(runner: runner, memTotalBytes: Self.memTotalBytes, pageSize: Self.pageSize)
        let (snapshot, _) = builder.build(now: 1_000_000, host: "test-mac", prev: nil)
        // usedGB ≈ 12.79
        XCTAssertEqual(snapshot.vitals.ramUsedGB, 12.79, accuracy: 0.1)
        // totalGB = 17179869184 / 1e9 ≈ 17.18
        XCTAssertEqual(snapshot.vitals.ramTotalGB, 17.18, accuracy: 0.1)
        XCTAssertEqual(snapshot.vitals.ramPressure, "normal")
    }

    func testBuild_vitals_disk() {
        let runner = makeRunner()
        let builder = SnapshotBuilder(runner: runner, memTotalBytes: Self.memTotalBytes, pageSize: Self.pageSize)
        let (snapshot, _) = builder.build(now: 1_000_000, host: "test-mac", prev: nil)
        XCTAssertEqual(snapshot.vitals.diskFreeGB,  10.656, accuracy: 0.01)
        XCTAssertEqual(snapshot.vitals.diskTotalGB, 245.107, accuracy: 0.1)
    }

    func testBuild_vitals_ssdHealth() {
        let runner = makeRunner()
        let builder = SnapshotBuilder(runner: runner, memTotalBytes: Self.memTotalBytes, pageSize: Self.pageSize)
        let (snapshot, _) = builder.build(now: 1_000_000, host: "test-mac", prev: nil)
        XCTAssertEqual(snapshot.vitals.ssdHealth, "Verified")
    }

    func testBuild_ports() throws {
        let runner = makeRunner()
        let builder = SnapshotBuilder(runner: runner, memTotalBytes: Self.memTotalBytes, pageSize: Self.pageSize)
        let (snapshot, _) = builder.build(now: 1_000_000, host: "test-mac", prev: nil)
        XCTAssertEqual(snapshot.ports.count, 2)
        XCTAssertEqual(snapshot.ports[0].port, 5000)
        XCTAssertEqual(snapshot.ports[0].proc, "ControlCe")
        XCTAssertEqual(snapshot.ports[1].port, 49152)
        XCTAssertEqual(snapshot.ports[1].proc, "rapportd")
    }

    func testBuild_topProc() throws {
        let runner = makeRunner()
        let builder = SnapshotBuilder(runner: runner, memTotalBytes: Self.memTotalBytes, pageSize: Self.pageSize)
        let (snapshot, _) = builder.build(now: 1_000_000, host: "test-mac", prev: nil)
        let proc = try XCTUnwrap(snapshot.netProc.topProc)
        XCTAssertEqual(proc.name, "Wallper")
        XCTAssertEqual(proc.cpu, 16.9, accuracy: 0.001)
    }

    func testBuild_battery_nilForDesktop() {
        let runner = makeRunner()
        let builder = SnapshotBuilder(runner: runner, memTotalBytes: Self.memTotalBytes, pageSize: Self.pageSize)
        let (snapshot, _) = builder.build(now: 1_000_000, host: "test-mac", prev: nil)
        // pmsetOutput has no InternalBattery line → battery = nil
        XCTAssertNil(snapshot.netProc.battery)
    }

    func testBuild_reminders_isEmpty() {
        let runner = makeRunner()
        let builder = SnapshotBuilder(runner: runner, memTotalBytes: Self.memTotalBytes, pageSize: Self.pageSize)
        let (snapshot, _) = builder.build(now: 1_000_000, host: "test-mac", prev: nil)
        XCTAssertEqual(snapshot.reminders, [])
    }

    func testBuild_host_andTs() {
        let runner = makeRunner()
        let builder = SnapshotBuilder(runner: runner, memTotalBytes: Self.memTotalBytes, pageSize: Self.pageSize)
        let now: Double = 1_750_000_000
        let (snapshot, _) = builder.build(now: now, host: "my-mac", prev: nil)
        XCTAssertEqual(snapshot.host, "my-mac")
        XCTAssertEqual(snapshot.ts, Int(now))
    }

    func testBuild_noPrev_netRateIsZero() {
        let runner = makeRunner()
        let builder = SnapshotBuilder(runner: runner, memTotalBytes: Self.memTotalBytes, pageSize: Self.pageSize)
        let (snapshot, _) = builder.build(now: 1_000_000, host: "test-mac", prev: nil)
        XCTAssertEqual(snapshot.netProc.upKBs,   0.0)
        XCTAssertEqual(snapshot.netProc.downKBs, 0.0)
    }

    func testBuild_withPrev_netRateIsPositive() {
        // First build: netstatOutput has en1 inBytes=50000000, outBytes=20000000
        let runner1 = makeRunner(netstatOutput: Self.netstatOutput)
        let builder = SnapshotBuilder(runner: runner1, memTotalBytes: Self.memTotalBytes, pageSize: Self.pageSize)
        let now1: Double = 1_000_000
        let (_, prev) = builder.build(now: now1, host: "test-mac", prev: nil)

        // Second build: netstatOutput2 has en1 inBytes=51024000, outBytes=21024000
        // elapsed = 1.0 second
        // downKBs = (51024000 - 50000000) / 1024 / 1.0 = 1000 KB/s
        // upKBs   = (21024000 - 20000000) / 1024 / 1.0 = 1000 KB/s
        let runner2 = FakeCommandRunner(outputs: [
            "/usr/bin/top":       Self.topOutput,
            "/usr/bin/vm_stat":   Self.vmStatOutput,
            "/bin/df":            Self.dfOutput,
            "/usr/sbin/diskutil": Self.diskutilOutput,
            "/usr/sbin/lsof":     Self.lsofOutput,
            "/usr/sbin/netstat":  Self.netstatOutput2,
            "/usr/bin/pmset":     Self.pmsetOutput,
            "/bin/ps":            Self.psOutput,
        ])
        let builder2 = SnapshotBuilder(runner: runner2, memTotalBytes: Self.memTotalBytes, pageSize: Self.pageSize)
        let now2: Double = 1_000_001   // 1 second later
        let (snapshot2, _) = builder2.build(now: now2, host: "test-mac", prev: prev)

        XCTAssertGreaterThan(snapshot2.netProc.downKBs, 0.0)
        XCTAssertGreaterThan(snapshot2.netProc.upKBs,   0.0)
        XCTAssertEqual(snapshot2.netProc.downKBs, 1000.0, accuracy: 1.0)
        XCTAssertEqual(snapshot2.netProc.upKBs,   1000.0, accuracy: 1.0)
    }

    func testBuild_returnsNewNetSample() {
        let runner = makeRunner()
        let builder = SnapshotBuilder(runner: runner, memTotalBytes: Self.memTotalBytes, pageSize: Self.pageSize)
        let now: Double = 1_000_000
        let (_, sample) = builder.build(now: now, host: "test-mac", prev: nil)
        XCTAssertEqual(sample.at, now)
        // en1 inBytes=50000000, outBytes=20000000
        XCTAssertEqual(sample.inBytes,  50_000_000)
        XCTAssertEqual(sample.outBytes, 20_000_000)
    }
}
