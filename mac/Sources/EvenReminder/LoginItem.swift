import ServiceManagement

public enum LoginItem {
    public static func enable() { try? SMAppService.mainApp.register() }
    public static func disable() { try? SMAppService.mainApp.unregister() }
    public static var isEnabled: Bool { SMAppService.mainApp.status == .enabled }
}
