// Configuration
const API_BASE_URL = 'https://nadasntuamor.com';

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
    loadUsersData(); // 🔥 Ahora carga usuarios reales al iniciar (sin esperar clicks)
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

// USUARIOS REALES + ACTUALIZA DASHBOARD Y TOP BAR (AQUÍ VA EL DEBUG)
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

        // DEBUG ADICIONAL: ALERTA Y CONSOLA
        console.log('DEBUG usersData:', usersData, usersData.length);
        alert('Usuarios cargados: ' + usersData.length);

        renderUsersTable(usersData);

        // ACTUALIZA TODOS LOS CONTADORES DE USUARIOS
        systemStats.totalUsers = usersData.length;
        document.getElementById('usersCount').textContent = usersData.length;
        document.getElementById('totalUsers').textContent = usersData.length;
        const userTopCounter = document.getElementById('userTopCounter');
        if (userTopCounter) userTopCounter.textContent = `${usersData.length} Usuarios`;
        updateStatsDisplay();

        // ⚡ Usuarios activos (nuevo widget)
        const activeUsers = usersData.filter(user => user.status === 'active');
        const activeUsersCountDiv = document.getElementById('activeUsersCount');
        if (activeUsersCountDiv) activeUsersCountDiv.textContent = activeUsers.length;
        // Si quieres mostrar los nombres o avatares activos en otro widget, puedes hacerlo con el array `activeUsers`
    } catch (err) {
        usersData = [];
        if (tableBody) renderUsersTable(usersData);
        showNotification('Error al cargar usuarios reales', 'error');
    }
}

// --- SESIONES Y USUARIOS ACTIVOS PARA DASHBOARD ADMIN ---

async function loadActiveSessionsAndUsers() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/usuarios-sesiones`);
        const result = await response.json();
        if (!result.success) return;
        
        // Usuarios activos (con al menos una sesión activa)
        const usuariosActivos = result.usuarios.filter(u => u.sessions.length > 0).length;
        // Número total de sesiones activas
        const numSesionesActivas = result.usuarios.reduce((acc, u) => acc + u.sessions.length, 0);
        
        // Aquí llamas la nueva función:
        updateSessionsTopBar(numSesionesActivas);

        // Actualiza widgets/tarjetas (cambia los IDs según lo que haya en tu HTML)
        if(document.getElementById('num-usuarios-activos')) 
            document.getElementById('num-usuarios-activos').textContent = usuariosActivos;
        if(document.getElementById('num-sesiones-activas')) 
            document.getElementById('num-sesiones-activas').textContent = numSesionesActivas;

        // Llenar detalle en tabla rápida por usuario (opcional)
        if(document.getElementById('tabla-usuarios-sesiones')) {
            let html = '';
            result.usuarios.forEach(u => {
                html += `<tr>
                    <td>${u.username}</td>
                    <td>${u.sessions.length}</td>
                    <td>${
                        u.sessions.length === 0
                        ? ''
                        : "<ul style='margin:0;padding-left:15px'>" +
                        u.sessions.map(
                            s => `<li>${s.ip_address} | ${s.user_agent.slice(0,22)}... | ${new Date(s.created_at).toLocaleString()}</li>`
                        ).join("") + "</ul>"
                    }</td>
                </tr>`;
            });
            document.getElementById('tabla-usuarios-sesiones').innerHTML = html;
        }
    } catch (e) {
        console.error('Error cargando sesiones activas:', e);
    }
}

// Puedes llamarlo cada 10 segundos para que el dashboard se actualice solo:
setInterval(loadActiveSessionsAndUsers, 10000);
document.addEventListener('DOMContentLoaded', loadActiveSessionsAndUsers);

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
function formatTimeAgo(date) {
    if (!date) return '';
    let d = date;
    if (typeof d === "string" || typeof d === "number") d = new Date(d);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffMins < 1) return 'Ahora mismo';
    if (diffMins < 60) return `Hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
    if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    if (diffDays < 7) return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
    return formatDate(d);
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

// Global functions
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
