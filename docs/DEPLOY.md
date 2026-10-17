# Pubblicazione online (demo con account reali, saldi finti)

## 1. API su Render (piano gratuito)
1. Metti il progetto su un repository GitHub privato (senza `.env`, `*.db`, `node_modules`).
2. Su render.com: **New → Blueprint** e seleziona il repository. Usa [render.yaml](../render.yaml): crea il servizio gratuito e genera `JWT_SECRET`.
3. Imposta `CORS_ORIGINS` con l'URL del sito web (es. `https://bitzza.vercel.app`).
4. Verifica `https://<servizio>.onrender.com/health` → `{"status":"OK"}`.

Limiti del piano gratuito: il servizio si addormenta dopo circa 15 minuti di inattività (la prima richiesta impiega fino a ~1 minuto) e il database in `/tmp` **si azzera a ogni riavvio o deploy**. Va bene per una demo; per conservare i dati passa al piano a pagamento con disco (`plan: starter`, disco su `/var/data`).

## 2. Web su Vercel
1. **New Project**, cartella radice `frontend/web`, framework Vite.
2. Variabile d'ambiente: `VITE_API_URL=https://<servizio>.onrender.com/api`.
3. Dopo il deploy, aggiorna `CORS_ORIGINS` su Render con il dominio definitivo.

## 3. iOS collegata al server
1. In `ios/Bitzza.xcodeproj` imposta `BITZZA_API_BASE_URL` su `https://<servizio>.onrender.com/api`.
2. In `ios/Bitzza/AppConfig.swift` imposta `offlineOnly = false`.
3. Archive e upload su TestFlight come prima.

## Limiti noti
- SQLite su una sola istanza: va bene per demo, non per molti utenti.
- Il limite tentativi di accesso è in memoria (si azzera al riavvio).
- Fai backup periodico del disco `/var/data/bitzza.db`.
- Saldi e token sono fittizi: nessun fondo reale.
