import SwiftUI
import EvenReminderCore

struct SettingsView: View {
    @EnvironmentObject var model: AppModel
    @State private var launchAtLogin: Bool = LoginItem.isEnabled

    var body: some View {
        Form {
            Section("Relay") {
                TextField("Relay URL", text: $model.relayUrl)
                    .textFieldStyle(.roundedBorder)
                SecureField("Relay Token", text: $model.relayToken)
                Toggle("Publish Enabled", isOn: $model.publishEnabled)
            }

            Section("Screens") {
                ForEach(Array(model.screensEnabled.keys.sorted()), id: \.self) { key in
                    Toggle(key.capitalized, isOn: Binding(
                        get: { model.screensEnabled[key] ?? true },
                        set: { model.screensEnabled[key] = $0 }
                    ))
                }
            }

            Section("Status") {
                HStack {
                    Text("Connection:")
                    Text(model.connectionStatus)
                        .foregroundColor(model.connectionStatus == "Connected" ? .green : .secondary)
                }
            }

            Section("System") {
                Toggle("Launch at Login", isOn: $launchAtLogin)
                    .onChange(of: launchAtLogin) { _, newValue in
                        model.toggleLaunchAtLogin()
                    }
                Button("Apply") {
                    model.applyConfig()
                }
                Button("Quit") {
                    NSApplication.shared.terminate(nil)
                }
                .foregroundColor(.red)
            }
        }
        .formStyle(.grouped)
        .frame(width: 320, height: 480)
    }
}
