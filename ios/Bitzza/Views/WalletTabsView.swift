import SwiftUI
import Charts
import Combine
import UIKit

struct WalletTabsView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            WalletHomeView()
                .tabItem { Label("Wallet", systemImage: "wallet.bifold") }
                .tag(0)

            MarketView()
                .tabItem { Label("Mercato", systemImage: "chart.xyaxis.line") }
                .tag(1)

            ToolsView()
                .tabItem { Label("Strumenti", systemImage: "square.grid.2x2") }
                .tag(2)

            ContactsView { email in
                session.paymentRecipient = email
                selectedTab = 0
            }
                .tabItem { Label("Contatti", systemImage: "person.crop.circle") }
                .tag(3)

            SettingsView()
                .tabItem { Label("Impostazioni", systemImage: "gearshape") }
                .tag(4)
        }
        .tint(BitzzaTheme.tomato)
        .safeAreaInset(edge: .top, spacing: 0) {
            if session.isOfflineDemo {
                HStack(spacing: 8) {
                    Image(systemName: "wifi.slash")
                    Text("DEMO OFFLINE")
                        .fontWeight(.bold)
                        .tracking(0.8)
                    Text("· dati solo su questo iPhone")
                        .fontWeight(.medium)
                    Spacer(minLength: 0)
                }
                .font(.caption2)
                .foregroundStyle(BitzzaTheme.forest)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(BitzzaTheme.gold.opacity(0.24))
                .accessibilityElement(children: .combine)
            }
        }
        .alert("BITZZA", isPresented: errorPresented) {
            Button("OK", role: .cancel) { session.errorMessage = nil }
        } message: {
            Text(session.errorMessage ?? "")
        }
        .alert("Operazione completata", isPresented: noticePresented) {
            Button("OK", role: .cancel) { session.notice = nil }
        } message: {
            Text(session.notice ?? "")
        }
    }

    private var errorPresented: Binding<Bool> {
        Binding(
            get: { session.errorMessage != nil },
            set: { if !$0 { session.errorMessage = nil } }
        )
    }

    private var noticePresented: Binding<Bool> {
        Binding(
            get: { session.notice != nil },
            set: { if !$0 { session.notice = nil } }
        )
    }
}

private struct ToolsView: View {
    var body: some View {
        NavigationStack {
            List {
                Section {
                    NavigationLink {
                        SpesaOrderView()
                    } label: {
                        ToolRow(
                            title: "Spesa a casa",
                            subtitle: "Ordina e paga con BITZ, cashback alla consegna",
                            symbol: "cart.fill",
                            tint: BitzzaTheme.tomato
                        )
                    }
                    NavigationLink {
                        LevelsView()
                    } label: {
                        ToolRow(
                            title: "Livelli e badge",
                            subtitle: "XP, serie giornaliera e traguardi",
                            symbol: "trophy.fill",
                            tint: BitzzaTheme.gold
                        )
                    }
                    NavigationLink {
                        DeliveryEarnView()
                    } label: {
                        ToolRow(
                            title: "Consegne SpesaGo",
                            subtitle: "Fai il corriere e guadagna BITZ demo",
                            symbol: "bicycle",
                            tint: BitzzaTheme.forest
                        )
                    }
                    NavigationLink {
                        PizzaRewardsView()
                    } label: {
                        ToolRow(
                            title: "Pizza-to-earn",
                            subtitle: "Scansiona il QR della pizzeria e guadagna BITZ demo",
                            symbol: "fork.knife",
                            tint: BitzzaTheme.gold
                        )
                    }
                    NavigationLink {
                        QRPaymentView()
                    } label: {
                        ToolRow(
                            title: "Pagamento QR",
                            subtitle: "Ricevi o paga subito con un codice QR",
                            symbol: "qrcode.viewfinder",
                            tint: BitzzaTheme.tomato
                        )
                    }
                    NavigationLink {
                        MetaMaskDemoView()
                    } label: {
                        ToolRow(
                            title: "MetaMask · swap demo",
                            subtitle: "Simula collegamento e cambio, senza blockchain",
                            symbol: "arrow.left.arrow.right",
                            tint: BitzzaTheme.gold
                        )
                    }
                    NavigationLink {
                        PizzaView()
                    } label: {
                        ToolRow(
                            title: "Pizzeria e voucher",
                            subtitle: "Catalogo demo, voucher e POS simulato",
                            symbol: "takeoutbag.and.cup.and.straw",
                            tint: BitzzaTheme.tomato
                        )
                    }
                    NavigationLink {
                        CommoditiesView()
                    } label: {
                        ToolRow(
                            title: "Filiere locali",
                            subtitle: "Scambia commodity virtuali",
                            symbol: "leaf",
                            tint: BitzzaTheme.forest
                        )
                    }
                    NavigationLink {
                        MiningView()
                    } label: {
                        ToolRow(
                            title: "Ricompense",
                            subtitle: "Richiedi ricompense BITZ demo",
                            symbol: "sparkles",
                            tint: BitzzaTheme.gold
                        )
                    }
                } header: {
                    Text("Esplora BITZZA")
                } footer: {
                    Text("Le funzioni di pagamento, mercati, voucher e ricompense sono simulazioni: non coinvolgono fondi o asset reali.")
                }
            }
            .navigationTitle("Strumenti")
            .background(BitzzaTheme.paper)
        }
    }
}

private struct ToolRow: View {
    let title: String
    let subtitle: String
    let symbol: String
    let tint: Color

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: symbol)
                .font(.system(size: 19, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: 44, height: 44)
                .background(tint.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 13))
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.headline).foregroundStyle(BitzzaTheme.forest)
                Text(subtitle).font(.caption).foregroundStyle(BitzzaTheme.muted)
            }
        }
        .padding(.vertical, 5)
    }
}

private struct ContactsView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var label = ""
    @State private var email = ""
    let onSend: (String) -> Void

    init(onSend: @escaping (String) -> Void = { _ in }) {
        self.onSend = onSend
    }
    var body: some View {
        NavigationStack {
            Form {
                Section("Aggiungi un contatto") {
                    TextField("Nome", text: $label)
                        .textContentType(.name)
                        .textInputAutocapitalization(.words)
                    TextField("Email", text: $email)
                        .keyboardType(.emailAddress)
                        .textContentType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Button {
                        Task {
                            await session.saveContact(label: label, email: email)
                            if session.errorMessage == nil {
                                label = ""
                                email = ""
                            }
                        }
                    } label: {
                        Label("Salva contatto", systemImage: "person.badge.plus")
                    }
                    .disabled(session.isFeatureLoading || label.trimmingCharacters(in: .whitespaces).isEmpty || email.isEmpty)
                }

                Section("Rubrica") {
                    if session.contacts.isEmpty {
                        ContentUnavailableView(
                            "Rubrica vuota",
                            systemImage: "person.crop.circle.badge.questionmark",
                            description: Text("I contatti salvati appariranno qui.")
                        )
                    } else {
                        ForEach(session.contacts) { contact in
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(contact.label).font(.headline)
                                    Text(contact.address).font(.caption).foregroundStyle(BitzzaTheme.muted)
                                }
                                Spacer()
                                Button {
                                    onSend(contact.address)
                                } label: {
                                    Image(systemName: "arrow.up.right")
                                }
                                .accessibilityLabel("Invia a \(contact.label)")
                                .buttonStyle(.borderless)
                                Button {
                                    UIPasteboard.general.string = contact.address
                                } label: {
                                    Image(systemName: "doc.on.doc")
                                }
                                .accessibilityLabel("Copia email")
                                .buttonStyle(.borderless)
                                Button(role: .destructive) {
                                    Task { await session.deleteContact(contact) }
                                } label: {
                                    Image(systemName: "trash")
                                }
                                .accessibilityLabel("Rimuovi contatto")
                                .buttonStyle(.borderless)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Contatti")
            .scrollContentBackground(.hidden)
            .background(BitzzaTheme.paper)
            .refreshable { await session.loadContacts() }
            .task {
                if session.contacts.isEmpty { await session.loadContacts() }
            }
        }
    }
}

private struct CommoditiesView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var selectedCommodity = "Pomodoro"
    @State private var units = "1"
    @State private var isBuying = true

    private let commodities: [(name: String, label: String, price: Double, symbol: String)] = [
        ("Pomodoro", "Pomodori", 2, "sun.max.fill"),
        ("Grano", "Grano", 1, "leaf.fill"),
        ("Latte", "Latte", 1.5, "drop.fill"),
    ]

    private var selected: (name: String, label: String, price: Double, symbol: String) {
        commodities.first { $0.name == selectedCommodity } ?? commodities[0]
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    ForEach(commodities, id: \.name) { item in
                        HStack(spacing: 12) {
                            Image(systemName: item.symbol)
                                .foregroundStyle(BitzzaTheme.tomato)
                                .frame(width: 34)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(item.label).font(.headline)
                                Text("\(item.price.formatted(.number.precision(.fractionLength(2)))) BITZ / unità")
                                    .font(.caption).foregroundStyle(BitzzaTheme.muted)
                            }
                            Spacer()
                            Text("\(session.commodityHoldings[item.name, default: 0].formatted(.number.precision(.fractionLength(0...2)))) unità")
                                .font(.subheadline.weight(.semibold))
                        }
                        .padding(.vertical, 3)
                    }
                } header: {
                    Text("Disponibilità demo")
                } footer: {
                    Text("Beni virtuali e prezzi simulati. Non rappresentano prodotti fisici o investimenti.")
                }

                Section("Operazione demo") {
                    Picker("Operazione", selection: $isBuying) {
                        Text("Acquista").tag(true)
                        Text("Vendi · commissione 5%").tag(false)
                    }
                    .pickerStyle(.segmented)
                    Picker("Prodotto", selection: $selectedCommodity) {
                        ForEach(commodities, id: \.name) { item in
                            Text(item.label).tag(item.name)
                        }
                    }
                    TextField("Unità", text: $units)
                        .keyboardType(.decimalPad)
                    if let amount = Double(units), amount > 0 {
                        LabeledContent("Totale stimato", value: "\(estimatedTotal(amount).formatted(.number.precision(.fractionLength(2)))) BITZ")
                    }
                    Button {
                        Task { await session.tradeCommodity(name: selected.name, unitsText: units, buying: isBuying) }
                    } label: {
                        HStack {
                            Spacer()
                            if session.isFeatureLoading { ProgressView().padding(.trailing, 5) }
                            Text(isBuying ? "Acquista demo" : "Vendi demo")
                            Spacer()
                        }
                    }
                    .disabled(session.isFeatureLoading || (Double(units) ?? 0) <= 0)
                }
            }
            .navigationTitle("Filiere locali")
            .scrollContentBackground(.hidden)
            .background(BitzzaTheme.paper)
            .refreshable { await session.loadCommodities() }
            .task { if session.commodityHoldings.isEmpty { await session.loadCommodities() } }
        }
    }

    private func estimatedTotal(_ amount: Double) -> Double {
        let gross = amount * selected.price
        return isBuying ? gross : gross * 0.95
    }
}

private struct MiningView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var cooldownEndsAt: Date?
    @State private var clock = Date()

    private var secondsRemaining: Int {
        max(0, Int(ceil((cooldownEndsAt ?? clock).timeIntervalSince(clock))))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    VStack(alignment: .leading, spacing: 9) {
                        Label("RICOMPENSE DEMO", systemImage: "sparkles")
                            .font(.caption.weight(.bold))
                            .tracking(1.3)
                            .foregroundStyle(BitzzaTheme.gold)
                        Text("Un piccolo premio alla volta.")
                            .font(.system(size: 27, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)
                        Text("Ogni richiesta è simulata e viene registrata nel ledger demo.")
                            .font(.subheadline)
                            .foregroundStyle(.white.opacity(0.78))
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(22)
                    .background(BitzzaTheme.forestFill)
                    .clipShape(RoundedRectangle(cornerRadius: 20))

                    if let status = session.miningStatus {
                        VStack(spacing: 12) {
                            metric("Prossima ricompensa", value: "\(status.nextReward.formatted(.number.precision(.fractionLength(2...4)))) BITZ")
                            metric("Ricompense totali", value: "\(status.totalMined.formatted(.number.precision(.fractionLength(2...4)))) BITZ")
                            metric("Richieste completate", value: "\(status.totalClaims)")
                            metric("Difficoltà demo", value: status.currentDifficulty.formatted(.number.precision(.fractionLength(2))))
                        }
                        .padding(18)
                        .background(BitzzaTheme.card)
                        .clipShape(RoundedRectangle(cornerRadius: 17))

                        Button {
                            Task {
                                await session.claimMiningReward()
                                setCooldown()
                            }
                        } label: {
                            HStack {
                                Spacer()
                                if session.isFeatureLoading { ProgressView().tint(.white).padding(.trailing, 5) }
                                Text(secondsRemaining == 0 ? "Richiedi BITZ demo" : "Disponibile tra \(secondsRemaining) s")
                                    .fontWeight(.bold)
                                Spacer()
                            }
                            .foregroundStyle(.white)
                            .padding(16)
                            .background(session.isFeatureLoading || secondsRemaining > 0 ? BitzzaTheme.muted : BitzzaTheme.tomato)
                            .clipShape(RoundedRectangle(cornerRadius: 13))
                        }
                        .disabled(session.isFeatureLoading || secondsRemaining > 0)
                    } else {
                        ProgressView("Caricamento stato…")
                    }
                    Text("Queste ricompense non sono mining blockchain e non hanno valore monetario.")
                        .font(.caption)
                        .foregroundStyle(BitzzaTheme.muted)
                }
                .padding(18)
            }
            .background(BitzzaTheme.paper)
            .navigationTitle("Ricompense")
            .refreshable {
                await session.loadMining()
                setCooldown()
            }
            .task {
                if session.miningStatus == nil { await session.loadMining() }
                setCooldown()
            }
            .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { clock = $0 }
        }
    }

    private func metric(_ title: String, value: String) -> some View {
        HStack {
            Text(title).foregroundStyle(BitzzaTheme.muted)
            Spacer()
            Text(value).fontWeight(.bold).foregroundStyle(BitzzaTheme.forest)
        }
        .font(.subheadline)
    }

    private func setCooldown() {
        guard let status = session.miningStatus else { return }
        cooldownEndsAt = Date().addingTimeInterval(TimeInterval(status.secondsRemaining))
    }
}

private struct PizzaView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var selectedMerchantID: Int?
    @State private var merchantName = ""
    @State private var merchantLocation = ""
    @State private var voucherCode = ""
    @State private var confirmingPurchase = false

    var body: some View {
        NavigationStack {
            Form {
                if let product = session.pizzaMenu?.products.first {
                    Section {
                        HStack(spacing: 14) {
                            Image("Logo")
                                .resizable()
                                .scaledToFill()
                                .frame(width: 54, height: 54)
                                .clipShape(RoundedRectangle(cornerRadius: 14))
                            VStack(alignment: .leading, spacing: 4) {
                                Text(product.name).font(.headline)
                                Text("\(product.price.formatted(.number.precision(.fractionLength(2)))) BITZ demo")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(BitzzaTheme.tomato)
                            }
                        }
                        Text(product.description)
                        Text("Ingredienti dimostrativi: \(product.ingredients.joined(separator: ", ")). Allergeni: \(product.allergens.joined(separator: ", ")).")
                            .font(.caption)
                            .foregroundStyle(BitzzaTheme.muted)
                        Text(product.disclosure)
                            .font(.caption)
                            .foregroundStyle(BitzzaTheme.muted)
                    } header: {
                        Text("Voucher pizza · simulazione")
                    } footer: {
                        Text("Il voucher demo non garantisce una pizza reale né un diritto di rimborso.")
                    }
                }

                Section("Acquista un voucher demo") {
                    if session.pizzaMerchants.isEmpty {
                        ContentUnavailableView(
                            "Nessuna pizzeria demo",
                            systemImage: "building.2",
                            description: Text("Un profilo POS demo deve essere creato prima di acquistare un voucher.")
                        )
                    } else {
                        Picker("Pizzeria", selection: $selectedMerchantID) {
                            Text("Seleziona una pizzeria").tag(Int?.none)
                            ForEach(session.pizzaMerchants) { merchant in
                                Text("\(merchant.name) · \(merchant.location)")
                                    .tag(Optional(merchant.id))
                            }
                        }
                        Button {
                            confirmingPurchase = true
                        } label: {
                            Label("Acquista per 12,50 BITZ demo", systemImage: "ticket")
                        }
                        .disabled(session.isFeatureLoading || selectedMerchantID == nil)
                        .confirmationDialog(
                            "Confermare l’acquisto demo?",
                            isPresented: $confirmingPurchase,
                            titleVisibility: .visible
                        ) {
                            Button("Acquista voucher demo · 12,50 BITZ") {
                                guard let selectedMerchantID else { return }
                                Task { await session.purchaseVoucher(merchantId: selectedMerchantID) }
                            }
                            Button("Annulla", role: .cancel) {}
                        } message: {
                            Text("Il saldo demo verrà ridotto. Non è un acquisto di beni reali.")
                        }
                    }
                }

                Section {
                    if let merchant = session.merchantProfile?.merchant {
                        LabeledContent("Pizzeria", value: merchant.name)
                        LabeledContent("Località", value: merchant.location)
                        LabeledContent(
                            "Liquidazioni demo",
                            value: "\((merchant.balance ?? 0).formatted(.number.precision(.fractionLength(2)))) BITZ"
                        )
                        TextField("Codice voucher (BZ-…)", text: $voucherCode)
                            .textInputAutocapitalization(.characters)
                            .autocorrectionDisabled()
                        Button {
                            Task {
                                await session.redeemVoucher(code: voucherCode)
                                if session.errorMessage == nil { voucherCode = "" }
                            }
                        } label: {
                            Label("Riscatta alla cassa demo", systemImage: "checkmark.seal")
                        }
                        .disabled(session.isFeatureLoading || voucherCode.isEmpty)

                        if let sales = session.merchantProfile?.sales, !sales.isEmpty {
                            ForEach(sales) { sale in
                                LabeledContent(sale.code, value: "\(sale.amount.formatted(.number.precision(.fractionLength(2)))) BITZ")
                            }
                        }
                    } else {
                        Text("Crea un profilo POS di prova per mostrare la funzione di riscatto.")
                            .font(.caption)
                            .foregroundStyle(BitzzaTheme.muted)
                        TextField("Nome pizzeria", text: $merchantName)
                            .textInputAutocapitalization(.words)
                        TextField("Città / località", text: $merchantLocation)
                            .textInputAutocapitalization(.words)
                        Button {
                            Task {
                                await session.saveMerchant(name: merchantName, location: merchantLocation)
                                if session.errorMessage == nil {
                                    merchantName = ""
                                    merchantLocation = ""
                                    await session.loadPizza()
                                }
                            }
                        } label: {
                            Label("Crea profilo POS demo", systemImage: "plus.circle")
                        }
                        .disabled(session.isFeatureLoading || merchantName.isEmpty || merchantLocation.isEmpty)
                    }
                } header: {
                    Text("Il mio profilo POS demo")
                } footer: {
                    Text("POS, voucher e liquidazioni sono simulati. Non usare questa demo per pagare o vendere beni reali.")
                }

                Section("I miei voucher demo") {
                    if session.vouchers.isEmpty {
                        ContentUnavailableView(
                            "Nessun voucher",
                            systemImage: "ticket",
                            description: Text("I voucher acquistati in questa demo appariranno qui.")
                        )
                    } else {
                        ForEach(session.vouchers) { voucher in
                            VStack(alignment: .leading, spacing: 5) {
                                HStack {
                                    Text(voucher.code).font(.system(.headline, design: .monospaced))
                                    Spacer()
                                    Text(voucher.status == "active" ? "ATTIVO · DEMO" : "RISCATTATO")
                                        .font(.system(size: 9, weight: .bold))
                                        .foregroundStyle(voucher.status == "active" ? BitzzaTheme.forest : BitzzaTheme.muted)
                                }
                                Text("\(voucher.merchantName) · \(voucher.merchantLocation)")
                                    .font(.caption).foregroundStyle(BitzzaTheme.muted)
                                Text("\(voucher.amount.formatted(.number.precision(.fractionLength(2)))) BITZ demo")
                                    .font(.caption.weight(.semibold))
                            }
                            .padding(.vertical, 3)
                        }
                    }
                }
            }
            .navigationTitle("Pizzeria / POS")
            .scrollContentBackground(.hidden)
            .background(BitzzaTheme.paper)
            .refreshable { await session.loadPizza() }
            .task { if session.pizzaMenu == nil { await session.loadPizza() } }
        }
    }
}

private struct MarketView: View {
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let market = session.marketData {
                        VStack(alignment: .leading, spacing: 14) {
                            HStack {
                                VStack(alignment: .leading, spacing: 5) {
                                    Text(session.tokenInfo?.name ?? "BITZZA")
                                        .font(.headline)
                                        .foregroundStyle(.white.opacity(0.75))
                                    Text("$\(market.price.formatted(.number.precision(.fractionLength(2))))")
                                        .font(.system(size: 35, weight: .bold, design: .rounded))
                                        .foregroundStyle(.white)
                                }

                                Spacer()
                                Text("\(market.change24h >= 0 ? "+" : "")\(market.change24h.formatted(.number.precision(.fractionLength(2))))%")
                                    .font(.subheadline.bold())
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 11)
                                    .padding(.vertical, 7)
                                    .background(.white.opacity(0.17))
                                    .clipShape(Capsule())
                            }

                            if !session.marketHistory.isEmpty {
                                Chart {
                                    ForEach(Array(session.marketHistory.enumerated()), id: \.element.id) { index, point in
                                        AreaMark(
                                            x: .value("Tempo", index),
                                            y: .value("Prezzo", point.price)
                                        )
                                        .foregroundStyle(LinearGradient(
                                            colors: [BitzzaTheme.gold.opacity(0.4), BitzzaTheme.gold.opacity(0.02)],
                                            startPoint: .top,
                                            endPoint: .bottom
                                        ))
                                        LineMark(
                                            x: .value("Tempo", index),
                                            y: .value("Prezzo", point.price)
                                        )
                                        .foregroundStyle(BitzzaTheme.gold)
                                        .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round))
                                    }
                                }
                                .chartXAxis(.hidden)
                                .chartYAxis(.hidden)
                                .frame(height: 155)
                            }
                        }
                        .padding(20)
                        .background(LinearGradient(colors: [BitzzaTheme.forestFill, BitzzaTheme.forestFill.opacity(0.86)], startPoint: .topLeading, endPoint: .bottomTrailing))
                        .clipShape(RoundedRectangle(cornerRadius: 20))

                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                            marketMetric("Capitalizzazione demo", value: market.marketCap, prefix: "$")
                            marketMetric("Volume 24h demo", value: market.volume24h, prefix: "$")
                        }

                        if let target = session.pizzaTarget {
                            VStack(alignment: .leading, spacing: 10) {
                                Label("Traguardo simulato", systemImage: "target")
                                    .font(.headline).foregroundStyle(BitzzaTheme.forest)
                                Text(target.message).font(.subheadline).foregroundStyle(BitzzaTheme.muted)
                                ProgressView(value: min(1, max(0, target.percentage / 100)))
                                    .tint(BitzzaTheme.tomato)
                                Text("\(target.percentage.formatted(.number.precision(.fractionLength(1))))% del traguardo di $\(target.target.formatted(.number.precision(.fractionLength(2))))")
                                    .font(.caption).foregroundStyle(BitzzaTheme.muted)
                            }
                            .padding(17)
                            .background(BitzzaTheme.card)
                            .clipShape(RoundedRectangle(cornerRadius: 16))
                        }
                    } else {
                        ProgressView("Caricamento dati demo…")
                            .frame(maxWidth: .infinity)
                            .padding(30)
                    }

                    Label("Mercato simulato", systemImage: "exclamationmark.triangle.fill")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(BitzzaTheme.tomato)
                    Text("Prezzi e statistiche sono dati generati per la demo. BITZ non è un token negoziabile e non è collegato a un mercato reale.")
                        .font(.caption)
                        .foregroundStyle(BitzzaTheme.muted)
                }
                .padding(18)
            }
            .background(BitzzaTheme.paper)
            .navigationTitle("Mercato")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await session.loadMarket() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    .accessibilityLabel("Aggiorna mercato")
                }
            }
            .refreshable { await session.loadMarket() }
            .task { if session.marketData == nil { await session.loadMarket() } }
        }
    }

    private func marketMetric(_ title: String, value: Double, prefix: String) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title).font(.caption).foregroundStyle(BitzzaTheme.muted)
            Text("\(prefix)\(value.formatted(.number.precision(.fractionLength(0))))")
                .font(.headline.monospacedDigit())
                .foregroundStyle(BitzzaTheme.forest)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(15)
        .background(BitzzaTheme.card)
        .clipShape(RoundedRectangle(cornerRadius: 15))
    }
}

private struct SettingsView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var theme = "light"
    @State private var notifications = true
    @State private var privacy = false
    @State private var slippage = 0.5
    @State private var initialized = false
    @State private var confirmingDemoReset = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Aspetto") {
                    Picker("Tema", selection: $theme) {
                        Text("Chiaro").tag("light")
                        Text("Scuro").tag("dark")
                        Text("Sistema").tag("system")
                    }
                }

                Section("Privacy e notifiche") {
                    Toggle("Notifiche abilitate", isOn: $notifications)
                    Toggle("Modalità privacy", isOn: $privacy)
                }

                Section {
                    Slider(value: $slippage, in: 0...50, step: 0.1) {
                        Text("Slippage predefinito")
                    } minimumValueLabel: {
                        Text("0%")
                    } maximumValueLabel: {
                        Text("50%")
                    }
                    LabeledContent("Slippage predefinito", value: "\(slippage.formatted(.number.precision(.fractionLength(1))))%")
                } footer: {
                    Text("Impostazione demo: non esegue ordini né transazioni on-chain.")
                }

                Section("Account") {
                    if let dashboard = session.dashboard {
                        LabeledContent("Email", value: privacy ? "Privacy attiva" : dashboard.profile.email)
                        LabeledContent("Indirizzo", value: privacy ? "Nascosto" : dashboard.profile.walletAddress)
                    }
                    Button {
                        Task { await session.refresh() }
                    } label: {
                        Label("Aggiorna dati account", systemImage: "arrow.clockwise")
                    }
                }

                Section {
                    Button {
                        Task {
                            await session.saveSettings(
                                theme: theme,
                                notificationsEnabled: notifications,
                                privacyMode: privacy,
                                slippage: slippage
                            )
                        }
                    } label: {
                        HStack {
                            Spacer()
                            if session.isFeatureLoading { ProgressView().padding(.trailing, 5) }
                            Text("Salva preferenze")
                            Spacer()
                        }
                    }
                    .disabled(session.isFeatureLoading)
                }

                if session.isOfflineDemo {
                    Section {
                        Button("Ripristina dati demo", systemImage: "arrow.counterclockwise", role: .destructive) {
                            confirmingDemoReset = true
                        }
                        .confirmationDialog(
                            "Ripristinare la demo offline?",
                            isPresented: $confirmingDemoReset,
                            titleVisibility: .visible
                        ) {
                            Button("Ripristina dati demo", role: .destructive) {
                                session.resetOfflineDemo()
                            }
                            Button("Annulla", role: .cancel) {}
                        } message: {
                            Text("Saldo, contatti, transazioni, voucher e preferenze locali torneranno ai valori iniziali.")
                        }
                    } footer: {
                        Text("La demo funziona senza server. Le modifiche sono salvate solo su questo dispositivo.")
                    }
                }

                Section {
                    Button("Esci dall’account", role: .destructive) {
                        session.signOut()
                    }
                }
            }
            .navigationTitle("Impostazioni")
            .scrollContentBackground(.hidden)
            .background(BitzzaTheme.paper)
            .task {
                if session.settings == nil { await session.loadSettings() }
                guard let settings = session.settings, !initialized else { return }
                theme = settings.theme
                notifications = settings.notificationsEnabled != 0
                privacy = settings.privacyMode != 0
                slippage = settings.defaultSlippage
                initialized = true
            }
            .onChange(of: session.settings?.theme) { _, value in
                if let value { theme = value }
            }
            .onChange(of: session.settings?.notificationsEnabled) { _, value in
                if let value { notifications = value != 0 }
            }
            .onChange(of: session.settings?.privacyMode) { _, value in
                if let value { privacy = value != 0 }
            }
            .onChange(of: session.settings?.defaultSlippage) { _, value in
                if let value { slippage = value }
            }
        }
    }
}
