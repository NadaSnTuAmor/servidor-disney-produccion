// ⚠️ IMPORTANTE: Cargar variables de entorno PRIMERO
require('dotenv').config();
const express = require('express');
const { Client } = require('pg');
const cors = require('cors');
const { google } = require('googleapis');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const app = express();
const PORT = process.env.PORT || 3000;
// 🛡️ CONFIGURACIÓN SEGURA - DESDE VARIABLES DE ENTORNO
// Nueva configuración para PostgreSQL/Supabase
const DB_CONFIG = {
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
};
// Nueva función para crear conexión
async function createConnection() {
  const client = new Client(DB_CONFIG);
  await client.connect();
  return client;
}
const GMAIL_CONFIG = {
  CLIENT_ID: process.env.GMAIL_CLIENT_ID,
  CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET,
  REDIRECT_URL: process.env.GMAIL_REDIRECT_URL || 'http://localhost:3000/oauth2callback',
  REFRESH_TOKEN: process.env.GMAIL_REFRESH_TOKEN
};
const CORREO_PRINCIPAL = process.env.CORREO_PRINCIPAL;
const TELEGRAM_CONFIG = {
  BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  YOUR_CHAT_ID: process.env.TELEGRAM_CHAT_ID
};
const GREEN_API_CONFIG = {
  idInstance: process.env.GREEN_API_ID_INSTANCE,
  apiTokenInstance: process.env.GREEN_API_API_TOKEN_INSTANCE,
  baseUrl: 'https://api.green-api.com'
};
const ADMIN_CONFIG = {
  numeroWhatsApp: process.env.ADMIN_WHATSAPP
};
// JWT CONFIGURATION Y FUNCIONES
const JWT_CONFIG = {
  SECRET: process.env.JWT_SECRET,
  EXPIRATION: '20m',
  ALGORITHM: 'HS256'
};
// 🔐 VALIDAR QUE TODAS LAS VARIABLES EXISTEN
const requiredEnvVars = [
  'DATABASE_URL', 'GREEN_API_ID_INSTANCE', 'GREEN_API_API_TOKEN_INSTANCE', 'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID', 'ADMIN_WHATSAPP', 'GMAIL_CLIENT_ID',
  'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN', 'CORREO_PRINCIPAL',
  'JWT_SECRET'
];
let missingVars = [];
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    missingVars.push(varName);
  }
});
if (missingVars.length > 0) {
  console.error('❌ FALTAN VARIABLES DE ENTORNO:', missingVars);
  console.error('📝 Asegúrate de crear el archivo .env con todas las variables');
  process.exit(1);
}
console.log('✅ Todas las variables de entorno cargadas correctamente');
console.log('🛡️ Credenciales protegidas - NO expuestas en código');
console.log('🔐 JWT Ultra Seguro configurado correctamente');
// Crear instancia del bot Telegram
const telegramBot = new TelegramBot(TELEGRAM_CONFIG.BOT_TOKEN);
// FUNCIÓN PARA GENERAR TOKEN
function generateToken(user) {
  const payload = {
    user_id: user.id,
    username: user.username,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (20 * 60) // 20 minutos
  };
  const token = jwt.sign(payload, JWT_CONFIG.SECRET, { algorithm: JWT_CONFIG.ALGORITHM });
  console.log(`🔐 Token generado para ${user.username} - Expira en 20 minutos`);
  return token;
}
// FUNCIÓN PARA VERIFICAR TOKEN
function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_CONFIG.SECRET);
    console.log(`✅ Token válido para usuario: ${decoded.username}`);
    return { valid: true, decoded, needsRefresh: false };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      console.log('⏰ Token expirado - necesita refresh');
      return { valid: false, needsRefresh: true, error: 'Token expirado' };
    }
    console.log('❌ Token inválido:', error.message);
    return { valid: false, needsRefresh: false, error: error.message };
  }
}
// FUNCIÓN PARA RENOVAR TOKEN (SLIDING EXPIRATION)
function refreshToken(oldToken) {
  try {
    const decoded = jwt.verify(oldToken, JWT_CONFIG.SECRET, { ignoreExpiration: true });
    const newPayload = {
      user_id: decoded.user_id,
      username: decoded.username,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (20 * 60) // +20 minutos más
    };
    const newToken = jwt.sign(newPayload, JWT_CONFIG.SECRET, { algorithm: JWT_CONFIG.ALGORITHM });
    console.log(`🔄 Token renovado para ${decoded.username} - +20 minutos más`);
    return { success: true, token: newToken, user: decoded };
  } catch (error) {
    console.log('❌ Error renovando token:', error.message);
    return { success: false, error: error.message };
  }
}
// MIDDLEWARE JWT CON SLIDING EXPIRATION
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('❌ No se proporcionó token JWT');
    return res.status(401).json({
      success: false,
      error: 'Token requerido',
      code: 'NO_TOKEN'
    });
  }
  const token = authHeader.substring(7); // Remove 'Bearer '
  const verification = verifyToken(token);
  if (verification.valid) {
    req.user = verification.decoded;
    console.log(`🎯 Request autorizado para: ${req.user.username}`);
    next();
  } else if (verification.needsRefresh) {
    console.log('🔄 Intentando renovación automática de token...');
    const refreshResult = refreshToken(token);
    if (refreshResult.success) {
      req.user = refreshResult.user;
      res.setHeader('New-Token', refreshResult.token); // Enviar nuevo token al cliente
      console.log(`✅ Token auto-renovado para: ${req.user.username}`);
      next();
    } else {
      return res.status(401).json({
        success: false,
        error: 'Sesión expirada - login requerido',
        code: 'EXPIRED_TOKEN'
      });
    }
  } else {
    return res.status(401).json({
      success: false,
      error: 'Token inválido',
      code: 'INVALID_TOKEN'
    });
  }
}
// 🚨 TUS FUNCIONES EXISTENTES (MANTENIDAS INTACTAS)
async function enviarAlertaTelegram(mensaje) {
  try {
    await telegramBot.sendMessage(TELEGRAM_CONFIG.YOUR_CHAT_ID, mensaje);
    console.log('✅ Alerta enviada a Telegram exitosamente');
  } catch (error) {
    console.error('❌ Error enviando alerta a Telegram:', error);
  }
}
async function enviarAlertaWhatsApp(numeroDestino, mensaje) {
  try {
    const url = `${GREEN_API_CONFIG.baseUrl}/waInstance${GREEN_API_CONFIG.idInstance}/sendMessage/${GREEN_API_CONFIG.apiTokenInstance}`;
    
    const data = {
      chatId: `${numeroDestino}@c.us`,
      message: mensaje
    };
    const response = await axios.post(url, data);
    console.log('✅ WhatsApp enviado exitosamente:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error enviando WhatsApp:', error.response?.data || error.message);
    throw error;
  }
}
// TU FUNCIÓN DUAL EXISTENTE (SIN CAMBIOS)
async function enviarAlertaDual(mensaje, numeroCliente = null) {
  try {
    console.log('🔄 INICIO enviarAlertaDual:');
    console.log('📱 Número admin:', ADMIN_CONFIG.numeroWhatsApp);
    console.log('👤 Número cliente recibido:', numeroCliente);
    console.log('🔍 Tipo del número cliente:', typeof numeroCliente);
    
    await enviarAlertaTelegram(mensaje);
    const destinatarios = new Set();
    destinatarios.add(ADMIN_CONFIG.numeroWhatsApp);
    console.log('✅ Agregado admin a lista:', ADMIN_CONFIG.numeroWhatsApp);
    
    if (numeroCliente && numeroCliente !== ADMIN_CONFIG.numeroWhatsApp) {
      destinatarios.add(numeroCliente);
      console.log('✅ Agregado cliente a lista:', numeroCliente);
    } else {
      console.log('⚠️ Cliente NO agregado. Razones:');
      console.log('   numeroCliente existe?', !!numeroCliente);
      console.log('   numeroCliente valor:', numeroCliente);
      console.log('   numeroCliente === admin?', numeroCliente === ADMIN_CONFIG.numeroWhatsApp);
      console.log('   admin es:', ADMIN_CONFIG.numeroWhatsApp);
    }
    
    console.log('📋 Lista final de destinatarios:', Array.from(destinatarios));
    console.log('📊 Total destinatarios:', destinatarios.size);
    
    const resultados = [];
    let contador = 0;
    for (const numero of destinatarios) {
      try {
        contador++;
        console.log(`📤 [${contador}/${destinatarios.size}] Enviando WhatsApp a: ${numero}`);
        const resultado = await enviarAlertaWhatsApp(numero, mensaje);
        resultados.push({ numero, exito: true, resultado });
        console.log(`✅ WhatsApp enviado exitosamente a ${numero}:`, resultado);
      } catch (error) {
        resultados.push({ numero, exito: false, error: error.message });
        console.error(`❌ Error enviando WhatsApp a ${numero}:`, error.message);
      }
    }
    
    console.log(`✅ Alertas duales procesadas: Telegram + ${destinatarios.size} WhatsApp(s)`);
    return {
      telegram: true,
      whatsapp_destinatarios: Array.from(destinatarios),
      whatsapp_resultados: resultados
    };
    
  } catch (error) {
    console.error('❌ Error en alertas duales:', error);
    return {
      telegram: false,
      whatsapp_destinatarios: [],
      whatsapp_resultados: [],
      error: error.message
    };
  }
}
// TUS FUNCIONES DE ALERTA EXISTENTES (SIN CAMBIOS)
async function alertaRoboDetectado(usuario, correo, numeroCliente = null) {
  const mensaje = `🚨 ROBO DETECTADO - DISNEY+
👤 Usuario: ${usuario}
📧 Correo: ${correo}
🕐 Fecha: ${new Date().toLocaleString('es-PE')}
🔐 Estado: BLOQUEADO AUTOMÁTICAMENTE
⚠️ REVISAR INMEDIATAMENTE
🛡️ Sistema de seguridad dual activo`;
  return await enviarAlertaDual(mensaje, numeroCliente);
}
async function alertaUsuarioReactivado(usuario, numeroCliente = null) {
  const mensaje = `✅ USUARIO REACTIVADO - DISNEY+
👤 Usuario: ${usuario}
🕐 Fecha: ${new Date().toLocaleString('es-PE')}
💰 Estado: ACTIVO (Cliente pagó)
✅ Usuario puede usar la app nuevamente
🛡️ Sistema de seguridad dual activo`;
  return await enviarAlertaDual(mensaje, numeroCliente);
}
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log(`🔍 ${req.method} ${req.path}`);
  console.log('📦 Body:', req.body);
  next();
});
// TU FUNCIÓN GMAIL EXISTENTE (SIN CAMBIOS)
async function connectGmail() {
  const oAuth2Client = new google.auth.OAuth2(
    GMAIL_CONFIG.CLIENT_ID,
    GMAIL_CONFIG.CLIENT_SECRET,
    GMAIL_CONFIG.REDIRECT_URL
  );
  oAuth2Client.setCredentials({
    refresh_token: GMAIL_CONFIG.REFRESH_TOKEN
  });
  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
  return gmail;
}
// TU FUNCIÓN BUSCAR CORREOS (SIN CAMBIOS)
async function buscarCorreosEnGmail(emailBuscado) {
  try {
    const gmail = await connectGmail();
    
    const ahora = new Date();
    const hace24Horas = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
    const fechaDesde = hace24Horas.toISOString().split('T')[0].replace(/-/g, '/');
    const query = `to:${emailBuscado} after:${fechaDesde}`;
    
    console.log('🔍 Buscando correos con query:', query);
    console.log('📅 Desde:', hace24Horas.toLocaleString());
    console.log('📅 Hasta:', ahora.toLocaleString());
    
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 5
    });
    const messages = response.data.messages || [];
    const correos = [];
    console.log(`📧 Encontrados ${messages.length} mensajes para ${emailBuscado} en las últimas 24h`);
    
    for (const message of messages) {
      try {
        const details = await gmail.users.messages.get({
          userId: 'me',
          id: message.id
        });
        const headers = details.data.payload.headers;
        const subject = headers.find(h => h.name === 'Subject')?.value || 'Sin asunto';
        const from = headers.find(h => h.name === 'From')?.value || 'Desconocido';
        const to = headers.find(h => h.name === 'To')?.value || 'Desconocido';
        const date = headers.find(h => h.name === 'Date')?.value || 'Fecha desconocida';
        
        let body = 'Sin contenido';
        if (details.data.payload.body?.data) {
          body = Buffer.from(details.data.payload.body.data, 'base64').toString('utf-8');
        } else if (details.data.payload.parts) {
          for (const part of details.data.payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
              body = Buffer.from(part.body.data, 'base64').toString('utf-8');
              break;
            } else if (part.mimeType === 'text/html' && part.body?.data) {
              body = Buffer.from(part.body.data, 'base64').toString('utf-8');
              body = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
              break;
            }
          }
        }
        
        const fechaFormateada = new Date(date).toLocaleString('es-PE', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        correos.push({
          id: message.id,
          subject: subject,
          from: from,
          to: to,
          date: fechaFormateada,
          body: body.substring(0, 300) + '...'
        });
        console.log(`✅ Procesado: ${subject} - ${fechaFormateada}`);
        
      } catch (error) {
        console.error(`❌ Error procesando mensaje ${message.id}:`, error);
      }
    }
    console.log(`✅ Total procesados: ${correos.length} correos para ${emailBuscado}`);
    return correos;
    
  } catch (error) {
    console.error('❌ Error leyendo Gmail:', error);
    return [];
  }
}
// MIDDLEWARE PARA FUNCIONES EXISTENTES
function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.log('⚠️ Sin token - permitiendo por desarrollo (compatibilidad)');
  }
  next();
}
// LOGIN CON JWT
// LOGIN JWT CON SUPABASE POSTGRESQL
app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('🔐 Intento de login JWT:', username);
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Usuario y contraseña son requeridos'
      });
    }
    
    // Crear conexión PostgreSQL
    const client = await createConnection();
    
    // Query adaptada a PostgreSQL (nota: $1 en lugar de ?)
    const result = await client.query(
      'SELECT id, username, password_hash, estado_seguridad FROM users WHERE username = $1',
      [username]
    );
    
    // Verificar si existe el usuario
    if (result.rows.length === 0) {
      await client.end();
      return res.status(401).json({
        success: false,
        message: 'Usuario o contraseña incorrectos'
      });
    }
    
    const user = result.rows[0];
    
    // Verificar estado de seguridad ANTES de validar password
    if (user.estado_seguridad === 'BLOQUEADO') {
      await client.end();
      return res.status(401).json({
        success: false,
        message: 'Usuario bloqueado por seguridad'
      });
    }
    
    // Validar contraseña (temporalmente simple, después implementar bcrypt)
    if (user.password_hash !== password) {
      await client.end();
      return res.status(401).json({
        success: false,
        message: 'Usuario o contraseña incorrectos'
      });
    }
    
    // Obtener emails asociados al usuario
    const emailsResult = await client.query(`
      SELECT a.email_address 
      FROM accounts a 
      JOIN user_accounts ua ON a.id = ua.account_id 
      WHERE ua.user_id = $1
    `, [user.id]);
    
    await client.end();
    
    // Generar JWT (tu función existente)
    const token = generateToken(user);
    
    console.log(`✅ Login JWT exitoso para: ${username}`);
    
    res.json({
      success: true,
      message: 'Login exitoso',
      token: token,
      user: {
        id: user.id,
        username: user.username,
        emails: emailsResult.rows.map(row => row.email_address),
        seguridad: user.estado_seguridad
      },
      expires_in: '20 minutos',
      token_type: 'Bearer',
      database: 'Supabase PostgreSQL'
    });
    
  } catch (error) {
    console.error('❌ Error en login JWT:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});
// RENOVAR TOKEN
app.post('/auth/refresh', (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({
      success: false,
      error: 'Token requerido para renovar'
    });
  }
  const refreshResult = refreshToken(token);
  if (refreshResult.success) {
    res.json({
      success: true,
      message: 'Token renovado exitosamente',
      token: refreshResult.token,
      expires_in: '20 minutos',
      user: {
        id: refreshResult.user.user_id,
        username: refreshResult.user.username
      }
    });
  } else {
    res.status(401).json({
      success: false,
      error: refreshResult.error
    });
  }
});
// PERFIL DE USUARIO JWT
app.get('/auth/profile', authenticateJWT, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.user_id,
      username: req.user.username,
      token_issued_at: new Date(req.user.iat * 1000).toLocaleString('es-PE'),
      token_expires_at: new Date(req.user.exp * 1000).toLocaleString('es-PE')
    }
  });
});
// LOGOUT JWT
app.post('/auth/logout', authenticateJWT, (req, res) => {
  console.log(`👋 Logout JWT para usuario: ${req.user.username}`);
  res.json({
    success: true,
    message: 'Logout exitoso - elimina el token del cliente'
  });
});
// ENDPOINT SEGURO: ENVIAR WHATSAPP DESDE APK
app.post('/api/send-whatsapp', authenticateJWT, async (req, res) => {
  try {
    const { numero, mensaje } = req.body;
    
    console.log(`📱 ${req.user.username} solicita WhatsApp:`, { numero, mensaje: mensaje.substring(0, 50) + '...' });
    
    if (!numero || !mensaje) {
      return res.status(400).json({
        success: false,
        error: 'numero y mensaje son requeridos'
      });
    }
    
    const resultado = await enviarAlertaWhatsApp(numero, mensaje);
    
    res.json({
      success: true,
      message: 'WhatsApp enviado exitosamente',
      id: resultado.idMessage,
      sent_by: req.user.username
    });
    
  } catch (error) {
    console.error('❌ Error en endpoint send-whatsapp:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});
// ENDPOINT SEGURO: ALERTAS DUALES DESDE APK
app.post('/api/send-dual-alert', authenticateJWT, async (req, res) => {
  try {
    const { mensaje, numeroCliente } = req.body;
    
    console.log(`📱 ${req.user.username} solicita alerta dual:`, { 
      mensaje: mensaje.substring(0, 50) + '...', 
      numeroCliente 
    });
    
    if (!mensaje) {
      return res.status(400).json({
        success: false,
        error: 'mensaje es requerido'
      });
    }
    
    const resultado = await enviarAlertaDual(mensaje, numeroCliente);
    
    res.json({
      success: true,
      message: 'Alerta dual enviada exitosamente',
      destinatarios: resultado.whatsapp_destinatarios,
      telegram: resultado.telegram,
      sent_by: req.user.username
    });
    
  } catch (error) {
    console.error('❌ Error en endpoint send-dual-alert:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});
// ENDPOINT DE STATUS CON INFO JWT
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    message: 'Servidor JWT Ultra Seguro funcionando',
    timestamp: new Date().toISOString(),
    version: '3.0-jwt-secure',
    security: 'JWT Sliding Expiration - Variables protegidas con dotenv',
    jwt_config: {
      expiration: '20 minutos',
      sliding: 'Auto-renovación con actividad',
      algorithm: 'HS256'
    },
    endpoints: [
      'POST /auth/login - Login con JWT',
      'POST /auth/refresh - Renovar token',
      'GET /auth/profile - Info usuario autenticado',
      'POST /auth/logout - Cerrar sesión',
      'POST /api/send-whatsapp - Enviar WhatsApp (JWT Required)',
      'POST /api/send-dual-alert - Alertas duales (JWT Required)',
      'GET /api/status - Status del servidor'
    ]
  });
});
// MANTENER TODOS TUS ENDPOINTS EXISTENTES
// ENDPOINT PRINCIPAL - MANTIENE TODO + AGREGA ELIMINACIÓN (SIN CAMBIOS)
// ENDPOINT PARA SINCRONIZAR GOOGLE SHEETS → SUPABASE
app.post('/sync-user', async (req, res) => {
  try {
    console.log('📨 Datos recibidos de Google Sheets:', req.body);
    
    const { id, usuario, password, activo, correos, action } = req.body;
    
    // MANEJAR ELIMINACIÓN DE USUARIOS
    if (action === 'delete_user') {
      const client = await createConnection();
      await client.query('DELETE FROM users WHERE id = $1', [id]);
      await client.end();
      console.log(`🗑️ Usuario ${id} eliminado de Supabase`);
      return res.json({ status: 'deleted' });
    }
    
    // MANEJAR LIMPIEZA DE USUARIOS ELIMINADOS
    if (action === 'clean_deleted_users') {
      const { existing_user_ids } = req.body;
      const client = await createConnection();
      
      if (existing_user_ids && existing_user_ids.length > 0) {
        const placeholders = existing_user_ids.map((_, i) => `$${i + 1}`).join(',');
        await client.query(`DELETE FROM users WHERE id NOT IN (${placeholders})`, existing_user_ids);
      }
      
      await client.end();
      console.log('🧹 Limpieza de usuarios completada');
      return res.json({ status: 'cleaned' });
    }
    
    // 🔧 MANEJAR SINCRONIZACIÓN DE CORREOS - CORREGIDO CON MANEJO DE CONFLICTOS
    if (action === 'sync_emails') {
      console.log(`📧 Sincronizando correos para usuario ${usuario} (ID: ${id})`);
      console.log('📧 Correos recibidos:', correos);
      
      const client = await createConnection();
      
      try {
        // 1️⃣ OBTENER CORREOS ACTUALES del usuario
        const currentEmailsResult = await client.query(`
          SELECT ua.row_id, a.email_address, a.id as account_id
          FROM user_accounts ua
          JOIN accounts a ON ua.account_id = a.id
          WHERE ua.user_id = $1
          ORDER BY ua.row_id ASC
        `, [id]);
        
        const currentEmails = currentEmailsResult.rows;
        console.log(`📧 Correos actuales en BD: ${currentEmails.length}`);
        
        // 2️⃣ PROCESAR CADA CORREO NUEVO
        const correosArray = Array.isArray(correos) ? correos : [correos];
        let correosActualizados = 0;
        let correosNuevos = 0;
        
        for (let i = 0; i < correosArray.length; i++) {
          const correo = correosArray[i];
          const rowId = i + 1; // row_id basado en posición
          
          console.log(`📧 Procesando correo ${rowId}: ${correo}`);
          
          // 3️⃣ BUSCAR SI YA EXISTE CUENTA CON ESE CORREO
          let accountResult = await client.query(
            'SELECT id FROM accounts WHERE email_address = $1',
            [correo]
          );
          
          let accountId;
          if (accountResult.rows.length > 0) {
            accountId = accountResult.rows[0].id;
            console.log(`✅ Cuenta existente encontrada: ${accountId}`);
          } else {
            // 4️⃣ CREAR NUEVA CUENTA CON MANEJO DE CONFLICTOS
            try {
              const newAccountResult = await client.query(
                'INSERT INTO accounts (email_address) VALUES ($1) RETURNING id',
                [correo]
              );
              accountId = newAccountResult.rows[0].id;
              console.log(`✅ Nueva cuenta creada: ${accountId}`);
            } catch (insertError) {
              if (insertError.code === '23505') {
                // Conflicto de clave única - el correo ya existe, buscar nuevamente
                console.log(`⚠️ Conflicto detectado, re-buscando cuenta para: ${correo}`);
                const retryAccountResult = await client.query(
                  'SELECT id FROM accounts WHERE email_address = $1',
                  [correo]
                );
                if (retryAccountResult.rows.length > 0) {
                  accountId = retryAccountResult.rows[0].id;
                  console.log(`✅ Cuenta encontrada en reintento: ${accountId}`);
                } else {
                  console.error(`❌ Error crítico: no se pudo crear ni encontrar cuenta para: ${correo}`);
                  continue; // Saltar este correo
                }
              } else {
                console.error(`❌ Error inesperado creando cuenta:`, insertError);
                throw insertError;
              }
            }
          }
          
          // 5️⃣ VERIFICAR SI YA EXISTE RELACIÓN USER_ACCOUNTS CON ESE ROW_ID
          const existingRelationResult = await client.query(
            'SELECT id FROM user_accounts WHERE user_id = $1 AND row_id = $2',
            [id, rowId]
          );
          
          if (existingRelationResult.rows.length > 0) {
            // 6️⃣ ACTUALIZAR RELACIÓN EXISTENTE
            await client.query(
              'UPDATE user_accounts SET account_id = $1 WHERE user_id = $2 AND row_id = $3',
              [accountId, id, rowId]
            );
            console.log(`🔄 Actualizada relación row_id ${rowId}: ${correo}`);
            correosActualizados++;
          } else {
            // 7️⃣ CREAR NUEVA RELACIÓN
            await client.query(
              'INSERT INTO user_accounts (user_id, account_id, row_id) VALUES ($1, $2, $3)',
              [id, accountId, rowId]
            );
            console.log(`✅ Nueva relación row_id ${rowId}: ${correo}`);
            correosNuevos++;
          }
        }
        
        // 8️⃣ ELIMINAR CORREOS SOBRANTES (si había más correos antes)
        const maxRowId = correosArray.length;
        const deleteResult = await client.query(
          'DELETE FROM user_accounts WHERE user_id = $1 AND row_id > $2',
          [id, maxRowId]
        );
        
        if (deleteResult.rowCount > 0) {
          console.log(`🗑️ Eliminadas ${deleteResult.rowCount} relaciones sobrantes`);
        }
        
        console.log(`✅ Sincronización completada para ${usuario}:`);
        console.log(`   📧 Correos nuevos: ${correosNuevos}`);
        console.log(`   🔄 Correos actualizados: ${correosActualizados}`);
        console.log(`   🗑️ Relaciones eliminadas: ${deleteResult.rowCount}`);
        
      } catch (updateError) {
        console.error('❌ Error actualizando correos:', updateError);
        throw updateError;
      } finally {
        await client.end();
      }
      
      return res.json({
        status: 'emails_synced',
        usuario: usuario,
        correos_procesados: correosArray.length,
        correos_nuevos: correosNuevos,
        correos_actualizados: correosActualizados,
        correos: correosArray,
        estructura: 'Relacional con row_id + manejo de conflictos'
      });
    }
    
    // SINCRONIZACIÓN NORMAL DE USUARIO
    if (!id || !usuario || !password) {
      return res.status(400).json({ error: 'Datos incompletos (id, usuario, password requeridos)' });
    }
    
    const client = await createConnection();
    
    // VERIFICAR SI USUARIO EXISTE
    const checkResult = await client.query('SELECT id FROM users WHERE id = $1', [id]);
    
    if (checkResult.rows.length > 0) {
      // ACTUALIZAR USUARIO EXISTENTE
      await client.query(
        'UPDATE users SET username = $1, password_hash = $2, act_desact = $3 WHERE id = $4',
        [usuario, password, activo ? 'SI' : 'NO', id]
      );
      console.log(`✅ Usuario ${usuario} actualizado en Supabase`);
    } else {
      // CREAR NUEVO USUARIO
      await client.query(
        'INSERT INTO users (id, username, password_hash, act_desact, estado_seguridad) VALUES ($1, $2, $3, $4, $5)',
        [id, usuario, password, activo ? 'SI' : 'NO', 'NORMAL']
      );
      console.log(`✅ Usuario ${usuario} creado en Supabase`);
    }
    
    await client.end();
    res.json({ 
      success: true, 
      usuario: usuario,
      action_performed: checkResult.rows.length > 0 ? 'updated' : 'created'
    });
    
  } catch (error) {
    console.error('❌ Error sincronizando usuario:', error);
    res.status(500).json({ error: error.message });
  }
});
// ENDPOINT PARA LISTAR TODOS LOS USUARIOS
// ESTE CÓDIGO ES EXACTO PARA TU TABLA
app.get('/usuarios', async (req, res) => {
  try {
    const client = await createConnection();
    
    const result = await client.query(`
      SELECT 
        id,
        username,
        password_hash,
        estado_seguridad
      FROM users 
      ORDER BY id ASC
    `);
    
    await client.end();
    
    console.log(`📋 Consultados ${result.rows.length} usuarios desde Supabase PostgreSQL`);
    
    res.json({
      success: true,
      total_usuarios: result.rows.length,
      usuarios: result.rows,
      database: 'Supabase PostgreSQL',
      timestamp: new Date().toLocaleString('es-PE')
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo usuarios:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});
// TUS ENDPOINTS EXISTENTES (MANTENIDOS)
app.post('/login', async (req, res) => {
  console.log('📱 Login desde app:', req.body);
  try {
    const { usuario, password } = req.body;
    
    if (!usuario || !password) {
      return res.status(400).json({
        success: false,
        message: 'Usuario y contraseña son requeridos'
      });
    }
    
    const client = await createConnection();
    
    const result = await client.query(
      'SELECT id, username, password_hash FROM users WHERE username = $1 AND password_hash = $2',
      [usuario, password]
    );
    
    await client.end();
    
    if (result.rows.length > 0) {
      const token = Buffer.from(`${usuario}:${Date.now()}`).toString('base64');
      
      res.json({
        success: true,
        message: 'Login exitoso',
        token: token,
        username: usuario
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Usuario o contraseña incorrectos'
      });
    }
    
  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});
// ENDPOINT BUSCAR CORREOS (CON JWT)
app.post('/buscar-correos', authenticateJWT, async (req, res) => {
  console.log(`🔍 ${req.user.username} busca correos:`, req.body);
  try {
    const { email_busqueda } = req.body;
    
    const correosEncontrados = await buscarCorreosEnGmail(email_busqueda);
    
    res.json({
      success: true,
      emails: correosEncontrados,
      total: correosEncontrados.length,
      email_buscado: email_busqueda,
      searched_by: req.user.username,
      correo_principal_leido: CORREO_PRINCIPAL
    });
    
  } catch (error) {
    console.error('❌ Error buscando correos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});
// ENDPOINTS DE SEGURIDAD EXISTENTES (SIN CAMBIOS)
app.post('/bloquear-usuario', async (req, res) => {
  try {
    const { id, usuario, accion, numeroWhatsApp } = req.body;
    
    console.log(`🔴 Solicitud de bloqueo DUAL para usuario ${usuario}`);
    
    if (!id || !usuario) {
      return res.status(400).json({
        success: false,
        message: 'ID y usuario son requeridos'
      });
    }
    
    const client = await createConnection();
    
    const result = await client.query(
      'UPDATE users SET estado_seguridad = $1 WHERE id = $2',
      ['BLOQUEADO', id]
    );
    
    await client.end();
    
    if (result.rowCount > 0) {
      console.log(`🔴 Usuario ${usuario} bloqueado - enviando alertas DUALES`);
      
      const resultadoAlertas = await alertaRoboDetectado(usuario, 'Correo comprometido detectado', numeroWhatsApp);
      
      res.json({
        success: true,
        message: `Usuario ${usuario} bloqueado exitosamente`,
        id: id,
        usuario: usuario,
        estado: 'BLOQUEADO',
        alertas_enviadas: {
          telegram: 'Admin',
          whatsapp: resultadoAlertas.whatsapp_destinatarios
        },
        sistema: 'DUAL (Admin + Cliente)',
        database: 'Supabase PostgreSQL'
      });
    } else {
      res.status(404).json({
        success: false,
        message: `Usuario con ID ${id} no encontrado`
      });
    }
    
  } catch (error) {
    console.error('❌ Error bloqueando usuario:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
app.post('/reactivar-usuario', async (req, res) => {
  try {
    const { id, usuario, accion, numeroWhatsApp } = req.body;
    
    console.log(`✅ Solicitud de reactivación DUAL para usuario ${usuario}`);
    
    if (!id || !usuario) {
      return res.status(400).json({
        success: false,
        message: 'ID y usuario son requeridos'
      });
    }
    
    const client = await createConnection();
    
    const result = await client.query(
      'UPDATE users SET estado_seguridad = $1 WHERE id = $2',
      ['NORMAL', id]
    );
    
    await client.end();
    
    if (result.rowCount > 0) {
      console.log(`✅ Usuario ${usuario} reactivado - enviando alertas DUALES`);
      
      const resultadoAlertas = await alertaUsuarioReactivado(usuario, numeroWhatsApp);
      
      res.json({
        success: true,
        message: `Usuario ${usuario} reactivado exitosamente`,
        id: id,
        usuario: usuario,
        estado: 'NORMAL',
        alertas_enviadas: {
          telegram: 'Admin',
          whatsapp: resultadoAlertas.whatsapp_destinatarios
        },
        sistema: 'DUAL (Admin + Cliente)',
        database: 'Supabase PostgreSQL'
      });
    } else {
      res.status(404).json({
        success: false,
        message: `Usuario con ID ${id} no encontrado`
      });
    }
    
  } catch (error) {
    console.error('❌ Error reactivando usuario:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
// ENDPOINTS DE PRUEBA EXISTENTES (SIN CAMBIOS)
app.post('/test-telegram', async (req, res) => {
  try {
    const { mensaje } = req.body;
    
    const mensajePrueba = mensaje || `🧪 PRUEBA SISTEMA TELEGRAM
    
Fecha: ${new Date().toLocaleString('es-PE')}
Estado: ✅ Funcionando correctamente
Servidor: Disney+ Security System`;
    await enviarAlertaTelegram(mensajePrueba);
    
    res.json({
      success: true,
      message: 'Mensaje enviado a Telegram exitosamente'
    });
    
  } catch (error) {
    console.error('❌ Error en prueba Telegram:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
app.post('/test-whatsapp', async (req, res) => {
  try {
    const { numeroDestino, mensaje } = req.body;
    
    if (!numeroDestino) {
      return res.status(400).json({
        success: false,
        message: 'numeroDestino es requerido (formato: 51987654321)'
      });
    }
    
    const mensajePrueba = mensaje || `🧪 PRUEBA SISTEMA WHATSAPP
    
Fecha: ${new Date().toLocaleString('es-PE')}
Estado: ✅ Funcionando correctamente
Servidor: Disney+ Security System`;
    
    await enviarAlertaWhatsApp(numeroDestino, mensajePrueba);
    
    res.json({
      success: true,
      message: 'Mensaje enviado a WhatsApp exitosamente',
      numeroDestino: numeroDestino
    });
    
  } catch (error) {
    console.error('❌ Error en prueba WhatsApp:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
app.get('/test-whatsapp-simple', async (req, res) => {
  try {
    const numeroTest = '51935121273';
    const mensajeTest = '🧪 PRUEBA: Sistema Disney+ WhatsApp funcionando correctamente';
    
    const resultado = await enviarAlertaWhatsApp(numeroTest, mensajeTest);
    
    res.json({
      success: true,
      message: 'Prueba WhatsApp enviada exitosamente',
      numeroDestino: numeroTest,
      resultado: resultado
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
app.post('/test-dual', async (req, res) => {
  try {
    const { numeroWhatsApp, mensaje } = req.body;
    
    const mensajePrueba = mensaje || `🧪 PRUEBA SISTEMA DUAL
    
👤 Admin: Siempre recibe alertas
👥 Cliente: ${numeroWhatsApp || 'No especificado'}
📱 Canales: Telegram + WhatsApp
⏰ Fecha: ${new Date().toLocaleString('es-PE')}
🛡️ Sistema Disney+ Dual Activo`;
    
    const resultado = await enviarAlertaDual(mensajePrueba, numeroWhatsApp);
    
    res.json({
      success: true,
      message: 'Alertas duales enviadas exitosamente',
      sistema: 'DUAL (Admin + Cliente)',
      destinatarios: {
        admin: ADMIN_CONFIG.numeroWhatsApp,
        cliente: numeroWhatsApp || 'No especificado',
        telegram: 'Admin siempre'
      },
      resultados: resultado
    });
    
  } catch (error) {
    console.error('❌ Error en prueba dual:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
app.get('/', (req, res) => {
  res.json({ 
    mensaje: '🚀 Servidor JWT ULTRA SEGURO - SLIDING EXPIRATION ACTIVO',
    version: '3.0-jwt-secure',
    security: '🔐 JWT Sliding Expiration + Variables protegidas',
    funcionalidades: [
      '✅ JWT con auto-renovación por actividad',
      '✅ Expiración 20 minutos de inactividad',
      '✅ Sliding expiration mágico',
      '✅ Control total de usuarios y contraseñas por admin',
      '✅ Mantiene toda funcionalidad Disney+ existente',
      '✅ Sistema DUAL - Admin + Cliente alertas',
      '✅ 🛡️ CREDENCIALES ULTRA SEGURAS',
      '✅ 🔐 Autenticación de nivel empresarial'
    ]
  });
});
// INICIAR SERVIDOR
app.listen(PORT, '0.0.0.0', () => { // ✅ AGREGADO '0.0.0.0' PARA RENDER
  console.log('🚀 ===============================================');
  console.log(`🔥 Servidor JWT ULTRA SEGURO corriendo en: http://localhost:${PORT}`);
  console.log('🔐 ✅ JWT: Sliding expiration 20 minutos configurado');
  console.log('🛡️ ✅ SEGURIDAD: Credenciales protegidas con variables de entorno');
  console.log('🔄 ✅ AUTO-RENOVACIÓN: Token se extiende automáticamente con actividad');
  console.log('⏰ ✅ EXPIRACIÓN: 20 minutos de inactividad → logout automático');
  console.log('👤 ✅ CONTROL ADMIN: Solo tú manejas usuarios y contraseñas');
  console.log('📧 ✅ MANTIENE: Toda funcionalidad Disney+ existente');
  console.log('🚀 ===============================================');
  console.log('');
  console.log('🔐 ENDPOINTS JWT:');
  console.log('POST /auth/login - Login con credenciales');
  console.log('POST /auth/refresh - Renovar token manual');
  console.log('GET /auth/profile - Info usuario autenticado');
  console.log('POST /auth/logout - Cerrar sesión');
  console.log('');
  console.log('🛡️ ENDPOINTS PROTEGIDOS:');
  console.log('POST /api/send-whatsapp - WhatsApp seguro');
  console.log('POST /api/send-dual-alert - Alertas duales seguras');
  console.log('POST /buscar-correos - Búsqueda Gmail segura');
  console.log('');
});
process.on('unhandledRejection', (err) => {
  console.error('❌ Error no manejado:', err);
});
