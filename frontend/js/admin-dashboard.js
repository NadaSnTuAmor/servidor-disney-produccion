// Configuration
const API_BASE_URL = 'https://tu-sistema-disney.onrender.com'; // ⚠️ CAMBIAR POR TU URL

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
    totalUsers: 7,
    totalSearches: 142,
    totalCodes: 89,
    totalAlerts: 3
};

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing admin dashboard...');
    
    // Check admin authentication
    if (!checkAdminAuth()) {
        return;
    }
    
    // Load admin info
    loadAdminInfo();
    
    // Initialize dashboard
    initializeDashboard();
    
    // Add event listeners
    addEventListeners();
    
    // Load demo data
    loadDemoData();
    
    // Start real-time updates
    startRealTimeUpdates();
    
    console.log('✅ Admin dashboard initialized successfully');
});

// Check admin authentication
function checkAdminAuth() {
    const token = localStorage.getItem('authToken');
    const tokenExpiry = localStorage.getItem('tokenExpiry');
    const userType = localStorage.getItem('userType');
    const userData = localStorage.getItem('userData');
    
    if (!token || !tokenExpiry || !userData || userType !== 'admin') {
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

// Initialize dashboard
function initializeDashboard() {
    // Set active section
    showSection('dashboard');
    
    // Update stats display
    updateStatsDisplay();
    
    // Load dashboard data
    loadDashboardData();
}

// ⭐ ARREGLAR EVENT LISTENERS - FUNCIONAN TODOS
function addEventListeners() {
    console.log('🎯 Adding event listeners...');
    
    // Sidebar toggle
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
        console.log('✅ Sidebar toggle added');
    }
    
    // Navigation items - ASEGURAR QUE FUNCIONAN
    navItems.forEach((item, index) => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            console.log(`🎯 Nav item clicked: ${item.dataset.section}`);
            
            const section = item.dataset.section;
            if (section) {
                showSection(section);
                setActiveNavItem(item);
            }
        });
        console.log(`✅ Nav item ${index + 1} listener added: ${item.dataset.section}`);
    });
    
    // Refresh activity button
    const refreshActivityBtn = document.getElementById('refreshActivity');
    if (refreshActivityBtn) {
        refreshActivityBtn.addEventListener('click', refreshActivity);
        console.log('✅ Refresh activity listener added');
    }
    
    // Export users button
    const exportUsersBtn = document.getElementById('exportUsers');
    if (exportUsersBtn) {
        exportUsersBtn.addEventListener('click', exportUsers);
        console.log('✅ Export users listener added');
    }
    
    // Refresh users button
    const refreshUsersBtn = document.getElementById('refreshUsers');
    if (refreshUsersBtn) {
        refreshUsersBtn.addEventListener('click', refreshUsers);
        console.log('✅ Refresh users listener added');
    }
    
    // User search input
    const userSearchInput = document.getElementById('userSearch');
    if (userSearchInput) {
        userSearchInput.addEventListener('input', filterUsers);
        console.log('✅ User search listener added');
    }
    
    // Status filter
    const statusFilterSelect = document.getElementById('statusFilter');
    if (statusFilterSelect) {
        statusFilterSelect.addEventListener('change', filterUsers);
        console.log('✅ Status filter listener added');
    }
    
    // Card links for navigation
    document.querySelectorAll('[data-section]').forEach(link => {
        if (link.classList.contains('card-link')) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                console.log(`🎯 Card link clicked: ${section}`);
                if (section) {
                    showSection(section);
                    setActiveNavItem(document.querySelector(`.nav-item[data-section="${section}"]`));
                }
            });
            console.log('✅ Card link listener added');
        }
    });
    
    console.log('🎉 All event listeners added successfully!');
}

// Toggle sidebar
function toggleSidebar() {
    console.log('🎯 Toggle sidebar');
    sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('sidebar-collapsed');
}

// Show section
function showSection(sectionName) {
    console.log(`🎯 Showing section: ${sectionName}`);
    
    // Hide all sections
    contentSections.forEach(section => {
        section.classList.remove('active');
    });
    
    // Show target section
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
        currentSection = sectionName;
        
        // Update page title
        updatePageTitle(sectionName);
        
        // Load section data
        loadSectionData(sectionName);
        
        console.log(`✅ Section ${sectionName} activated`);
    } else {
        console.error(`❌ Section not found: ${sectionName}-section`);
    }
}

// Set active nav item
function setActiveNavItem(activeItem) {
    if (!activeItem) {
        console.warn('⚠️ No active item provided');
        return;
    }
    
    console.log(`🎯 Setting active nav item: ${activeItem.dataset.section}`);
    
    navItems.forEach(item => {
        item.classList.remove('active');
    });
    activeItem.classList.add('active');
}

// Update page title
function updatePageTitle(section) {
    const titles = {
        dashboard: 'Dashboard',
        users: 'Lista de Usuarios',
        monitoring: 'Monitoreo del Sistema',
        settings: 'Configuración',
        alerts: 'Centro de Alertas',
        logs: 'Logs del Sistema'
    };
    
    const newTitle = titles[section] || 'Panel de Administración';
    pageTitle.textContent = newTitle;
    console.log(`✅ Page title updated: ${newTitle}`);
}

// Load section data
function loadSectionData(section) {
    console.log(`🎯 Loading data for section: ${section}`);
    
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
        default:
            console.warn(`⚠️ Unknown section: ${section}`);
    }
}

// Update stats display
function updateStatsDisplay() {
    document.getElementById('totalUsers').textContent = systemStats.totalUsers;
    document.getElementById('totalSearches').textContent = systemStats.totalSearches;
    document.getElementById('totalCodes').textContent = systemStats.totalCodes;
    document.getElementById('totalAlerts').textContent = systemStats.totalAlerts;
    document.getElementById('usersCount').textContent = systemStats.totalUsers;
    document.getElementById('alertsCount').textContent = systemStats.totalAlerts;
}

// Load demo data
function loadDemoData() {
    usersData = [
        {
            id: 1,
            username: 'usuario_mario',
            name: 'Mario',
            email: 'mario@sistema.com',
            status: 'active',
            lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000),
            searchCount: 15,
            whatsapp: '51929765920'
        },
        {
            id: 2,
            username: 'usuario2',
            name: 'Elena',
            email: 'elena@sistema.com',
            status: 'active',
            lastActivity: new Date(Date.now() - 5 * 60 * 60 * 1000),
            searchCount: 8,
            whatsapp: null
        },
        {
            id: 3,
            username: 'usuario3',
            name: 'Carlos',
            email: 'carlos@sistema.com',
            status: 'active',
            lastActivity: new Date(Date.now() - 1 * 60 * 60 * 1000),
            searchCount: 22,
            whatsapp: null
        },
        {
            id: 4,
            username: 'usuario_carmen',
            name: 'Kalo',
            email: 'carmen@sistema.com',
            status: 'inactive',
            lastActivity: new Date(Date.now() - 24 * 60 * 60 * 1000),
            searchCount: 3,
            whatsapp: null
        },
        {
            id: 5,
            username: 'nsta_roxana',
            name: 'Roxana',
            email: 'roxana@sistema.com',
            status: 'active',
            lastActivity: new Date(Date.now() - 30 * 60 * 1000),
            searchCount: 12,
            whatsapp: '51921079241'
        },
        {
            id: 6,
            username: 'nsta_carlos',
            name: 'Carlos',
            email: 'nsta_carlos@sistema.com',
            status: 'active',
            lastActivity: new Date(Date.now() - 4 * 60 * 60 * 1000),
            searchCount: 6,
            whatsapp: null
        },
        {
            id: 7,
            username: 'nsta_beatriz',
            name: 'Beatriz',
            email: 'nsta_beatriz@sistema.com',
            status: 'blocked',
            lastActivity: new Date(Date.now() - 48 * 60 * 60 * 1000),
            searchCount: 1,
            whatsapp: null
        }
    ];
    
    console.log('✅ Demo data loaded:', usersData.length, 'users');
}

// Load dashboard data
function loadDashboardData() {
    console.log('🎯 Loading dashboard data...');
    loadRecentActivity();
    loadActiveUsers();
}

// Load recent activity
function loadRecentActivity() {
    const activityContainer = document.getElementById('recentActivity');
    if (!activityContainer) return;
    
    const activities = [
        {
            icon: 'search',
            text: 'Mario realizó una búsqueda de códigos',
            time: 'Hace 5 minutos'
        },
        {
            icon: 'user-plus',
            text: 'Nuevo usuario registrado: Elena',
            time: 'Hace 15 minutos'
        },
        {
            icon: 'key',
            text: '3 códigos Disney+ encontrados para Carlos',
            time: 'Hace 30 minutos'
        },
        {
            icon: 'bell',
            text: 'Alerta generada: Usuario bloqueado',
            time: 'Hace 1 hora'
        },
        {
            icon: 'search',
            text: 'Roxana realizó una búsqueda de códigos',
            time: 'Hace 2 horas'
        }
    ];
    
    activityContainer.innerHTML = activities.map(activity => `
        <div class="activity-item">
            <div class="activity-icon">
                <i class="fas fa-${activity.icon}"></i>
            </div>
            <div class="activity-content">
                <div class="activity-text">${activity.text}</div>
                <div class="activity-time">${activity.time}</div>
            </div>
        </div>
    `).join('');
    
    console.log('✅ Recent activity loaded');
}

// Load active users
function loadActiveUsers() {
    const usersContainer = document.getElementById('activeUsers');
    if (!usersContainer) return;
    
    const activeUsers = usersData
        .filter(user => user.status === 'active')
        .sort((a, b) => b.lastActivity - a.lastActivity)
        .slice(0, 5);
    
    usersContainer.innerHTML = activeUsers.map(user => `
        <div class="user-item">
            <div class="user-avatar">
                ${user.name.charAt(0).toUpperCase()}
            </div>
            <div class="user-info">
                <div class="user-name">${user.name}</div>
                <div class="user-status">Activo • ${formatTimeAgo(user.lastActivity)}</div>
            </div>
            <div class="user-online"></div>
        </div>
    `).join('');
    
    console.log('✅ Active users loaded');
}

// Load users data
function loadUsersData() {
    console.log('🎯 Loading users data...');
    const tableBody = document.getElementById('usersTableBody');
    if (!tableBody) return;
    
    renderUsersTable(usersData);
}

// Render users table - SOLO LECTURA
function renderUsersTable(users) {
    const tableBody = document.getElementById('usersTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = users.map(user => `
        <tr>
            <td>
                <div class="user-cell">
                    <div class="table-avatar">
                        ${user.name.charAt(0).toUpperCase()}
                    </div>
                    <div class="table-user-info">
                        <div class="table-username">${user.name}</div>
                        <div class="table-user-id">@${user.username}</div>
                    </div>
                </div>
            </td>
            <td>${user.name}</td>
            <td>
                <span class="status-badge ${user.status}">
                    ${getStatusText(user.status)}
                </span>
            </td>
            <td>${formatTimeAgo(user.lastActivity)}</td>
            <td>
                <div class="search-count">
                    <i class="fas fa-search"></i>
                    <span>${user.searchCount}</span>
                </div>
            </td>
        </tr>
    `).join('');
    
    // Update table info
    const tableInfo = document.getElementById('usersTableInfo');
    if (tableInfo) {
        const total = users.length;
        tableInfo.textContent = `Mostrando ${total} usuario${total !== 1 ? 's' : ''}`;
    }
    
    console.log('✅ Users table rendered:', users.length, 'users');
}

// Filter users
function filterUsers() {
    const searchTerm = document.getElementById('userSearch')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('statusFilter')?.value || 'all';
    
    let filteredUsers = usersData;
    
    // Filter by search term
    if (searchTerm) {
        filteredUsers = filteredUsers.filter(user => 
            user.name.toLowerCase().includes(searchTerm) ||
            user.username.toLowerCase().includes(searchTerm) ||
            user.email.toLowerCase().includes(searchTerm)
        );
    }
    
    // Filter by status
    if (statusFilter !== 'all') {
        filteredUsers = filteredUsers.filter(user => user.status === statusFilter);
    }
    
    renderUsersTable(filteredUsers);
    console.log('✅ Users filtered:', filteredUsers.length, 'results');
}

// Load monitoring data
function loadMonitoringData() {
    console.log('🎯 Loading monitoring data...');
    loadSearchesTimeline();
    loadAlertsList();
}

// Load searches timeline
function loadSearchesTimeline() {
    const timelineContainer = document.getElementById('searchesTimeline');
    if (!timelineContainer) return;
    
    const searches = [
        { user: 'Mario', email: 'mario@sistema.com', time: new Date(Date.now() - 5 * 60 * 1000), results: 3 },
        { user: 'Elena', email: 'elena@sistema.com', time: new Date(Date.now() - 12 * 60 * 1000), results: 1 },
        { user: 'Carlos', email: 'carlos@sistema.com', time: new Date(Date.now() - 18 * 60 * 1000), results: 2 },
        { user: 'Roxana', email: 'roxana@sistema.com', time: new Date(Date.now() - 25 * 60 * 1000), results: 4 }
    ];
    
    timelineContainer.innerHTML = searches.map(search => `
        <div class="activity-item">
            <div class="activity-icon">
                <i class="fas fa-search"></i>
            </div>
            <div class="activity-content">
                <div class="activity-text">${search.user} buscó códigos • ${search.results} encontrados</div>
                <div class="activity-time">${formatTimeAgo(search.time)}</div>
            </div>
        </div>
    `).join('');
    
    console.log('✅ Searches timeline loaded');
}

// Load alerts list
function loadAlertsList() {
    const alertsContainer = document.getElementById('alertsList');
    if (!alertsContainer) return;
    
    const alerts = [
        {
            type: 'warning',
            title: 'Usuario bloqueado automáticamente',
            message: 'Usuario Beatriz bloqueado por intentos fallidos',
            time: new Date(Date.now() - 30 * 60 * 1000)
        },
        {
            type: 'info',
            title: 'Sincronización completada',
            message: 'Google Sheets sincronizado correctamente',
            time: new Date(Date.now() - 60 * 60 * 1000)
        },
        {
            type: 'error',
            title: 'Error en WhatsApp API',
            message: 'Falló el envío de notificación a usuario Mario',
            time: new Date(Date.now() - 2 * 60 * 60 * 1000)
        }
    ];
    
    alertsContainer.innerHTML = alerts.map(alert => `
        <div class="activity-item">
            <div class="activity-icon">
                <i class="fas fa-${alert.type === 'error' ? 'exclamation-triangle' : alert.type === 'warning' ? 'exclamation-circle' : 'info-circle'}"></i>
            </div>
            <div class="activity-content">
                <div class="activity-text"><strong>${alert.title}</strong><br>${alert.message}</div>
                <div class="activity-time">${formatTimeAgo(alert.time)}</div>
            </div>
        </div>
    `).join('');
    
    console.log('✅ Alerts list loaded');
}

// Load settings data
function loadSettingsData() {
    console.log('🎯 Loading settings data...');
    showNotification('Sección de configuración cargada', 'info');
}

// Load alerts data
function loadAlertsData() {
    console.log('🎯 Loading alerts data...');
    showNotification('Centro de alertas cargado', 'info');
}

// Load logs data
function loadLogsData() {
    console.log('🎯 Loading logs data...');
    showNotification('Logs del sistema cargados', 'info');
}

// Export users
function exportUsers() {
    console.log('🎯 Exporting users...');
    const csvContent = [
        ['Usuario', 'Nombre', 'Estado', 'Última Actividad', 'Búsquedas'],
        ...usersData.map(user => [
            user.username,
            user.name,
            getStatusText(user.status),
            formatDate(user.lastActivity),
            user.searchCount
        ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `usuarios_disney_shield_${formatDateFile(new Date())}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    showNotification('Lista de usuarios exportada', 'success');
}

// Refresh users
function refreshUsers() {
    console.log('🎯 Refreshing users...');
    showNotification('Lista de usuarios actualizada', 'success');
    
    // Simulate some activity updates
    usersData.forEach(user => {
        if (Math.random() > 0.7) {
            user.lastActivity = new Date(Date.now() - Math.random() * 60 * 60 * 1000);
        }
    });
    
    // Recargar datos
    loadUsersData();
    
    // Update dashboard if showing
    if (currentSection === 'dashboard') {
        loadActiveUsers();
    }
}

// Refresh activity
function refreshActivity() {
    console.log('🎯 Refreshing activity...');
    loadRecentActivity();
    loadActiveUsers();
    showNotification('Actividad actualizada', 'success');
}

// Start real-time updates
function startRealTimeUpdates() {
    // Update stats every 30 seconds
    setInterval(() => {
        // Simulate stat changes
        if (Math.random() > 0.7) {
            systemStats.totalSearches += Math.floor(Math.random() * 3) + 1;
            systemStats.totalCodes += Math.floor(Math.random() * 2) + 1;
            updateStatsDisplay();
        }
    }, 30000);
    
    // Update activity every 60 seconds
    setInterval(() => {
        if (currentSection === 'dashboard') {
            loadRecentActivity();
        }
    }, 60000);
}

// Utility functions
function formatTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return 'Ahora mismo';
    if (diffMins < 60) return `Hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
    if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    if (diffDays < 7) return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
    
    return formatDate(date);
}

function formatDate(date) {
    return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDateFile(date) {
    return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).replace(/\//g, '-');
}

function getStatusText(status) {
    const statusTexts = {
        active: 'Activo',
        inactive: 'Inactivo',
        blocked: 'Bloqueado'
    };
    return statusTexts[status] || status;
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-triangle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    // Add styles
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
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// ⭐ LOGOUT FUNCTION - ASEGURAR QUE FUNCIONA
function doLogout() {
    console.log('🎯 Logout clicked');
    if (confirm('¿Estás seguro de cerrar sesión?')) {
        console.log('✅ Logout confirmed');
        localStorage.clear();
        showNotification('Cerrando sesión...', 'info');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    }
}

// Global functions
window.doLogout = doLogout;

// Add notification styles
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    @keyframes slideInRight {
        from {
            opacity: 0;
            transform: translateX(100%);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes slideOutRight {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100%);
        }
    }
`;
document.head.appendChild(notificationStyles);

// ⭐ DEBUG - LOG ALL INTERACTIONS
console.log('🎯 Admin Dashboard JS loaded and ready!');
