// Configuration - BACKEND REAL CONECTADO
const API_BASE_URL = 'https://servidor-disney-produccion.onrender.com'; // ✅ TU URL REAL

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

// User types (debe ser en mayúsculas para comparar el backend)
const USER_TYPES = {
    ADMIN: 'ADMIN',
    CLIENT: 'CLIENTE'
};

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    checkExistingAuth();
    loginForm.addEventListener('submit', handleLogin);
    addInputAnimations();
});

// Check for existing authentication
function checkExistingAuth() {
    const token = localStorage.getItem('authToken');
    const tokenExpiry = localStorage.getItem('tokenExpiry');
    const userType = localStorage.getItem('userType');
    if (token && tokenExpiry && userType) {
        if (new Date().getTime() < parseInt(tokenExpiry)) {
            showSuccessMessage('Sesión activa detectada, redirigiendo...');
            setTimeout(() => {
                redirectUser(userType);
            }, 1000);
        } else {
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
    if (!validateInputs(username, password)) {
        return;
    }
    setLoadingState(true);
    hideMessages();
    try {
        await handleRealLogin(username, password);
    } catch (error) {
        console.error('Error en login:', error);
        handleLoginError('Error de conexión. Intenta nuevamente.');
    } finally {
        setLoadingState(false);
    }
}

// 🌐 CONEXIÓN REAL CON TU BACKEND (CORREGIDO EL BLOQUE!)
async function handleRealLogin(username, password) {
    try {
        console.log("VOY A ENVIAR FETCH");
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        const result = await response.json();
        console.log('📡 Respuesta del backend:', result);

        // SOLO USA EL CAMPO user.rol PARA DEFINIR EL TIPO DE USUARIO -- este es el ÚNICO cambio real!
        if (result.success && result.user && result.user.rol) {
            const userType = result.user.rol.trim().toUpperCase(); // 'ADMIN' o 'CLIENTE'
            const loginData = {
                token: result.token || '',
                user: {
                    id: result.user.id,
                    username: result.user.username,
                    name: result.user.username,
                    rol: userType,
                    email: result.user.emails?.[0] || `${result.user.username}@sistema.com`,
                    emails: result.user.emails || [],
                    seguridad: result.user.seguridad,
                    isActive: true,
                    createdDate: new Date().toISOString(),
                    source: 'backend_real',
                    database: 'Google Sheets + Supabase'
                }
            };
            handleLoginSuccess(loginData);
        } else if (result.success && result.user) {
            // fallback (cliente sin rol definido, pero deberías tenerlo siempre ahora)
            const loginData = {
                token: result.token,
                user: {
                    id: result.user.id,
                    username: result.user.username,
                    name: result.user.username,
                    rol: 'CLIENTE',
                    email: result.user.emails?.[0] || `${result.user.username}@sistema.com`,
                    emails: result.user.emails || [],
                    seguridad: result.user.seguridad,
                    isActive: true,
                    createdDate: new Date().toISOString(),
                    source: 'backend_real',
                    database: 'Google Sheets + Supabase'
                }
            };
            handleLoginSuccess(loginData);
        } else {
            handleLoginError(result.message || 'Credenciales incorrectas');
        }
    } catch (error) {
        console.error('❌ Error conectando con backend:', error);
        if (username.toLowerCase() === 'demo' && password === 'demo123') {
            handleDemoLoginFallback(username, password);
        } else {
            handleLoginError('Error de conexión con el servidor. Verifica tu conexión a internet.');
        }
    }
}

// DEMO FALLBACK (SIN MODIFICAR)
function handleDemoLoginFallback(username, password) {
    if (username.toLowerCase() === 'demo' && password === 'demo123') {
        const demoData = {
            token: 'demo-token-' + Date.now(),
            user: {
                id: 999,
                username: 'demo',
                name: 'Demo User',
                rol: USER_TYPES.CLIENT,
                email: 'demo@sistema.com',
                emails: ['demo@sistema.com'],
                seguridad: 'NORMAL',
                isActive: true,
                createdDate: new Date().toISOString(),
                source: 'demo_fallback',
                database: 'Local Demo'
            }
        };
        handleLoginSuccess(demoData);
    } else {
        handleLoginError('Credenciales incorrectas');
    }
}

// Validate form inputs (SIN MODIFICAR)
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

// Handle successful login (SOLO LEE EL CAMPO .rol Y LO USA COMO userType)
function handleLoginSuccess(data) {
    console.log('DEBUG login data:', data);
    const { token, user } = data;
    let userType = user.rol === USER_TYPES.ADMIN ? USER_TYPES.ADMIN : USER_TYPES.CLIENT;
    localStorage.setItem('authToken', token);
    localStorage.setItem('tokenExpiry', String(Date.now() + 86400000));
    localStorage.setItem('userData', JSON.stringify(user));
    localStorage.setItem('userType', userType);
    localStorage.setItem('username', user.username);
    localStorage.setItem('userEmail', user.email);
    localStorage.setItem('userName', user.name);
    localStorage.setItem('loginTime', new Date().toISOString());
    showSuccessMessage(`¡Bienvenido ${user.name}! Redirigiendo al ${userType === USER_TYPES.ADMIN ? 'panel de administración' : 'buscador de códigos'}...`);
    loginButton.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    setTimeout(() => {
        redirectUser(userType);
    }, 1500);
}

// El RESTO de funciones UI y helpers (NADA MODIFICADO)
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

// Global functions (SIN CAMBIOS)
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
