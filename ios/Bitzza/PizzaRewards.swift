import Foundation

/// QR del commerciante: bitzza://earn?m=<id>&n=<nome>&l=<luogo>
struct MerchantEarnCode: Equatable {
    let merchantId: Int
    let name: String
    let location: String

    var uriString: String {
        var components = URLComponents()
        components.scheme = "bitzza"
        components.host = "earn"
        components.queryItems = [
            URLQueryItem(name: "m", value: String(merchantId)),
            URLQueryItem(name: "n", value: name),
            URLQueryItem(name: "l", value: location),
        ]
        return components.string ?? "bitzza://earn"
    }

    static func parse(_ raw: String) -> MerchantEarnCode? {
        guard let components = URLComponents(string: raw.trimmingCharacters(in: .whitespacesAndNewlines)),
              components.scheme?.lowercased() == "bitzza", components.host == "earn" else { return nil }
        func value(_ name: String) -> String? { components.queryItems?.first { $0.name == name }?.value }
        guard let id = value("m").flatMap(Int.init), id > 0,
              let name = value("n"), !name.isEmpty, name.count <= 60 else { return nil }
        return MerchantEarnCode(merchantId: id, name: name, location: String((value("l") ?? "").prefix(60)))
    }
}

struct PizzaVisit: Codable, Identifiable {
    var id: UUID = UUID()
    let merchantId: Int
    let merchantName: String
    let reward: Double
    let date: Date
}

enum PizzaRewardRules {
    static let rewardPerVisit = 1.0
    static let maxVisitsPerDay = 3
}
