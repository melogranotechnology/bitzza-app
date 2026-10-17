import Foundation

struct AuthResponse: Decodable {
    let token: String
}

struct WalletProfile: Codable {
    let email: String
    let walletAddress: String

    enum CodingKeys: String, CodingKey {
        case email
        case walletAddress = "wallet_address"
    }
}

struct WalletBalance: Codable {
    let balance: Double
    let currency: String
}

struct TransactionList: Decodable {
    let transactions: [WalletTransaction]
}

struct WalletTransaction: Codable, Identifiable {
    let id: Int
    let amount: Double
    let type: String
    let description: String?
    let createdAt: String
    let otherParty: String
}

struct SendPaymentRequest: Encodable {
    let amount: Double
    let recipientEmail: String
    let description: String
}

struct APIErrorResponse: Decodable {
    let error: String
}

struct DashboardData {
    let profile: WalletProfile
    let balance: WalletBalance
    let transactions: [WalletTransaction]
}

struct ContactList: Decodable {
    let contacts: [WalletContact]
}

struct WalletContact: Codable, Identifiable {
    let id: Int
    let label: String
    let address: String
}

struct SaveContactRequest: Encodable {
    let label: String
    let address: String
}

struct CommodityHoldings: Decodable {
    let holdings: [String: Double]
}

struct CommodityTradeRequest: Encodable {
    let commodity: String
    let units: Double
}

struct MiningStatus: Codable {
    var canClaim: Bool
    var secondsRemaining: Int
    var totalMined: Double
    var totalClaims: Int
    var currentDifficulty: Double
    var nextReward: Double
}

struct MiningClaimResponse: Decodable {
    let success: Bool
    let amount: Double
    let newBalance: Double
}

struct MarketData: Codable {
    let price: Double
    let marketCap: Double
    let volume24h: Double
    let change24h: Double

    enum CodingKeys: String, CodingKey {
        case price = "price_usd"
        case marketCap = "market_cap"
        case volume24h = "volume_24h"
        case change24h = "change_24h"
    }
}

struct MarketHistory: Decodable {
    let history: [MarketPoint]
}

struct MarketPoint: Codable, Identifiable {
    let id: Int
    let price: Double
    let timestamp: String

    enum CodingKeys: String, CodingKey {
        case id
        case price = "price_usd"
        case timestamp
    }
}

struct TokenInfo: Codable {
    let name: String
    let symbol: String
    let totalSupply: Double

    enum CodingKeys: String, CodingKey {
        case name
        case symbol
        case totalSupply = "total_supply"
    }
}

struct PizzaTarget: Codable {
    let target: Double
    let current: Double
    let percentage: Double
    let reached: Bool
    let message: String

    enum CodingKeys: String, CodingKey {
        case target = "target_usd"
        case current = "current_usd"
        case percentage
        case reached
        case message
    }
}

struct PizzaMenu: Codable {
    let products: [PizzaProduct]
}

struct PizzaProduct: Codable, Identifiable {
    let id: String
    let name: String
    let description: String
    let price: Double
    let ingredients: [String]
    let allergens: [String]
    let disclosure: String
}

struct MerchantList: Decodable {
    let merchants: [PizzaMerchant]
}

struct PizzaMerchant: Codable, Identifiable {
    let id: Int
    let name: String
    let location: String
    let balance: Double?
}

struct MerchantProfile: Codable {
    var merchant: PizzaMerchant?
    var sales: [MerchantSale]
}

struct MerchantSale: Codable, Identifiable {
    let id: Int
    let code: String
    let amount: Double
    let redeemedAt: String
}

struct VoucherList: Decodable {
    let vouchers: [PizzaVoucher]
}

struct PizzaVoucher: Codable, Identifiable {
    let id: Int
    let code: String
    let amount: Double
    let status: String
    let purchasedAt: String
    let redeemedAt: String?
    let merchantName: String
    let merchantLocation: String
}

struct MerchantRequest: Encodable {
    let name: String
    let location: String
}

struct VoucherPurchaseRequest: Encodable {
    let merchantId: Int
    let requestId: String
}

struct VoucherPurchaseResponse: Decodable {
    let voucher: PurchasedVoucher
}

struct PurchasedVoucher: Decodable {
    let code: String
    let amount: Double
}

struct VoucherRedeemRequest: Encodable {
    let code: String
}

struct VoucherRedeemResponse: Decodable {
    let sale: RedeemedSale
}

struct RedeemedSale: Decodable {
    let amount: Double
    let code: String
}

struct UserSettings: Codable {
    var theme: String
    var notificationsEnabled: Int
    var privacyMode: Int
    var defaultSlippage: Double

    enum CodingKeys: String, CodingKey {
        case theme
        case notificationsEnabled = "notifications_enabled"
        case privacyMode = "privacy_mode"
        case defaultSlippage = "default_slippage"
    }
}

struct SettingsUpdateRequest: Encodable {
    let theme: String
    let notificationsEnabled: Bool
    let privacyMode: Bool
    let defaultSlippage: Double

    enum CodingKeys: String, CodingKey {
        case theme
        case notificationsEnabled = "notifications_enabled"
        case privacyMode = "privacy_mode"
        case defaultSlippage = "default_slippage"
    }
}

struct EmptyResponse: Decodable {}

struct DemoSwap: Codable, Identifiable {
    let id: UUID
    let createdAt: Date
    let inputAmount: Double
    let inputAsset: String
    let outputAmount: Double
    let outputAsset: String
    let feeAmount: Double

    init(
        id: UUID = UUID(),
        createdAt: Date = Date(),
        inputAmount: Double,
        inputAsset: String,
        outputAmount: Double,
        outputAsset: String,
        feeAmount: Double
    ) {
        self.id = id
        self.createdAt = createdAt
        self.inputAmount = inputAmount
        self.inputAsset = inputAsset
        self.outputAmount = outputAmount
        self.outputAsset = outputAsset
        self.feeAmount = feeAmount
    }
}
