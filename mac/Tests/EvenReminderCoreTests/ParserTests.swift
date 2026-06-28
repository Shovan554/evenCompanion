import XCTest
@testable import EvenReminderCore

// MARK: - parseTopCPU

final class ParseTopCPUTests: XCTestCase {

    // Realistic fixture captured from `top -l 2 -n 0` on this Mac (two iterations).
    // We take the LAST "CPU usage:" line; user=3.61%, sys=5.73%, idle=90.64% → sum=9.34
    let topFixture = """
Processes: 549 total, 5 running, 544 sleeping, 3800 threads \n\
2026/06/28 15:35:51
Load Avg: 2.14, 1.84, 2.13 \n\
CPU usage: 5.30% user, 11.36% sys, 83.33% idle \n\
SharedLibs: 488M resident, 118M data, 99M linkedit.
MemRegions: 890216 total, 3922M resident, 181M private, 1235M shared.
PhysMem: 15G used (2292M wired, 6559M compressor), 325M unused.

Processes: 549 total, 2 running, 547 sleeping, 3802 threads \n\
2026/06/28 15:35:52
Load Avg: 2.13, 1.84, 2.13 \n\
CPU usage: 3.61% user, 5.73% sys, 90.64% idle \n\
SharedLibs: 488M resident, 118M data, 99M linkedit.
"""

    func testParseTopCPU_returnsLastLineSumUserPlusSys() {
        let result = parseTopCPU(topFixture)
        // 3.61 + 5.73 = 9.34
        XCTAssertEqual(result, 9.34, accuracy: 0.01)
    }

    func testParseTopCPU_emptyInput_returnsZero() {
        XCTAssertEqual(parseTopCPU(""), 0.0)
    }

    func testParseTopCPU_garbageInput_returnsZero() {
        XCTAssertEqual(parseTopCPU("no cpu line here"), 0.0)
    }

    func testParseTopCPU_singleLine() {
        let input = "CPU usage: 4.76% user, 9.52% sys, 85.71% idle"
        let result = parseTopCPU(input)
        // 4.76 + 9.52 = 14.28
        XCTAssertEqual(result, 14.28, accuracy: 0.01)
    }
}

// MARK: - parseVmStat

final class ParseVmStatTests: XCTestCase {

    // Realistic fixture captured from `vm_stat` on this Mac.
    // page size = 16384 bytes
    // active=214029, wired=146638, compressor (occupied by compressor)=419678
    // used pages = 214029 + 146638 + 419678 = 780345
    // usedGB = 780345 * 16384 / 1e9 = 12.787...
    // memTotal = 16GB = 17179869184 bytes, totalGB = ~16.0
    // usedGB/totalGB ≈ 0.80 → pressure = "warn"
    let vmStatFixture = """
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
    // memTotal = 16GB = 17179869184
    let memTotalBytes: UInt64 = 17_179_869_184
    let pageSize: Int = 16384

    func testParseVmStat_usedGB() {
        let (usedGB, _) = parseVmStat(vmStatFixture, pageSize: pageSize, memTotalBytes: memTotalBytes)
        // used pages = 214029 + 146638 + 419678 = 780345
        // usedGB = 780345 * 16384 / 1e9 = 12.787...
        XCTAssertEqual(usedGB, 12.787, accuracy: 0.01)
    }

    func testParseVmStat_pressure_normal_fromFixture() {
        let (_, pressure) = parseVmStat(vmStatFixture, pageSize: pageSize, memTotalBytes: memTotalBytes)
        // usedGB ~12.79, totalGB ~17.18 → ratio ~0.744 → "normal"
        XCTAssertEqual(pressure, "normal")
    }

    func testParseVmStat_pressure_warn_synthetic() {
        // Create fixture where ratio > 0.75 but <= 0.90
        // memTotal = 16 GB = 16000000000 bytes, pageSize = 16384
        // target usedGB = 13 GB → usedPages = 13000000000 / 16384 = 793457.03 ≈ 793457
        // ratio = 793457 * 16384 / 16000000000 = 12.9999... / 16 = 0.8125 → "warn"
        let warnFixture = """
Mach Virtual Memory Statistics: (page size of 16384 bytes)
Pages free:                                   100000.
Pages active:                                 500000.
Pages inactive:                               200000.
Pages wired down:                             200000.
Pages occupied by compressor:                  93457.
"""
        // active(500000) + wired(200000) + compressor(93457) = 793457
        // usedGB = 793457 * 16384 / 1e9 = 12.9999...
        // totalGB = 16000000000 / 1e9 = 16.0
        // ratio = 12.9999/16.0 = 0.8125 → "warn"
        let memTotal: UInt64 = 16_000_000_000
        let (_, pressure) = parseVmStat(warnFixture, pageSize: 16384, memTotalBytes: memTotal)
        XCTAssertEqual(pressure, "warn")
    }

    func testParseVmStat_pressure_normal() {
        // lower memory usage: only 100 pages active, 50 wired, 50 compressor
        let lowUsage = """
Mach Virtual Memory Statistics: (page size of 4096 bytes)
Pages free:                                  500000.
Pages active:                                   100.
Pages inactive:                                  50.
Pages wired down:                                50.
Pages occupied by compressor:                    50.
"""
        let (_, pressure) = parseVmStat(lowUsage, pageSize: 4096, memTotalBytes: 17_179_869_184)
        XCTAssertEqual(pressure, "normal")
    }

    func testParseVmStat_pressure_critical() {
        // Very high memory usage — 99% of 1GB memory used
        // 1GB = 1073741824 bytes, pageSize=4096 → totalPages=262144
        // used pages = 240000 active + 10000 wired + 10000 compressor = 260000 of 262144 → ~99%
        let highUsage = """
Mach Virtual Memory Statistics: (page size of 4096 bytes)
Pages free:                                     100.
Pages active:                                240000.
Pages inactive:                                 500.
Pages wired down:                             10000.
Pages occupied by compressor:                 10000.
"""
        let memTotal: UInt64 = 1_073_741_824 // 1 GB
        let (_, pressure) = parseVmStat(highUsage, pageSize: 4096, memTotalBytes: memTotal)
        XCTAssertEqual(pressure, "critical")
    }

    func testParseVmStat_emptyInput_returnsDefaults() {
        let (usedGB, pressure) = parseVmStat("", pageSize: 16384, memTotalBytes: memTotalBytes)
        XCTAssertEqual(usedGB, 0.0)
        XCTAssertEqual(pressure, "normal")
    }
}

// MARK: - parseDf

final class ParseDfTests: XCTestCase {

    // Realistic fixture from `df -k /`
    // total 1024-blocks=239362496, available=10406348
    // totalGB = 239362496 * 1024 / 1e9 = 245.107...
    // freeGB  = 10406348 * 1024 / 1e9 = 10.656...
    let dfFixture = """
Filesystem     1024-blocks      Used Available Capacity iused     ifree %iused  Mounted on
/dev/disk3s1s1   239362496  12275144  10406348    55%  458725 104063480    0%   /
"""

    func testParseDf_totalGB() {
        let (_, totalGB) = parseDf(dfFixture)
        XCTAssertEqual(totalGB, 245.107, accuracy: 0.01)
    }

    func testParseDf_freeGB() {
        let (freeGB, _) = parseDf(dfFixture)
        XCTAssertEqual(freeGB, 10.656, accuracy: 0.01)
    }

    func testParseDf_emptyInput_returnsZeros() {
        let (freeGB, totalGB) = parseDf("")
        XCTAssertEqual(freeGB, 0.0)
        XCTAssertEqual(totalGB, 0.0)
    }

    func testParseDf_headerOnly_returnsZeros() {
        let headerOnly = "Filesystem     1024-blocks      Used Available Capacity iused     ifree %iused  Mounted on"
        let (freeGB, totalGB) = parseDf(headerOnly)
        XCTAssertEqual(freeGB, 0.0)
        XCTAssertEqual(totalGB, 0.0)
    }
}

// MARK: - parseDiskutilSMART

final class ParseDiskutilSMARTTests: XCTestCase {

    // Realistic fixture from `diskutil info /`
    let diskutilFixture = """
   Device Identifier:         disk3s1s1
   Device Node:               /dev/disk3s1s1
   Whole:                     No
   Part of Whole:             disk3
   Volume Name:               Macintosh HD
   SMART Status:              Verified
   Volume UUID:               D0CC64AA-224B-4ECC-9D8D-B829FEB1B2B9
"""

    func testParseDiskutilSMART_returnsVerified() {
        XCTAssertEqual(parseDiskutilSMART(diskutilFixture), "Verified")
    }

    func testParseDiskutilSMART_emptyInput_returnsUnknown() {
        XCTAssertEqual(parseDiskutilSMART(""), "Unknown")
    }

    func testParseDiskutilSMART_garbageInput_returnsUnknown() {
        XCTAssertEqual(parseDiskutilSMART("no smart here"), "Unknown")
    }

    func testParseDiskutilSMART_failingStatus() {
        let input = "   SMART Status:              Failing"
        XCTAssertEqual(parseDiskutilSMART(input), "Failing")
    }
}

// MARK: - parseLsofListening

final class ParseLsofListeningTests: XCTestCase {

    // Realistic fixture from `lsof -nP -iTCP -sTCP:LISTEN`
    // Should dedupe port 49152 (rapportd appears twice for IPv4+IPv6), port 7000, 5000
    // Result sorted by port: 5000(ControlCe), 7000(ControlCe), 9277(stable), 49152(rapportd)
    let lsofFixture = """
COMMAND     PID        USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
rapportd    647 shovansmini   10u  IPv4 0x9a7664961bfb0429      0t0  TCP *:49152 (LISTEN)
rapportd    647 shovansmini   11u  IPv6 0x8309e97feb00dc97      0t0  TCP *:49152 (LISTEN)
ControlCe   660 shovansmini    9u  IPv4 0xcb5a00f207256f61      0t0  TCP *:7000 (LISTEN)
ControlCe   660 shovansmini   10u  IPv6  0xe0eb735733c6006      0t0  TCP *:7000 (LISTEN)
ControlCe   660 shovansmini   11u  IPv4 0x97eaa0738e19b253      0t0  TCP *:5000 (LISTEN)
ControlCe   660 shovansmini   12u  IPv6 0xe519e03ba6f8ee78      0t0  TCP *:5000 (LISTEN)
stable      807 shovansmini   41u  IPv4 0xf24c18bb90212a00      0t0  TCP 127.0.0.1:9277 (LISTEN)
"""

    func testParseLsofListening_dedupesByPort() {
        let ports = parseLsofListening(lsofFixture)
        let portNums = ports.map { $0.port }
        XCTAssertEqual(portNums, [5000, 7000, 9277, 49152])
    }

    func testParseLsofListening_correctProcNames() {
        let ports = parseLsofListening(lsofFixture)
        let byPort = Dictionary(uniqueKeysWithValues: ports.map { ($0.port, $0.proc) })
        XCTAssertEqual(byPort[5000], "ControlCe")
        XCTAssertEqual(byPort[7000], "ControlCe")
        XCTAssertEqual(byPort[9277], "stable")
        XCTAssertEqual(byPort[49152], "rapportd")
    }

    func testParseLsofListening_emptyInput_returnsEmptyArray() {
        XCTAssertEqual(parseLsofListening(""), [])
    }

    func testParseLsofListening_headerOnly_returnsEmptyArray() {
        let header = "COMMAND     PID        USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME"
        XCTAssertEqual(parseLsofListening(header), [])
    }

    func testParseLsofListening_ignoresNonListenLines() {
        let mixed = """
COMMAND     PID        USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
chrome      123 user   10u  IPv4 0x1234      0t0  TCP 127.0.0.1:8080 (ESTABLISHED)
python      456 user    3u  IPv4 0x5678      0t0  TCP *:8000 (LISTEN)
"""
        let ports = parseLsofListening(mixed)
        XCTAssertEqual(ports.count, 1)
        XCTAssertEqual(ports[0].port, 8000)
        XCTAssertEqual(ports[0].proc, "python")
    }
}

// MARK: - parseNetstat

final class ParseNetstatTests: XCTestCase {

    // Realistic fixture from `netstat -ib`.
    // Only count the first (Link#) row per interface, exclude lo0.
    // en1 (Link#15): Ibytes=51846588555, Obytes=12542712983
    // awdl0 (Link#17): Ibytes=34624495, Obytes=30556505
    // llw0 (Link#18): Ibytes=9603427, Obytes=2502180
    // utun4 (Link#24): Ibytes=11648, Obytes=6265
    // ... (others are 0)
    // Total inBytes = 51846588555 + 34624495 + 9603427 + 11648 + others(0)
    //               = 51890828125
    // Total outBytes = 12542712983 + 30556505 + 2502180 + 6265 + others(0)
    //                = 12575777933
    let netstatFixture = """
Name       Mtu   Network       Address            Ipkts Ierrs     Ibytes    Opkts Oerrs     Obytes  Coll
lo0        16384 <Link#1>                       6717761     0 21341346719  6717761     0 21341346719     0
lo0        16384 127           localhost        6717761     - 21341346719  6717761     - 21341346719     -
lo0        16384 localhost   ::1                6717761     - 21341346719  6717761     - 21341346719     -
lo0        16384 shovans-mac fe80:1::1          6717761     - 21341346719  6717761     - 21341346719     -
gif0*      1280  <Link#2>                             0     0          0        0     0          0     0
stf0*      1280  <Link#3>                             0     0          0        0     0          0     0
anpi1      1500  <Link#4>    02:48:5d:30:dd:e1        0     0          0        0     0          0     0
anpi0      1500  <Link#5>    02:48:5d:30:dd:e0        0     0          0        0     0          0     0
anpi3      1500  <Link#6>    02:48:5d:30:dd:e3        0     0          0        0     0          0     0
en0        1500  <Link#7>    1c:f6:4c:59:4f:cc        0     0          0        0     0          0     0
en5        1500  <Link#8>    02:48:5d:30:dd:c0        0     0          0        0     0          0     0
en6        1500  <Link#9>    02:48:5d:30:dd:c1        0     0          0        0     0          0     0
en7        1500  <Link#10>   02:48:5d:30:dd:c3        0     0          0        0     0          0     0
en2        1500  <Link#11>   36:d6:f3:aa:76:80        0     0          0        0     0          0     0
en3        1500  <Link#12>   36:d6:f3:aa:76:84        0     0          0        0     0          0     0
en4        1500  <Link#13>   36:d6:f3:aa:76:8c        0     0          0        0     0          0     0
bridge0    1500  <Link#16>   36:d6:f3:aa:76:80        0     0          0        0     0          0     0
en8        1500  <Link#19>   34:29:8f:10:76:c6        0     0          0        0     0          0     0
utun0      1500  <Link#20>                            0     0          0        1     0         80     0
utun0      1500  shovans-mac fe80:14::2c64:d89        0     -          0        1     -         80     -
utun1      1380  <Link#21>                            0     0          0      223     0      43711     0
utun1      1380  shovans-mac fe80:15::b848:cd5        0     -          0      223     -      43711     -
ap1        1500  <Link#14>   76:f1:78:7a:c7:50        0     0          0        0     0          0     0
en1        1500  <Link#15>   86:0c:13:79:f0:f9 53389897     0 51846588555 21023259     0 12542712983     0
en1        1500  shovans-mac fe80:f::43f:22af: 53389897     - 51846588555 21023259     - 12542712983     -
en1        1500  192.168.1     192.168.1.222   53389897     - 51846588555 21023259     - 12542712983     -
awdl0      1500  <Link#17>   0a:6f:1c:16:16:ac    81558     0   34624495   123398     0   30556505     0
awdl0      1500  fe80::86f:1 fe80:11::86f:1cff    81558     -   34624495   123398     -   30556505     -
utun2      2000  <Link#22>                            0     0          0      223     0      43711     0
utun2      2000  shovans-mac fe80:16::5049:326        0     -          0      223     -      43711     -
utun3      1000  <Link#23>                            0     0          0      224     0      43771     0
utun3      1000  shovans-mac fe80:17::ce81:b1c        0     -          0      224     -      43771     -
llw0       1500  <Link#18>   0a:6f:1c:16:16:ac    16582     0    9603427    22670     0    2502180     0
llw0       1500  fe80::86f:1 fe80:12::86f:1cff    16582     -    9603427    22670     -    2502180     -
utun4      1380  <Link#24>                           56     0      11648       35     0       6265     0
utun4      1380  shovans-mac fe80:18::d02a:139       56     -      11648       35     -       6265     -
utun5      1380  <Link#25>                            0     0          0      222     0      43651     0
utun5      1380  shovans-mac fe80:19::97db:cc1        0     -          0      222     -      43651     -
"""

    func testParseNetstat_sumInBytesExcludingLoopback() {
        let (inBytes, _) = parseNetstat(netstatFixture)
        // 11-col interfaces (with MAC address): en1=51846588555, awdl0=34624495, llw0=9603427
        // 10-col interfaces (no address): utun4=11648; utun0=0, utun1=0, utun2=0, utun3=0, utun5=0
        // Others: all 0
        let expected: UInt64 = 51_846_588_555 + 34_624_495 + 9_603_427 + 11_648
        XCTAssertEqual(inBytes, expected)
    }

    func testParseNetstat_sumOutBytesExcludingLoopback() {
        let (_, outBytes) = parseNetstat(netstatFixture)
        // 11-col interfaces: en1=12542712983, awdl0=30556505, llw0=2502180
        // 10-col interfaces: utun0=80, utun1=43711, utun2=43711, utun3=43771, utun4=6265, utun5=43651
        // (gif0*, stf0* have 10 cols but all zeros)
        let expected: UInt64 = 12_542_712_983 + 30_556_505 + 2_502_180 +
                               80 + 43_711 + 43_711 + 43_771 + 6_265 + 43_651
        XCTAssertEqual(outBytes, expected)
    }

    func testParseNetstat_emptyInput_returnsZeros() {
        let (inBytes, outBytes) = parseNetstat("")
        XCTAssertEqual(inBytes, 0)
        XCTAssertEqual(outBytes, 0)
    }

    func testParseNetstat_headerOnly_returnsZeros() {
        let header = "Name       Mtu   Network       Address            Ipkts Ierrs     Ibytes    Opkts Oerrs     Obytes  Coll"
        let (inBytes, outBytes) = parseNetstat(header)
        XCTAssertEqual(inBytes, 0)
        XCTAssertEqual(outBytes, 0)
    }
}

// MARK: - parsePmsetBattery

final class ParsePmsetBatteryTests: XCTestCase {

    // Battery Mac fixture
    let batteryFixture = """
Now drawing from 'Battery Power'
 -InternalBattery-0 (id=12345678)	87%; discharging; 3:45 remaining present: true
"""

    // Charging battery fixture
    let chargingFixture = """
Now drawing from 'AC Power'
 -InternalBattery-0 (id=12345678)	64%; charging; 1:22 remaining present: true
"""

    // Desktop / no battery
    let desktopFixture = "Now drawing from 'AC Power'"

    func testParsePmsetBattery_returnsCorrectPct() {
        let battery = parsePmsetBattery(batteryFixture)
        XCTAssertNotNil(battery)
        XCTAssertEqual(battery?.pct, 87)
    }

    func testParsePmsetBattery_dischargingNotCharging() {
        let battery = parsePmsetBattery(batteryFixture)
        XCTAssertEqual(battery?.charging, false)
    }

    func testParsePmsetBattery_chargingIsTrue() {
        let battery = parsePmsetBattery(chargingFixture)
        XCTAssertNotNil(battery)
        XCTAssertEqual(battery?.charging, true)
    }

    func testParsePmsetBattery_chargedACPowerIsCharging() {
        let charged = """
Now drawing from 'AC Power'
 -InternalBattery-0 (id=12345678)	100%; charged; 0:00 remaining present: true
"""
        let battery = parsePmsetBattery(charged)
        XCTAssertNotNil(battery)
        XCTAssertEqual(battery?.charging, true)
    }

    func testParsePmsetBattery_desktopNoBattery_returnsNil() {
        XCTAssertNil(parsePmsetBattery(desktopFixture))
    }

    func testParsePmsetBattery_emptyInput_returnsNil() {
        XCTAssertNil(parsePmsetBattery(""))
    }
}

// MARK: - parseTopProcess

final class ParseTopProcessTests: XCTestCase {

    // Realistic fixture from `ps -Aceo pcpu,comm -r`
    let psFixture = """
 %CPU COMM
 16.9 Wallper
 13.1 WindowServer
  6.2 claude
  5.8 VTDecoderXPCService
  0.0 kernel_task
"""

    func testParseTopProcess_returnsFirstDataRow() throws {
        let proc = try XCTUnwrap(parseTopProcess(psFixture))
        XCTAssertEqual(proc.name, "Wallper")
        XCTAssertEqual(proc.cpu, 16.9, accuracy: 0.001)
    }

    func testParseTopProcess_emptyInput_returnsNil() {
        XCTAssertNil(parseTopProcess(""))
    }

    func testParseTopProcess_headerOnly_returnsNil() {
        XCTAssertNil(parseTopProcess(" %CPU COMM"))
    }

    func testParseTopProcess_garbageInput_returnsNil() {
        XCTAssertNil(parseTopProcess("no valid ps output here"))
    }

    func testParseTopProcess_singleDataRow() throws {
        let input = " %CPU COMM\n  3.5 myapp"
        let proc = try XCTUnwrap(parseTopProcess(input))
        XCTAssertEqual(proc.name, "myapp")
        XCTAssertEqual(proc.cpu, 3.5, accuracy: 0.001)
    }
}
