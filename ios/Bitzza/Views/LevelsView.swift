import SwiftUI

struct LevelsView: View {
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        let progress = session.progress
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Livello \(progress.level)").font(.system(size: 30, weight: .bold, design: .rounded))
                        .foregroundStyle(BitzzaTheme.forest)
                    ProgressView(value: Double(progress.xpInLevel), total: Double(progress.xpPerLevel))
                        .tint(BitzzaTheme.tomato)
                    Text("\(progress.xpInLevel)/\(progress.xpPerLevel) XP al prossimo livello · \(progress.xp) XP totali")
                        .font(.caption).foregroundStyle(BitzzaTheme.muted)
                    Label("Serie: \(progress.streakDays) \(progress.streakDays == 1 ? "giorno" : "giorni")", systemImage: "flame.fill")
                        .foregroundStyle(BitzzaTheme.tomato)
                }
                .padding(14).frame(maxWidth: .infinity, alignment: .leading)
                .background(BitzzaTheme.card).clipShape(RoundedRectangle(cornerRadius: 14))

                Text("Badge").font(.headline)
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    ForEach(progress.badges) { badge in
                        VStack(spacing: 6) {
                            Image(systemName: badge.symbol).font(.title)
                                .foregroundStyle(badge.unlocked ? BitzzaTheme.tomato : BitzzaTheme.muted)
                            Text(badge.title).font(.subheadline.bold())
                            Text(badge.detail).font(.caption2).multilineTextAlignment(.center).foregroundStyle(BitzzaTheme.muted)
                        }
                        .padding(12).frame(maxWidth: .infinity)
                        .background(BitzzaTheme.card).clipShape(RoundedRectangle(cornerRadius: 14))
                        .opacity(badge.unlocked ? 1 : 0.45)
                        .accessibilityLabel("\(badge.title), \(badge.unlocked ? "sbloccato" : "bloccato"). \(badge.detail)")
                    }
                }
                Text("XP: +10 per visita in pizzeria, +20 per consegna, +15 per spesa consegnata.")
                    .font(.caption).foregroundStyle(BitzzaTheme.muted)
            }
            .padding()
        }
        .background(BitzzaTheme.paper)
        .navigationTitle("Livelli e badge")
        .navigationBarTitleDisplayMode(.inline)
    }
}
