import Foundation

// MARK: - NetSample

/// A single measurement of network byte counters, used to compute delta KB/s.
public struct NetSample: Sendable {
    public let inBytes:  UInt64
    public let outBytes: UInt64
    public let at:       Double   // epoch seconds (Double for sub-second precision)

    public init(inBytes: UInt64, outBytes: UInt64, at: Double) {
        self.inBytes  = inBytes
        self.outBytes = outBytes
        self.at       = at
    }
}

// MARK: - SnapshotBuilder

/// Builds a `Snapshot` by running CLI commands via an injected `CommandRunner`.
/// Pure side-effects are confined to the runner; all parsing is done by the functions in Parsers.swift.
public struct SnapshotBuilder {
    let runner:        CommandRunner
    let memTotalBytes: UInt64
    let pageSize:      Int

    /// - Parameters:
    ///   - runner:        The command runner (SystemCommandRunner in production, FakeCommandRunner in tests).
    ///   - memTotalBytes: Total physical RAM bytes.  Defaults to ProcessInfo.processInfo.physicalMemory.
    ///   - pageSize:      VM page size in bytes.  Defaults to the host's page size (usually 16384 on Apple Silicon).
    public init(
        runner:        CommandRunner,
        memTotalBytes: UInt64? = nil,
        pageSize:      Int?    = nil
    ) {
        self.runner        = runner
        self.memTotalBytes = memTotalBytes ?? UInt64(ProcessInfo.processInfo.physicalMemory)
        self.pageSize      = pageSize      ?? Int(getpagesize())  // POSIX getpagesize() — safe under Swift 6
    }

    /// Runs all telemetry commands and assembles a `Snapshot`.
    ///
    /// - Parameters:
    ///   - now:  The current epoch time (seconds). Used for `ts` and net-rate computation.
    ///   - host: The machine hostname to embed in the snapshot.
    ///   - prev: The previous `NetSample` (or nil on first call). When provided, network KB/s is computed
    ///           as the byte delta divided by the elapsed time.
    /// - Returns: The assembled `Snapshot` and the new `NetSample` (to pass as `prev` on next call).
    public func build(now: Double, host: String, prev: NetSample?) -> (Snapshot, NetSample) {

        // --- CPU ---
        let topText = runner.run("/usr/bin/top", ["-l", "2", "-n", "0"])
        let cpu = parseTopCPU(topText)

        // --- Memory ---
        let vmText = runner.run("/usr/bin/vm_stat", [])
        let (ramUsedGB, ramPressure) = parseVmStat(vmText, pageSize: pageSize, memTotalBytes: memTotalBytes)
        let ramTotalGB = Double(memTotalBytes) / 1_000_000_000.0

        // --- Disk ---
        let dfText = runner.run("/bin/df", ["-k", "/"])
        let (diskFreeGB, diskTotalGB) = parseDf(dfText)

        // --- SSD Health ---
        let diskutilText = runner.run("/usr/sbin/diskutil", ["info", "/"])
        let ssdHealth = parseDiskutilSMART(diskutilText)

        // --- Listening Ports ---
        let lsofText = runner.run("/usr/sbin/lsof", ["-nP", "-iTCP", "-sTCP:LISTEN"])
        let ports = parseLsofListening(lsofText)

        // --- Network bytes ---
        let netstatText = runner.run("/usr/sbin/netstat", ["-ib"])
        let (inBytes, outBytes) = parseNetstat(netstatText)

        // --- Battery ---
        let pmsetText = runner.run("/usr/bin/pmset", ["-g", "batt"])
        let battery = parsePmsetBattery(pmsetText)

        // --- Top Process ---
        let psText = runner.run("/bin/ps", ["-Aceo", "pcpu,comm", "-r"])
        let topProc = parseTopProcess(psText)

        // --- Net rate ---
        let upKBs:   Double
        let downKBs: Double
        if let prev = prev {
            let elapsed = now - prev.at
            if elapsed > 0 {
                let upDelta   = outBytes >= prev.outBytes ? outBytes - prev.outBytes : 0
                let downDelta = inBytes  >= prev.inBytes  ? inBytes  - prev.inBytes  : 0
                upKBs   = Double(upDelta)   / 1024.0 / elapsed
                downKBs = Double(downDelta) / 1024.0 / elapsed
            } else {
                upKBs   = 0
                downKBs = 0
            }
        } else {
            upKBs   = 0
            downKBs = 0
        }

        // --- Assemble ---
        let vitals = Vitals(
            cpu:         cpu,
            ramUsedGB:   ramUsedGB,
            ramTotalGB:  ramTotalGB,
            ramPressure: ramPressure,
            diskFreeGB:  diskFreeGB,
            diskTotalGB: diskTotalGB,
            ssdHealth:   ssdHealth,
            ssdWearPct:  nil          // not available from CLI without sudo
        )

        let netProc = NetProc(
            upKBs:   upKBs,
            downKBs: downKBs,
            topProc: topProc,
            battery: battery
        )

        let snapshot = Snapshot(
            ts:        Int(now),
            host:      host,
            vitals:    vitals,
            netProc:   netProc,
            ports:     ports,
            reminders: []           // M3/M4 will inject real reminders
        )

        let newSample = NetSample(inBytes: inBytes, outBytes: outBytes, at: now)
        return (snapshot, newSample)
    }
}
