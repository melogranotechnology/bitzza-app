import Foundation

enum APIClientError: LocalizedError {
    case invalidBaseURL
    case invalidEndpoint
    case invalidResponse
    case unauthorized
    case connectionFailed(healthURL: String)
    case server(String)

    var errorDescription: String? {
        switch self {
        case .invalidBaseURL:
            return "Indirizzo del server BITZZA non valido."
        case .invalidEndpoint:
            return "Indirizzo della richiesta BITZZA non valido."
        case .invalidResponse:
            return "Risposta del server non valida."
        case .unauthorized:
            return "La sessione è scaduta. Accedi di nuovo."
        case .connectionFailed(let healthURL):
            return "Non riesco a raggiungere il server demo. Verifica dal browser dell’iPhone che si apra \(healthURL), che iPhone e Mac siano sulla stessa rete e che l’API BITZZA sia avviata."
        case .server(let message):
            return message
        }
    }
}

struct APIClient {
    private let baseURL: URL
    private let session: URLSession
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    init(session: URLSession = .shared) throws {
        guard
            let configuredURL = Bundle.main.object(forInfoDictionaryKey: "BITZZA_API_BASE_URL") as? String,
            let url = URL(string: configuredURL),
            ["http", "https"].contains(url.scheme?.lowercased() ?? ""),
            url.host != nil
        else {
            throw APIClientError.invalidBaseURL
        }
        #if targetEnvironment(simulator)
        if url.host != "127.0.0.1" && url.host != "localhost" {
            var simulatorURL = URLComponents(url: url, resolvingAgainstBaseURL: false)
            simulatorURL?.host = "127.0.0.1"
            guard let localURL = simulatorURL?.url else {
                throw APIClientError.invalidBaseURL
            }
            baseURL = localURL
        } else {
            baseURL = url
        }
        #else
        baseURL = url
        #endif
        self.session = session
    }

    func login(email: String, password: String) async throws -> String {
        let response: AuthResponse = try await request(
            path: "login",
            method: "POST",
            body: Credentials(email: email, password: password)
        )
        return response.token
    }

    func register(email: String, password: String) async throws -> String {
        let response: AuthResponse = try await request(
            path: "register",
            method: "POST",
            body: Credentials(email: email, password: password)
        )
        return response.token
    }

    func dashboard(token: String) async throws -> DashboardData {
        async let profile: WalletProfile = request(path: "profile", token: token)
        async let balance: WalletBalance = request(path: "balance", token: token)
        async let transactionList: TransactionList = request(
            path: "transactions?limit=30",
            token: token
        )
        return try await DashboardData(
            profile: profile,
            balance: balance,
            transactions: transactionList.transactions
        )
    }

    func sendPayment(
        token: String,
        amount: Double,
        recipientEmail: String,
        description: String
    ) async throws {
        let body = SendPaymentRequest(
            amount: amount,
            recipientEmail: recipientEmail,
            description: description
        )
        let _: SendPaymentResponse = try await request(
            path: "send",
            method: "POST",
            token: token,
            idempotencyKey: UUID().uuidString,
            body: body
        )
    }

    func contacts(token: String) async throws -> [WalletContact] {
        let response: ContactList = try await request(path: "address-book", token: token)
        return response.contacts
    }

    func saveContact(token: String, label: String, email: String) async throws {
        let body = SaveContactRequest(label: label, address: email)
        let _: EmptyResponse = try await request(
            path: "address-book",
            method: "POST",
            token: token,
            body: body
        )
    }

    func deleteContact(token: String, id: Int) async throws {
        let _: EmptyResponse = try await request(
            path: "address-book/\(id)",
            method: "DELETE",
            token: token,
            idempotencyKey: Optional<String>.none,
            body: Optional<EmptyBody>.none
        )
    }

    func commodityHoldings(token: String) async throws -> [String: Double] {
        let response: CommodityHoldings = try await request(path: "commodities", token: token)
        return response.holdings
    }

    func tradeCommodity(token: String, commodity: String, units: Double, buying: Bool) async throws {
        let body = CommodityTradeRequest(commodity: commodity, units: units)
        let _: EmptyResponse = try await request(
            path: buying ? "commodities/buy" : "commodities/sell",
            method: "POST",
            token: token,
            body: body
        )
    }

    func miningStatus(token: String) async throws -> MiningStatus {
        try await request(path: "mining/status", token: token)
    }

    func claimMiningReward(token: String) async throws -> MiningClaimResponse {
        try await request(
            path: "mining/claim",
            method: "POST",
            token: token,
            idempotencyKey: Optional<String>.none,
            body: Optional<EmptyBody>.none
        )
    }

    func market(token: String) async throws -> (MarketData, [MarketPoint], TokenInfo, PizzaTarget) {
        async let current: MarketData = request(path: "market/data")
        async let history: MarketHistory = request(path: "market/history?limit=30")
        async let tokenInfo: TokenInfo = request(path: "token/info")
        async let target: PizzaTarget = request(path: "pizza/target")
        let result = try await (current, history, tokenInfo, target)
        return (result.0, result.1.history, result.2, result.3)
    }

    func pizzaMenu() async throws -> PizzaMenu {
        try await request(path: "pizza/menu")
    }

    func pizzaMerchants() async throws -> [PizzaMerchant] {
        let response: MerchantList = try await request(path: "pizza/merchants")
        return response.merchants
    }

    func merchantProfile(token: String) async throws -> MerchantProfile {
        try await request(path: "pizza/merchant", token: token)
    }

    func vouchers(token: String) async throws -> [PizzaVoucher] {
        let response: VoucherList = try await request(path: "pizza/vouchers", token: token)
        return response.vouchers
    }

    func saveMerchant(token: String, name: String, location: String) async throws {
        let _: MerchantProfileResponse = try await request(
            path: "pizza/merchant",
            method: "POST",
            token: token,
            body: MerchantRequest(name: name, location: location)
        )
    }

    func purchaseVoucher(token: String, merchantId: Int) async throws -> PurchasedVoucher {
        let response: VoucherPurchaseResponse = try await request(
            path: "pizza/vouchers",
            method: "POST",
            token: token,
            idempotencyKey: UUID().uuidString.replacingOccurrences(of: "-", with: ""),
            body: VoucherPurchaseRequest(
                merchantId: merchantId,
                requestId: UUID().uuidString.replacingOccurrences(of: "-", with: "")
            )
        )
        return response.voucher
    }

    func redeemVoucher(token: String, code: String) async throws -> RedeemedSale {
        let response: VoucherRedeemResponse = try await request(
            path: "pizza/pos/redeem",
            method: "POST",
            token: token,
            body: VoucherRedeemRequest(code: code)
        )
        return response.sale
    }

    func settings(token: String) async throws -> UserSettings {
        try await request(path: "user/settings", token: token)
    }

    func updateSettings(token: String, settings: SettingsUpdateRequest) async throws -> UserSettings {
        try await request(
            path: "user/settings",
            method: "PUT",
            token: token,
            body: settings
        )
    }

    func topupConfig(token: String) async throws -> TopupConfig {
        try await request(path: "topups/config", token: token)
    }

    func startTopup(amountEur: Int, token: String) async throws -> URL {
        let r: TopupCheckout = try await request(
            path: "topups", method: "POST", token: token, body: TopupRequest(amountEur: amountEur)
        )
        guard let url = URL(string: r.url) else { throw APIClientError.invalidResponse }
        return url
    }

    func topups(token: String) async throws -> [TopupRecord] {
        let r: TopupList = try await request(path: "topups", token: token)
        return r.topups
    }

    func listOrders(_ kind: String, token: String) async throws -> [OnlineOrder] {
        let r: OnlineOrdersResponse = try await request(path: "orders/\(kind)", token: token)
        return r.orders
    }

    func placeOrder(_ body: NewOnlineOrder, key: String, token: String) async throws -> OnlineOrder {
        let r: OnlineOrderResponse = try await request(
            path: "orders", method: "POST", token: token, idempotencyKey: key, body: body
        )
        return r.order
    }

    func orderAction(_ id: String, _ action: String, expectedStatus: String? = nil, token: String) async throws {
        let _: OnlineOrderAction = try await request(
            path: "orders/\(id)/\(action)", method: "POST", token: token,
            body: expectedStatus.map { OrderStepBody(expectedStatus: $0) } ?? OrderStepBody(expectedStatus: nil)
        )
    }

    private func request<Response: Decodable, Body: Encodable>(
        path: String,
        method: String = "GET",
        token: String? = nil,
        idempotencyKey: String? = nil,
        body: Body? = nil
    ) async throws -> Response {
        var request = URLRequest(url: try endpoint(path: path))
        request.httpMethod = method
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let idempotencyKey {
            request.setValue(idempotencyKey, forHTTPHeaderField: "Idempotency-Key")
        }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try encoder.encode(body)
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch let error as URLError {
            switch error.code {
            case .cannotConnectToHost, .cannotFindHost, .notConnectedToInternet, .timedOut, .networkConnectionLost:
                throw APIClientError.connectionFailed(healthURL: healthCheckURL)
            default:
                throw error
            }
        }
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIClientError.invalidResponse
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            let message = (try? decoder.decode(APIErrorResponse.self, from: data).error)
                ?? "Il server BITZZA ha restituito un errore (\(httpResponse.statusCode))."
            if httpResponse.statusCode == 401, token != nil {
                throw APIClientError.unauthorized
            }
            throw APIClientError.server(message)
        }
        return try decoder.decode(Response.self, from: data)
    }

    private func request<Response: Decodable>(
        path: String,
        token: String? = nil
    ) async throws -> Response {
        try await request(
            path: path,
            method: "GET",
            token: token,
            idempotencyKey: Optional<String>.none,
            body: Optional<EmptyBody>.none
        )
    }

    private func endpoint(path: String) throws -> URL {
        let base = baseURL.absoluteString.hasSuffix("/")
            ? baseURL.absoluteString
            : baseURL.absoluteString + "/"
        guard
            let normalizedBase = URL(string: base),
            let endpoint = URL(string: path, relativeTo: normalizedBase)?.absoluteURL
        else {
            throw APIClientError.invalidEndpoint
        }
        return endpoint
    }

    private var healthCheckURL: String {
        var components = URLComponents()
        components.scheme = baseURL.scheme
        components.host = baseURL.host
        components.port = baseURL.port
        components.path = "/health"
        return components.url?.absoluteString ?? baseURL.absoluteString
    }
}

private struct Credentials: Encodable {
    let email: String
    let password: String
}

private struct SendPaymentResponse: Decodable {
    let message: String
}

private struct MerchantProfileResponse: Decodable {
    let merchant: PizzaMerchant
}

private struct EmptyBody: Encodable {}
