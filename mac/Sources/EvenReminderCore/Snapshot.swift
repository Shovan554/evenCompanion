import Foundation

// MARK: - Top-level Snapshot

public struct Snapshot: Codable, Equatable, Sendable {
    public var ts: Int
    public var host: String
    public var vitals: Vitals
    public var netProc: NetProc
    public var ports: [Port]
    public var reminders: [Reminder]

    public init(ts: Int, host: String, vitals: Vitals, netProc: NetProc, ports: [Port], reminders: [Reminder]) {
        self.ts = ts
        self.host = host
        self.vitals = vitals
        self.netProc = netProc
        self.ports = ports
        self.reminders = reminders
    }
}

// MARK: - Vitals

public struct Vitals: Equatable, Sendable {
    public var cpu: Double
    public var ramUsedGB: Double
    public var ramTotalGB: Double
    public var ramPressure: String
    public var diskFreeGB: Double
    public var diskTotalGB: Double
    public var ssdHealth: String
    public var ssdWearPct: Double?   // must encode as null when nil

    public init(cpu: Double, ramUsedGB: Double, ramTotalGB: Double, ramPressure: String,
                diskFreeGB: Double, diskTotalGB: Double, ssdHealth: String, ssdWearPct: Double? = nil) {
        self.cpu = cpu
        self.ramUsedGB = ramUsedGB
        self.ramTotalGB = ramTotalGB
        self.ramPressure = ramPressure
        self.diskFreeGB = diskFreeGB
        self.diskTotalGB = diskTotalGB
        self.ssdHealth = ssdHealth
        self.ssdWearPct = ssdWearPct
    }
}

extension Vitals: Codable {
    enum CodingKeys: String, CodingKey {
        case cpu, ramUsedGB, ramTotalGB, ramPressure, diskFreeGB, diskTotalGB, ssdHealth, ssdWearPct
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        cpu         = try c.decode(Double.self, forKey: .cpu)
        ramUsedGB   = try c.decode(Double.self, forKey: .ramUsedGB)
        ramTotalGB  = try c.decode(Double.self, forKey: .ramTotalGB)
        ramPressure = try c.decode(String.self, forKey: .ramPressure)
        diskFreeGB  = try c.decode(Double.self, forKey: .diskFreeGB)
        diskTotalGB = try c.decode(Double.self, forKey: .diskTotalGB)
        ssdHealth   = try c.decode(String.self, forKey: .ssdHealth)
        ssdWearPct  = try c.decodeIfPresent(Double.self, forKey: .ssdWearPct)
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(cpu,         forKey: .cpu)
        try c.encode(ramUsedGB,   forKey: .ramUsedGB)
        try c.encode(ramTotalGB,  forKey: .ramTotalGB)
        try c.encode(ramPressure, forKey: .ramPressure)
        try c.encode(diskFreeGB,  forKey: .diskFreeGB)
        try c.encode(diskTotalGB, forKey: .diskTotalGB)
        try c.encode(ssdHealth,   forKey: .ssdHealth)
        // Encode Optional<Double> directly — writes null when nil
        try c.encode(ssdWearPct,  forKey: .ssdWearPct)
    }
}

// MARK: - NetProc

public struct NetProc: Equatable, Sendable {
    public var upKBs: Double
    public var downKBs: Double
    public var topProc: TopProc?   // must encode as null when nil
    public var battery: Battery?   // must encode as null when nil

    public init(upKBs: Double, downKBs: Double, topProc: TopProc? = nil, battery: Battery? = nil) {
        self.upKBs = upKBs
        self.downKBs = downKBs
        self.topProc = topProc
        self.battery = battery
    }
}

extension NetProc: Codable {
    enum CodingKeys: String, CodingKey {
        case upKBs, downKBs, topProc, battery
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        upKBs   = try c.decode(Double.self, forKey: .upKBs)
        downKBs = try c.decode(Double.self, forKey: .downKBs)
        topProc = try c.decodeIfPresent(TopProc.self, forKey: .topProc)
        battery = try c.decodeIfPresent(Battery.self, forKey: .battery)
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(upKBs,   forKey: .upKBs)
        try c.encode(downKBs, forKey: .downKBs)
        // Encode Optional directly — writes null when nil
        try c.encode(topProc, forKey: .topProc)
        try c.encode(battery, forKey: .battery)
    }
}

// MARK: - TopProc

public struct TopProc: Codable, Equatable, Sendable {
    public var name: String
    public var cpu: Double

    public init(name: String, cpu: Double) {
        self.name = name
        self.cpu = cpu
    }
}

// MARK: - Battery

public struct Battery: Codable, Equatable, Sendable {
    public var pct: Int
    public var charging: Bool

    public init(pct: Int, charging: Bool) {
        self.pct = pct
        self.charging = charging
    }
}

// MARK: - Port

public struct Port: Codable, Equatable, Sendable {
    public var port: Int
    public var proc: String

    public init(port: Int, proc: String) {
        self.port = port
        self.proc = proc
    }
}

// MARK: - Reminder

public struct Reminder: Equatable, Sendable {
    public var id: String
    public var title: String
    public var due: Int?   // must encode as null when nil
    public var overdue: Bool

    public init(id: String, title: String, due: Int? = nil, overdue: Bool) {
        self.id = id
        self.title = title
        self.due = due
        self.overdue = overdue
    }
}

extension Reminder: Codable {
    enum CodingKeys: String, CodingKey {
        case id, title, due, overdue
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id      = try c.decode(String.self, forKey: .id)
        title   = try c.decode(String.self, forKey: .title)
        due     = try c.decodeIfPresent(Int.self, forKey: .due)
        overdue = try c.decode(Bool.self, forKey: .overdue)
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id,      forKey: .id)
        try c.encode(title,   forKey: .title)
        // Encode Optional directly — writes null when nil
        try c.encode(due,     forKey: .due)
        try c.encode(overdue, forKey: .overdue)
    }
}

// MARK: - Helper

/// Encodes a Snapshot to a JSON string using sorted keys for stable output.
public func snapshotJSON(_ s: Snapshot) -> String {
    let encoder = JSONEncoder()
    encoder.outputFormatting = .sortedKeys
    // swiftlint:disable:next force_try
    let data = try! encoder.encode(s)
    return String(data: data, encoding: .utf8)!
}
