import AVFoundation
import CoreImage.CIFilterBuiltins
import SwiftUI

struct QRPaymentView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var mode = 0

    var body: some View {
        VStack(spacing: 0) {
            Picker("Modalità", selection: $mode) {
                Text("Ricevi").tag(0)
                Text("Paga").tag(1)
            }
            .pickerStyle(.segmented)
            .padding()
            if mode == 0 { ReceiveQRView() } else { PayQRView() }
        }
        .background(BitzzaTheme.paper)
        .navigationTitle("Pagamento QR")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct ReceiveQRView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var amount = ""
    @State private var memo = ""

    private var request: QRPaymentRequest {
        let parsed = Double(amount.replacingOccurrences(of: ",", with: "."))
        return QRPaymentRequest(
            recipient: session.dashboard?.profile.walletAddress ?? "",
            amount: parsed.flatMap { $0 > 0 ? $0 : nil },
            memo: memo
        )
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                if request.recipient.isEmpty {
                    Text("Wallet non disponibile.").foregroundStyle(BitzzaTheme.muted)
                } else {
                    QRCodeImage(text: request.uriString)
                        .frame(width: 240, height: 240)
                        .padding(16)
                        .background(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 18))
                    Text(request.recipient).font(.footnote.monospaced()).foregroundStyle(BitzzaTheme.muted)
                    ShareLink(item: request.uriString) { Label("Condividi richiesta", systemImage: "square.and.arrow.up") }
                }
                TextField("Importo (facoltativo)", text: $amount)
                    .keyboardType(.decimalPad)
                    .padding(14).background(BitzzaTheme.input).clipShape(RoundedRectangle(cornerRadius: 12))
                TextField("Descrizione (facoltativa)", text: $memo)
                    .padding(14).background(BitzzaTheme.input).clipShape(RoundedRectangle(cornerRadius: 12))
                Text("Mostra il QR a chi deve pagarti. Demo: nessun fondo reale, nessuna blockchain.")
                    .font(.caption).multilineTextAlignment(.center).foregroundStyle(BitzzaTheme.muted)
            }
            .padding()
        }
    }
}

private struct PayQRView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var scanned: QRPaymentRequest?
    @State private var pasted = ""
    @State private var amount = ""
    @State private var invalid = false
    @State private var scanning = true

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                if let scanned {
                    confirmation(scanned)
                } else {
                    if scanning && QRScannerView.isAvailable {
                        QRScannerView { handle($0) }
                            .frame(height: 280)
                            .clipShape(RoundedRectangle(cornerRadius: 18))
                    }
                    TextField("Oppure incolla il codice del pagamento", text: $pasted)
                        .textInputAutocapitalization(.never).autocorrectionDisabled()
                        .padding(14).background(BitzzaTheme.input).clipShape(RoundedRectangle(cornerRadius: 12))
                    Button("Leggi codice") { handle(pasted) }
                        .disabled(pasted.isEmpty)
                    if invalid {
                        Text("Codice non valido. Supportati: bitzza://pay, ethereum:, bitcoin:, solana:.")
                            .font(.caption).foregroundStyle(.red)
                    }
                }
            }
            .padding()
        }
    }

    private func confirmation(_ request: QRPaymentRequest) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Conferma pagamento demo").font(.headline)
            Text("A: \(request.recipient)").font(.subheadline.monospaced())
            if request.isExternalCrypto {
                Text("Destinatario crypto esterno: nella demo il trasferimento è solo simulato.")
                    .font(.caption).foregroundStyle(BitzzaTheme.muted)
            }
            if request.amount == nil {
                TextField("Importo in BITZ demo", text: $amount)
                    .keyboardType(.decimalPad)
                    .padding(14).background(BitzzaTheme.input).clipShape(RoundedRectangle(cornerRadius: 12))
            } else if let value = request.amount {
                Text("Importo: \(value, specifier: "%.2f") BITZ").font(.title3.bold())
            }
            Button {
                let text = request.amount.map { String(format: "%.2f", $0) } ?? amount.replacingOccurrences(of: ",", with: ".")
                Task {
                    if await session.send(amountText: text, recipient: request.recipient, description: request.memo) {
                        scanned = nil; pasted = ""; amount = ""
                    }
                }
            } label: {
                Text("Paga subito").fontWeight(.bold).frame(maxWidth: .infinity).padding(14)
                    .foregroundStyle(.white).background(BitzzaTheme.tomato).clipShape(RoundedRectangle(cornerRadius: 13))
            }
            .disabled(session.isLoading)
            Button("Annulla", role: .cancel) { scanned = nil; invalid = false }
        }
    }

    private func handle(_ text: String) {
        if let request = QRPaymentRequest.parse(text) {
            invalid = false
            scanned = request
        } else {
            invalid = true
        }
    }
}

struct QRCodeImage: View {
    let text: String

    var body: some View {
        if let image = render() {
            Image(uiImage: image).interpolation(.none).resizable().scaledToFit()
                .accessibilityLabel("Codice QR di pagamento")
        }
    }

    private func render() -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(text.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage?.transformed(by: CGAffineTransform(scaleX: 10, y: 10)),
              let cgImage = CIContext().createCGImage(output, from: output.extent) else { return nil }
        return UIImage(cgImage: cgImage)
    }
}

struct QRScannerView: UIViewControllerRepresentable {
    let onCode: (String) -> Void

    static var isAvailable: Bool { AVCaptureDevice.default(for: .video) != nil }

    func makeUIViewController(context: Context) -> ScannerController {
        let controller = ScannerController()
        controller.onCode = onCode
        return controller
    }

    func updateUIViewController(_ controller: ScannerController, context: Context) {}

    final class ScannerController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
        var onCode: ((String) -> Void)?
        private let captureSession = AVCaptureSession()
        private var preview: AVCaptureVideoPreviewLayer?
        private var delivered = false

        override func viewDidLoad() {
            super.viewDidLoad()
            guard let device = AVCaptureDevice.default(for: .video),
                  let input = try? AVCaptureDeviceInput(device: device),
                  captureSession.canAddInput(input) else { return }
            captureSession.addInput(input)
            let output = AVCaptureMetadataOutput()
            guard captureSession.canAddOutput(output) else { return }
            captureSession.addOutput(output)
            output.setMetadataObjectsDelegate(self, queue: .main)
            output.metadataObjectTypes = [.qr]
            let layer = AVCaptureVideoPreviewLayer(session: captureSession)
            layer.videoGravity = .resizeAspectFill
            view.layer.addSublayer(layer)
            preview = layer
        }

        override func viewDidLayoutSubviews() {
            super.viewDidLayoutSubviews()
            preview?.frame = view.bounds
        }

        override func viewDidAppear(_ animated: Bool) {
            super.viewDidAppear(animated)
            let session = captureSession
            DispatchQueue.global(qos: .userInitiated).async { session.startRunning() }
        }

        override func viewWillDisappear(_ animated: Bool) {
            super.viewWillDisappear(animated)
            captureSession.stopRunning()
        }

        func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput objects: [AVMetadataObject], from connection: AVCaptureConnection) {
            guard !delivered,
                  let value = (objects.first as? AVMetadataMachineReadableCodeObject)?.stringValue else { return }
            delivered = true
            onCode?(value)
        }
    }
}
