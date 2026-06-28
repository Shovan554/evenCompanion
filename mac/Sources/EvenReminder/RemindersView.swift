import SwiftUI
import EvenReminderCore

struct RemindersView: View {
    @EnvironmentObject var model: AppModel
    @State private var newTitle: String = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                TextField("New reminder…", text: $newTitle)
                    .textFieldStyle(.roundedBorder)
                Button("Add") {
                    let t = newTitle.trimmingCharacters(in: .whitespaces)
                    guard !t.isEmpty else { return }
                    newTitle = ""
                    Task { await model.addReminder(title: t) }
                }
                .disabled(newTitle.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(.horizontal)

            Divider()

            if model.reminders.isEmpty {
                Text("No upcoming reminders")
                    .foregroundColor(.secondary)
                    .padding()
            } else {
                List(model.reminders, id: \.id) { reminder in
                    HStack {
                        Image(systemName: reminder.overdue ? "exclamationmark.circle.fill" : "circle")
                            .foregroundColor(reminder.overdue ? .red : .secondary)
                        Text(reminder.title)
                            .foregroundColor(reminder.overdue ? .red : .primary)
                        Spacer()
                        if let due = reminder.due {
                            Text(Date(timeIntervalSince1970: Double(due)), style: .date)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }
                .listStyle(.plain)
            }
        }
        .frame(width: 300, height: 400)
    }
}
