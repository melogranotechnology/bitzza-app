import SwiftUI

struct OnboardingView: View {
    let onFinish: () -> Void
    @State private var page = 0

    private let pages: [(symbol: String, title: String, text: String)] = [
        ("wallet.pass", "Benvenuto in BITZZA", "Un wallet dimostrativo per pizzerie e filiere locali."),
        ("exclamationmark.shield", "È una simulazione", "Tutti i saldi e i pagamenti sono fittizi. Nessun denaro, cripto o token reale."),
        ("qrcode.viewfinder", "Prova le funzioni", "Invia, ricevi con QR, usa voucher pizza, mercato e ricompense. Tutto resta sul tuo iPhone.")
    ]

    var body: some View {
        ZStack {
            BitzzaTheme.paper.ignoresSafeArea()
            VStack(spacing: 24) {
                TabView(selection: $page) {
                    ForEach(pages.indices, id: \.self) { index in
                        VStack(spacing: 18) {
                            Image(systemName: pages[index].symbol)
                                .font(.system(size: 64))
                                .foregroundStyle(BitzzaTheme.tomato)
                                .accessibilityHidden(true)
                            Text(pages[index].title)
                                .font(.system(size: 28, weight: .bold, design: .rounded))
                                .foregroundStyle(BitzzaTheme.forest)
                            Text(pages[index].text)
                                .font(.body)
                                .multilineTextAlignment(.center)
                                .foregroundStyle(BitzzaTheme.muted)
                        }
                        .padding(.horizontal, 32)
                        .tag(index)
                    }
                }
                .tabViewStyle(.page)
                Button {
                    if page < pages.count - 1 { withAnimation { page += 1 } } else { onFinish() }
                } label: {
                    Text(page < pages.count - 1 ? "Avanti" : "Inizia")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(16)
                        .foregroundStyle(.white)
                        .background(BitzzaTheme.tomato)
                        .clipShape(RoundedRectangle(cornerRadius: 13))
                }
                .padding(.horizontal, 26)
                .padding(.bottom, 24)
            }
        }
    }
}
