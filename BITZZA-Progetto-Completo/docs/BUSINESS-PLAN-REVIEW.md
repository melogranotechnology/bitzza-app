# BITZZA — sintesi e lettura critica del business plan

## Documento esaminato

Il file **“Bittza plan complete.pdf”** è una presentazione di 49 pagine, principalmente in inglese. Combina una visione di prodotto con sezioni da business plan e pagine di template ancora incomplete. Questa sintesi descrive ciò che il documento propone; non verifica in modo indipendente dati, partnership, proiezioni o fattibilità.

## L’idea in breve

Il piano immagina BITZZA come un ecosistema che unisce pagamenti, pizza e agricoltura:

- una community di clienti, possessori del token, pizzerie e produttori agricoli;
- una moneta/token BITZ collegata alla produzione e distribuzione della pizza, presentata come unità di valore concreta;
- un’app con wallet, pagamenti online e offline, acquisto/vendita/scambio, informazioni sul mercato, notizie, governance e in futuro carta o integrazione con Apple Pay;
- uso di blockchain e AI per tracciare ingredienti e filiera, migliorare la trasparenza e automatizzare alcuni processi;
- una rete di pizzerie e aziende agricole, con l’ambizione di partire da Napoli e poi espandersi;
- cashback e incentivi per i possessori, oltre a ricavi destinati a sviluppo aziendale, nuove pizzerie e aziende agricole.

La proposta di valore aspirazionale è usare la pizza come riferimento quotidiano e comprensibile per collegare l’economia digitale al cibo e alle filiere locali.

## Modello di business descritto

Il PDF ipotizza ricavi e distribuzioni tramite token, commissioni e cashback; cita anche imposte, fondi per lo sviluppo della società e ricompense per i possessori. Prevede partnership con produttori e pizzerie, vendita/distribuzione tramite app e attività di marketing online e sul territorio.

Tuttavia, non specifica ancora in modo operativo:

- chi emette il token e quali diritti concreti attribuisce;
- quali ricavi sono generati da clienti, esercenti o altre attività e con quali commissioni;
- quale evento finanzia il cashback, a chi spetta, per quanto tempo e con quali limiti;
- se la pizza è un bene riscattabile, un voucher, un riferimento di prezzo o solo un concetto di marca;
- chi paga e mantiene rete, app, personale, produzione, logistica, compliance e assistenza;
- i costi di acquisizione clienti, i margini per pizza, l’economia unitaria degli esercenti e il fabbisogno di capitale.

Quindi il PDF comunica una visione e alcune ipotesi, ma non presenta ancora un modello finanziario verificabile.

## Elementi interessanti da conservare

1. **Identità forte:** pizza, territorio e filiera agricola rendono il progetto facile da raccontare e distinguibile.
2. **Punto d’ingresso concreto:** pizzerie e voucher possono offrire un caso d’uso comprensibile, se diritti, rimborso e regolamento sono definiti.
3. **Tracciabilità come servizio:** la provenienza degli ingredienti può avere valore senza dipendere dalla speculazione sul token, a condizione che i dati siano verificati.
4. **Community locale:** partire da una città o da un gruppo ristretto di esercenti sembra più testabile di una promessa di espansione globale immediata.
5. **Offline come requisito operativo:** il documento identifica la continuità in caso di interruzione Internet come tema, ma non definisce una modalità sicura di autorizzazione e riconciliazione.

## Lacune e incongruenze da risolvere

### 1. Numeri di mercato e ricavi non verificabili

Il piano cita, tra gli altri, 5 miliardi di pizze vendute nel mondo, oltre 3 miliardi negli Stati Uniti, un mercato globale della pizza di 233,26 miliardi di dollari, ricavi annuali stimati di 26,45 miliardi negli USA e 132,48 miliardi a livello globale. Non accompagna queste cifre con fonti, definizioni, date di rilevazione o un modello che spieghi come si passa dalle vendite di pizza ai ricavi BITZZA. Il riferimento al mercato “by 2023” è inoltre datato rispetto a una pianificazione attuale.

Le pagine sul mercato riportano ipotesi di spesa mensile di 3.500 dollari per cliente e applicano moltiplicatori su popolazioni o transazioni molto ampie. Non chiariscono se la base rappresenti clienti raggiungibili, transazioni, spesa effettiva o ricavi dell’azienda. Alcuni risultati cambiano tra le pagine senza spiegare le ipotesi.

**Da fare:** creare un modello dal basso, per paese e segmento: esercenti realmente acquisibili, utenti attivi, scontrini, volume medio, take rate, costi di pagamento, margine lordo, cashback, costi operativi e scenari prudente/base/ottimistico. Ogni dato esterno deve avere fonte, data e definizione.

### 2. Cashback, prezzo e “stabilità”

Il documento parla di un valore sostenuto dalla pizza, stabilità rispetto alla volatilità di Bitcoin/Ethereum, rivalutazione e cashback. Non descrive però un meccanismo verificabile che garantisca stabilità o un diritto di rimborso. Il cashback viene indicato in intervalli differenti, per esempio dal 2,34375% fino all’8–10%, mentre altre sezioni usano 0,17% e 5,85%.

Un bene di riferimento non stabilizza automaticamente il prezzo di un token scambiabile. Se si promettono rimborsi, valore ancorato, guadagni o distribuzioni ai possessori, servono definizioni economiche precise e una valutazione legale specifica prima di presentarli agli utenti o agli investitori.

**Da fare:** separare prezzo di mercato, prezzo di un eventuale voucher, ricavi, ricompense e diritti del token. Non promettere rendimento, stabilità, cashback o rimborso finché modello e basi legali non sono documentati e validati.

### 3. Esempio Solidity non pronto per l’uso

La presentazione include un frammento di contratto Polygon che dichiara ripetutamente lo stesso indirizzo segnaposto `0x1234...`, usa percentuali con scale non coerenti con i commenti e non controlla i valori booleani restituiti da `transfer`. La logica trasferisce più quote partendo da un singolo importo di token e non dimostra la copertura dei saldi. Mancano inoltre una specifica completa del token, test, gestione degli errori, controlli dei prezzi e una revisione indipendente.

È un esempio illustrativo, non un contratto da distribuire o un’implementazione da copiare. Nel repository dell’app non è collegato a una blockchain.

### 4. Piano operativo, partner e finanziamento incompleti

Il documento nomina possibili partner come esempi, ma non documenta accordi o autorizzazioni. L’organigramma e la storia aziendale sono parziali; alcune tappe sono indicate come “unknown”. Le sezioni “break-even”, crescita e richiesta di finanziamento contengono grafici o campi segnaposto, non un budget o una previsione supportata.

**Da fare:** indicare lo stato di ogni partnership (contatto, trattativa, accordo firmato), il responsabile, le risorse necessarie, i costi, le dipendenze e i risultati misurabili per ogni fase.

### 5. Prodotto e priorità

La visione include wallet, scambio, mercati, carta, pagamenti offline, governance, agricoltura, robotica e crescita internazionale. Sono troppi fronti per una prima release e hanno rischi e dipendenze diverse.

La v1 concordata per il progetto è più limitata: wallet non-custodial per creare/importare, ricevere e inviare BITZ; niente acquisto/vendita in-app, voucher o pagamenti ai negozi. Il documento originale può guidare la visione successiva, ma non deve essere interpretato come specifica già approvata per la v1.

## Allineamento con l’app attuale

L’app oggi è una demo web con registrazione, saldo e trasferimenti simulati, POS/voucher demo, mercati e ricompense simulate. Non contiene il token, la blockchain, le chiavi non-custodial o i servizi reali descritti nel business plan. I voucher demo non costituiscono un diritto a ricevere una pizza e il saldo demo non è un asset.

Per mantenere un percorso sicuro e coerente:

1. usare il business plan come visione, non come prova che i numeri o i meccanismi siano già validati;
2. decidere e documentare il prodotto minimo con utenti e pizzerie reali prima di implementare nuove promesse economiche;
3. chiedere una verifica legale e finanziaria del token e dei flussi previsti per Italia/UE;
4. testare i flussi blockchain solo su testnet, dopo aver definito diritti del token e modello chiavi/recupero;
5. aggiungere una funzione reale solo quando esistono fonti dati, responsabilità operative, partner e criteri di accettazione.

## Sintesi finale

Il business plan è utile come **manifesto di prodotto e visione**: collega pizza, agricoltura, community e tecnologia con una forte identità. Non è ancora un piano esecutivo o finanziario pronto per investitori, partner o lancio pubblico: servono fonti per le stime, unit economics, definizione dei diritti e del token, accordi verificati, costi, team, tappe misurabili e verifiche legali e tecniche. La strada più solida è trasformare prima la visione in un pilot locale misurabile, senza attribuire valore reale al saldo o alle ricompense della demo.
