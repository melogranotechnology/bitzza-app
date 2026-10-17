import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthenticationRequest = /\/(login|register)\/?$/.test(error.config?.url || '');
    if (error.response?.status === 401 && !isAuthenticationRequest) {
      // Token expired or invalid
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  register: (userData) => api.post('/register', userData),
  login: (userData) => api.post('/login', userData),
};

// Wallet APIs
export const walletAPI = {
  getProfile: () => api.get('/profile'),
  getBalance: () => api.get('/balance'),
  sendPayment: (paymentData, idempotencyKey) => api.post('/send', paymentData, {
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
  }),
  getTransactions: (params) => api.get('/transactions', { params }),
  exportWallet: () => api.get('/wallet/export'),
};

export const addressBookAPI = {
  list: () => api.get('/address-book'),
  save: (contact) => api.post('/address-book', contact),
  remove: (id) => api.delete(`/address-book/${id}`),
};

export const settingsAPI = {
  get: () => api.get('/user/settings'),
  update: (settings) => api.put('/user/settings', settings),
};

export const tokenAPI = {
  getInfo: () => api.get('/token/info'),
  getMarketData: () => api.get('/market/data'),
  getMarketHistory: (params) => api.get('/market/history', { params }),
  getPizzaTarget: () => api.get('/pizza/target'),
  getPizzaMenu: () => api.get('/pizza/menu'),
};

export const pizzaAPI = {
  listMerchants: () => api.get('/pizza/merchants'),
  getMerchant: () => api.get('/pizza/merchant'),
  registerMerchant: (profile) => api.post('/pizza/merchant', profile),
  listVouchers: () => api.get('/pizza/vouchers'),
  buyVoucher: (purchase) => api.post('/pizza/vouchers', purchase),
  redeemVoucher: (code) => api.post('/pizza/pos/redeem', { code }),
};

export const miningAPI = {
  getStatus: () => api.get('/mining/status'),
  claim: () => api.post('/mining/claim'),
};

export const commoditiesAPI = {
  getHoldings: () => api.get('/commodities'),
  buy: (purchase) => api.post('/commodities/buy', purchase),
  sell: (sale) => api.post('/commodities/sell', sale),
};

export default api;
