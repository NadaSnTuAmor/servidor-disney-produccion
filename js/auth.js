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
    ADMIN: 'ADMIN',
    CLIENT: 'CLIENTE'
};

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
    // Redirige correctamente
    if (userType === USER_TYPES.ADMIN) {
        window.location.href = 'admin-dashboard.html'; // PANEL ADMIN
    } else {
        window.location.href = 'search.html'; // PANEL CLIENTE
    }
}

// HANDLE LOGIN - CONECTADO CON BACKEND REAL
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

// CONEXIÓN REAL CON TU BACKEND
async function handleRealLogin(username, password) {
    try {
        console.log('🌐 Conectando con backend real para usuario:', username);
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

        // CAMBIO: Toma siempre el rol del result.user.rol
        if (result.success && result.user && result.user.rol) {
            const rol = result.user.rol.trim().toUpperCase(); // 'ADMIN' o 'CLIENTE'
            const loginData = {
                token: result.token || '',
                user: {
                    id: result.user.id,
                    username: result.user.username,
                    name: result.user.username,
                    rol: rol, // GUARDAMOS EL ROL REAL
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
            // ❌ LOGIN FALLIDO
            const errorMsg = result.message || 'Credenciales incorrectas';
            console.log('❌ Login fallido:', errorMsg);
            handleLoginError(errorMsg);
        }
    } catch (error) {
        console.error('❌ Error conectando con backend:', error);
        if (username.toLowerCase() === 'demo' && password === 'demo123') {
            console.log('🎭 Fallback a usuario demo local');
            handleDemoLoginFallback(username, password);
        } else {
            handleLoginError('Error de conexión con el servidor. Verifica tu conexión a internet.');
        }
    }
}

// DEMO FALLBACK (Solo si falla la conexión)
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
    // Determinar tipo de usuario usando SOLO user.rol
    let userType = (user.rol === 'ADMIN') ? USER_TYPES.ADMIN : USER_TYPES.CLIENT;
    const expiryTime = new Date().getTime() + (20 * 60 * 1000); // 20 minutos
    localStorage.setItem('authToken', token);
    localStorage.setItem('tokenExpiry', expiryTime.toString());
    localStorage.setItem('userData', JSON.stringify(user));
    localStorage.setItem('userType', userType);
    localStorage.setItem('username', user.username);
    localStorage.setItem('userEmail', user.email);
    localStorage.setItem('userName', user.name);
    localStorage.setItem('loginTime', new Date().toISOString());
    showSuccessMessage(`¡Bienvenido ${user.name}! Redirigiendo al ${userType === USER_TYPES.ADMIN ? 'panel de administración' : 'buscador de códigos'}...`);
    loginButton.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    console.log(`✅ Login completo:`, { usuario: user.username, tipo: userType, source: user.source, database: user.database, emails: user.emails?.length || 0 });
    // Redirecciona al panel correcto según rol
    setTimeout(() => {
        redirectUser(userType);
    }, 1500);
}

// El resto de funciones y helpers quedan IGUAL...

// ... (no repito las funciones UI, solo corregí lo importante)

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
