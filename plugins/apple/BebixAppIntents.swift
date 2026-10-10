// Siri dhe Shortcuts për Bebix (App Intents, iOS 16+).
// E shton plugins/withBebixAppIntents.js gjatë build-it; mos e ndrysho te ios/ (gjenerohet).
//
// Çdo veprim hap një lidhje bebix:// — e njëjta rrugë si widget-i dhe
// shortcuts e Android-it (app/log/*, app/sleep/toggle): shënimi hyn në radhë,
// pa dyfishim, edhe pa internet.

import AppIntents
import UIKit

@available(iOS 16.0, *)
private enum BebixLink {
  @MainActor
  static func open(_ value: String) {
    guard let url = URL(string: value) else { return }
    UIApplication.shared.open(url)
  }
}

@available(iOS 16.0, *)
struct BebixWetDiaperIntent: AppIntent {
  static let title: LocalizedStringResource = "Wet diaper"
  static let description = IntentDescription("Logs a wet diaper in Bebix.")
  static let openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    BebixLink.open("bebix://log/diaper?type=wet")
    return .result()
  }
}

@available(iOS 16.0, *)
struct BebixDirtyDiaperIntent: AppIntent {
  static let title: LocalizedStringResource = "Dirty diaper"
  static let description = IntentDescription("Logs a dirty diaper in Bebix.")
  static let openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    BebixLink.open("bebix://log/diaper?type=dirty")
    return .result()
  }
}

@available(iOS 16.0, *)
struct BebixSleepToggleIntent: AppIntent {
  static let title: LocalizedStringResource = "Sleep or wake up"
  static let description = IntentDescription("Starts or ends the baby's sleep in Bebix.")
  static let openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    BebixLink.open("bebix://sleep/toggle")
    return .result()
  }
}

@available(iOS 16.0, *)
struct BebixFeedingIntent: AppIntent {
  static let title: LocalizedStringResource = "Log a feeding"
  static let description = IntentDescription("Opens feeding in Bebix, ready to log.")
  static let openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    BebixLink.open("bebix://log/feeding")
    return .result()
  }
}

// Frazat që Siri i njeh pa i regjistruar prindi vetë. Siri s'flet shqip:
// frazat janë në anglisht; në Shortcuts mund t'i riemërtosh si të duash.
@available(iOS 16.0, *)
struct BebixAppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: BebixWetDiaperIntent(),
      phrases: ["Log a wet diaper in \(.applicationName)", "\(.applicationName) wet diaper"]
    )
    AppShortcut(
      intent: BebixDirtyDiaperIntent(),
      phrases: ["Log a dirty diaper in \(.applicationName)", "\(.applicationName) dirty diaper"]
    )
    AppShortcut(
      intent: BebixSleepToggleIntent(),
      phrases: ["\(.applicationName) sleep", "Baby is sleeping in \(.applicationName)", "Baby woke up in \(.applicationName)"]
    )
    AppShortcut(
      intent: BebixFeedingIntent(),
      phrases: ["Log a feeding in \(.applicationName)", "\(.applicationName) feeding"]
    )
  }
}
