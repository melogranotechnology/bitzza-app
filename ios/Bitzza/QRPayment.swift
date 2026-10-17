import Foundation

/// Payload QR aperto: bitzza://pay?to=<indirizzo|email>&amount=<importo>&memo=<testo>
/// Accetta anche URI crypto standard (es. ethereum:0x…?value=…) come destinatari esterni.
struct QRPaymentRequest: Equatable {
    var recipient: String
    var amount: Double?
    var memo: String

    var isExternalCrypto: Bool { !recipient.contains("@") && !recipient.hasPrefix("BITZ-") }

    var uriString: String {
        var components = URLComponents()
        components.scheme = "bitzza"
        components.host = "pay"
        var items = [URLQueryItem(name: "to", value: recipient)]
        if let amount, amount > 0 { items.append(URLQueryItem(name: "amount", value: String(format: "%.2f", amount))) }
        if !memo.isEmpty { items.append(URLQueryItem(name: "memo", value: memo)) }
        components.queryItems = items
        return components.string ?? "bitzza://pay"
    }

    static func parse(_ raw: String) -> QRPaymentRequest? {
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, text.count <= 512, let components = URLComponents(string: text) else { return nil }
        func value(_ name: String) -> String? {
            components.queryItems?.first { $0.name == name }?.value
        }
        switch components.scheme?.lowercased() {
        case "bitzza":
            guard components.host == "pay", let to = value("to"), isValidRecipient(to) else { return nil }
            return QRPaymentRequest(recipient: to, amount: value("amount").flatMap(parseAmount), memo: String((value("memo") ?? "").prefix(80)))
        case "ethereum", "bitcoin", "solana":
            let address = components.path.split(separator: "@").first.map(String.init) ?? components.path
            guard isValidRecipient(address) else { return nil }
            let amount = (value("amount") ?? value("value")).flatMap(parseAmount)
            return QRPaymentRequest(recipient: address, amount: amount, memo: "Pagamento a \(components.scheme ?? "crypto")")
        default:
            return nil
        }
    }

    private static func isValidRecipient(_ value: String) -> Bool {
        !value.isEmpty && value.count <= 128 && value.allSatisfy { $0.isLetter || $0.isNumber || "@.-_+".contains($0) }
    }

    private static func parseAmount(_ text: String) -> Double? {
        guard let number = Double(text.replacingOccurrences(of: ",", with: ".")), number.isFinite, number > 0, number < 1_000_000 else { return nil }
        return (number * 100).rounded() / 100
    }
}
