import Foundation

// MARK: - parseTopCPU
// Input: stdout of `top -l 2 -n 0`
// Returns sum of user% + sys% from the LAST "CPU usage:" line.
// Example line: "CPU usage: 3.61% user, 5.73% sys, 90.64% idle"  → 9.34
public func parseTopCPU(_ text: String) -> Double {
    // Collect ALL "CPU usage:" lines, take the last one.
    let cpuLines = text.components(separatedBy: .newlines)
        .filter { $0.contains("CPU usage:") }

    guard let line = cpuLines.last else { return 0.0 }

    // Extract all numbers that precede a '%'
    // Pattern: one or more digits (optional decimal) followed by '%'
    let pattern = #"(\d+(?:\.\d+)?)%"#
    guard let regex = try? NSRegularExpression(pattern: pattern) else { return 0.0 }
    let ns = line as NSString
    let matches = regex.matches(in: line, range: NSRange(location: 0, length: ns.length))

    // We expect: user%, sys%, idle% — in that order; sum first two.
    guard matches.count >= 2 else { return 0.0 }
    let userStr = ns.substring(with: matches[0].range(at: 1))
    let sysStr  = ns.substring(with: matches[1].range(at: 1))
    guard let user = Double(userStr), let sys = Double(sysStr) else { return 0.0 }

    // Round to 2 decimal places to avoid floating-point drift
    let sum = (user * 100 + sys * 100).rounded() / 100
    return sum
}

// MARK: - parseVmStat
// Input: stdout of `vm_stat`
// Returns (usedGB, pressure) where:
//   used pages = active + wired down + occupied by compressor
//   usedGB = usedPages * pageSize / 1e9
//   pressure: usedGB/totalGB > 0.9 → "critical", > 0.75 → "warn", else "normal"
public func parseVmStat(_ text: String, pageSize: Int, memTotalBytes: UInt64) -> (usedGB: Double, pressure: String) {
    func extractPages(from text: String, keyword: String) -> UInt64 {
        for line in text.components(separatedBy: .newlines) {
            if line.contains(keyword) {
                // Extract the last number on the line (strip trailing dot)
                let cleaned = line.trimmingCharacters(in: .whitespaces)
                    .replacingOccurrences(of: ".", with: "")
                let parts = cleaned.components(separatedBy: .whitespaces)
                if let last = parts.last, let val = UInt64(last) {
                    return val
                }
            }
        }
        return 0
    }

    let active     = extractPages(from: text, keyword: "Pages active:")
    let wired      = extractPages(from: text, keyword: "Pages wired down:")
    let compressor = extractPages(from: text, keyword: "Pages occupied by compressor:")
    let usedPages  = active + wired + compressor

    guard usedPages > 0 else { return (0.0, "normal") }

    let usedBytes  = Double(usedPages) * Double(pageSize)
    let usedGB     = usedBytes / 1_000_000_000.0
    let totalGB    = Double(memTotalBytes) / 1_000_000_000.0

    let ratio = totalGB > 0 ? usedGB / totalGB : 0.0
    let pressure: String
    if ratio > 0.9 {
        pressure = "critical"
    } else if ratio > 0.75 {
        pressure = "warn"
    } else {
        pressure = "normal"
    }

    return (usedGB, pressure)
}

// MARK: - parseDf
// Input: stdout of `df -k /`
// Columns (1-indexed): Filesystem, 1024-blocks (total), Used, Available, ...
// totalGB = total_1K_blocks * 1024 / 1e9
// freeGB  = available_1K_blocks * 1024 / 1e9
public func parseDf(_ text: String) -> (freeGB: Double, totalGB: Double) {
    let lines = text.components(separatedBy: .newlines)
        .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }

    // Skip the header line (starts with "Filesystem"); take the next non-empty line
    guard let dataLine = lines.first(where: { !$0.hasPrefix("Filesystem") }) else {
        return (0.0, 0.0)
    }

    let parts = dataLine.components(separatedBy: .whitespaces)
        .filter { !$0.isEmpty }

    // Expect: [Filesystem, 1024-blocks, Used, Available, ...]
    guard parts.count >= 4,
          let totalKB = Double(parts[1]),
          let availKB = Double(parts[3]) else {
        return (0.0, 0.0)
    }

    let totalGB = totalKB * 1024.0 / 1_000_000_000.0
    let freeGB  = availKB * 1024.0 / 1_000_000_000.0
    return (freeGB, totalGB)
}

// MARK: - parseDiskutilSMART
// Input: stdout of `diskutil info /`
// Returns the value after "SMART Status:" or "Unknown".
public func parseDiskutilSMART(_ text: String) -> String {
    for line in text.components(separatedBy: .newlines) {
        if line.contains("SMART Status:") {
            // Extract the part after the colon
            let parts = line.components(separatedBy: ":")
            if parts.count >= 2 {
                return parts[1...].joined(separator: ":").trimmingCharacters(in: .whitespaces)
            }
        }
    }
    return "Unknown"
}

// MARK: - parseLsofListening
// Input: stdout of `lsof -nP -iTCP -sTCP:LISTEN`
// Returns [Port] deduped by port number, sorted ascending.
// Only processes lines containing "(LISTEN)".
// lsof output columns (0-indexed, whitespace-split):
//   0: COMMAND  1: PID  2: USER  3: FD  4: TYPE  5: DEVICE  6: SIZE/OFF  7: NODE  8: NAME  9: (LISTEN)
// Port is the number after the last ':' in the NAME column (index 8).
public func parseLsofListening(_ text: String) -> [Port] {
    var seen = Set<Int>()
    var result: [Port] = []

    let lines = text.components(separatedBy: .newlines)
    for line in lines {
        guard line.contains("(LISTEN)") else { continue }

        let parts = line.components(separatedBy: .whitespaces).filter { !$0.isEmpty }
        // We need at least: COMMAND(0) ... NAME(8) (LISTEN)(9)
        // NAME col should contain ":" and come before "(LISTEN)"
        guard let command = parts.first else { continue }

        // Find the NAME field: it's the part containing ":" that precedes "(LISTEN)"
        // Typically at index 8, but let's find it robustly
        var namePart: String? = nil
        if let listenIdx = parts.firstIndex(of: "(LISTEN)"), listenIdx > 0 {
            namePart = parts[listenIdx - 1]
        }

        guard let name = namePart,
              let portStr = name.components(separatedBy: ":").last,
              let portNum = Int(portStr) else { continue }

        if seen.insert(portNum).inserted {
            result.append(Port(port: portNum, proc: command))
        }
    }

    return result.sorted { $0.port < $1.port }
}

// MARK: - parseNetstat
// Input: stdout of `netstat -ib`
// Sum Ibytes and Obytes across all non-loopback interfaces.
// Only count the first row per interface (the "<Link#N>" row).
// lo0 is excluded.
//
// The netstat -ib header is:
//   Name Mtu Network Address Ipkts Ierrs Ibytes Opkts Oerrs Obytes Coll
// When an interface has an Address field (MAC), there are 11 columns:
//   [0:Name][1:Mtu][2:Network/Link#][3:Address][4:Ipkts][5:Ierrs][6:Ibytes][7:Opkts][8:Oerrs][9:Obytes][10:Coll]
// When no Address field (virtual/tunnel interfaces), there are 10 columns:
//   [0:Name][1:Mtu][2:Network/Link#][3:Ipkts][4:Ierrs][5:Ibytes][6:Opkts][7:Oerrs][8:Obytes][9:Coll]
// Distinguish by checking if parts[3] looks like a MAC address (contains ":") or is all digits.
public func parseNetstat(_ text: String) -> (inBytes: UInt64, outBytes: UInt64) {
    var totalIn:  UInt64 = 0
    var totalOut: UInt64 = 0
    var seenInterfaces = Set<String>()

    let lines = text.components(separatedBy: .newlines)
    for line in lines {
        let parts = line.components(separatedBy: .whitespaces).filter { !$0.isEmpty }
        guard parts.count >= 10 else { continue }

        let ifName = parts[0]

        // Only process <Link#N> rows
        guard parts.contains(where: { $0.hasPrefix("<Link#") }) else { continue }

        // Exclude loopback
        guard !ifName.hasPrefix("lo") else { continue }

        // First occurrence only
        guard seenInterfaces.insert(ifName).inserted else { continue }

        // Determine column layout: if parts[3] contains ":" or is a MAC-like hex address,
        // we have 11 columns; otherwise 10 columns.
        let hasAddress: Bool
        if parts.count >= 11 {
            // 4th field is Address (MAC like "1c:f6:4c:59:4f:cc") — contains colons
            hasAddress = parts[3].contains(":")
        } else {
            hasAddress = false
        }

        let ibytesIdx = hasAddress ? 6 : 5
        let obytesIdx = hasAddress ? 9 : 8

        guard ibytesIdx < parts.count, obytesIdx < parts.count,
              let ibytes = UInt64(parts[ibytesIdx]),
              let obytes = UInt64(parts[obytesIdx]) else { continue }

        totalIn  += ibytes
        totalOut += obytes
    }

    return (totalIn, totalOut)
}

// MARK: - parsePmsetBattery
// Input: stdout of `pmset -g batt`
// Returns Battery? (nil if no InternalBattery line = desktop).
// charging = true if line contains "AC Power" header AND battery line has "charging" or "charged"
// OR if battery line itself mentions "charging"/"charged"
public func parsePmsetBattery(_ text: String) -> Battery? {
    let lines = text.components(separatedBy: .newlines)

    // Find line containing "InternalBattery"
    guard let battLine = lines.first(where: { $0.contains("InternalBattery") }) else {
        return nil
    }

    // Extract percentage: e.g. "87%;" → 87
    let pctPattern = #"(\d+)%"#
    guard let pctRegex = try? NSRegularExpression(pattern: pctPattern),
          let match = pctRegex.firstMatch(in: battLine,
                                           range: NSRange(battLine.startIndex..., in: battLine)),
          let range = Range(match.range(at: 1), in: battLine),
          let pct = Int(battLine[range]) else {
        return nil
    }

    // charging if the first line says 'AC Power', or the battery state token is "charging"/"charged"
    // (the state token appears between semicolons, e.g. "87%; charging; 1:22 remaining")
    // We must NOT match "discharging" which also contains "charging".
    let firstLine = lines.first ?? ""
    let acPower   = firstLine.lowercased().contains("ac power")

    // Extract the semicolon-separated state token (e.g. "charging", "charged", "discharging")
    // Battery line format: "-InternalBattery-0 (id=...) XX%; STATE; ..."
    var stateToken = ""
    let tokens = battLine.components(separatedBy: ";")
    if tokens.count >= 2 {
        stateToken = tokens[1].trimmingCharacters(in: .whitespaces).lowercased()
    }
    let isCharging = acPower || stateToken == "charging" || stateToken == "charged"

    return Battery(pct: pct, charging: isCharging)
}

// MARK: - parseTopProcess
// Input: stdout of `ps -Aceo pcpu,comm -r`
// Skip the header line ("%CPU COMM"), take the first data row.
// Returns TopProc? (nil if no data rows).
public func parseTopProcess(_ text: String) -> TopProc? {
    let lines = text.components(separatedBy: .newlines)

    // Skip the header and any empty lines; take the first actual data line
    for line in lines {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { continue }
        // Header line contains "%CPU" or "COMM"
        if trimmed.contains("%CPU") || trimmed.hasPrefix("COMM") { continue }

        // The line format is "  6.2 claude" — split on whitespace
        let parts = trimmed.components(separatedBy: .whitespaces).filter { !$0.isEmpty }
        guard parts.count >= 2,
              let cpu = Double(parts[0]) else { continue }

        // Command name is the rest (may contain spaces though ps -comm usually won't)
        let name = parts[1...].joined(separator: " ")
        return TopProc(name: name, cpu: cpu)
    }

    return nil
}
