import SwiftUI
import UIKit

@main
struct BitzzaApp: App {
    @StateObject private var session = SessionStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
                .preferredColorScheme(preferredColorScheme)
        }
    }

    private var preferredColorScheme: ColorScheme? {
        switch session.settings?.theme {
        case "dark": .dark
        case "system", nil: nil
        default: .light
        }
    }
}

private struct RootView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var isReady = false
    @AppStorage("bitzza.onboarding.done") private var onboardingDone = false

    var body: some View {
        Group {
            if !isReady {
                LaunchView()
            } else if !onboardingDone && !session.isAuthenticated {
                OnboardingView { onboardingDone = true }
            } else if session.isAuthenticated {
                WalletTabsView()
            } else {
                AuthenticationView()
            }
        }
        .task {
            try? await Task.sleep(for: .milliseconds(850))
            withAnimation(.easeInOut(duration: 0.25)) {
                isReady = true
            }
            if session.isAuthenticated {
                await session.refresh()
                await session.loadSettings()
            }
        }
        .tint(BitzzaTheme.tomato)
    }
}

private struct LaunchView: View {
    var body: some View {
        ZStack {
            BitzzaTheme.forestFill.ignoresSafeArea()
            VStack(spacing: 18) {
                Image("Logo")
                    .resizable()
                    .scaledToFill()
                    .frame(width: 138, height: 138)
                    .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: 28, style: .continuous)
                            .stroke(.white.opacity(0.8), lineWidth: 3)
                    }
                    .shadow(color: .black.opacity(0.22), radius: 25, y: 12)
                Text("BITZZA")
                    .font(.system(size: 23, weight: .black, design: .rounded))
                    .tracking(5)
                    .foregroundStyle(.white)
                Text("Valore locale, in movimento")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.72))
                ProgressView()
                    .tint(BitzzaTheme.gold)
                    .padding(.top, 12)
            }
        }
    }
}

enum BitzzaTheme {
    static let forestFill = Color(red: 23.0 / 255, green: 61.0 / 255, blue: 45.0 / 255)
    static let forest = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 145.0 / 255, green: 205.0 / 255, blue: 164.0 / 255, alpha: 1)
            : UIColor(red: 23.0 / 255, green: 61.0 / 255, blue: 45.0 / 255, alpha: 1)
    })
    static let tomato = Color(red: 230.0 / 255, green: 94.0 / 255, blue: 47.0 / 255)
    static let gold = Color(red: 245.0 / 255, green: 185.0 / 255, blue: 66.0 / 255)
    static let paper = Color(uiColor: .systemGroupedBackground)
    static let card = Color(uiColor: .secondarySystemGroupedBackground)
    static let input = Color(uiColor: .tertiarySystemGroupedBackground)
    static let muted = Color(uiColor: .secondaryLabel)
}
