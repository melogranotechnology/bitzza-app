import Foundation

struct SpesaOrder: Codable, Identifiable {
    var id: UUID = UUID()
    let store: String
    let area: String
    let itemsTotal: Double
    let weightKg: Double
    let distanceKm: Double
    let vehicle: DeliveryVehicle
    let courierEarnings: Double
    let commission: Double
    let total: Double
    var step: Int
    let date: Date
    var cashback: Double

    static let steps = ["Ordine inviato", "Spesa in corso", "In consegna", "Consegnato"]
    var isDelivered: Bool { step >= Self.steps.count - 1 }
}

enum SpesaPricing {
    static let cashbackPercent = 2.0
    static let cashbackCap = 5.0

    static func commission(base: Double) -> Double {
        let rate = DeliveryPricing.platformCommissionPercent / 100
        return ((base * rate / (1 - rate)) * 100).rounded() / 100
    }

    static func cashback(itemsTotal: Double) -> Double {
        min((itemsTotal * cashbackPercent / 100 * 100).rounded() / 100, cashbackCap)
    }
}

struct Badge: Identifiable {
    let id: String
    let title: String
    let detail: String
    let symbol: String
    let unlocked: Bool
}

struct ProgressSummary {
    let xp: Int
    let level: Int
    let xpInLevel: Int
    let xpPerLevel: Int
    let streakDays: Int
    let badges: [Badge]

    static let xpPerLevel = 50

    static func compute(pizza: [PizzaVisit], deliveries: [DeliveryRecord], orders: [SpesaOrder], now: Date = Date()) -> ProgressSummary {
        let delivered = orders.filter(\.isDelivered)
        let xp = pizza.count * 10 + deliveries.count * 20 + delivered.count * 15
        let level = xp / xpPerLevel + 1

        let calendar = Calendar.current
        let days = Set((pizza.map(\.date) + deliveries.map(\.date) + orders.map(\.date)).map { calendar.startOfDay(for: $0) })
        var streak = 0
        var cursor = calendar.startOfDay(for: now)
        if !days.contains(cursor), let yesterday = calendar.date(byAdding: .day, value: -1, to: cursor) { cursor = yesterday }
        while days.contains(cursor) {
            streak += 1
            guard let previous = calendar.date(byAdding: .day, value: -1, to: cursor) else { break }
            cursor = previous
        }

        let badges = [
            Badge(id: "pizza1", title: "Primo morso", detail: "Prima ricompensa in pizzeria", symbol: "fork.knife", unlocked: !pizza.isEmpty),
            Badge(id: "pizza3", title: "Esploratore", detail: "3 pizzerie diverse", symbol: "map", unlocked: Set(pizza.map(\.merchantId)).count >= 3),
            Badge(id: "order1", title: "Spesa fatta", detail: "Primo ordine consegnato", symbol: "cart.fill", unlocked: !delivered.isEmpty),
            Badge(id: "ride1", title: "Corriere", detail: "Prima consegna completata", symbol: "bicycle", unlocked: !deliveries.isEmpty),
            Badge(id: "ride5", title: "Instancabile", detail: "5 consegne completate", symbol: "bolt.fill", unlocked: deliveries.count >= 5),
            Badge(id: "streak3", title: "Costanza", detail: "3 giorni di fila", symbol: "flame.fill", unlocked: streak >= 3),
        ]
        return ProgressSummary(xp: xp, level: level, xpInLevel: xp % xpPerLevel, xpPerLevel: xpPerLevel, streakDays: streak, badges: badges)
    }
}
