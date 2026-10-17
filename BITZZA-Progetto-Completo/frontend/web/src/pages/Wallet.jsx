import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  addressBookAPI,
  commoditiesAPI,
  miningAPI,
  pizzaAPI,
  settingsAPI,
  tokenAPI,
  walletAPI,
} from '../api';
import { useAuth } from '../context/useAuth';

const COMMODITIES = [
  { name: 'Pomodoro', unitPrice: 2, label: 'Pomodori' },
  { name: 'Grano', unitPrice: 1, label: 'Grano' },
  { name: 'Latte', unitPrice: 1.5, label: 'Latte' },
];
const PENDING_PAYMENTS_PREFIX = 'bitzza-pending-payments:';

const readPendingPayments = (key) => {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch (storageError) {
    console.warn('Could not read pending demo payments:', storageError);
    return [];
  }
};

const NAV_ICONS = {
  wallet: <><rect x="3" y="5" width="18" height="15" rx="3" /><path d="M3 9h18M16 15h.01" /></>,
  pizzeria: <><path d="M4 7 20 4l-6 16L4 7Z" /><path d="m4 7 10 13M10 8l1 1M14 6l1 1M13 13l1 1" /></>,
  commodities: <><path d="M3 20h18M5 20V10l7-6 7 6v10M9 20v-6h6v6" /></>,
  mining: <><path d="m12 3 2.4 5.1 5.6.8-4 3.9.9 5.6-4.9-2.6-4.9 2.6.9-5.6-4-3.9 5.6-.8L12 3Z" /></>,
  contacts: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.8M17 14a4.5 4.5 0 0 1 3.5 4.4" /></>,
  market: <><path d="M4 18 9 13l4 3 7-9" /><path d="M14 7h6v6" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.2.9-1.5 2.6-1.4-.6a7.6 7.6 0 0 1-1.7 1l-.2 1.5h-3l-.3-1.5a7.6 7.6 0 0 1-1.7-1l-1.4.6L8 16l1.2-.9a7.4 7.4 0 0 1 0-2l-1.2-.9 1.5-2.6 1.4.6a7.6 7.6 0 0 1 1.7-1l.3-1.5h3l.2 1.5a7.6 7.6 0 0 1 1.7 1l1.4-.6 1.5 2.6-1.2.9a7.4 7.4 0 0 1-.1 1.9Z" transform="translate(-1.3 -1.3) scale(1.11)" /></>,
};

const DashboardIcon = ({ name }) => (
  <svg aria-hidden="true" className="nav-icon" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {NAV_ICONS[name]}
  </svg>
);

const loadWalletData = async () => {
  const [profile, balance, transactionResult] = await Promise.all([
    walletAPI.getProfile(),
    walletAPI.getBalance(),
    walletAPI.getTransactions({ limit: 100 }),
  ]);
  return {
    profile: profile.data,
    balance: Number(balance.data.balance) || 0,
    transactions: transactionResult.data.transactions || [],
    settings: profile.data.settings || null,
  };
};

const Wallet = () => {
  const navigate = useNavigate();
  const { logout: logoutFromContext } = useAuth();
  const [section, setSection] = useState('wallet');
  const [profile, setProfile] = useState(null);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [holdings, setHoldings] = useState({});
  const [mining, setMining] = useState(null);
  const [market, setMarket] = useState(null);
  const [marketHistory, setMarketHistory] = useState([]);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [pizzaTarget, setPizzaTarget] = useState(null);
  const [pizzaMenu, setPizzaMenu] = useState(null);
  const [pizzaMerchants, setPizzaMerchants] = useState([]);
  const [pizzaMerchant, setPizzaMerchant] = useState(null);
  const [pizzaSales, setPizzaSales] = useState([]);
  const [pizzaVouchers, setPizzaVouchers] = useState([]);
  const [selectedMerchantId, setSelectedMerchantId] = useState('');
  const [merchantName, setMerchantName] = useState('');
  const [merchantLocation, setMerchantLocation] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [pendingPayments, setPendingPayments] = useState([]);
  const [online, setOnline] = useState(navigator.onLine);
  const pendingPaymentsRef = useRef(pendingPayments);
  const syncingPaymentsRef = useRef(false);
  const hydratedQueueKeyRef = useRef(null);
  const pendingPaymentsKey = profile?.email
    ? `${PENDING_PAYMENTS_PREFIX}${profile.email.toLowerCase()}`
    : null;
  const [settings, setSettings] = useState(null);
  const recipientInputRef = useRef(null);
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [description, setDescription] = useState('');
  const [transactionSearch, setTransactionSearch] = useState('');
  const [transactionType, setTransactionType] = useState('all');
  const [contactLabel, setContactLabel] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [commodity, setCommodity] = useState('Pomodoro');
  const [commodityUnits, setCommodityUnits] = useState('1');
  const [commodityAction, setCommodityAction] = useState('buy');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const updatePendingPayments = useCallback((update) => {
    const next = typeof update === 'function' ? update(pendingPaymentsRef.current) : update;
    pendingPaymentsRef.current = next;
    setPendingPayments(next);
    const storageKey = hydratedQueueKeyRef.current;
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch (storageError) {
      console.error('Could not persist pending demo payments:', storageError);
      setError('Il pagamento è in coda solo in memoria: chiudendo il browser potrebbe andare perso.');
    }
  }, [setError]);

  const refreshWallet = useCallback(async () => {
    const data = await loadWalletData();
    setProfile(data.profile);
    setBalance(data.balance);
    setTransactions(data.transactions);
    if (data.settings) setSettings(data.settings);
  }, []);

  const loadSection = useCallback(async (key) => {
    try {
      if (key === 'wallet') {
        await refreshWallet();
      } else if (key === 'commodities') {
        const response = await commoditiesAPI.getHoldings();
        setHoldings(response.data.holdings);
      } else if (key === 'mining') {
        const response = await miningAPI.getStatus();
        setMining(response.data);
      } else if (key === 'contacts') {
        const response = await addressBookAPI.list();
        setContacts(response.data.contacts);
      } else if (key === 'market') {
        const [marketResponse, historyResponse, tokenResponse, targetResponse] = await Promise.all([
          tokenAPI.getMarketData(),
          tokenAPI.getMarketHistory({ limit: 20 }),
          tokenAPI.getInfo(),
          tokenAPI.getPizzaTarget(),
        ]);
        setMarket(marketResponse.data);
        setMarketHistory(historyResponse.data.history);
        setTokenInfo(tokenResponse.data);
        setPizzaTarget(targetResponse.data);
      } else if (key === 'pizzeria') {
        const [menuResponse, merchantsResponse, merchantResponse, vouchersResponse] = await Promise.all([
          tokenAPI.getPizzaMenu(),
          pizzaAPI.listMerchants(),
          pizzaAPI.getMerchant(),
          pizzaAPI.listVouchers(),
        ]);
        const merchants = merchantsResponse.data.merchants || [];
        setPizzaMenu(menuResponse.data);
        setPizzaMerchants(merchants);
        setPizzaMerchant(merchantResponse.data.merchant);
        setPizzaSales(merchantResponse.data.sales || []);
        setPizzaVouchers(vouchersResponse.data.vouchers || []);
        if (!selectedMerchantId && merchants.length) setSelectedMerchantId(String(merchants[0].id));
      } else if (key === 'settings') {
        const response = await settingsAPI.get();
        setSettings(response.data);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Impossibile caricare questa sezione.');
    } finally {
      setLoading(false);
    }
  }, [refreshWallet, selectedMerchantId, setError]);

  useEffect(() => {
    let active = true;
    loadWalletData()
      .then((data) => {
        if (!active) return;
        setProfile(data.profile);
        setBalance(data.balance);
        setTransactions(data.transactions);
        const queueKey = `${PENDING_PAYMENTS_PREFIX}${data.profile.email.toLowerCase()}`;
        const storedPayments = readPendingPayments(queueKey);
        pendingPaymentsRef.current = storedPayments;
        hydratedQueueKeyRef.current = queueKey;
        setPendingPayments(storedPayments);
        if (data.settings) setSettings(data.settings);
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.response?.data?.error || 'Impossibile caricare il wallet.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (section !== 'mining') return undefined;
    const timer = window.setInterval(() => {
      miningAPI.getStatus()
        .then((response) => setMining(response.data))
        .catch((requestError) => {
          setError(requestError.response?.data?.error || 'Impossibile aggiornare lo stato mining.');
        });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [section]);

  const syncPendingPayments = useCallback(async () => {
    if (!navigator.onLine || syncingPaymentsRef.current) return;
    syncingPaymentsRef.current = true;
    try {
      for (const payment of pendingPaymentsRef.current) {
        if (payment.status !== 'pending') continue;
        try {
          await walletAPI.sendPayment(payment.payload, payment.id);
        } catch (requestError) {
          if (!requestError.response) break;
          updatePendingPayments((current) => current.map((item) => item.id === payment.id
            ? { ...item, status: 'rejected', error: requestError.response.data?.error || 'Pagamento rifiutato dal server.' }
            : item));
          setError(`Pagamento in coda rifiutato: ${requestError.response.data?.error || 'verifica i dati e riprova.'}`);
          continue;
        }
        updatePendingPayments((current) => current.filter((item) => item.id !== payment.id));
        setNotice(`Pagamento in coda inviato a ${payment.payload.recipientEmail}.`);
        try {
          await refreshWallet();
        } catch (refreshError) {
          setError(refreshError.response?.data?.error || 'Pagamento inviato, ma impossibile aggiornare il saldo.');
        }
      }
    } finally {
      syncingPaymentsRef.current = false;
    }
  }, [refreshWallet, updatePendingPayments]);

  useEffect(() => {
    const updateConnection = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) syncPendingPayments();
    };
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    if (navigator.onLine) syncPendingPayments();
    return () => {
      window.removeEventListener('online', updateConnection);
      window.removeEventListener('offline', updateConnection);
    };
  }, [syncPendingPayments]);

  useEffect(() => {
    if (hydratedQueueKeyRef.current === pendingPaymentsKey && pendingPayments.length && navigator.onLine) {
      syncPendingPayments();
    }
  }, [pendingPaymentsKey, pendingPayments, syncPendingPayments]);

  const selectSection = (key) => {
    setSection(key);
    setError('');
    setNotice('');
    setLoading(true);
    loadSection(key);
  };

  const handleSend = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Inserisci un importo valido.');
      return;
    }
    setSaving(true);
    const payload = {
        amount: parsedAmount,
        recipientEmail: recipient.trim(),
        description: description.trim(),
    };
    const requestId = crypto.randomUUID().replaceAll('-', '');
    try {
      if (!navigator.onLine) throw new Error('OFFLINE');
      await walletAPI.sendPayment(payload, requestId);
      setAmount('');
      setRecipient('');
      setDescription('');
      setNotice('Pagamento inviato con successo.');
      await refreshWallet();
    } catch (requestError) {
      if (!requestError.response) {
        updatePendingPayments((current) => [...current, {
          id: requestId,
          payload,
          status: 'pending',
          queuedAt: new Date().toISOString(),
          error: '',
        }]);
        setAmount('');
        setRecipient('');
        setDescription('');
        setNotice('Pagamento salvato come PENDING sul dispositivo. Non è completato né ha riservato fondi.');
      } else {
        setError(requestError.response.data?.error || 'Invio del pagamento non riuscito.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleMerchantSave = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setSaving(true);
    try {
      const result = await pizzaAPI.registerMerchant({ name: merchantName, location: merchantLocation });
      setPizzaMerchant(result.data.merchant);
      setMerchantName('');
      setMerchantLocation('');
      await loadSection('pizzeria');
      setNotice('Profilo pizzeria demo salvato.');
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Impossibile salvare il profilo pizzeria.');
    } finally {
      setSaving(false);
    }
  };

  const handleVoucherPurchase = async (event) => {
    event.preventDefault();
    if (!selectedMerchantId) {
      setError('Seleziona una pizzeria.');
      return;
    }
    setError('');
    setNotice('');
    setSaving(true);
    try {
      const requestId = crypto.randomUUID().replaceAll('-', '');
      const response = await pizzaAPI.buyVoucher({ merchantId: Number(selectedMerchantId), requestId });
      setNotice(`Voucher demo acquistato: ${response.data.voucher.code}`);
      const [voucherResponse, walletData] = await Promise.all([
        pizzaAPI.listVouchers(),
        loadWalletData(),
      ]);
      setPizzaVouchers(voucherResponse.data.vouchers || []);
      setBalance(walletData.balance);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Impossibile acquistare il voucher.');
    } finally {
      setSaving(false);
    }
  };

  const handleVoucherRedeem = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setSaving(true);
    try {
      const response = await pizzaAPI.redeemVoucher(voucherCode);
      setNotice(`Voucher demo riscattato. Accreditati ${Number(response.data.sale.amount).toFixed(2)} BITZ demo.`);
      setVoucherCode('');
      await loadSection('pizzeria');
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Impossibile riscattare il voucher.');
    } finally {
      setSaving(false);
    }
  };

  const retryPendingPayment = (paymentId) => {
    updatePendingPayments((current) => current.map((payment) => payment.id === paymentId
      ? { ...payment, status: 'pending', error: '' }
      : payment));
    window.setTimeout(syncPendingPayments, 0);
  };

  const handleContactSave = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setSaving(true);
    try {
      await addressBookAPI.save({ label: contactLabel.trim(), address: contactEmail.trim() });
      setContactLabel('');
      setContactEmail('');
      setNotice('Contatto salvato.');
      await loadSection('contacts');
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Impossibile salvare il contatto.');
    } finally {
      setSaving(false);
    }
  };

  const handleContactDelete = async (contactId) => {
    setError('');
    try {
      await addressBookAPI.remove(contactId);
      setContacts((current) => current.filter((contact) => contact.id !== contactId));
      setNotice('Contatto eliminato.');
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Impossibile eliminare il contatto.');
    }
  };

  const handleCommodityTrade = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setSaving(true);
    try {
      const trade = { commodity, units: Number(commodityUnits) };
      const result = commodityAction === 'buy'
        ? await commoditiesAPI.buy(trade)
        : await commoditiesAPI.sell(trade);
      setNotice(
        commodityAction === 'buy'
          ? `Acquisto completato. Nuovo saldo: ${Number(result.data.newBalance).toFixed(2)} BITZ.`
          : `Vendita completata. Ricevuti ${Number(result.data.bitzReceived).toFixed(2)} BITZ.`,
      );
      const [holdingResponse, walletData] = await Promise.all([
        commoditiesAPI.getHoldings(),
        loadWalletData(),
      ]);
      setHoldings(holdingResponse.data.holdings);
      setProfile(walletData.profile);
      setBalance(walletData.balance);
      setTransactions(walletData.transactions);
      if (walletData.settings) setSettings(walletData.settings);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Operazione non riuscita.');
    } finally {
      setSaving(false);
    }
  };

  const handleMiningClaim = async () => {
    setError('');
    setNotice('');
    setSaving(true);
    try {
      const result = await miningAPI.claim();
      setNotice(`Hai ricevuto ${Number(result.data.amount).toFixed(2)} BITZ.`);
      const [statusResponse, walletData] = await Promise.all([
        miningAPI.getStatus(),
        loadWalletData(),
      ]);
      setMining(statusResponse.data);
      setBalance(walletData.balance);
      setTransactions(walletData.transactions);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Impossibile richiedere la ricompensa.');
      if (requestError.response?.status === 429) {
        miningAPI.getStatus()
          .then((response) => setMining(response.data))
          .catch(() => setError('Impossibile aggiornare lo stato mining.'));
      }
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setSaving(true);
    try {
      const response = await settingsAPI.update(settings);
      setSettings(response.data);
      setNotice('Preferenze salvate.');
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Impossibile salvare le preferenze.');
    } finally {
      setSaving(false);
    }
  };

  const exportWallet = async () => {
    setError('');
    try {
      const response = await walletAPI.exportWallet();
      const file = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const downloadUrl = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = 'bitzza-wallet-export.json';
      link.click();
      URL.revokeObjectURL(downloadUrl);
      setNotice('Esportazione del wallet completata.');
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Impossibile esportare il wallet.');
    }
  };

  const handleLogout = () => {
    logoutFromContext();
    navigate('/login', { replace: true });
  };

  const copyWalletAddress = async () => {
    setError('');
    if (settings?.privacy_mode || !profile?.wallet_address) {
      setError('Attiva la visualizzazione dell’indirizzo per poterlo copiare.');
      return;
    }
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Copia negli appunti non disponibile in questo browser.');
      }
      await navigator.clipboard.writeText(profile.wallet_address);
      setNotice('Indirizzo demo copiato negli appunti.');
    } catch (copyError) {
      setError(copyError.message || 'Impossibile copiare l’indirizzo.');
    }
  };

  const focusPaymentForm = () => {
    recipientInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    recipientInputRef.current?.focus({ preventScroll: true });
  };

  const filteredTransactions = transactions.filter((transaction) => {
    const matchesType = transactionType === 'all' || transaction.type === transactionType;
    const term = transactionSearch.trim().toLowerCase();
    const matchesSearch = !term || [
      transaction.description,
      transaction.label,
      transaction.otherParty,
    ].some((value) => value?.toLowerCase().includes(term));
    return matchesType && matchesSearch;
  });

  const navItems = [
    ['wallet', 'Wallet'],
    ['pizzeria', 'Pizzeria / POS'],
    ['commodities', 'Commodità'],
    ['mining', 'Mining'],
    ['contacts', 'Contatti'],
    ['market', 'Mercato'],
    ['settings', 'Impostazioni'],
  ];

  return (
    <main className={`wallet-page${settings?.theme === 'dark' ? ' theme-dark' : settings?.theme === 'system' ? ' theme-system' : ''}`}>
      <header className="wallet-header">
        <div className="wallet-header-inner">
          <div className="wallet-brand">
            <img className="brand-logo" src="/bitzza-logo-original.png" alt="" />
            <div>
              <h1>BITZZA <span className="demo-badge">DEMO</span></h1>
              <p>Valore locale, in movimento</p>
            </div>
          </div>
          <div className="wallet-account">
            <span className="account-email">{settings?.privacy_mode ? 'Privacy attiva' : profile?.email}</span>
            <button className="secondary-button" onClick={exportWallet} type="button">Esporta</button>
            <button className="secondary-button logout-button" onClick={handleLogout} type="button">Esci</button>
          </div>
        </div>
      </header>

      <div className="wallet-content">
        <nav className="dashboard-nav" aria-label="Sezioni wallet">
          {navItems.map(([key, label]) => (
            <button
              aria-current={section === key ? 'page' : undefined}
              className={section === key ? 'dashboard-nav-item active' : 'dashboard-nav-item'}
              key={key}
              onClick={() => selectSection(key)}
              type="button"
            >
              <DashboardIcon name={key} />
              {label}
            </button>
          ))}
        </nav>

        <p className={`connection-status${online ? '' : ' offline'}`} role="status">
          {online ? 'Connesso' : 'Offline'} · Le operazioni non confermate restano in sospeso fino alla verifica del server.
        </p>
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && settings?.notifications_enabled !== 0 && (
          <p className="form-success" role="status">{notice}</p>
        )}
        {loading && <p className="loading-message">Caricamento…</p>}

        {!loading && section === 'wallet' && (
          <>
            <section className="wallet-welcome">
              <div>
                <span className="welcome-kicker">IL TUO SPAZIO BITZZA</span>
                <h2>{settings?.privacy_mode
                  ? 'Ciao.'
                  : `Ciao, ${profile?.email?.split('@')[0] || 'benvenuto'}.`}</h2>
                <p>Un piccolo passo alla volta, verso un’economia più vicina.</p>
              </div>
              <span className="welcome-tomato" aria-hidden="true">✳</span>
            </section>
            <section className="wallet-card balance-card">
            <div className="balance-card-topline">
              <p className="eyebrow">IL TUO SALDO DEMO</p>
              <span className="balance-chip"><span aria-hidden="true">●</span> Wallet attivo</span>
            </div>
            <div className="balance-card-main">
              <div>
                <p className="balance-amount">
                  {settings?.privacy_mode ? '••••••' : balance.toFixed(2)} <span>BITZ</span>
                </p>
                <p className="wallet-address">
                  {settings?.privacy_mode ? 'Indirizzo nascosto' : profile?.wallet_address}
                </p>
              </div>
              <span className="balance-emblem" aria-hidden="true">B</span>
            </div>
            <div className="balance-actions">
              <button className="balance-action secondary" type="button"
                disabled={settings?.privacy_mode || !profile?.wallet_address}
                onClick={copyWalletAddress}>
                <span aria-hidden="true">▣</span> Copia indirizzo
              </button>
              <button className="balance-action primary" type="button" onClick={focusPaymentForm}>
                <span aria-hidden="true">↗</span> Invia BITZ demo
              </button>
            </div>
          </section>

            <div className="wallet-columns">
              <section className="wallet-card wallet-panel">
                <div className="form-card-heading">
                  <span className="panel-icon send-icon" aria-hidden="true">↗</span>
                  <div>
                    <span className="panel-kicker">TRASFERIMENTO DEMO</span>
                    <h2 className="section-heading">Invia un pagamento</h2>
                  </div>
                </div>
                <form className="auth-form" onSubmit={handleSend}>
                  <div className="form-field">
                    <label htmlFor="recipient">Email destinatario</label>
                    <input ref={recipientInputRef} className="form-input" id="recipient" type="email" required
                      value={recipient} onChange={(event) => setRecipient(event.target.value)} />
                  </div>
                  <div className="form-field">
                    <label htmlFor="amount">Importo (BITZ)</label>
                    <input className="form-input" id="amount" type="number" min="0.01" step="0.01" required
                      value={amount} onChange={(event) => setAmount(event.target.value)} />
                  </div>
                  <div className="form-field">
                    <label htmlFor="description">Descrizione (facoltativa)</label>
                    <input className="form-input" id="description" type="text" maxLength="200"
                      value={description} onChange={(event) => setDescription(event.target.value)} />
                  </div>
                  <button className="primary-button" type="submit" disabled={saving}>
                    {saving ? 'Invio in corso…' : 'Invia pagamento'}
                  </button>
                </form>
              </section>

              <section className="wallet-card wallet-panel">
                <div className="section-heading-row">
                  <h2 className="section-heading">Transazioni</h2>
                  <button className="text-button" onClick={exportWallet} type="button">Esporta JSON</button>
                </div>
                <div className="transaction-filters">
                  <input className="form-input" aria-label="Cerca transazioni" placeholder="Cerca"
                    value={transactionSearch} onChange={(event) => setTransactionSearch(event.target.value)} />
                  <select className="form-input" aria-label="Filtra tipo transazione"
                    value={transactionType} onChange={(event) => setTransactionType(event.target.value)}>
                    <option value="all">Tutte</option>
                    <option value="sent">Inviate</option>
                    <option value="received">Ricevute</option>
                  </select>
                </div>
                {filteredTransactions.length === 0 ? (
                  transactions.length === 0 && !transactionSearch.trim() && transactionType === 'all' ? (
                    <div className="empty-state activity-empty">
                      <span className="empty-icon" aria-hidden="true">↗</span>
                      <strong>La tua attività inizia qui</strong>
                      <p>Quando invii o ricevi BITZ demo, vedrai le operazioni in questo spazio.</p>
                      <button className="text-button" type="button" onClick={focusPaymentForm}>Fai una prova di invio</button>
                    </div>
                  ) : (
                    <p className="empty-state">Nessuna transazione corrisponde ai filtri selezionati.</p>
                  )
                ) : (
                  <ul className="transaction-list">
                    {filteredTransactions.map((transaction) => (
                      <li className="transaction-item" key={transaction.id}>
                        <div>
                          <p className="transaction-title">
                            {transaction.type === 'sent' ? 'Inviato a' : 'Ricevuto da'} {transaction.otherParty}
                          </p>
                          <p className="transaction-description">{transaction.description || 'Pagamento BITZ'}</p>
                          <time className="transaction-date" dateTime={transaction.createdAt}>
                            {new Date(transaction.createdAt).toLocaleString()}
                          </time>
                        </div>
                        <strong className={transaction.type === 'sent' ? 'amount-sent' : 'amount-received'}>
                          {settings?.privacy_mode
                            ? '•••• BITZ'
                            : `${transaction.type === 'sent' ? '−' : '+'}${Number(transaction.amount).toFixed(2)} BITZ`}
                        </strong>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
            {pendingPayments.length > 0 && (
              <section className="wallet-card wallet-panel">
                <h2 className="section-heading">Pagamenti in attesa sul dispositivo</h2>
                <p className="section-intro">Non sono transazioni confermate, non compaiono nella cronologia e non riservano fondi. Restano in chiaro nel local storage di questo browser fino alla sincronizzazione, al rifiuto o all’eliminazione.</p>
                <ul className="voucher-list">
                  {pendingPayments.map((payment) => (
                    <li className="voucher-item" key={payment.id}>
                      <div>
                        <strong>{payment.payload.recipientEmail} · {Number(payment.payload.amount).toFixed(2)} BITZ</strong>
                        <span>{payment.status === 'pending' ? 'PENDING — da verificare' : `RIFIUTATO — ${payment.error}`}</span>
                        <small>{new Date(payment.queuedAt).toLocaleString()}</small>
                      </div>
                      {payment.status === 'rejected' && (
                        <div className="pending-actions">
                          <button className="secondary-button" type="button" disabled={!online || saving}
                            onClick={() => retryPendingPayment(payment.id)}>Riprova</button>
                          <button className="text-button danger-link" type="button"
                            onClick={() => updatePendingPayments((current) => current.filter((item) => item.id !== payment.id))}>
                            Elimina
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {!loading && section === 'pizzeria' && (
          <>
            <section className="wallet-card wallet-panel">
              <h2 className="section-heading">Voucher pizza e cassa POS <span className="demo-badge">SIMULAZIONE</span></h2>
              <p className="section-intro">Voucher prepagati con valore demo fisso. Non garantiscono una pizza reale: accordarsi e verificare prezzi, ingredienti e allergeni con il venditore.</p>
              {pizzaMenu?.products?.map((product) => (
                <article className="pizza-product" key={product.id}>
                  <div>
                    <h3>{product.name}</h3>
                    <p>{product.description}</p>
                    <p>Ingredienti dimostrativi: {product.ingredients.join(', ')} · Allergeni: {product.allergens.join(', ')}</p>
                    <small>{product.disclosure}</small>
                  </div>
                  <strong>{Number(product.price).toFixed(2)} BITZ demo</strong>
                </article>
              ))}
              <form className="trade-form" onSubmit={handleVoucherPurchase}>
                <div className="form-field">
                  <label htmlFor="pizza-merchant-select">Pizzeria</label>
                  <select className="form-input" id="pizza-merchant-select" required
                    value={selectedMerchantId} onChange={(event) => setSelectedMerchantId(event.target.value)}>
                    <option value="">Seleziona una pizzeria</option>
                    {pizzaMerchants.map((merchant) => (
                      <option key={merchant.id} value={merchant.id}>{merchant.name} · {merchant.location}</option>
                    ))}
                  </select>
                </div>
                <p className="pizza-price">Prezzo fisso: {Number(pizzaMenu?.products?.[0]?.price || 12.5).toFixed(2)} BITZ demo</p>
                <button className="primary-button" type="submit" disabled={saving || !selectedMerchantId}>
                  {saving ? 'Acquisto…' : 'Acquista voucher demo'}
                </button>
              </form>
            </section>

            <section className="wallet-card wallet-panel">
              <h2 className="section-heading">La mia pizzeria</h2>
              {pizzaMerchant ? (
                <>
                  <div className="merchant-summary">
                    <div><strong>{pizzaMerchant.name}</strong><span>{pizzaMerchant.location}</span></div>
                    <strong>{Number(pizzaMerchant.balance).toFixed(2)} BITZ demo liquidati</strong>
                  </div>
                  <form className="trade-form pos-form" onSubmit={handleVoucherRedeem}>
                    <div className="form-field">
                      <label htmlFor="pizza-voucher-code">Codice voucher da riscattare</label>
                      <input className="form-input" id="pizza-voucher-code" autoComplete="off"
                        placeholder="BZ-…" required value={voucherCode}
                        onChange={(event) => setVoucherCode(event.target.value)} />
                    </div>
                    <button className="primary-button" type="submit" disabled={saving}>
                      {saving ? 'Verifica…' : 'Riscatta alla cassa demo'}
                    </button>
                  </form>
                  <h3 className="subheading">Vendite riscattate</h3>
                  {pizzaSales.length === 0 ? <p className="empty-state">Nessuna vendita demo riscattata.</p> : (
                    <ul className="voucher-list">
                      {pizzaSales.map((sale) => (
                        <li className="voucher-item" key={sale.id}>
                          <div><strong>{sale.code}</strong><span>{new Date(sale.redeemedAt).toLocaleString()}</span></div>
                          <strong>{Number(sale.amount).toFixed(2)} BITZ demo</strong>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <>
                  <p className="section-intro">Crea il profilo POS demo. Non è una verifica commerciale né un conto bancario reale.</p>
                  <form className="trade-form" onSubmit={handleMerchantSave}>
                    <div className="form-field">
                      <label htmlFor="pizzeria-name">Nome pizzeria</label>
                      <input className="form-input" id="pizzeria-name" required maxLength="100"
                        value={merchantName} onChange={(event) => setMerchantName(event.target.value)} />
                    </div>
                    <div className="form-field">
                      <label htmlFor="pizzeria-location">Città / località</label>
                      <input className="form-input" id="pizzeria-location" required maxLength="120"
                        value={merchantLocation} onChange={(event) => setMerchantLocation(event.target.value)} />
                    </div>
                    <button className="primary-button" type="submit" disabled={saving}>
                      {saving ? 'Salvataggio…' : 'Crea profilo POS demo'}
                    </button>
                  </form>
                </>
              )}
            </section>

            <section className="wallet-card wallet-panel">
              <h2 className="section-heading">I miei voucher</h2>
              {pizzaVouchers.length === 0 ? <p className="empty-state">Non hai acquistato voucher demo.</p> : (
                <ul className="voucher-list">
                  {pizzaVouchers.map((voucher) => (
                    <li className="voucher-item" key={voucher.id}>
                      <div>
                        <strong>{voucher.code}</strong>
                        <span>{voucher.merchantName} · {voucher.merchantLocation}</span>
                        <small>{voucher.status === 'active' ? 'ATTIVO — demo' : `RISCATTATO · ${new Date(voucher.redeemedAt).toLocaleString()}`}</small>
                      </div>
                      <strong>{Number(voucher.amount).toFixed(2)} BITZ demo</strong>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {!loading && section === 'commodities' && (
          <section className="wallet-card wallet-panel">
            <h2 className="section-heading">Mercato delle commodity</h2>
            <p className="section-intro">Acquista e vendi beni virtuali usando il saldo BITZ demo.</p>
            <div className="commodity-grid">
              {COMMODITIES.map((item) => (
                <article className="commodity-card" key={item.name}>
                  <h3>{item.label}</h3>
                  <p>{item.unitPrice.toFixed(2)} BITZ / unità</p>
                  <strong>{Number(holdings[item.name] || 0).toFixed(2)} unità</strong>
                </article>
              ))}
            </div>
            <form className="trade-form" onSubmit={handleCommodityTrade}>
              <div className="form-field">
                <label htmlFor="trade-action">Operazione</label>
                <select id="trade-action" className="form-input" value={commodityAction}
                  onChange={(event) => setCommodityAction(event.target.value)}>
                  <option value="buy">Acquista</option>
                  <option value="sell">Vendi (commissione 5%)</option>
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="trade-commodity">Prodotto</label>
                <select id="trade-commodity" className="form-input" value={commodity}
                  onChange={(event) => setCommodity(event.target.value)}>
                  {COMMODITIES.map((item) => <option key={item.name} value={item.name}>{item.label}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="trade-units">Unità</label>
                <input className="form-input" id="trade-units" type="number" min="0.01" step="0.01" required
                  value={commodityUnits} onChange={(event) => setCommodityUnits(event.target.value)} />
              </div>
              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? 'Elaborazione…' : commodityAction === 'buy' ? 'Acquista' : 'Vendi'}
              </button>
            </form>
          </section>
        )}

        {!loading && section === 'mining' && (
          <section className="wallet-card wallet-panel">
            <h2 className="section-heading">Mining demo</h2>
            <p className="section-intro">Richiedi una ricompensa virtuale. Una richiesta è disponibile ogni volta che il conto alla rovescia termina.</p>
            <div className="mining-summary">
              <article><span>Ricompensa prossima</span><strong>{Number(mining?.nextReward || 0).toFixed(4)} BITZ</strong></article>
              <article><span>Ricompense totali</span><strong>{Number(mining?.totalMined || 0).toFixed(4)} BITZ</strong></article>
              <article><span>Richieste completate</span><strong>{mining?.totalClaims ?? 0}</strong></article>
              <article><span>Difficoltà</span><strong>{Number(mining?.currentDifficulty || 1).toFixed(2)}</strong></article>
            </div>
            <button className="primary-button mining-button" type="button" disabled={saving || !mining?.canClaim}
              onClick={handleMiningClaim}>
              {saving ? 'Elaborazione…' : mining?.canClaim ? 'Richiedi BITZ' : `Disponibile tra ${mining?.secondsRemaining ?? 0} secondi`}
            </button>
          </section>
        )}

        {!loading && section === 'contacts' && (
          <section className="wallet-card wallet-panel">
            <h2 className="section-heading">Rubrica</h2>
            <form className="trade-form contact-form" onSubmit={handleContactSave}>
              <div className="form-field">
                <label htmlFor="contact-label">Nome</label>
                <input className="form-input" id="contact-label" required maxLength="80"
                  value={contactLabel} onChange={(event) => setContactLabel(event.target.value)} />
              </div>
              <div className="form-field">
                <label htmlFor="contact-email">Email</label>
                <input className="form-input" id="contact-email" type="email" required
                  value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} />
              </div>
              <button className="primary-button" type="submit" disabled={saving}>Salva contatto</button>
            </form>
            {contacts.length === 0 ? <p className="empty-state">La rubrica è vuota.</p> : (
              <ul className="contact-list">
                {contacts.map((contact) => (
                  <li className="contact-item" key={contact.id}>
                    <div><strong>{contact.label}</strong><span>{contact.address}</span></div>
                    <div className="contact-actions">
                      <button className="text-button" type="button" onClick={() => {
                        setRecipient(contact.address);
                        selectSection('wallet');
                      }}>Invia</button>
                      <button className="text-button danger-link" type="button"
                        onClick={() => handleContactDelete(contact.id)}>Rimuovi</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {!loading && section === 'market' && (
          <section className="wallet-card wallet-panel">
            <h2 className="section-heading">Token e mercato <span className="demo-badge">SIMULATO</span></h2>
            {market && tokenInfo && (
              <>
                <div className="market-grid">
                  <article><span>{tokenInfo.name} ({tokenInfo.symbol})</span><strong>${Number(market.price_usd).toFixed(2)}</strong></article>
                  <article><span>Capitalizzazione demo</span><strong>${Number(market.market_cap).toLocaleString()}</strong></article>
                  <article><span>Volume 24h demo</span><strong>${Number(market.volume_24h).toLocaleString()}</strong></article>
                  <article><span>Variazione simulata</span><strong>{Number(market.change_24h).toFixed(2)}%</strong></article>
                </div>
                <p className="market-note">Dati e token simulati a solo scopo dimostrativo; non rappresentano un asset negoziabile.</p>
                {pizzaTarget && (
                  <div className="target-card">
                    <div><strong>Traguardo BITZ</strong><span>{pizzaTarget.message}</span></div>
                    <progress max="100" value={pizzaTarget.percentage}>{pizzaTarget.percentage}%</progress>
                    <small>{pizzaTarget.percentage}% del traguardo di ${Number(pizzaTarget.target_usd).toFixed(2)}</small>
                  </div>
                )}
                <h3 className="subheading">Andamento simulato</h3>
                <ul className="market-history">
                  {marketHistory.map((entry) => (
                    <li key={entry.id}><time>{new Date(entry.timestamp).toLocaleString()}</time>
                      <strong>${Number(entry.price_usd).toFixed(2)}</strong></li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

        {!loading && section === 'settings' && settings && (
          <section className="wallet-card wallet-panel">
            <h2 className="section-heading">Impostazioni</h2>
            <form className="settings-form" onSubmit={saveSettings}>
              <div className="form-field">
                <label htmlFor="theme">Tema</label>
                <select className="form-input" id="theme" value={settings.theme}
                  onChange={(event) => setSettings({ ...settings, theme: event.target.value })}>
                  <option value="light">Chiaro</option>
                  <option value="dark">Scuro</option>
                  <option value="system">Sistema</option>
                </select>
              </div>
              <label className="toggle-setting">
                <input type="checkbox" checked={Boolean(settings.notifications_enabled)}
                  onChange={(event) => setSettings({ ...settings, notifications_enabled: Number(event.target.checked) })} />
                Notifiche abilitate
              </label>
              <label className="toggle-setting">
                <input type="checkbox" checked={Boolean(settings.privacy_mode)}
                  onChange={(event) => setSettings({ ...settings, privacy_mode: Number(event.target.checked) })} />
                Modalità privacy
              </label>
              <div className="form-field">
                <label htmlFor="slippage">Slippage predefinito (0–50%)</label>
                <input className="form-input" id="slippage" type="number" min="0" max="50" step="0.1"
                  value={settings.default_slippage}
                  onChange={(event) => setSettings({ ...settings, default_slippage: Number(event.target.value) })} />
              </div>
              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? 'Salvataggio…' : 'Salva impostazioni'}
              </button>
            </form>
          </section>
        )}

        <footer className="wallet-footer">BITZZA · Wallet demo con saldi e mercati simulati.</footer>
      </div>
    </main>
  );
};

export default Wallet;
