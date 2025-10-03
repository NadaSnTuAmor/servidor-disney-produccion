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

// Configuration
const API_BASE_URL = 'https://www.nadasntuamor.com';

// DOM Elements
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebar = document.querySelector('.admin-sidebar');
const mainContent = document.querySelector('.admin-main');
const navItems = document.querySelectorAll('.nav-item');
const contentSections = document.querySelectorAll('.content-section');
const pageTitle = document.getElementById('pageTitle');
const adminName = document.getElementById('adminName');

// Data Storage
let currentSection = 'dashboard';
let usersData = [];
let systemStats = {
    totalUsers: 0,
    totalSearches: 0,
    totalCodes: 0,
    totalAlerts: 0
};

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    if (!checkAdminAuth()) return;
    loadAdminInfo();
    addEventListeners();
    startRealTimeUpdates();
    loadUsersData();
    initializeDashboard();
});

// Check admin authentication
function checkAdminAuth() {
    const token = localStorage.getItem('authToken');
    const tokenExpiry = localStorage.getItem('tokenExpiry');
    const userType = localStorage.getItem('userType');
    const userData = localStorage.getItem('userData');
    if (!token || !tokenExpiry || !userData || !userType || userType.toUpperCase() !== 'ADMIN') {
        alert('Acceso denegado. Solo administradores pueden acceder a este panel.');
        window.location.href = 'index.html';
        return false;
    }
    if (new Date().getTime() >= parseInt(tokenExpiry)) {
        alert('Sesión expirada. Por favor, inicia sesión nuevamente.');
        localStorage.clear();
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

// Load admin info
function loadAdminInfo() {
    const userData = JSON.parse(localStorage.getItem('userData'));
    if (userData && userData.name) {
        adminName.textContent = userData.name;
    }
}

// Initialize dashboard and view
function initializeDashboard() {
    showSection('dashboard');
    updateStatsDisplay();
    loadDashboardData();
}

function addEventListeners() {
    if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const section = item.dataset.section;
            if (section) {
                showSection(section);
                setActiveNavItem(item);
            }
        });
    });
    document.getElementById('refreshActivity')?.addEventListener('click', refreshActivity);
    document.getElementById('exportUsers')?.addEventListener('click', exportUsers);
    document.getElementById('refreshUsers')?.addEventListener('click', refreshUsers);
    document.getElementById('userSearch')?.addEventListener('input', filterUsers);
    document.getElementById('statusFilter')?.addEventListener('change', filterUsers);
    document.querySelectorAll('[data-section].card-link').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const section = link.dataset.section;
            if (section) {
                showSection(section);
                setActiveNavItem(document.querySelector(`.nav-item[data-section="${section}"]`));
            }
        });
    });
}

function toggleSidebar() {
    sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('sidebar-collapsed');
}

function showSection(sectionName) {
    contentSections.forEach(section => section.classList.remove('active'));
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
        currentSection = sectionName;
        updatePageTitle(sectionName);
        loadSectionData(sectionName);
    }
}

function setActiveNavItem(activeItem) {
    if (!activeItem) return;
    navItems.forEach(item => item.classList.remove('active'));
    activeItem.classList.add('active');
}

function updatePageTitle(section) {
    const titles = {
        dashboard: 'Dashboard',
        users: 'Lista de Usuarios',
        monitoring: 'Monitoreo del Sistema',
        settings: 'Configuración',
        alerts: 'Centro de Alertas',
        logs: 'Logs del Sistema'
    };
    pageTitle.textContent = titles[section] || 'Panel de Administración';
}

function loadSectionData(section) {
    switch (section) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'users':
            loadUsersData();
            break;
        case 'monitoring':
            loadMonitoringData();
            break;
        case 'settings':
            loadSettingsData();
            break;
        case 'alerts':
            loadAlertsData();
            break;
        case 'logs':
            loadLogsData();
            break;
    }
}

async function loadUsersData() {
    const tableBody = document.getElementById('usersTableBody');
    try {
        const response = await fetch(`${API_BASE_URL}/api/usuarios`);
        const result = await response.json();
        if (result.success && Array.isArray(result.usuarios)) {
            usersData = result.usuarios;
        } else if (result.success && Array.isArray(result.users)) {
            usersData = result.users;
        } else {
            usersData = [];
            showNotification('No se pudo cargar la lista real de usuarios', 'error');
        }
        renderUsersTable(usersData);

        // Actualiza todos los contadores de usuarios
        systemStats.totalUsers = usersData.length;
        document.getElementById('usersCount').textContent = usersData.length;
        document.getElementById('totalUsers').textContent = usersData.length;
        const userTopCounter = document.getElementById('userTopCounter');
        if (userTopCounter) userTopCounter.textContent = `${usersData.length} Usuarios`;
        updateStatsDisplay();

        // Usuarios activos (nuevo widget)
        const activeUsers = usersData.filter(user => user.status === 'active');
        const activeUsersCountDiv = document.getElementById('activeUsersCount');
        if (activeUsersCountDiv) activeUsersCountDiv.textContent = activeUsers.length;
    } catch (err) {
        usersData = [];
        if (tableBody) renderUsersTable(usersData);
        showNotification('Error al cargar usuarios reales', 'error');
    }
}

// --- TABLA SÓLO 5 COLUMNAS ---
function renderUsersTable(users) {
    const tableBody = document.getElementById('usersTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = users.map(user => `
        <tr>
            <td>${user.username || ""}</td>
            <td>${user.name || user.username || ""}</td>
            <td>
                <span class="status-badge ${user.status || ""}">
                    ${getStatusText(user.status)}
                </span>
            </td>
            <td>${user.ultima_sesion ? formatDate(user.ultima_sesion) : ""}</td>
            <td>${user.localizacion || "Desconocida"}</td>
        </tr>
    `).join('');

    const tableInfo = document.getElementById('usersTableInfo');
    if (tableInfo) {
        const total = users.length;
        tableInfo.textContent = `Mostrando ${total} usuario${total !== 1 ? 's' : ''}`;
    }
}
// ---------------------------------

function filterUsers() {
    const searchTerm = document.getElementById('userSearch')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('statusFilter')?.value || 'all';
    let filteredUsers = usersData;
    if (searchTerm) {
        filteredUsers = filteredUsers.filter(user => 
            (user.name && user.name.toLowerCase().includes(searchTerm)) ||
            (user.username && user.username.toLowerCase().includes(searchTerm)) ||
            (user.email && user.email.toLowerCase().includes(searchTerm))
        );
    }
    if (statusFilter !== 'all') {
        filteredUsers = filteredUsers.filter(user => user.status === statusFilter);
    }
    renderUsersTable(filteredUsers);
}

function updateStatsDisplay() {
    if(document.getElementById('totalUsers'))         document.getElementById('totalUsers').textContent = systemStats.totalUsers;
    if(document.getElementById('totalSearches'))      document.getElementById('totalSearches').textContent = systemStats.totalSearches;
    if(document.getElementById('totalCodes'))         document.getElementById('totalCodes').textContent = systemStats.totalCodes;
    if(document.getElementById('totalAlerts'))        document.getElementById('totalAlerts').textContent = systemStats.totalAlerts;
    if(document.getElementById('usersCount'))         document.getElementById('usersCount').textContent = systemStats.totalUsers;
    if(document.getElementById('alertsCount'))        document.getElementById('alertsCount').textContent = systemStats.totalAlerts;
}

function updateSessionsTopBar(numSesiones) {
    const el = document.getElementById('sessionsTopCounter');
    if (el) el.textContent = numSesiones + " Sesiones activas";
}

function loadDashboardData() {}
function loadMonitoringData() {}
function loadSettingsData() {}
function loadAlertsData() {}
function loadLogsData() {}
function refreshActivity() {}
function exportUsers() {}
function refreshUsers() {}
function startRealTimeUpdates() {}
function getStatusText(status) {
    const statusTexts = {
        active: 'Activo',
        inactive: 'Inactivo',
        blocked: 'Bloqueado'
    };
    return statusTexts[status] || status || '';
}
function formatDate(date) {
    let d = date;
    if (typeof d === "string" || typeof d === "number") d = new Date(d);
    return d.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-triangle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? 'rgba(16, 185, 129, 0.9)' : type === 'error' ? 'rgba(239, 68, 68, 0.9)' : 'rgba(59, 130, 246, 0.9)'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
        z-index: 10000;
        font-size: 14px;
        font-weight: 500;
        backdrop-filter: blur(10px);
        animation: slideInRight 0.3s ease-out;
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

window.doLogout = function doLogout() {
    if (confirm('¿Estás seguro de cerrar sesión?')) {
        localStorage.clear();
        showNotification('Cerrando sesión...', 'info');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    }
};

const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    @keyframes slideInRight {
        from { opacity: 0; transform: translateX(100%); }
        to { opacity: 1; transform: translateX(0);}
    }
    @keyframes slideOutRight {
        from { opacity: 1; transform: translateX(0);}
        to { opacity: 0; transform: translateX(100%);}
    }
`;
document.head.appendChild(notificationStyles);

console.log('🎯 Admin Dashboard JS loaded and ready!');
