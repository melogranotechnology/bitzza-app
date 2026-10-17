import SwiftUI

struct AuthenticationView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var isRegistering = false
    @State private var email = ""
    @State private var password = ""
    @State private var confirmation = ""
    @State private var isPasswordVisible = false

    var body: some View {
        ZStack {
            BitzzaTheme.paper.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 0) {
                    hero
                    form
                }
                .frame(maxWidth: 520)
                .background(BitzzaTheme.card)
                .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
                .shadow(color: .black.opacity(0.08), radius: 30, y: 16)
                .padding(.horizontal, 18)
                .padding(.vertical, 24)
                .frame(maxWidth: .infinity)
            }
        }
        .alert("Attenzione", isPresented: errorPresented) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(session.errorMessage ?? "")
        }
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 24) {
            HStack(spacing: 12) {
                Image("Logo")
                    .resizable()
                    .scaledToFill()
                    .frame(width: 42, height: 42)
                    .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: 11, style: .continuous)
                            .stroke(.white.opacity(0.8), lineWidth: 1.5)
                    }
                Text("BITZZA")
                    .font(.system(size: 14, weight: .black, design: .rounded))
                    .tracking(3)
                    .foregroundStyle(.white)
            }
            Text("VALORE, IN MOVIMENTO")
                .font(.system(size: 10, weight: .bold, design: .rounded))
                .tracking(2)
                .foregroundStyle(BitzzaTheme.gold)
            Text("Un modo più semplice di tenere tutto insieme.")
                .font(.system(size: 36, weight: .bold, design: .rounded))
                .tracking(-1.6)
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
            Text("Un wallet demo per connettere persone, pizzerie e filiere locali.")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.76))
            HStack(spacing: 8) {
                Circle().fill(BitzzaTheme.gold).frame(width: 7, height: 7)
                Text("AMBIENTE DEMO · NESSUN FONDO REALE")
                    .font(.system(size: 9, weight: .bold, design: .rounded))
                    .tracking(1)
                    .foregroundStyle(.white.opacity(0.78))
            }
            .padding(.top, 4)
        }
        .padding(28)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            ZStack(alignment: .bottomTrailing) {
                LinearGradient(
                    colors: [Color(red: 33.0 / 255, green: 77.0 / 255, blue: 56.0 / 255), BitzzaTheme.forestFill],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                Circle()
                    .fill(BitzzaTheme.tomato.opacity(0.72))
                    .frame(width: 120, height: 120)
                    .overlay(Circle().stroke(BitzzaTheme.gold, lineWidth: 8))
                    .overlay(alignment: .topLeading) {
                        Circle().fill(BitzzaTheme.gold).frame(width: 12, height: 12).offset(x: 30, y: 26)
                    }
                    .offset(x: 40, y: 34)
                    .accessibilityHidden(true)
            }
            .clipped()
        }
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 7) {
                Text(isRegistering ? "IL TUO SPAZIO BITZZA" : "AREA PERSONALE")
                    .font(.system(size: 10, weight: .bold, design: .rounded))
                    .tracking(1.8)
                    .foregroundStyle(BitzzaTheme.tomato)
                Text(isRegistering ? "Inizia da qui." : "Bentornato.")
                    .font(.system(size: 30, weight: .bold, design: .rounded))
                    .tracking(-1.2)
                    .foregroundStyle(BitzzaTheme.forest)
                Text(isRegistering ? "Crea un account per provare il wallet." : "Accedi per continuare nel tuo wallet.")
                    .font(.subheadline)
                    .foregroundStyle(BitzzaTheme.muted)
            }

            Button {
                session.startOfflineDemo()
            } label: {
                Label("Entra nella demo offline", systemImage: "wifi.slash")
                    .font(.subheadline.weight(.bold))
                    .frame(maxWidth: .infinity)
                    .padding(14)
                    .foregroundStyle(BitzzaTheme.forest)
                    .background(BitzzaTheme.forest.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 13))
            }
            Text("Senza account, server o internet. Dati salvati solo su questo iPhone.")
                .font(.caption)
                .multilineTextAlignment(.center)
                .foregroundStyle(BitzzaTheme.muted)
                .frame(maxWidth: .infinity)

            if !AppConfig.offlineOnly {
            HStack(spacing: 12) {
                Rectangle().fill(BitzzaTheme.muted.opacity(0.25)).frame(height: 1)
                Text("OPPURE ACCEDI").font(.caption2.weight(.bold)).foregroundStyle(BitzzaTheme.muted)
                Rectangle().fill(BitzzaTheme.muted.opacity(0.25)).frame(height: 1)
            }
            .padding(.vertical, 2)

            VStack(alignment: .leading, spacing: 7) {
                Text("Email").font(.subheadline.weight(.semibold))
                TextField("nome@esempio.it", text: $email)
                    .keyboardType(.emailAddress)
                    .textContentType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .padding(14)
                    .background(BitzzaTheme.input)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.primary.opacity(0.08)))
            }

            VStack(alignment: .leading, spacing: 7) {
                Text("Password").font(.subheadline.weight(.semibold))
                HStack {
                    Group {
                        if isPasswordVisible {
                            TextField("Almeno 8 caratteri", text: $password)
                        } else {
                            SecureField("Almeno 8 caratteri", text: $password)
                        }
                    }
                    .textContentType(isRegistering ? .newPassword : .password)
                    Button(isPasswordVisible ? "Nascondi" : "Mostra") {
                        isPasswordVisible.toggle()
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(BitzzaTheme.tomato)
                }
                .padding(14)
                .background(BitzzaTheme.input)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.primary.opacity(0.08)))
            }

            if isRegistering {
                VStack(alignment: .leading, spacing: 7) {
                    Text("Conferma password").font(.subheadline.weight(.semibold))
                    SecureField("Ripeti la password", text: $confirmation)
                        .textContentType(.newPassword)
                        .padding(14)
                        .background(BitzzaTheme.input)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.primary.opacity(0.08)))
                    if !confirmation.isEmpty && confirmation != password {
                        Text("Le password non corrispondono.")
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                }
            }

            Button(action: submit) {
                HStack {
                    if session.isLoading { ProgressView().tint(.white) }
                    Text(session.isLoading ? "Attendi…" : (isRegistering ? "Crea account demo" : "Accedi al wallet"))
                    Spacer()
                    Image(systemName: "arrow.up.right")
                }
                .font(.headline)
                .foregroundStyle(.white)
                .padding(16)
                .background(BitzzaTheme.tomato)
                .clipShape(RoundedRectangle(cornerRadius: 13))
            }
            .disabled(session.isLoading || (isRegistering && password != confirmation))

            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    isRegistering.toggle()
                    session.errorMessage = nil
                    confirmation = ""
                }
            } label: {
                HStack(spacing: 4) {
                    Text(isRegistering ? "Hai già un account?" : "Non hai un account?")
                        .foregroundStyle(BitzzaTheme.muted)
                    Text(isRegistering ? "Accedi" : "Crealo adesso")
                        .fontWeight(.bold)
                        .foregroundStyle(BitzzaTheme.tomato)
                }
                .font(.subheadline)
                .frame(maxWidth: .infinity)
            }
            }
        }
        .padding(26)
    }

    private var errorPresented: Binding<Bool> {
        Binding(
            get: { session.errorMessage != nil },
            set: { if !$0 { session.errorMessage = nil } }
        )
    }

    private func submit() {
        Task {
            if isRegistering {
                guard password.count >= 8 else {
                    session.errorMessage = "La password deve contenere almeno 8 caratteri."
                    return
                }
                guard password == confirmation else {
                    session.errorMessage = "Le password non corrispondono."
                    return
                }
                await session.register(email: email, password: password)
            } else {
                await session.login(email: email, password: password)
            }
        }
    }
}
