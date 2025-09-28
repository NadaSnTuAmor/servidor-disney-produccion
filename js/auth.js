// Configuration - BACKEND REAL CONECTADO
const API_BASE_URL = 'https://nadasntuamor.com'; // ✅ TU URL REAL

// DOM Elements
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginButton = document.querySelector('.login-button');
const buttonText = document.querySelector('.button-text');
const buttonLoader = document.querySelector('.button-loader');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');
const errorText = document.getElementById('errorText');

// User types
const USER_TYPES = {
    ADMIN: 'admin',
    CLIENT: 'client'
};

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    // Check if already logged in
    checkExistingAuth();
    // Add form event listeners
    loginForm.addEventListener('submit', handleLogin);
    // Add input animations
    addInputAnimations();
});

// Check for existing authentication
function checkExistingAuth() {
    const token = localStorage.getItem('authToken');
    const tokenExpiry = localStorage.getItem('tokenExpiry');
    const userType = localStorage.getItem('userType');
    if (token && tokenExpiry && userType) {
        if (new Date().getTime() < parseInt(tokenExpiry)) {
            // Token is still valid, redirect based on user type
            showSuccessMessage('Sesión activa detectada, redirigiendo...');
            setTimeout(() => {
                redirectUser(userType);
            }, 1000);
        } else {
            // Token expired, clear storage
            clearAuthData();
        }
    }
}

// Redirect user based on type
function redirectUser(userType) {
    if (userType === USER_TYPES.ADMIN) {
        window.location.href = 'admin-dashboard.html';
    } else {
        window.location.href = 'search.html';
    }
}

// 🚀 HANDLE LOGIN - CONECTADO CON BACKEND REAL
async function handleLogin(e) {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    // Validate inputs
    if (!validateInputs(username, password)) {
        return;
    }
    // Show loading state
    setLoadingState(true);
    hideMessages();
    // 🚀 CONECTAR CON TU BACKEND REAL
    try {
        await handleRealLogin(username, password);
    } catch (error) {
        console.error('Error en login:', error);
        handleLoginError('Error de conexión. Intenta nuevamente.');
    } finally {
        setLoadingState(false);
    }
}

// 🌐 CONEXIÓN REAL CON TU BACKEND
async function handleRealLogin(username, password) {
    try {
        console.log('🌐 Conectando con backend real para usuario:', username);
        // 🚀 HACER REQUEST AL BACKEND REAL
        const response = await fetch(`${API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                password: password
            })
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const result = await response.json();
        console.log('📡 Respuesta del backend:', result);

        // ✅ CAMBIO: Checar campo rol del backend y preparar loginData
        if (result.success && result.rol) {
            const rol = result.rol.trim().toUpperCase(); // ADMIN o CLIENTE desde backend
            const loginData = {
                token: result.token || '', // si tu backend retorna el token aquí
                user: {
                    id: result.user?.id || 1,
                    username: result.username || username,
                    name: result.username || username,
                    type: rol === "ADMIN" ? USER_TYPES.ADMIN : USER_TYPES.CLIENT, // usa el rol
                    email: result.user?.email || `${result.username || username}@sistema.com`,
                    emails: result.user?.emails || [],
                    seguridad: rol === "ADMIN" ? 'ADMIN' : 'NORMAL',
                    isActive: true,
                    createdDate: new Date().toISOString(),
                    source: 'backend_real',
                    database: 'Google Sheets + Supabase'
                }
            };
            handleLoginSuccess(loginData);
        } else if (result.success && result.user) {
            // Fallback por si backend sólo retorna normal
            const loginData = {
                token: result.token,
                user: {
                    id: result.user.id,
                    username: result.user.username,
                    name: result.user.username, // Usar username como nombre
                    type: result.user.seguridad === 'NORMAL' ? USER_TYPES.CLIENT : USER_TYPES.ADMIN,
                    email: result.user.emails?.[0] || `${result.user.username}@sistema.com`,
                    emails: result.user.emails || [],
                    seguridad: result.user.seguridad,
                    isActive: result.user.seguridad === 'NORMAL',
                    createdDate: new Date().toISOString(),
                    source: 'backend_real',
                    database: 'Google Sheets + Supabase'
                }
            };
            handleLoginSuccess(loginData);
        } else {
            // ❌ LOGIN FALLIDO
            const errorMsg = result.message || 'Credenciales incorrectas';
            console.log('❌ Login fallido:', errorMsg);
            handleLoginError(errorMsg);
        }
    } catch (error) {
        console.error('❌ Error conectando con backend:', error);
        // Si falla la conexión, intentar con usuario demo como fallback
        if (username.toLowerCase() === 'demo' && password === 'demo123') {
            console.log('🎭 Fallback a usuario demo local');
            handleDemoLoginFallback(username, password);
        } else {
            handleLoginError('Error de conexión con el servidor. Verifica tu conexión a internet.');
        }
    }
}

// 🎭 DEMO FALLBACK (Solo si falla la conexión)
function handleDemoLoginFallback(username, password) {
    if (username.toLowerCase() === 'demo' && password === 'demo123') {
        const demoData = {
            token: 'demo-token-' + Date.now(),
            user: {
                id: 999,
                username: 'demo',
                name: 'Demo User',
                type: USER_TYPES.CLIENT,
                email: 'demo@sistema.com',
                emails: ['demo@sistema.com'],
                seguridad: 'NORMAL',
                isActive: true,
                createdDate: new Date().toISOString(),
                source: 'demo_fallback',
                database: 'Local Demo'
            }
        };
        console.log('🎭 Login demo fallback exitoso');
        handleLoginSuccess(demoData);
    } else {
        handleLoginError('Credenciales incorrectas');
    }
}

// Validate form inputs
function validateInputs(username, password) {
    if (!username) {
        showErrorMessage('Por favor ingresa tu nombre de usuario');
        usernameInput.focus();
        return false;
    }
    if (!password) {
        showErrorMessage('Por favor ingresa tu contraseña');
        passwordInput.focus();
        return false;
    }
    if (username.length < 3) {
        showErrorMessage('El usuario debe tener al menos 3 caracteres');
        usernameInput.focus();
        return false;
    }
    return true;
}

// Handle successful login
function handleLoginSuccess(data) {
    const { token, user } = data;
    // Determine user type
    let userType = user.type || USER_TYPES.CLIENT;
    // Store authentication data con JWT real
    const expiryTime = new Date().getTime() + (20 * 60 * 1000); // 20 minutos (igual que JWT)
    localStorage.setItem('authToken', token);
    localStorage.setItem('tokenExpiry', expiryTime.toString());
    localStorage.setItem('userData', JSON.stringify(user));
    localStorage.setItem('userType', userType);
    localStorage.setItem('username', user.username);
    localStorage.setItem('userEmail', user.email);
    localStorage.setItem('userName', user.name);
    localStorage.setItem('loginTime', new Date().toISOString());
    // Show success message with user info
    const userTypeText = userType === USER_TYPES.ADMIN ? 'panel de administración' : 'buscador de códigos';
    const sourceText = user.source === 'backend_real' ? '(Google Sheets)' : '(Demo)';
    showSuccessMessage(`¡Bienvenido ${user.name}! ${sourceText} Redirigiendo al ${userTypeText}...`);
    // Add success animation
    loginButton.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    // Log successful login
    console.log(`✅ Login completo:`, {
        usuario: user.username,
        tipo: userType,
        source: user.source,
        database: user.database,
        emails: user.emails?.length || 0
    });
    // Redirect after animation based on user type
    setTimeout(() => {
        redirectUser(userType);
    }, 1500);
}

// Resto de funciones de UI y helpers
function handleLoginError(message) {
    showErrorMessage(message);
    loginForm.style.animation = 'shake 0.5s ease-in-out';
    setTimeout(() => {
        loginForm.style.animation = '';
    }, 500);
    if (message.toLowerCase().includes('usuario')) {
        usernameInput.focus();
    } else {
        passwordInput.focus();
    }
}
function setLoadingState(isLoading) {
    if (isLoading) {
        loginButton.disabled = true;
        buttonText.style.opacity = '0';
        buttonLoader.classList.remove('hidden');
        loginButton.style.cursor = 'not-allowed';
    } else {
        loginButton.disabled = false;
        buttonText.style.opacity = '1';
        buttonLoader.classList.add('hidden');
        loginButton.style.cursor = 'pointer';
    }
}
function showErrorMessage(message) {
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
    successMessage.classList.add('hidden');
    // Auto hide after 8 seconds
    setTimeout(() => {
        errorMessage.classList.add('hidden');
    }, 8000);
}
function showSuccessMessage(message) {
    successMessage.querySelector('span').textContent = message;
    successMessage.classList.remove('hidden');
    errorMessage.classList.add('hidden');
}
function hideMessages() {
    errorMessage.classList.add('hidden');
    successMessage.classList.add('hidden');
}
function clearAuthData() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('tokenExpiry');
    localStorage.removeItem('userData');
    localStorage.removeItem('userType');
    localStorage.removeItem('username');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    localStorage.removeItem('loginTime');
}
function togglePassword() {
    const passwordField = document.getElementById('password');
    const toggleIcon = document.getElementById('toggleIcon');
    if (passwordField.type === 'password') {
        passwordField.type = 'text';
        toggleIcon.classList.remove('fa-eye');
        toggleIcon.classList.add('fa-eye-slash');
    } else {
        passwordField.type = 'password';
        toggleIcon.classList.remove('fa-eye-slash');
        toggleIcon.classList.add('fa-eye');
    }
}
function addInputAnimations() {
    const inputs = document.querySelectorAll('.input-container input');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.classList.add('focused');
        });
        input.addEventListener('blur', function() {
            this.parentElement.classList.remove('focused');
        });
        input.addEventListener('input', function() {
            validateInputField(this);
        });
    });
}
function validateInputField(input) {
    const value = input.value.trim();
    const inputContainer = input.parentElement;
    inputContainer.classList.remove('valid', 'invalid');
    if (input.name === 'username') {
        if (value.length >= 3) {
            inputContainer.classList.add('valid');
        } else if (value.length > 0) {
            inputContainer.classList.add('invalid');
        }
    }
    if (input.name === 'password') {
        if (value.length >= 1) {
            inputContainer.classList.add('valid');
        } else if (value.length > 0) {
            inputContainer.classList.add('invalid');
        }
    }
}

// Add CSS for validation states
const style = document.createElement('style');
style.textContent = `
    .input-container.valid input {
        border-color: var(--success-color);
        box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
    }
    .input-container.invalid input {
        border-color: var(--error-color);
        box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
    }
    .input-container.valid .input-icon {
        color: var(--success-color);
    }
    .input-container.invalid .input-icon {
        color: var(--error-color);
    }
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
`;
document.head.appendChild(style);

// Global functions
window.logout = function() {
    clearAuthData();
    window.location.href = 'index.html';
};
window.checkAuth = function() {
    const token = localStorage.getItem('authToken');
    const tokenExpiry = localStorage.getItem('tokenExpiry');
    if (!token || !tokenExpiry || new Date().getTime() >= parseInt(tokenExpiry)) {
        clearAuthData();
        window.location.href = 'index.html';
        return false;
    }
    return true;
};
window.getCurrentUser = function() {
    const userData = localStorage.getItem('userData');
    if (userData) {
        return JSON.parse(userData);
    }
    return null;
};
window.getAuthToken = function() {
    return localStorage.getItem('authToken');
};
// 🛡️ FUNCIÓN PARA HACER REQUESTS AUTENTICADOS
window.authenticatedFetch = async function(url, options = {}) {
    const token = getAuthToken();
    if (!token) {
        throw new Error('No authentication token found');
    }
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
        }
    };
    return fetch(url, { ...defaultOptions, ...options });
};
