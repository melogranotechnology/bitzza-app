import SwiftUI

struct SendPaymentView: View {
    @EnvironmentObject private var session: SessionStore
    @Environment(\.dismiss) private var dismiss
    @State private var recipient: String
    @State private var amount = ""
    @State private var note = ""
    @State private var showingError = false

    init(initialRecipient: String = "") {
        _recipient = State(initialValue: initialRecipient)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Email destinatario", text: $recipient)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    TextField("Importo in BITZ demo", text: $amount)
                        .keyboardType(.decimalPad)
                    TextField("Descrizione (facoltativa)", text: $note)
                        .textInputAutocapitalization(.sentences)
                } header: {
                    Text("Invia un pagamento demo")
                } footer: {
                    Text("Trasferimento simulato nel ledger demo. Non invia token o fondi reali.")
                }

                Section {
                    Button {
                        submit()
                    } label: {
                        HStack {
                            Spacer()
                            if session.isLoading { ProgressView().padding(.trailing, 6) }
                            Text(session.isLoading ? "Invio…" : "Conferma invio demo")
                                .fontWeight(.bold)
                            Spacer()
                        }
                    }
                    .disabled(session.isLoading)
                }
            }
            .scrollContentBackground(.hidden)
            .background(BitzzaTheme.paper)
            .navigationTitle("Invia BITZ")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Chiudi") { dismiss() }
                }
            }
            .alert("Pagamento non inviato", isPresented: $showingError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(session.errorMessage ?? "")
            }
            .onChange(of: session.errorMessage) { _, newValue in
                showingError = newValue != nil
            }
        }
    }

    private func submit() {
        Task {
            let normalizedAmount = amount.replacingOccurrences(of: ",", with: ".")
            if await session.send(amountText: normalizedAmount, recipient: recipient, description: note) {
                dismiss()
            }
        }
    }
}
