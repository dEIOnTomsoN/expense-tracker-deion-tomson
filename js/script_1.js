//script_1.js - Handles user authentication (login and registration) for the Expense Tracker web app.

(function () {
  'use strict';

  const USERS_KEY = 'app_users';
  const CURRENT_USER_KEY = 'currentUser';
  const wrapper = document.querySelector('.wrapper');
  const registerLink = document.querySelector('.register-link');
  const loginLink = document.querySelector('.login-link');
  const loginForm = document.querySelector('#login-form');
  const registerForm = document.querySelector('#register-form');

  function showMessage(id, text) {
    const target = document.getElementById(id);
    if (target) target.textContent = text;
  }

  function normalizeUsername(username) {
    return String(username || '').trim().toLocaleLowerCase();
  }

  function readUsers() {
    const raw = window.localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const users = JSON.parse(raw);
    return Array.isArray(users) ? users.filter((user) => user && typeof user === 'object') : [];
  }

  function toHex(buffer) {
    return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  // Hash locally for this demo; this is not a substitute for server-side auth.
  async function hashPassword(password) {
    if (!window.crypto?.subtle || typeof TextEncoder !== 'function') {
      throw new Error('Password hashing requires a secure browser context. Open this app on localhost or HTTPS.');
    }
    const bytes = new TextEncoder().encode(password);
    return toHex(await window.crypto.subtle.digest('SHA-256', bytes));
  }

  function saveCurrentUser(user) {
    const currentUser = { id: user.id, username: user.username };
    window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
    window.location.assign('./index.html');
  }

  function createUserId() {
    if (typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return toHex(bytes);
  }

  function validateAuthForm(form, mode) {
    const data = new FormData(form);
    const username = String(data.get('username') || '').trim();
    const password = String(data.get('password') || '');
    if (!username) return 'Enter your username.';
    if (mode === 'register' && username.length < 2) return 'Username must be at least 2 characters.';
    if (mode === 'register') {
      const email = form.querySelector('[type="email"]');
      if (!email.value.trim()) return 'Enter your email address.';
      if (!email.validity.valid) return 'Enter a valid email address.';
    }
    if (!password) return 'Enter your password.';
    if (mode === 'register' && password.length < 6) return 'Password must be at least 6 characters.';
    if (mode === 'register' && password !== String(data.get('confirmPassword') || '')) {
      return 'Passwords do not match.';
    }
    return '';
  }

  if (registerLink) {
    registerLink.addEventListener('click', (event) => {
      event.preventDefault();
      wrapper.classList.add('active');
      showMessage('login-message', '');
    });
  }

  if (loginLink) {
    loginLink.addEventListener('click', (event) => {
      event.preventDefault();
      wrapper.classList.remove('active');
      showMessage('register-message', '');
    });
  }

  document.querySelectorAll('.password-toggle').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const input = document.getElementById(toggle.dataset.passwordTarget);
      const icon = toggle.querySelector('i');
      if (!input || !icon) return;

      const isVisible = input.type === 'text';
      input.type = isVisible ? 'password' : 'text';
      icon.className = isVisible ? 'bx bx-show' : 'bx bx-hide';
      toggle.setAttribute('aria-label', isVisible ? 'Show password' : 'Hide password');
      toggle.setAttribute('title', isVisible ? 'Show password' : 'Hide password');
    });
  });

  // Verify a stored account before creating the dashboard session.
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    showMessage('login-message', '');
    const error = validateAuthForm(loginForm, 'login');
    if (error) {
      showMessage('login-message', error);
      return;
    }
    const data = new FormData(loginForm);
    const username = String(data.get('username') || '').trim();
    try {
      const user = readUsers().find((record) => normalizeUsername(record.username) === normalizeUsername(username));
      if (!user) {
        showMessage('login-message', 'No account was found for that username.');
        return;
      }
      const passwordHash = await hashPassword(String(data.get('password') || ''));
      if (passwordHash !== user.passwordHash) {
        showMessage('login-message', 'Incorrect username or password.');
        return;
      }
      saveCurrentUser(user);
    } catch (error) {
      showMessage('login-message', error.message || 'Could not sign in. Check browser storage and try again.');
    }
  });

  // Create a local account, save it, then start its dashboard session.
  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    showMessage('register-message', '');
    const error = validateAuthForm(registerForm, 'register');
    if (error) {
      showMessage('register-message', error);
      return;
    }
    const data = new FormData(registerForm);
    const username = String(data.get('username') || '').trim();
    try {
      const users = readUsers();
      if (users.some((user) => normalizeUsername(user.username) === normalizeUsername(username))) {
        showMessage('register-message', 'That username is already taken. Choose another.');
        return;
      }
      const passwordHash = await hashPassword(String(data.get('password') || ''));
      const user = {
        id: createUserId(),
        username,
        email: String(data.get('email') || '').trim(),
        passwordHash,
        createdAt: new Date().toISOString()
      };
      users.push(user);
      window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
      saveCurrentUser(user);
    } catch (error) {
      showMessage('register-message', error.message || 'Could not create the account. Check browser storage and try again.');
    }
  });

  [loginForm, registerForm].forEach((form) => {
    form.querySelectorAll('input').forEach((input) => {
      const updateFloatingLabel = () => {
        input.closest('.input-box')?.classList.toggle('has-value', input.value.length > 0);
      };

      updateFloatingLabel();
      input.addEventListener('input', () => {
        updateFloatingLabel();
        const messageId = form === loginForm ? 'login-message' : 'register-message';
        showMessage(messageId, '');
      });
    });
  });

  // Return valid existing sessions to the dashboard and clear stale ones.
  try {
    const currentUser = JSON.parse(window.localStorage.getItem(CURRENT_USER_KEY) || 'null');
    const userExists = currentUser && typeof currentUser.id === 'string'
      && typeof currentUser.username === 'string'
      && readUsers().some((user) => user.id === currentUser.id && user.username === currentUser.username);
    if (userExists) {
      window.location.replace('./index.html');
    } else if (currentUser) {
      window.localStorage.removeItem(CURRENT_USER_KEY);
    }
  } catch (error) {
    window.localStorage.removeItem(CURRENT_USER_KEY);
  }
})();
