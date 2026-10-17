import Foundation
import Combine
import Security

@MainActor
final class SessionStore: ObservableObject {
    @Published private(set) var token: String?
    @Published private(set) var dashboard: DashboardData?
    @Published private(set) var contacts: [WalletContact] = []
    @Published private(set) var commodityHoldings: [String: Double] = [:]
    @Published private(set) var miningStatus: MiningStatus?
    @Published private(set) var marketData: MarketData?
    @Published private(set) var marketHistory: [MarketPoint] = []
    @Published private(set) var tokenInfo: TokenInfo?
    @Published private(set) var pizzaTarget: PizzaTarget?
    @Published private(set) var pizzaMenu: PizzaMenu?
    @Published private(set) var pizzaMerchants: [PizzaMerchant] = []
    @Published private(set) var merchantProfile: MerchantProfile?
    @Published private(set) var vouchers: [PizzaVoucher] = []
    @Published private(set) var settings: UserSettings?
    @Published private(set) var isOfflineDemo = false
    @Published private(set) var isMetaMaskDemoConnected = false
    @Published private(set) var demoSwaps: [DemoSwap] = []
    @Published var isLoading = false
    @Published var isFeatureLoading = false
    @Published var errorMessage: String?
    @Published var notice: String?
    @Published var paymentRecipient = ""

    private let api: APIClient?
    private let apiInitializationError: Error?
    private let keychain = TokenKeychain()
    private let defaults = UserDefaults.standard
    private var offlineState: OfflineDemoState
    private static let offlineStateKey = "bitzza.offline-demo.state"
    private static let offlineSessionKey = "bitzza.offline-demo.active"
    private static let metaMaskDemoKey = "bitzza.metamask-demo.connected"
    private static let demoSwapsKey = "bitzza.metamask-demo.swaps"

    init() {
        do {
            api = try APIClient()
            apiInitializationError = nil
        } catch {
            api = nil
            apiInitializationError = error
        }
        if let data = defaults.data(forKey: Self.offlineStateKey) {
            do {
                offlineState = try JSONDecoder().decode(OfflineDemoState.self, from: data)
            } catch {
                offlineState = .sample()
                errorMessage = "I dati demo locali non sono leggibili. Puoi iniziare una nuova demo dalle impostazioni."
            }
        } else {
            offlineState = .sample()
        }
        isMetaMaskDemoConnected = defaults.bool(forKey: Self.metaMaskDemoKey)
        if let data = defaults.data(forKey: Self.demoSwapsKey) {
            do {
                demoSwaps = try JSONDecoder().decode([DemoSwap].self, from: data)
            } catch {
                demoSwaps = []
                errorMessage = "La cronologia swap demo locale non è leggibile."
            }
        }
        isOfflineDemo = defaults.bool(forKey: Self.offlineSessionKey)
        do {
            token = isOfflineDemo ? nil : try keychain.read()
        } catch {
            token = nil
            errorMessage = error.localizedDescription
        }
        if isOfflineDemo {
            applyOfflineState()
        }
    }

    var isAuthenticated: Bool {
        isOfflineDemo || token != nil
    }

    func startOfflineDemo() {
        errorMessage = nil
        notice = nil
        keychain.delete()
        token = nil
        isOfflineDemo = true
        defaults.set(true, forKey: Self.offlineSessionKey)
        applyOfflineState()
        persistOfflineState()
        notice = "Demo offline attiva: le modifiche restano su questo iPhone."
    }

    func connectMetaMaskDemo() {
        isMetaMaskDemoConnected = true
        defaults.set(true, forKey: Self.metaMaskDemoKey)
        notice = "Portafoglio MetaMask demo simulato. Nessuna app esterna o wallet reale è stato collegato."
    }

    func disconnectMetaMaskDemo() {
        isMetaMaskDemoConnected = false
        defaults.set(false, forKey: Self.metaMaskDemoKey)
        notice = "Portafoglio MetaMask demo disconnesso."
    }

    func simulateSwap(amountText: String, fromAsset: String) {
        guard isMetaMaskDemoConnected else {
            errorMessage = "Simula prima il collegamento del portafoglio demo."
            return
        }
        guard let inputAmount = Double(amountText), inputAmount.isFinite, inputAmount > 0,
              abs(inputAmount * 100 - (inputAmount * 100).rounded()) < 0.000001 else {
            errorMessage = "Inserisci un importo positivo con massimo due decimali."
            return
        }
        let inputAsset = fromAsset == "USDC" ? "USDC demo" : "BITZ demo"
        let outputAsset = fromAsset == "USDC" ? "BITZ demo" : "USDC demo"
        let rate = OfflineDemoFixtures.swapRateUSDCPerBITZ
        let grossOutput = fromAsset == "USDC" ? inputAmount / rate : inputAmount * rate
        let feeAmount = grossOutput * 0.003
        let outputAmount = grossOutput - feeAmount
        guard grossOutput.isFinite, feeAmount.isFinite, outputAmount.isFinite, outputAmount > 0 else {
            errorMessage = "L’importo supera i limiti della simulazione."
            return
        }
        let swap = DemoSwap(
            inputAmount: inputAmount,
            inputAsset: inputAsset,
            outputAmount: outputAmount,
            outputAsset: outputAsset,
            feeAmount: feeAmount
        )
        demoSwaps.insert(swap, at: 0)
        persistDemoSwaps()
        notice = "Swap simulato: nessuna transazione, firma o modifica al saldo reale."
    }

    func resetMetaMaskDemo() {
        isMetaMaskDemoConnected = false
        demoSwaps = []
        defaults.set(false, forKey: Self.metaMaskDemoKey)
        defaults.removeObject(forKey: Self.demoSwapsKey)
    }

    func clearDemoSwapHistory() {
        demoSwaps = []
        defaults.removeObject(forKey: Self.demoSwapsKey)
        notice = "Cronologia swap demo cancellata. Il collegamento fittizio è rimasto attivo."
    }

    func login(email: String, password: String) async {
        await authenticate(email: email, password: password, isRegistration: false)
    }

    func register(email: String, password: String) async {
        await authenticate(email: email, password: password, isRegistration: true)
    }

    func refresh() async {
        if isOfflineDemo {
            applyOfflineState()
            return
        }
        guard let token else { return }
        guard let api else {
            errorMessage = apiInitializationError?.localizedDescription
            return
        }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            dashboard = try await api.dashboard(token: token)
        } catch {
            if case APIClientError.unauthorized = error {
                signOut()
                errorMessage = error.localizedDescription
            } else {
                errorMessage = error.localizedDescription
            }
        }
    }

    func send(amountText: String, recipient: String, description: String) async -> Bool {
        guard let parsedAmount = Double(amountText), parsedAmount.isFinite, parsedAmount > 0 else {
            errorMessage = "Inserisci un importo positivo con massimo due decimali."
            return false
        }
        let cents = parsedAmount * 100
        let roundedCents = cents.rounded()
        guard cents.isFinite, abs(cents - roundedCents) < 0.000001 else {
            errorMessage = "Inserisci un importo positivo con massimo due decimali."
            return false
        }
        let amount = roundedCents / 100
        guard !recipient.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            errorMessage = "Inserisci l’email del destinatario."
            return false
        }

        let cleanRecipient = recipient.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanDescription = description.trimmingCharacters(in: .whitespacesAndNewlines)
        if isOfflineDemo {
            guard amount <= offlineState.balance.balance else {
                errorMessage = "Saldo demo insufficiente."
                return false
            }
            offlineState.balance = WalletBalance(
                balance: offlineState.balance.balance - amount,
                currency: offlineState.balance.currency
            )
            recordOfflineTransaction(
                type: "sent",
                amount: amount,
                otherParty: cleanRecipient,
                description: cleanDescription.isEmpty ? "Pagamento demo offline" : cleanDescription
            )
            applyOfflineState()
            persistOfflineState()
            notice = "Pagamento demo registrato solo su questo iPhone. Nessun dato è stato inviato."
            return true
        }
        guard let token, let api else {
            errorMessage = apiInitializationError?.localizedDescription ?? "Accedi di nuovo per continuare."
            return false
        }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            try await api.sendPayment(
                token: token,
                amount: amount,
                recipientEmail: cleanRecipient,
                description: cleanDescription
            )
            notice = "Pagamento demo inviato."
            await refresh()
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func loadContacts() async {
        if isOfflineDemo {
            contacts = offlineState.contacts
            return
        }
        guard let (api, token) = featureContext() else { return }
        isFeatureLoading = true
        defer { isFeatureLoading = false }
        do {
            contacts = try await api.contacts(token: token)
        } catch {
            report(error)
        }
    }

    func saveContact(label: String, email: String) async {
        if isOfflineDemo {
            let cleanLabel = label.trimmingCharacters(in: .whitespacesAndNewlines)
            let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            guard !cleanLabel.isEmpty, cleanEmail.contains("@") else {
                errorMessage = "Inserisci un nome e un indirizzo email valido."
                return
            }
            guard !offlineState.contacts.contains(where: { $0.address.caseInsensitiveCompare(cleanEmail) == .orderedSame }) else {
                errorMessage = "Questo contatto è già presente nella rubrica demo."
                return
            }
            offlineState.contacts.append(
                WalletContact(id: offlineState.nextContactID, label: cleanLabel, address: cleanEmail)
            )
            offlineState.nextContactID += 1
            contacts = offlineState.contacts
            persistOfflineState()
            notice = "Contatto salvato solo su questo iPhone."
            return
        }
        guard let (api, token) = featureContext() else { return }
        isFeatureLoading = true
        defer { isFeatureLoading = false }
        do {
            try await api.saveContact(token: token, label: label, email: email)
            contacts = try await api.contacts(token: token)
            notice = "Contatto salvato."
        } catch {
            report(error)
        }
    }

    func deleteContact(_ contact: WalletContact) async {
        if isOfflineDemo {
            offlineState.contacts.removeAll { $0.id == contact.id }
            contacts = offlineState.contacts
            persistOfflineState()
            notice = "Contatto rimosso dalla rubrica locale."
            return
        }
        guard let (api, token) = featureContext() else { return }
        isFeatureLoading = true
        defer { isFeatureLoading = false }
        do {
            try await api.deleteContact(token: token, id: contact.id)
            contacts.removeAll { $0.id == contact.id }
            notice = "Contatto rimosso."
        } catch {
            report(error)
        }
    }

    func loadCommodities() async {
        if isOfflineDemo {
            commodityHoldings = offlineState.commodityHoldings
            return
        }
        guard let (api, token) = featureContext() else { return }
        isFeatureLoading = true
        defer { isFeatureLoading = false }
        do {
            commodityHoldings = try await api.commodityHoldings(token: token)
        } catch {
            report(error)
        }
    }

    func tradeCommodity(name: String, unitsText: String, buying: Bool) async {
        if isOfflineDemo {
            guard let units = Double(unitsText), units.isFinite, units > 0,
                  abs(units * 100 - (units * 100).rounded()) < 0.000001 else {
                errorMessage = "Inserisci un numero di unità positivo, con massimo due decimali."
                return
            }
            let prices = ["Pomodoro": 2.0, "Grano": 1.0, "Latte": 1.5]
            guard let unitPrice = prices[name] else {
                errorMessage = "Prodotto demo non disponibile."
                return
            }
            let currentUnits = offlineState.commodityHoldings[name, default: 0]
            if buying {
                let cost = units * unitPrice
                guard cost <= offlineState.balance.balance else {
                    errorMessage = "Saldo demo insufficiente per questa operazione."
                    return
                }
                offlineState.balance = WalletBalance(
                    balance: offlineState.balance.balance - cost,
                    currency: offlineState.balance.currency
                )
                offlineState.commodityHoldings[name] = currentUnits + units
                recordOfflineTransaction(type: "sent", amount: cost, otherParty: "Filiere locali", description: "Acquisto demo: \(name)")
                notice = "Acquisto demo completato. Dati salvati solo su questo iPhone."
            } else {
                guard units <= currentUnits else {
                    errorMessage = "Non hai abbastanza unità demo da vendere."
                    return
                }
                let proceeds = units * unitPrice * 0.95
                offlineState.balance = WalletBalance(
                    balance: offlineState.balance.balance + proceeds,
                    currency: offlineState.balance.currency
                )
                offlineState.commodityHoldings[name] = currentUnits - units
                recordOfflineTransaction(type: "received", amount: proceeds, otherParty: "Filiere locali", description: "Vendita demo: \(name) · commissione 5%")
                notice = "Vendita demo completata. Commissione del 5%; dati solo locali."
            }
            applyOfflineState()
            persistOfflineState()
            return
        }
        guard let (api, token) = featureContext() else { return }
        guard let units = Double(unitsText), units.isFinite, units > 0,
              abs(units * 100 - (units * 100).rounded()) < 0.000001 else {
            errorMessage = "Inserisci un numero di unità positivo, con massimo due decimali."
            return
        }
        isFeatureLoading = true
        defer { isFeatureLoading = false }
        do {
            try await api.tradeCommodity(token: token, commodity: name, units: units, buying: buying)
            commodityHoldings = try await api.commodityHoldings(token: token)
            try await refreshDashboardData(using: api, token: token)
            notice = buying ? "Acquisto demo completato." : "Vendita demo completata. Commissione del 5% applicata."
        } catch {
            report(error)
        }
    }

    func loadMining() async {
        if isOfflineDemo {
            updateOfflineMiningCooldown()
            miningStatus = offlineState.miningStatus
            return
        }
        guard let (api, token) = featureContext() else { return }
        isFeatureLoading = true
        defer { isFeatureLoading = false }
        do {
            miningStatus = try await api.miningStatus(token: token)
        } catch {
            report(error)
        }
    }

    func claimMiningReward() async {
        if isOfflineDemo {
            updateOfflineMiningCooldown()
            guard offlineState.miningStatus.canClaim else {
                errorMessage = "La prossima ricompensa demo non è ancora disponibile."
                miningStatus = offlineState.miningStatus
                return
            }
            let reward = offlineState.miningStatus.nextReward
            offlineState.balance = WalletBalance(
                balance: offlineState.balance.balance + reward,
                currency: offlineState.balance.currency
            )
            offlineState.miningStatus.totalMined += reward
            offlineState.miningStatus.totalClaims += 1
            offlineState.miningStatus.currentDifficulty += 0.1
            offlineState.miningStatus.nextReward = min(1, reward + 0.01)
            offlineState.miningAvailableAt = Date().addingTimeInterval(60)
            offlineState.miningStatus.canClaim = false
            offlineState.miningStatus.secondsRemaining = 60
            recordOfflineTransaction(type: "received", amount: reward, otherParty: "Ricompensa demo", description: "Ricompensa locale simulata")
            applyOfflineState()
            persistOfflineState()
            notice = "Ricompensa demo di \(reward.formatted(.number.precision(.fractionLength(2...4)))) BITZ aggiunta localmente."
            return
        }
        guard let (api, token) = featureContext() else { return }
        isFeatureLoading = true
        defer { isFeatureLoading = false }
        do {
            let reward = try await api.claimMiningReward(token: token)
            miningStatus = try await api.miningStatus(token: token)
            try await refreshDashboardData(using: api, token: token)
            notice = "Ricompensa demo di \(reward.amount.formatted(.number.precision(.fractionLength(2...4)))) BITZ aggiunta."
        } catch {
            report(error)
        }
    }

    func loadMarket() async {
        if isOfflineDemo {
            marketData = OfflineDemoFixtures.market
            marketHistory = OfflineDemoFixtures.history
            tokenInfo = OfflineDemoFixtures.tokenInfo
            pizzaTarget = OfflineDemoFixtures.pizzaTarget
            return
        }
        guard let api else {
            errorMessage = apiInitializationError?.localizedDescription
            return
        }
        isFeatureLoading = true
        defer { isFeatureLoading = false }
        do {
            let result = try await api.market(token: token ?? "")
            marketData = result.0
            marketHistory = result.1
            tokenInfo = result.2
            pizzaTarget = result.3
        } catch {
            report(error)
        }
    }

    func loadPizza() async {
        if isOfflineDemo {
            pizzaMenu = OfflineDemoFixtures.menu
            pizzaMerchants = OfflineDemoFixtures.merchants
            merchantProfile = offlineState.merchantProfile
            vouchers = offlineState.vouchers
            return
        }
        guard let (api, token) = featureContext() else { return }
        isFeatureLoading = true
        defer { isFeatureLoading = false }
        do {
            async let menu = api.pizzaMenu()
            async let merchants = api.pizzaMerchants()
            async let profile = api.merchantProfile(token: token)
            async let userVouchers = api.vouchers(token: token)
            let result = try await (menu, merchants, profile, userVouchers)
            pizzaMenu = result.0
            pizzaMerchants = result.1
            merchantProfile = result.2
            vouchers = result.3
        } catch {
            report(error)
        }
    }

    func saveMerchant(name: String, location: String) async {
        if isOfflineDemo {
            let cleanName = name.trimmingCharacters(in: .whitespacesAndNewlines)
            let cleanLocation = location.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !cleanName.isEmpty, !cleanLocation.isEmpty else {
                errorMessage = "Inserisci il nome della pizzeria e la località."
                return
            }
            offlineState.merchantProfile = MerchantProfile(
                merchant: PizzaMerchant(
                    id: 99,
                    name: cleanName,
                    location: cleanLocation,
                    balance: offlineState.merchantProfile.merchant?.balance ?? 0
                ),
                sales: offlineState.merchantProfile.sales
            )
            merchantProfile = offlineState.merchantProfile
            persistOfflineState()
            notice = "Profilo POS demo salvato solo su questo iPhone."
            return
        }
        guard let (api, token) = featureContext() else { return }
        let cleanName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanLocation = location.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanName.isEmpty, !cleanLocation.isEmpty else {
            errorMessage = "Inserisci il nome della pizzeria e la località."
            return
        }
        isFeatureLoading = true
        defer { isFeatureLoading = false }
        do {
            try await api.saveMerchant(token: token, name: cleanName, location: cleanLocation)
            merchantProfile = try await api.merchantProfile(token: token)
            notice = "Profilo POS demo salvato."
        } catch {
            report(error)
        }
    }

    func purchaseVoucher(merchantId: Int) async {
        if isOfflineDemo {
            let price = OfflineDemoFixtures.menu.products.first?.price ?? 12.5
            guard let merchant = OfflineDemoFixtures.merchants.first(where: { $0.id == merchantId }) else {
                errorMessage = "Seleziona una pizzeria demo valida."
                return
            }
            guard offlineState.balance.balance >= price else {
                errorMessage = "Saldo demo insufficiente per il voucher."
                return
            }
            offlineState.balance = WalletBalance(
                balance: offlineState.balance.balance - price,
                currency: offlineState.balance.currency
            )
            let code = "BZ-" + String(UUID().uuidString.replacingOccurrences(of: "-", with: "").prefix(8)).uppercased()
            offlineState.vouchers.insert(
                PizzaVoucher(
                    id: offlineState.nextVoucherID,
                    code: code,
                    amount: price,
                    status: "active",
                    purchasedAt: ISO8601DateFormatter().string(from: Date()),
                    redeemedAt: nil,
                    merchantName: merchant.name,
                    merchantLocation: merchant.location
                ),
                at: 0
            )
            offlineState.nextVoucherID += 1
            recordOfflineTransaction(type: "sent", amount: price, otherParty: merchant.name, description: "Voucher pizza demo")
            vouchers = offlineState.vouchers
            applyOfflineState()
            persistOfflineState()
            notice = "Voucher demo \(code) creato localmente. Non è un ordine reale."
            return
        }
        guard let (api, token) = featureContext() else { return }
        isFeatureLoading = true
        defer { isFeatureLoading = false }
        do {
            let voucher = try await api.purchaseVoucher(token: token, merchantId: merchantId)
            vouchers = try await api.vouchers(token: token)
            try await refreshDashboardData(using: api, token: token)
            notice = "Voucher demo acquistato: \(voucher.code)."
        } catch {
            report(error)
        }
    }

    func redeemVoucher(code: String) async {
        if isOfflineDemo {
            let normalizedCode = code.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
            guard !normalizedCode.isEmpty else {
                errorMessage = "Inserisci il codice voucher."
                return
            }
            guard let voucherIndex = offlineState.vouchers.firstIndex(where: {
                $0.code == normalizedCode && $0.status == "active"
            }) else {
                errorMessage = "Voucher demo non trovato o già riscattato."
                return
            }
            let voucher = offlineState.vouchers[voucherIndex]
            offlineState.vouchers[voucherIndex] = PizzaVoucher(
                id: voucher.id,
                code: voucher.code,
                amount: voucher.amount,
                status: "redeemed",
                purchasedAt: voucher.purchasedAt,
                redeemedAt: ISO8601DateFormatter().string(from: Date()),
                merchantName: voucher.merchantName,
                merchantLocation: voucher.merchantLocation
            )
            let merchant = offlineState.merchantProfile.merchant
            offlineState.merchantProfile.merchant = PizzaMerchant(
                id: merchant?.id ?? 99,
                name: merchant?.name ?? "Pizzeria Demo",
                location: merchant?.location ?? "Bologna",
                balance: (merchant?.balance ?? 0) + voucher.amount
            )
            offlineState.merchantProfile.sales.insert(
                MerchantSale(
                    id: offlineState.nextSaleID,
                    code: voucher.code,
                    amount: voucher.amount,
                    redeemedAt: ISO8601DateFormatter().string(from: Date())
                ),
                at: 0
            )
            offlineState.nextSaleID += 1
            vouchers = offlineState.vouchers
            merchantProfile = offlineState.merchantProfile
            persistOfflineState()
            notice = "Voucher demo riscattato localmente: \(voucher.amount.formatted(.number.precision(.fractionLength(2)))) BITZ."
            return
        }
        guard let (api, token) = featureContext() else { return }
        let normalizedCode = code.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard !normalizedCode.isEmpty else {
            errorMessage = "Inserisci il codice voucher."
            return
        }
        isFeatureLoading = true
        defer { isFeatureLoading = false }
        do {
            let sale = try await api.redeemVoucher(token: token, code: normalizedCode)
            merchantProfile = try await api.merchantProfile(token: token)
            notice = "Voucher demo riscattato: \(sale.amount.formatted(.number.precision(.fractionLength(2)))) BITZ."
        } catch {
            report(error)
        }
    }

    func loadSettings() async {
        if isOfflineDemo {
            settings = offlineState.settings
            return
        }
        guard let (api, token) = featureContext() else { return }
        isFeatureLoading = true
        defer { isFeatureLoading = false }
        do {
            settings = try await api.settings(token: token)
        } catch {
            report(error)
        }
    }

    func saveSettings(theme: String, notificationsEnabled: Bool, privacyMode: Bool, slippage: Double) async {
        if isOfflineDemo {
            guard slippage.isFinite, (0...50).contains(slippage) else {
                errorMessage = "Lo slippage deve essere compreso tra 0 e 50."
                return
            }
            offlineState.settings = UserSettings(
                theme: theme,
                notificationsEnabled: notificationsEnabled ? 1 : 0,
                privacyMode: privacyMode ? 1 : 0,
                defaultSlippage: slippage
            )
            settings = offlineState.settings
            persistOfflineState()
            notice = "Preferenze demo salvate solo su questo iPhone."
            return
        }
        guard let (api, token) = featureContext() else { return }
        guard slippage.isFinite, (0...50).contains(slippage) else {
            errorMessage = "Lo slippage deve essere compreso tra 0 e 50."
            return
        }
        isFeatureLoading = true
        defer { isFeatureLoading = false }
        do {
            settings = try await api.updateSettings(
                token: token,
                settings: SettingsUpdateRequest(
                    theme: theme,
                    notificationsEnabled: notificationsEnabled,
                    privacyMode: privacyMode,
                    defaultSlippage: slippage
                )
            )
            notice = "Preferenze salvate."
        } catch {
            report(error)
        }
    }

    func signOut() {
        keychain.delete()
        defaults.set(false, forKey: Self.offlineSessionKey)
        isOfflineDemo = false
        token = nil
        dashboard = nil
        contacts = []
        commodityHoldings = [:]
        miningStatus = nil
        marketData = nil
        marketHistory = []
        tokenInfo = nil
        pizzaTarget = nil
        pizzaMenu = nil
        pizzaMerchants = []
        merchantProfile = nil
        vouchers = []
        settings = nil
        paymentRecipient = ""
        errorMessage = nil
        notice = nil
    }

    func resetOfflineDemo() {
        guard isOfflineDemo else { return }
        offlineState = .sample()
        applyOfflineState()
        persistOfflineState()
        resetMetaMaskDemo()
        notice = "La demo locale è stata ripristinata ai dati iniziali."
    }

    private func applyOfflineState() {
        dashboard = DashboardData(
            profile: offlineState.profile,
            balance: offlineState.balance,
            transactions: offlineState.transactions
        )
        contacts = offlineState.contacts
        commodityHoldings = offlineState.commodityHoldings
        miningStatus = offlineState.miningStatus
        vouchers = offlineState.vouchers
        merchantProfile = offlineState.merchantProfile
        settings = offlineState.settings
    }

    private func persistOfflineState() {
        do {
            defaults.set(try JSONEncoder().encode(offlineState), forKey: Self.offlineStateKey)
        } catch {
            errorMessage = "Impossibile salvare i dati della demo su questo iPhone: \(error.localizedDescription)"
        }
    }

    private func persistDemoSwaps() {
        do {
            defaults.set(try JSONEncoder().encode(demoSwaps), forKey: Self.demoSwapsKey)
        } catch {
            errorMessage = "Impossibile salvare la cronologia swap demo: \(error.localizedDescription)"
        }
    }

    private func recordOfflineTransaction(type: String, amount: Double, otherParty: String, description: String) {
        offlineState.transactions.insert(
            WalletTransaction(
                id: offlineState.nextTransactionID,
                amount: amount,
                type: type,
                description: description,
                createdAt: ISO8601DateFormatter().string(from: Date()),
                otherParty: otherParty
            ),
            at: 0
        )
        offlineState.nextTransactionID += 1
    }

    private func updateOfflineMiningCooldown() {
        let secondsRemaining = max(
            0,
            Int(ceil((offlineState.miningAvailableAt ?? Date()).timeIntervalSinceNow))
        )
        offlineState.miningStatus.secondsRemaining = secondsRemaining
        offlineState.miningStatus.canClaim = secondsRemaining == 0
    }

    private func featureContext() -> (APIClient, String)? {
        errorMessage = nil
        notice = nil
        guard let token else {
            errorMessage = "Accedi di nuovo per continuare."
            return nil
        }
        guard let api else {
            errorMessage = apiInitializationError?.localizedDescription
            return nil
        }
        return (api, token)
    }

    private func refreshDashboardData(using api: APIClient, token: String) async throws {
        dashboard = try await api.dashboard(token: token)
    }

    private func report(_ error: Error) {
        if case APIClientError.unauthorized = error {
            signOut()
        }
        errorMessage = error.localizedDescription
    }

    private func authenticate(email: String, password: String, isRegistration: Bool) async {
        guard let api else {
            errorMessage = apiInitializationError?.localizedDescription
            return
        }
        let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !normalizedEmail.isEmpty, !password.isEmpty else {
            errorMessage = "Inserisci email e password."
            return
        }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let newToken = try await (isRegistration
                ? api.register(email: normalizedEmail, password: password)
                : api.login(email: normalizedEmail, password: password))
            try keychain.save(newToken)
            token = newToken
            await refresh()
            if isAuthenticated {
                await loadSettings()
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct TokenKeychain {
    private let service = Bundle.main.bundleIdentifier ?? "com.bitzza.wallet"
    private let account = "access-token"

    func read() throws -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound {
            return nil
        }
        guard status == errSecSuccess, let data = item as? Data,
              let token = String(data: data, encoding: .utf8) else {
            throw KeychainError(status: status == errSecSuccess ? errSecDecode : status)
        }
        return token
    }

    func save(_ token: String) throws {
        let data = Data(token.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        ]
        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var insert = query
            attributes.forEach { insert[$0.key] = $0.value }
            let insertStatus = SecItemAdd(insert as CFDictionary, nil)
            guard insertStatus == errSecSuccess else {
                throw KeychainError(status: insertStatus)
            }
        } else if status != errSecSuccess {
            throw KeychainError(status: status)
        }
    }

    func delete() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        let status = SecItemDelete(query as CFDictionary)
        if status != errSecSuccess && status != errSecItemNotFound {
            NSLog("BITZZA could not remove the saved session token (Keychain status: %d)", status)
        }
    }

    private struct KeychainError: LocalizedError {
        let status: OSStatus

        var errorDescription: String? {
            "Impossibile accedere in modo sicuro alla sessione (Keychain: \(status))."
        }
    }
}
