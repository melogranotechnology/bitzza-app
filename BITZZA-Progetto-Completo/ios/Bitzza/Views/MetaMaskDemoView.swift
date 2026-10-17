import SwiftUI

struct MetaMaskDemoView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var amount = "25"
    @State private var fromAsset = "USDC"
    @State private var confirmingSwap = false
    @State private var confirmingHistoryReset = false

    private var inputAmount: Double {
        Double(amount.replacingOccurrences(of: ",", with: ".")) ?? 0
    }

    private var outputAmount: Double {
        let rate = OfflineDemoFixtures.swapRateUSDCPerBITZ
        let gross = fromAsset == "USDC" ? inputAmount / rate : inputAmount * rate
        return max(0, gross * 0.997)
    }

    private var feeAmount: Double {
        let rate = OfflineDemoFixtures.swapRateUSDCPerBITZ
        let gross = fromAsset == "USDC" ? inputAmount / rate : inputAmount * rate
        return max(0, gross * 0.003)
    }

    private var isValidAmount: Bool {
        inputAmount.isFinite
            && inputAmount > 0
            && abs(inputAmount * 100 - (inputAmount * 100).rounded()) < 0.000001
            && outputAmount.isFinite
            && outputAmount > 0
    }

    private var inputAssetLabel: String { fromAsset == "USDC" ? "USDC" : "BITZ" }
    private var outputAssetLabel: String { fromAsset == "USDC" ? "BITZ" : "USDC" }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(alignment: .leading, spacing: 12) {
                        Label("PROTOTIPO · SOLO SIMULAZIONE", systemImage: "exclamationmark.shield.fill")
                            .font(.caption.weight(.bold))
                            .tracking(0.7)
                            .foregroundStyle(BitzzaTheme.gold)
                        Text("Nessun collegamento reale a MetaMask. BITZ e USDC qui sono asset dimostrativi: non vengono richiesti permessi, firme o pagamenti.")
                            .font(.subheadline)
                            .foregroundStyle(.white.opacity(0.85))
                        Text("Non usare seed phrase o credenziali reali in questa demo.")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.white)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(17)
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(BitzzaTheme.forestFill)
                }

                Section {
                    HStack(spacing: 12) {
                        Image(systemName: session.isMetaMaskDemoConnected ? "wallet.pass.fill" : "wallet.pass")
                            .font(.title2)
                            .foregroundStyle(session.isMetaMaskDemoConnected ? BitzzaTheme.forest : BitzzaTheme.muted)
                            .frame(width: 42, height: 42)
                            .background(BitzzaTheme.forest.opacity(0.1))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        VStack(alignment: .leading, spacing: 4) {
                            Text(session.isMetaMaskDemoConnected ? "Collegamento demo attivo" : "Nessun wallet collegato")
                                .font(.subheadline.weight(.semibold))
                            Text(session.isMetaMaskDemoConnected ? "0xDEMO…B17Z · rete di prova" : "Crea una sessione fittizia locale")
                                .font(.caption.monospaced())
                                .foregroundStyle(BitzzaTheme.muted)
                        }
                        Spacer()
                    }

                    if session.isMetaMaskDemoConnected {
                        Button {
                            session.disconnectMetaMaskDemo()
                        } label: {
                            Label("Disconnetti demo", systemImage: "xmark.circle")
                        }
                        .foregroundStyle(BitzzaTheme.tomato)
                    } else {
                        Button {
                            session.connectMetaMaskDemo()
                        } label: {
                            Label("Simula collegamento", systemImage: "link")
                        }
                    }
                } header: {
                    Text("Portafoglio dimostrativo")
                } footer: {
                    Text("Il pulsante non apre MetaMask e non legge un account: mostra soltanto come potrebbe apparire il flusso.")
                }

                Section {
                    Picker("Dai", selection: $fromAsset) {
                        Text("USDC demo").tag("USDC")
                        Text("BITZ demo").tag("BITZ")
                    }
                    .pickerStyle(.segmented)
                    .accessibilityLabel("Asset di partenza")

                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        TextField("Importo", text: $amount)
                            .font(.system(size: 32, weight: .bold, design: .rounded))
                            .keyboardType(.decimalPad)
                            .accessibilityLabel("Importo \(inputAssetLabel) demo")
                        Text(inputAssetLabel)
                            .font(.headline)
                            .foregroundStyle(BitzzaTheme.muted)
                    }

                    HStack(spacing: 9) {
                        ForEach(["10", "25", "50"], id: \.self) { preset in
                            Button(preset) { amount = preset }
                                .font(.caption.weight(.semibold))
                                .buttonStyle(.bordered)
                                .tint(BitzzaTheme.forest)
                                .accessibilityLabel("Imposta importo \(preset) \(inputAssetLabel) demo")
                        }
                        Spacer()
                        Button {
                            withAnimation(.easeInOut(duration: 0.18)) {
                                fromAsset = fromAsset == "USDC" ? "BITZ" : "USDC"
                            }
                        } label: {
                            Label("Inverti", systemImage: "arrow.up.arrow.down")
                                .labelStyle(.iconOnly)
                        }
                        .buttonStyle(.bordered)
                        .tint(BitzzaTheme.tomato)
                        .accessibilityLabel("Inverti asset dello swap")
                    }

                    VStack(spacing: 12) {
                        quoteRow(
                            title: "Riceveresti",
                            value: "\(outputAmount.formatted(.number.precision(.fractionLength(2...4)))) \(outputAssetLabel) demo",
                            emphasized: true
                        )
                        Divider()
                        quoteRow(
                            title: "Tasso indicativo",
                            value: "1 BITZ = \(OfflineDemoFixtures.swapRateUSDCPerBITZ.formatted(.number.precision(.fractionLength(2)))) USDC"
                        )
                        quoteRow(
                            title: "Commissione demo (0,30%)",
                            value: "\(feeAmount.formatted(.number.precision(.fractionLength(4)))) \(outputAssetLabel)"
                        )
                    }
                    .padding(14)
                    .background(BitzzaTheme.card)
                    .clipShape(RoundedRectangle(cornerRadius: 14))

                    if !amount.isEmpty && !isValidAmount {
                        Label("Inserisci un importo positivo con massimo due decimali.", systemImage: "exclamationmark.circle")
                            .font(.caption)
                            .foregroundStyle(BitzzaTheme.tomato)
                    }

                    Button {
                        confirmingSwap = true
                    } label: {
                        Label("Simula swap", systemImage: "arrow.left.arrow.right")
                            .frame(maxWidth: .infinity)
                    }
                    .disabled(!session.isMetaMaskDemoConnected || !isValidAmount)
                    .confirmationDialog(
                        "Eseguire la simulazione?",
                        isPresented: $confirmingSwap,
                        titleVisibility: .visible
                    ) {
                        Button("Registra swap demo") {
                            session.simulateSwap(
                                amountText: normalizedAmount,
                                fromAsset: fromAsset
                            )
                        }
                        Button("Annulla", role: .cancel) {}
                    } message: {
                        Text("Verrà aggiunta una riga alla cronologia locale. Nessun asset o saldo reale sarà modificato.")
                    }
                } header: {
                    Text("Swap simulato")
                }

                Section {
                    if session.demoSwaps.isEmpty {
                        ContentUnavailableView(
                            "Nessuno swap demo",
                            systemImage: "arrow.left.arrow.right",
                            description: Text("Simula un collegamento e un cambio per vedere qui l’anteprima.")
                        )
                    } else {
                        ForEach(session.demoSwaps) { swap in
                            VStack(alignment: .leading, spacing: 5) {
                                Text("\(swap.inputAmount.formatted(.number.precision(.fractionLength(2)))) \(swap.inputAsset) → \(swap.outputAmount.formatted(.number.precision(.fractionLength(2...4)))) \(swap.outputAsset)")
                                    .font(.subheadline.weight(.semibold))
                                    .lineLimit(2)
                                Text("Commissione demo \(swap.feeAmount.formatted(.number.precision(.fractionLength(4)))) · \(swap.createdAt.formatted(date: .abbreviated, time: .shortened))")
                                    .font(.caption)
                                    .foregroundStyle(BitzzaTheme.muted)
                                Text("SIMULATO · NON INVIATO")
                                    .font(.system(size: 9, weight: .bold, design: .rounded))
                                    .tracking(0.7)
                                    .foregroundStyle(BitzzaTheme.tomato)
                                }
                            .padding(.vertical, 3)
                        }
                    }
                } header: {
                    Text("Cronologia locale")
                } footer: {
                    if !session.demoSwaps.isEmpty {
                        Button("Cancella cronologia swap demo", role: .destructive) {
                            confirmingHistoryReset = true
                        }
                        .confirmationDialog(
                            "Cancellare la cronologia locale?",
                            isPresented: $confirmingHistoryReset,
                            titleVisibility: .visible
                        ) {
                            Button("Cancella cronologia", role: .destructive) {
                                session.clearDemoSwapHistory()
                            }
                            Button("Annulla", role: .cancel) {}
                        } message: {
                            Text("Verranno cancellate solo le righe della simulazione salvate su questo dispositivo.")
                        }
                    }
                }
            }
            .navigationTitle("MetaMask / Swap")
            .navigationBarTitleDisplayMode(.inline)
            .scrollContentBackground(.hidden)
            .background(BitzzaTheme.paper)
        }
    }

    private var normalizedAmount: String {
        amount.replacingOccurrences(of: ",", with: ".")
    }

    private func quoteRow(title: String, value: String, emphasized: Bool = false) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text(title)
                .font(emphasized ? .subheadline.weight(.semibold) : .caption)
                .foregroundStyle(emphasized ? BitzzaTheme.forest : BitzzaTheme.muted)
            Spacer(minLength: 8)
            Text(value)
                .font(emphasized ? .subheadline.weight(.bold).monospacedDigit() : .caption.weight(.medium).monospacedDigit())
                .foregroundStyle(emphasized ? BitzzaTheme.forest : .primary)
                .multilineTextAlignment(.trailing)
        }
    }
}
