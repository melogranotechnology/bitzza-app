import Foundation

struct OfflineDemoState: Codable {
    var profile: WalletProfile
    var balance: WalletBalance
    var transactions: [WalletTransaction]
    var contacts: [WalletContact]
    var commodityHoldings: [String: Double]
    var miningStatus: MiningStatus
    var miningAvailableAt: Date?
    var vouchers: [PizzaVoucher]
    var merchantProfile: MerchantProfile
    var settings: UserSettings
    var nextTransactionID: Int
    var nextContactID: Int
    var nextVoucherID: Int
    var nextSaleID: Int

    static func sample() -> OfflineDemoState {
        let merchant = PizzaMerchant(
            id: 1,
            name: "Pizzeria Demo",
            location: "Bologna",
            balance: 0
        )
        return OfflineDemoState(
            profile: WalletProfile(
                email: "demo@bitzza.local",
                walletAddress: "BITZ-DEMO-LOCAL-001"
            ),
            balance: WalletBalance(balance: 100, currency: "BITZ"),
            transactions: [],
            contacts: [
                WalletContact(id: 1, label: "Marco Demo", address: "marco@bitzza.local"),
                WalletContact(id: 2, label: "Pizzeria Demo", address: "pizzeria@bitzza.local"),
            ],
            commodityHoldings: ["Pomodoro": 5, "Grano": 10, "Latte": 3],
            miningStatus: MiningStatus(
                canClaim: true,
                secondsRemaining: 0,
                totalMined: 0,
                totalClaims: 0,
                currentDifficulty: 1,
                nextReward: 0.25
            ),
            miningAvailableAt: nil,
            vouchers: [],
            merchantProfile: MerchantProfile(merchant: merchant, sales: []),
            settings: UserSettings(
                theme: "system",
                notificationsEnabled: 1,
                privacyMode: 0,
                defaultSlippage: 0.5
            ),
            nextTransactionID: 1,
            nextContactID: 3,
            nextVoucherID: 1,
            nextSaleID: 1
        )
    }
}

enum OfflineDemoFixtures {
    static let swapRateUSDCPerBITZ = 12.5

    static let merchants = [
        PizzaMerchant(id: 1, name: "Pizzeria Demo", location: "Bologna", balance: 0),
        PizzaMerchant(id: 2, name: "Forno Locale", location: "Modena", balance: 0),
    ]

    static let menu = PizzaMenu(products: [
        PizzaProduct(
            id: "margherita-demo",
            name: "Margherita demo",
            description: "Una pizza dimostrativa per esplorare il flusso voucher.",
            price: 12.5,
            ingredients: ["pomodoro", "mozzarella", "basilico"],
            allergens: ["glutine", "latte"],
            disclosure: "Prodotto e voucher sono simulati e non rappresentano un ordine reale."
        )
    ])

    static let market = MarketData(
        price: swapRateUSDCPerBITZ,
        marketCap: 12_500_000,
        volume24h: 475_000,
        change24h: 2.4
    )

    static let history: [MarketPoint] = (0..<24).map { index in
        let price = 11.85 + Double((index * 7) % 13) * 0.045 + Double(index) * 0.012
        return MarketPoint(
            id: index + 1,
            price: price,
            timestamp: ISO8601DateFormatter().string(from: Date().addingTimeInterval(Double(index - 23) * 3600))
        )
    }

    static let tokenInfo = TokenInfo(name: "BITZZA Demo", symbol: "BITZ", totalSupply: 1_000_000)

    static let pizzaTarget = PizzaTarget(
        target: 12.5,
        current: 12.2,
        percentage: 97.6,
        reached: false,
        message: "Traguardo simulato: quasi raggiunto."
    )
}
