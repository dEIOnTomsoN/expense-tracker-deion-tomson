/*
 * Small observable state store backed by localStorage.
 * Data stays in this browser profile; this is not a secure auth system.
 */
(function () {
  'use strict';

  const listeners = new Set();
  const initialState = { profile: null, transactions: [] };

  function getUserStorageKey() {
    try {
      const user = JSON.parse(window.localStorage.getItem('currentUser') || 'null');
      if (user && typeof user.id === 'string' && user.id) {
        return `exi.user.${encodeURIComponent(user.id)}`;
      }
    } catch (error) {
      // No current account: use an isolated empty state, never the signed-in account's key.
    }
    return 'exi.signed-out';
  }

  const STORAGE_KEY = getUserStorageKey();

  function isValidDate(date) {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const [year, month, day] = date.split('-').map(Number);
    const parsed = new Date(year, month - 1, day);
    return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
  }

  function isValidTransaction(item) {
    return item && typeof item === 'object'
      && typeof item.id === 'string'
      && (item.type === 'income' || item.type === 'expense')
      && Number.isFinite(Number(item.amount)) && Number(item.amount) > 0
      && isValidDate(item.date)
      && typeof item.category === 'string' && item.category.trim().length > 0;
  }

  // Migrate stored data into the current shape and discard invalid transactions.
  function normalizeState(value) {
    if (!value || typeof value !== 'object') return { ...initialState };
    return {
      profile: value.profile && typeof value.profile.name === 'string'
        ? { name: value.profile.name.slice(0, 80) }
        : null,
      transactions: Array.isArray(value.transactions)
        ? value.transactions.filter(isValidTransaction).map((item) => ({
            id: item.id,
            type: item.type,
            amount: Number(item.amount),
            date: item.date,
            category: item.category.slice(0, 80),
            description: (typeof item.description === 'string' && item.description.trim())
              ? item.description.trim().slice(0, 240)
              : typeof item.note === 'string' && item.note.trim()
                ? item.note.trim().slice(0, 240)
                : item.type === 'income' ? 'Imported income' : 'Imported expense'
          }))
        : []
    };
  }

  function loadState() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeState(JSON.parse(raw)) : { ...initialState };
    } catch (error) {
      console.warn('ExI could not read localStorage; using in-memory data.', error);
      return { ...initialState };
    }
  }

  let state = loadState();

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  // Persist changes before notifying every view subscribed to the store.
  function publish() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('ExI could not persist data to localStorage.', error);
    }
    const snapshot = getState();
    listeners.forEach((listener) => listener(snapshot));
  }

  function parseDateParts(date) {
    const parts = date.split('-').map(Number);
    return { year: parts[0], month: parts[1], day: parts[2] };
  }

  function getState() {
    return clone(state);
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('Listener must be a function.');
    listeners.add(listener);
    return function unsubscribe() { listeners.delete(listener); };
  }

  // Apply optional filters and return newest-first copies, not mutable store records.
  function getTransactions(filters) {
    const options = filters || {};
    return state.transactions
      .filter((transaction) => {
        const parts = parseDateParts(transaction.date);
        if (options.year && parts.year !== Number(options.year)) return false;
        if (options.month && parts.month !== Number(options.month)) return false;
        if (options.type && transaction.type !== options.type) return false;
        if (options.category && transaction.category !== options.category) return false;
        return true;
      })
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
      .map((transaction) => ({ ...transaction }));
  }

  function getSummary(filters) {
    const transactions = getTransactions(filters);
    const totals = transactions.reduce((summary, transaction) => {
      summary[transaction.type] += transaction.amount;
      return summary;
    }, { income: 0, expense: 0 });
    return {
      ...totals,
      balance: totals.income - totals.expense,
      count: transactions.length
    };
  }

  // Share the same input rules across transaction creation and editing.
  function validateInput(input) {
    if (!input || (input.type !== 'income' && input.type !== 'expense')) {
      throw new TypeError('Choose income or expense.');
    }
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new TypeError('Amount must be greater than zero.');
    if (!isValidDate(input.date)) throw new TypeError('Enter a valid transaction date.');
    const category = String(input.category || '').trim();
    if (!category) throw new TypeError('Choose a category.');
    const description = String(input.description || '').trim();
    if (!description) throw new TypeError('Enter a description.');
    return {
      type: input.type,
      amount,
      date: input.date,
      category: category.slice(0, 80),
      description: description.slice(0, 240)
    };
  }

  function addTransaction(input) {
    const transaction = {
      id: window.crypto && typeof window.crypto.randomUUID === 'function'
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      ...validateInput(input)
    };
    state = { ...state, transactions: [transaction, ...state.transactions] };
    publish();
    return { ...transaction };
  }

  function updateTransaction(id, input) {
    const exists = state.transactions.some((item) => item.id === id);
    if (!exists) throw new Error('Transaction no longer exists.');
    const updated = { id, ...validateInput(input) };
    state = {
      ...state,
      transactions: state.transactions.map((item) => item.id === id ? updated : item)
    };
    publish();
    return { ...updated };
  }

  function deleteTransaction(id) {
    const transactions = state.transactions.filter((item) => item.id !== id);
    if (transactions.length === state.transactions.length) return false;
    state = { ...state, transactions };
    publish();
    return true;
  }

  // This stores only a display name. It does not verify identity or protect data.
  function setProfileName(name) {
    const trimmedName = String(name || '').trim().slice(0, 80);
    state = { ...state, profile: trimmedName ? { name: trimmedName } : null };
    publish();
  }

  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    try {
      state = event.newValue ? normalizeState(JSON.parse(event.newValue)) : { ...initialState };
      const snapshot = getState();
      listeners.forEach((listener) => listener(snapshot));
    } catch (error) {
      console.warn('ExI could not sync changed browser storage.', error);
    }
  });

  window.ExIState = Object.freeze({
    getState,
    subscribe,
    getTransactions,
    getSummary,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    setProfileName,
    isValidDate
  });
})();
