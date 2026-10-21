import Foundation

struct TopupConfig: Decodable {
    let enabled: Bool
    let minEur: Int
    let maxEur: Int
}

struct TopupRequest: Encodable { let amountEur: Int }
struct TopupCheckout: Decodable { let url: String }
struct TopupList: Decodable { let topups: [TopupRecord] }

struct TopupRecord: Decodable, Identifiable {
    let id: String
    let amountEur: Double
    let status: String
}
