import Foundation

enum DeliveryVehicle: String, Codable, CaseIterable, Identifiable {
    case walking, bicycle, motorcycle, car
    var id: String { rawValue }

    var title: String {
        switch self {
        case .walking: "A piedi"
        case .bicycle: "Bici"
        case .motorcycle: "Moto"
        case .car: "Auto"
        }
    }

    var symbol: String {
        switch self {
        case .walking: "figure.walk"
        case .bicycle: "bicycle"
        case .motorcycle: "scooter"
        case .car: "car.fill"
        }
    }
}

/// Tariffe iniziali del prototipo SpesaGo (€/km per mezzo, €/kg, commissione piattaforma %).
enum DeliveryPricing {
    static let weightSurchargePerKg = 0.20
    static let platformCommissionPercent = 0.17
    static let completionBonus = 0.50

    static func ratePerKm(_ vehicle: DeliveryVehicle) -> Double {
        switch vehicle {
        case .walking: 2.00
        case .bicycle: 1.50
        case .motorcycle: 1.80
        case .car: 2.20
        }
    }

    static func earnings(vehicle: DeliveryVehicle, distanceKm: Double, weightKg: Double) -> Double {
        ((distanceKm * ratePerKm(vehicle) + weightKg * weightSurchargePerKg) * 100).rounded() / 100
    }

    /// Mezzi ragionevoli per la distanza (evita 6 km a piedi).
    static func isSuitable(_ vehicle: DeliveryVehicle, distanceKm: Double) -> Bool {
        switch vehicle {
        case .walking: distanceKm <= 1.5
        case .bicycle: distanceKm <= 5
        case .motorcycle, .car: true
        }
    }
}

struct DeliveryJob: Identifiable, Equatable {
    let id: Int
    let store: String
    let area: String
    let distanceKm: Double
    let weightKg: Double
}

struct DeliveryRecord: Codable, Identifiable {
    var id: UUID = UUID()
    let jobId: Int
    let store: String
    let vehicle: DeliveryVehicle
    let earnings: Double
    let bonus: Double
    let date: Date
}

enum DeliveryDemoFixtures {
    static let maxPerDay = 5
    static let jobs = [
        DeliveryJob(id: 1, store: "Supermercato Centro", area: "Bologna · Via Indipendenza", distanceKm: 1.2, weightKg: 4),
        DeliveryJob(id: 2, store: "Mercato Biologico", area: "Modena · Corso Canalgrande", distanceKm: 3.4, weightKg: 7),
        DeliveryJob(id: 3, store: "Forno Locale", area: "Modena · Via Emilia", distanceKm: 0.8, weightKg: 2),
        DeliveryJob(id: 4, store: "Ipermercato Nord", area: "Bologna · Casalecchio", distanceKm: 7.5, weightKg: 15),
    ]
}
