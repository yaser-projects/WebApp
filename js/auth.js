// ============================================
// Metal Brain - Authentication Module
// ============================================

import { connectWebSocket } from './ws.js';

// DOM Elements
const loginForm = document.getElementById('loginForm');
const usernameInp = document.getElementById('username');
const passwordInp = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const togglePwd = document.getElementById('togglePwd');
const errorBox = document.getElementById('loginError');
const usernameError = document.getElementById('usernameError');
const passwordError = document.getElementById('passwordError');
const centerSpinner = document.getElementById('centerSpinner');

// Device credentials (loaded from device)
let deviceUsername = null;
let devicePassword = null;

// WebSocket connection
let ws = null;

/**
 * Show/hide spinner
 */
function showSpinner() {
  centerSpinner.classList.remove('hidden');
}

function hideSpinner() {
  centerSpinner.classList.add('hidden');
}

/**
 * Validate form fields
 */
function validateForm() {
  const u = usernameInp.value.trim();
  const p = passwordInp.value.trim();

  let isValid = true;

  // Clear previous errors
  usernameError.textContent = '';
  passwordError.textContent = '';
  errorBox.textContent = '';
  usernameInp.classList.remove('error');
  passwordInp.classList.remove('error');

  // Validate username
  if (u.length === 0) {
    usernameError.textContent = 'Username is required';
    usernameInp.classList.add('error');
    isValid = false;
  } else if (u.length > 16) {
    usernameError.textContent = 'Username must be 1-16 characters';
    usernameInp.classList.add('error');
    isValid = false;
  }

  // Validate password
  if (p.length === 0) {
    passwordError.textContent = 'Password is required';
    passwordInp.classList.add('error');
    isValid = false;
  } else if (p.length > 16) {
    passwordError.textContent = 'Password must be 1-16 characters';
    passwordInp.classList.add('error');
    isValid = false;
  }

  // Enable/disable login button
  loginBtn.disabled = !isValid;

  return isValid;
}

/**
 * Toggle password visibility
 */
togglePwd.addEventListener('click', () => {
  const isPassword = passwordInp.type === 'password';
  passwordInp.type = isPassword ? 'text' : 'password';
  togglePwd.setAttribute('aria-pressed', isPassword ? 'true' : 'false');
  togglePwd.textContent = isPassword ? '🙈' : '👁';
});

// Real-time validation
usernameInp.addEventListener('input', validateForm);
passwordInp.addEventListener('blur', validateForm);
passwordInp.addEventListener('input', validateForm);

/**
 * Connect WebSocket and load device credentials
 */
function initConnection() {
  showSpinner();

  ws = connectWebSocket({
    onOpen: () => {
      console.log('[Auth] WebSocket connected');
      // Request device credentials
      ws.sendJSON({
        setting: "device",
        action: "read",
        fields: ["username", "password"]
      });
    },

    onJSON: (data) => {
      // Receive device credentials
      if (data.username !== undefined && data.password !== undefined) {
        deviceUsername = data.username;
        devicePassword = data.password;
        console.log('[Auth] Credentials loaded from device');
        hideSpinner();
      }

      // Receive AP SSID for redirect decision
      if (data['AP SSID'] !== undefined) {
        const apSsid = data['AP SSID'];
        hideSpinner();
        
        if (apSsid === 'Metal Brain') {
          window.location.href = 'quickstart.html';
        } else {
          window.location.href = 'dashboard.html';
        }
      }
    },

    onError: () => {
      console.error('[Auth] WebSocket error');
      hideSpinner();
      errorBox.textContent = 'Connection error. Please check your device connection.';
    },

    onClose: () => {
      console.log('[Auth] WebSocket closed');
    }
  });
}

/**
 * Handle form submission
 */
loginForm.addEventListener('submit', (e) => {
  e.preventDefault();

  if (!validateForm()) {
    return;
  }

  const u = usernameInp.value.trim();
  const p = passwordInp.value.trim();

  // Check if credentials match device
  if (deviceUsername === null || devicePassword === null) {
    errorBox.textContent = 'Device credentials not loaded. Please wait...';
    return;
  }

  if (u !== deviceUsername || p !== devicePassword) {
    errorBox.textContent = 'Username or password is incorrect.';
    usernameInp.classList.add('error');
    passwordInp.classList.add('error');
    return;
  }

  // Clear errors
  errorBox.textContent = '';
  usernameInp.classList.remove('error');
  passwordInp.classList.remove('error');

  // Show spinner
  showSpinner();

  // Request AP SSID to determine redirect
  ws.sendJSON({
    setting: "device",
    action: "read",
    fields: ["AP SSID"]
  });
});

/**
 * Check authentication status
 */
export function requireAuth() {
  if (sessionStorage.getItem('metalbrain-auth') !== 'ok') {
    window.location.href = 'index.html';
  }
}

/**
 * Initialize on page load
 */
initConnection();

