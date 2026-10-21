import Foundation

struct OnlineOrder: Decodable, Identifiable, Equatable {
    let id: String
    let store: String
    let area: String
    let itemsMinor: Int
    let weightKg: Double
    let distanceKm: Double
    let vehicle: String
    let courierFeeMinor: Int
    let commissionMinor: Int
    let totalMinor: Int
    let cashbackMinor: Int
    let status: String
    let step: Int?
    let courierName: String?

    var total: Double { Double(totalMinor) / 100 }
    var items: Double { Double(itemsMinor) / 100 }
    var fee: Double { Double(courierFeeMinor) / 100 }
    var cashback: Double { Double(cashbackMinor) / 100 }

    var statusTitle: String {
        switch status {
        case "open": return "In attesa di un corriere"
        case "accepted": return "Corriere assegnato"
        case "shopping": return "Spesa in corso"
        case "delivering": return "In consegna"
        case "delivered": return "Consegnato"
        case "cancelled": return "Annullato"
        default: return status
        }
    }

    var nextStatus: String? {
        switch status {
        case "accepted": return "shopping"
        case "shopping": return "delivering"
        case "delivering": return "delivered"
        default: return nil
        }
    }

    var nextActionTitle: String? {
        switch status {
        case "accepted": return "Inizia la spesa"
        case "shopping": return "Parti per la consegna"
        case "delivering": return "Segna come consegnato"
        default: return nil
        }
    }
}

struct NewOnlineOrder: Encodable {
    let store: String
    let area: String
    let itemsMinor: Int
    let weightKg: Double
    let distanceKm: Double
    let vehicle: String
}

struct OrderStepBody: Encodable {
    let expectedStatus: String?
}

struct OnlineOrdersResponse: Decodable { let orders: [OnlineOrder] }
struct OnlineOrderResponse: Decodable { let order: OnlineOrder }
struct OnlineOrderAction: Decodable {}
