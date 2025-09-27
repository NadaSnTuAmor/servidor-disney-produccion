// Configuration - CAMBIA ESTA URL POR TU URL DE RENDER
const API_BASE_URL = 'https://nadasntuamor.com'; // ⚠️ CAMBIAR POR TU URL

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

// ⚡ HANDLE LOGIN - MODO DEMO FORZADO
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
    
    // ⚡ USAR SOLO MODO DEMO HASTA TENER BACKEND
    setTimeout(() => {
        handleDemoLogin(username, password);
        setLoadingState(false);
    }, 1000); // Simular delay de red
}

// ⭐ DEMO LOGIN - SIMULANDO TU GOOGLE SHEETS EXACTO
function handleDemoLogin(username, password) {
    // ⭐ USUARIOS BASADOS EN TU GOOGLE SHEETS
    const demoUsers = {
        // ⭐ ADMIN
        'demo': { 
            password: 'demo123', 
            type: USER_TYPES.CLIENT, 
            name: 'demo',
            email: 'demo@demo.com'
        },
    };
    
    const user = demoUsers[username.toLowerCase()];
    
    if (user && user.password === password) {
        // ⭐ LOGIN EXITOSO
        const demoData = {
            token: 'demo-token-' + Date.now(),
            user: {
                id: Math.floor(Math.random() * 1000),
                username: username,
                name: user.name, // ⭐ NOMBRE LIMPIO (Mario, Elena, Carlos, etc.)
                type: user.type,
                email: user.email,
                whatsapp: user.whatsapp || null,
                isActive: true,
                createdDate: new Date().toISOString()
            }
        };
        
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
    
    // Store authentication data
    const expiryTime = new Date().getTime() + (24 * 60 * 60 * 1000); // 24 hours
    localStorage.setItem('authToken', token);
    localStorage.setItem('tokenExpiry', expiryTime.toString());
    localStorage.setItem('userData', JSON.stringify(user));
    localStorage.setItem('userType', userType);
    localStorage.setItem('loginTime', new Date().toISOString());
    
    // Show success message with user type
    const userTypeText = userType === USER_TYPES.ADMIN ? 'panel de administración' : 'buscador de códigos';
    showSuccessMessage(`¡Bienvenido ${user.name}! Redirigiendo al ${userTypeText}...`);
    
    // Add success animation
    loginButton.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    
    // Redirect after animation based on user type
    setTimeout(() => {
        redirectUser(userType);
    }, 1500);
}

// Handle login error
function handleLoginError(message) {
    showErrorMessage(message);
    
    // Add shake animation to form
    loginForm.style.animation = 'shake 0.5s ease-in-out';
    setTimeout(() => {
        loginForm.style.animation = '';
    }, 500);
    
    // Focus on first input with error
    if (message.toLowerCase().includes('usuario')) {
        usernameInput.focus();
    } else {
        passwordInput.focus();
    }
}

// Set loading state
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

// Show error message
function showErrorMessage(message) {
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
    successMessage.classList.add('hidden');
    
    // Auto hide after 8 seconds
    setTimeout(() => {
        errorMessage.classList.add('hidden');
    }, 8000);
}

// Show success message
function showSuccessMessage(message) {
    successMessage.querySelector('span').textContent = message;
    successMessage.classList.remove('hidden');
    errorMessage.classList.add('hidden');
}

// Hide all messages
function hideMessages() {
    errorMessage.classList.add('hidden');
    successMessage.classList.add('hidden');
}

// Clear authentication data
function clearAuthData() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('tokenExpiry');
    localStorage.removeItem('userData');
    localStorage.removeItem('userType');
    localStorage.removeItem('loginTime');
}

// Toggle password visibility
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

// Add input animations and effects
function addInputAnimations() {
    const inputs = document.querySelectorAll('.input-container input');
    
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.classList.add('focused');
        });
        
        input.addEventListener('blur', function() {
            this.parentElement.classList.remove('focused');
        });
        
        // Add real-time validation
        input.addEventListener('input', function() {
            validateInputField(this);
        });
    });
}

// Validate individual input field
function validateInputField(input) {
    const value = input.value.trim();
    const inputContainer = input.parentElement;
    
    // Remove existing validation classes
    inputContainer.classList.remove('valid', 'invalid');
    
    if (input.name === 'username') {
        if (value.length >= 3) {
            inputContainer.classList.add('valid');
        } else if (value.length > 0) {
            inputContainer.classList.add('invalid');
        }
    }
    
    if (input.name === 'password') {
        if (value.length >= 6) {
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
