function autoLogoutWhenExpired() {
    const expiresAt = parseInt(localStorage.getItem('tokenExpiry') || '0');
    const token = localStorage.getItem('authToken');
    if (!token || Date.now() > expiresAt) {
        localStorage.clear();  // Borra TODO, para forzar login limpio
        window.location.href = 'index.html'; // O la ruta de tu login
    }
}
autoLogoutWhenExpired();
setInterval(autoLogoutWhenExpired, 60 * 1000); // Cada minuto

// Configuration - BACKEND CONECTADO
const API_BASE_URL = 'https://nadasntuamor.com'; // ✅ TU URL

// DOM Elements
const searchForm = document.getElementById('searchForm');
const emailInput = document.getElementById('emailInput');
const searchButton = document.getElementById('searchButton');
const buttonText = searchButton.querySelector('.button-text');
const buttonLoader = searchButton.querySelector('.button-loader');

// Message elements
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');
const infoMessage = document.getElementById('infoMessage');
const errorText = document.getElementById('errorText');
const successText = document.getElementById('successText');
const infoText = document.getElementById('infoText');

// Results elements
const resultsSection = document.getElementById('resultsSection');
const resultsContent = document.getElementById('resultsContent');
const resultsCount = document.getElementById('resultsCount');
const paginationContainer = document.getElementById('paginationContainer');
const pagination = document.getElementById('pagination');

// User elements
const userNameDisplay = document.getElementById('userNameDisplay');

// Help modal
const helpModal = document.getElementById('helpModal');

// Search state
let currentSearch = {
    email: '',
    results: [],
    currentPage: 1,
    totalPages: 1,
    totalResults: 0
};

// Results per page
const RESULTS_PER_PAGE = 10;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    if (!checkAuth()) {
        return;
    }
    
    // ⭐ FORCE LABEL ALWAYS TOP ON LOAD
    const emailLabel = document.querySelector('label[for="emailInput"]');
    if (emailLabel) {
        emailLabel.style.top = '-12px';
        emailLabel.style.left = '16px';
        emailLabel.style.fontSize = '12px';
        emailLabel.style.color = 'var(--disney-teal)';
        emailLabel.style.background = 'var(--disney-dark-blue)';
        emailLabel.style.padding = '0 8px';
        emailLabel.style.zIndex = '2';
    }
    
    // Hide any demo info boxes
    const demoBoxes = document.querySelectorAll('.demo-info, [class*="demo"]');
    demoBoxes.forEach(box => box.style.display = 'none');
    
    // Load user info
    loadUserInfo();
    
    // Add event listeners
    addEventListeners();
    
    // Add input animations
    addInputAnimations();
    
    // Focus email input
    emailInput.focus();
});

// Load user information - SIN TRUNCAR
function loadUserInfo() {
    const user = getCurrentUser();
    if (user && user.name) {
        userNameDisplay.textContent = user.name; // NOMBRE COMPLETO
        userNameDisplay.title = user.name; // Tooltip
    } else if (user && user.username) {
        userNameDisplay.textContent = user.username; // USERNAME COMPLETO
        userNameDisplay.title = user.username; // Tooltip
    }
}

// Add all event listeners
function addEventListeners() {
    // Search form
    searchForm.addEventListener('submit', handleSearch);
    
    // Email input - search on Enter
    emailInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSearch(e);
        }
    });
    
    // Real-time email validation
    emailInput.addEventListener('input', validateEmail);
    
    // Click outside to close modals
    document.addEventListener('click', function(e) {
        if (e.target === helpModal) {
            closeHelp();
        }
    });
}

// 🚀 HANDLE SEARCH - CONECTADO CON BACKEND REAL
async function handleSearch(e) {
    e.preventDefault();
    
    const email = emailInput.value.trim();
    
    // Validate email
    if (!validateSearchInput(email)) {
        return;
    }
    
    // Show loading state
    setSearchLoading(true);
    hideMessages();
    
    try {
        console.log('🔍 Buscando códigos para:', email);
        
        // 🌉 USAR EL NUEVO ENDPOINT WEB BRIDGE
        const response = await fetch(`${API_BASE_URL}/api/buscar-correos-web`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({
                email_busqueda: email // ← NOMBRE CORRECTO DEL CAMPO
            })
        });
        
        const data = await response.json();
        console.log('📡 Respuesta del servidor:', data);
        
        if (response.ok && data.success) {
            // Search successful
            console.log(`✅ Búsqueda exitosa: ${data.total} emails encontrados`);
            console.log(`🎯 Vigilancia Disney+ iniciada: ${data.vigilancia_iniciada ? 'SÍ' : 'NO'}`);
            handleSearchSuccess(email, data);
        } else {
            // Search failed
            console.log('❌ Búsqueda fallida:', data.error);
            handleSearchError(data.error || data.message || 'Error en la búsqueda');
        }
        
    } catch (error) {
        console.error('❌ Error de conexión:', error);
        
        // Fallback a demo solo si hay error de red
        if (error.message.includes('fetch') || error.message.includes('network')) {
            console.log('🎭 Usando fallback demo por error de conexión');
            handleDemoSearch(email);
        } else {
            handleSearchError('Error de conexión. Verifica tu conexión a internet.');
        }
    } finally {
        setSearchLoading(false);
    }
}

// Handle demo search (fallback)
function handleDemoSearch(email) {
    console.log('🎭 Activando modo demo para:', email);
    
    // Generate demo results
    const demoResults = generateDemoResults(email);
    
    showInfoMessage(`⚠️ Conexión con servidor no disponible. Mostrando resultados demo para ${email}`);
    
    setTimeout(() => {
        handleSearchSuccess(email, {
            emails: demoResults, // ← CAMBIAR A 'emails'
            total: demoResults.length,
            success: true
        });
    }, 1500);
}

// Generate demo results
function generateDemoResults(email) {
    const results = [];
    const codes = ['DISNEY123', 'PLUS456', 'MAGIC789', 'STREAM001', 'SECURE999'];
    const subjects = [
        'Código de verificación Disney+',
        'Tu código de acceso Disney+',
        'Verificación de cuenta Disney+',
        'Código de seguridad Disney+',
        'Acceso a tu cuenta Disney+'
    ];
    
    // Generate 3-7 random results
    const numResults = Math.floor(Math.random() * 5) + 3;
    
    for (let i = 0; i < numResults; i++) {
        const daysAgo = Math.floor(Math.random() * 30);
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        
        results.push({
            id: `demo_${i}_${Date.now()}`,
            subject: subjects[i % subjects.length],
            from: 'noreply@disneyplus.com',
            date: date.toISOString(),
            code: codes[i % codes.length],
            snippet: `Tu código de verificación es: ${codes[i % codes.length]}. No lo compartas con nadie.`
        });
    }
    
    // Sort by date (newest first)
    return results.sort((a, b) => new Date(b.date) - new Date(a.date));
}

// Validate search input
function validateSearchInput(email) {
    if (!email) {
        showErrorMessage('Por favor ingresa tu dirección de email');
        emailInput.focus();
        return false;
    }
    
    if (!isValidEmail(email)) {
        showErrorMessage('Por favor ingresa un email válido');
        emailInput.focus();
        return false;
    }
    
    return true;
}

// Validate email format
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Real-time email validation
function validateEmail() {
    const email = emailInput.value.trim();
    const container = emailInput.parentElement;
    
    container.classList.remove('valid', 'invalid');
    
    if (email) {
        if (isValidEmail(email)) {
            container.classList.add('valid');
        } else {
            container.classList.add('invalid');
        }
    }
}

// 🔧 HANDLE SEARCH SUCCESS - ACTUALIZADO PARA BACKEND REAL
function handleSearchSuccess(email, data) {
    currentSearch.email = email;
    currentSearch.results = data.emails || data.correos || [];

    // 🔎 FILTRO por asunto
    currentSearch.results = currentSearch.results.filter(email =>
        email.subject === '¿Vas a actualizar tu Hogar de Disney+?' ||
        email.subject === 'Tu código de acceso único para Disney+'
    );
    
    currentSearch.totalResults = data.total || currentSearch.results.length;
    currentSearch.currentPage = 1;
    currentSearch.totalPages = Math.ceil(currentSearch.totalResults / RESULTS_PER_PAGE);
    
    // Show success message
    const vigilanciaText = data.vigilancia_iniciada ? ' 🛡️ Vigilancia Disney+ activada.' : '';
    showSuccessMessage(`Búsqueda completada. Encontrados ${currentSearch.totalResults} emails con códigos Disney+${vigilanciaText}`);
    
    // Display results
    displayResults();
    
    // Scroll to results
    setTimeout(() => {
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 500);
}

// Handle search error
function handleSearchError(message) {
    showErrorMessage(message);
    
    // Hide results if showing
    resultsSection.classList.add('hidden');
}

// Display search results
function displayResults() {
    if (currentSearch.results.length === 0) {
        displayEmptyResults();
        return;
    }
    
    // Update results count
    const countText = currentSearch.totalResults === 1 ? 
        '1 resultado' : 
        `${currentSearch.totalResults} resultados`;
    resultsCount.textContent = countText;
    
    // Calculate pagination
    const startIndex = (currentSearch.currentPage - 1) * RESULTS_PER_PAGE;
    const endIndex = startIndex + RESULTS_PER_PAGE;
    const pageResults = currentSearch.results.slice(startIndex, endIndex);
    
    // Clear results content
    resultsContent.innerHTML = '';
    
    // Add results
    pageResults.forEach((result, index) => {
        const resultElement = createResultElement(result, startIndex + index);
        resultsContent.appendChild(resultElement);
    });
    
    // Update pagination
    updatePagination();
    
    // Show results section
    resultsSection.classList.remove('hidden');
}

// ✅ FUNCIÓN SIMPLE Y EXACTA - SOLO PARA CÓDIGOS DISNEY+
function createResultElement(result, index) {
    const resultDiv = document.createElement('div');
    resultDiv.className = 'result-item';
    resultDiv.setAttribute('data-index', index);
    
    // ✅ FECHA SIMPLE - COMO EN GMAIL
    let formattedDate = 'Fecha desconocida';
    if (result.date) {
        try {
            const date = new Date(result.date);
            if (!isNaN(date.getTime())) {
                formattedDate = formatDate(date);
            }
        } catch (error) {
            console.log('Error parseando fecha:', result.date);
        }
    }
    
    // ✅ CÓDIGO DISNEY+ - SOLO BUSCAR NÚMEROS DE 6 DÍGITOS
    let displayCode = 'Código no encontrado';
    
    // El código Disney+ son exactamente 6 dígitos
    if (result.snippet || result.body || result.content) {
        const text = result.snippet || result.body || result.content;
        
        // Buscar exactamente 6 dígitos seguidos (como 821894, 952700)
        const codeMatch = text.match(/\b(\d{6})\b/);
        if (codeMatch) {
            displayCode = codeMatch[1];
        }
    }
    
    resultDiv.innerHTML = `
        <div class="result-header">
            <div class="result-info">
                <h3 class="result-subject">${escapeHtml(result.subject || 'Sin asunto')}</h3>
                <p class="result-from">De: ${escapeHtml(result.from || 'Disney+')}</p>
            </div>
            <div class="result-date">${formattedDate}</div>
        </div>
        
        <div class="result-code" onclick="copyCode(this, '${displayCode}')" title="Click para copiar código">
            ${displayCode}
            <div class="copy-notification">¡Copiado!</div>
        </div>
    `;
    
    // Animación simple
    resultDiv.style.opacity = '0';
    resultDiv.style.transform = 'translateY(20px)';
    
    setTimeout(() => {
        resultDiv.style.transition = 'all 0.3s ease';
        resultDiv.style.opacity = '1';
        resultDiv.style.transform = 'translateY(0)';
    }, index * 100);
    
    return resultDiv;
}

// Display empty results
function displayEmptyResults() {
    resultsCount.textContent = '0 resultados';
    
    resultsContent.innerHTML = `
        <div class="empty-results">
            <i class="fas fa-inbox"></i>
            <h3>No se encontraron códigos</h3>
            <p>No hemos encontrado emails con códigos Disney+ para esta dirección.<br>
            Verifica que el email sea correcto o que esté asociado a tu cuenta.</p>
        </div>
    `;
    
    paginationContainer.classList.add('hidden');
    resultsSection.classList.remove('hidden');
}

// Update pagination
function updatePagination() {
    if (currentSearch.totalPages <= 1) {
        paginationContainer.classList.add('hidden');
        return;
    }
    
    pagination.innerHTML = '';
    
    // Previous button
    if (currentSearch.currentPage > 1) {
        const prevBtn = createPaginationButton('←', currentSearch.currentPage - 1);
        prevBtn.className = 'pagination-btn prev-btn';
        pagination.appendChild(prevBtn);
    }
    
    // Page numbers
    const maxPages = 5;
    let startPage = Math.max(1, currentSearch.currentPage - Math.floor(maxPages / 2));
    let endPage = Math.min(currentSearch.totalPages, startPage + maxPages - 1);
    
    if (endPage - startPage + 1 < maxPages) {
        startPage = Math.max(1, endPage - maxPages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = createPaginationButton(i, i);
        if (i === currentSearch.currentPage) {
            pageBtn.className = 'pagination-btn active';
        }
        pagination.appendChild(pageBtn);
    }
    
    // Next button
    if (currentSearch.currentPage < currentSearch.totalPages) {
        const nextBtn = createPaginationButton('→', currentSearch.currentPage + 1);
        nextBtn.className = 'pagination-btn next-btn';
        pagination.appendChild(nextBtn);
    }
    
    paginationContainer.classList.remove('hidden');
}

// Create pagination button
function createPaginationButton(text, page) {
    const button = document.createElement('button');
    button.textContent = text;
    button.className = 'pagination-btn';
    button.onclick = () => goToPage(page);
    return button;
}

// Go to specific page
function goToPage(page) {
    if (page < 1 || page > currentSearch.totalPages || page === currentSearch.currentPage) {
        return;
    }
    
    currentSearch.currentPage = page;
    displayResults();
    
    // Scroll to top of results
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Copy code to clipboard
window.copyCode = async function(element, code) {
    try {
        await navigator.clipboard.writeText(code);
        
        // Show notification
        const notification = element.querySelector('.copy-notification');
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 2000);
        
    } catch (error) {
        console.error('Failed to copy code:', error);
        
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = code;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        showInfoMessage(`Código copiado: ${code}`);
    }
};

// Set search loading state
function setSearchLoading(isLoading) {
    if (isLoading) {
        searchButton.disabled = true;
        buttonText.style.opacity = '0';
        buttonLoader.classList.remove('hidden');
        searchButton.style.cursor = 'not-allowed';
        emailInput.disabled = true;
    } else {
        searchButton.disabled = false;
        buttonText.style.opacity = '1';
        buttonLoader.classList.add('hidden');
        searchButton.style.cursor = 'pointer';
        emailInput.disabled = false;
    }
}

// Message functions
function showErrorMessage(message) {
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
    successMessage.classList.add('hidden');
    infoMessage.classList.add('hidden');
    
    setTimeout(() => {
        errorMessage.classList.add('hidden');
    }, 8000);
}

function showSuccessMessage(message) {
    successText.textContent = message;
    successMessage.classList.remove('hidden');
    errorMessage.classList.add('hidden');
    infoMessage.classList.add('hidden');
    
    setTimeout(() => {
        successMessage.classList.add('hidden');
    }, 5000);
}

function showInfoMessage(message) {
    infoText.textContent = message;
    infoMessage.classList.remove('hidden');
    errorMessage.classList.add('hidden');
    successMessage.classList.add('hidden');
    
    setTimeout(() => {
        infoMessage.classList.add('hidden');
    }, 6000);
}

function hideMessages() {
    errorMessage.classList.add('hidden');
    successMessage.classList.add('hidden');
    infoMessage.classList.add('hidden');
}

// Utility functions
function refreshResults() {
    if (currentSearch.email) {
        emailInput.value = currentSearch.email;
        handleSearch({ preventDefault: () => {} });
    }
}

function newSearch() {
    emailInput.value = '';
    emailInput.focus();
    resultsSection.classList.add('hidden');
    hideMessages();
    currentSearch = { email: '', results: [], currentPage: 1, totalPages: 1, totalResults: 0 };
}

function formatDate(date) {
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        return 'Hoy';
    } else if (diffDays === 1) {
        return 'Ayer';
    } else if (diffDays < 7) {
        return `Hace ${diffDays} días`;
    } else {
        return date.toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Modal functions
function showHelp() {
    helpModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeHelp() {
    helpModal.classList.add('hidden');
    document.body.style.overflow = '';
}

function showPrivacy() {
    showInfoMessage('Política de privacidad: Todos tus datos están protegidos y encriptados.');
}

// Input animations
function addInputAnimations() {
    const inputs = document.querySelectorAll('.input-container input');
    
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.classList.add('focused');
        });
        
        input.addEventListener('blur', function() {
            this.parentElement.classList.remove('focused');
        });
    });
}

// ⚡ FUNCIÓN DE LOGOUT QUE SÍ FUNCIONA
function doLogout() {
    // Limpiar localStorage
    localStorage.removeItem('authToken');
    localStorage.removeItem('tokenExpiry');
    localStorage.removeItem('userData');
    localStorage.removeItem('userType');
    localStorage.removeItem('loginTime');
    
    // Redirigir inmediatamente
    window.location.href = 'index.html';
}

// Global functions for buttons
window.refreshDashboard = refreshResults;
window.openSearchPage = newSearch;
window.showHelp = showHelp;
window.closeHelp = closeHelp;
window.showPrivacy = showPrivacy;
window.doLogout = doLogout;

// También funciones de auth.js
window.checkAuth = function() {
    const token = localStorage.getItem('authToken');
    const tokenExpiry = localStorage.getItem('tokenExpiry');
    
    if (!token || !tokenExpiry || new Date().getTime() >= parseInt(tokenExpiry)) {
        localStorage.clear();
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
