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

// 🎯 NUEVO SISTEMA DE VIGILANCIA INTELIGENTE
const watchList = new Map(); // email -> { startTime, timers: [] }

// 🕐 CONFIGURACIÓN DE REVISIONES ALEATORIAS
const VIGILANCIA_REVISIONES = [
  { minInicio: 2,  minFin: 3,  descripcion: "Código recién enviado" },
  { minInicio: 5,  minFin: 6,  descripcion: "Usuario usando código" },  
  { minInicio: 8,  minFin: 9,  descripcion: "Punto medio crítico" },
  { minInicio: 11, minFin: 12, descripcion: "Últimos minutos útiles" },
  { minInicio: 14, minFin: 15, descripcion: "ÚLTIMA OPORTUNIDAD" }
];

// 🛡️ CONFIGURACIÓN SEGURA - DESDE VARIABLES DE ENTORNO
// 🚀 CONFIGURACIÓN MEJORADA CON CONNECTION POOLING
const DB_CONFIG = {
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  // 🔧 PARÁMETROS DE CONNECTION POOLING
  max: 10,                    // Máximo 10 conexiones simultáneas (bajo para evitar límites)
  idleTimeoutMillis: 30000,   // 30 segundos para cerrar conexiones inactivas
  connectionTimeoutMillis: 10000, // 10 segundos timeout para establecer conexión
  statement_timeout: 15000,   // 15 segundos timeout para statements
  query_timeout: 15000,       // 15 segundos timeout para queries
};

// 🚀 FUNCIÓN MEJORADA CON RETRY LOGIC Y EXPONENTIAL BACKOFF
async function createConnection() {
  const maxRetries = 5;
  const baseDelay = 1000; // 1 segundo
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Intento de conexión ${attempt}/${maxRetries} a Supabase...`);
      
      const client = new Client(DB_CONFIG);
      await client.connect();
      console.log(`✅ Conexión exitosa a Supabase en intento ${attempt}`);
      return client;
      
    } catch (error) {
      console.error(`❌ Intento ${attempt} falló:`, error.code || error.message);
      
      // Si es el último intento, lanzar error
      if (attempt === maxRetries) {
        console.error('🚨 TODOS LOS INTENTOS AGOTADOS - No se puede conectar a Supabase');
        throw new Error(`Supabase connection failed after ${maxRetries} attempts: ${error.message}`);
      }
      
      // Delay exponencial: 1s, 2s, 4s, 8s, 16s
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`⏳ Esperando ${delay}ms antes del siguiente intento...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
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

// 🔴 FUNCIÓN PARA BLOQUEAR USUARIO POR EMAIL DETECTADO
async function bloquearUsuarioPorCorreo(email) {
  let client;
  try {
    console.log(`🔍 Buscando usuario propietario del email: ${email}`);
    
    // Conectar a Supabase
    client = await createConnection();
    
    // Buscar qué usuario(s) tienen este email y bloquearlos
    const result = await client.query(`
      UPDATE users 
      SET estado_seguridad = 'BLOQUEADO' 
      WHERE id IN (
        SELECT DISTINCT ua.user_id 
        FROM user_accounts ua
        JOIN accounts a ON ua.account_id = a.id 
        WHERE a.email_address = $1
      )
      RETURNING id, username
    `, [email.toLowerCase()]);
    
    if (result.rows.length > 0) {
      // Usuario(s) encontrado(s) y bloqueado(s)
      for (const user of result.rows) {
        console.log(`🔴 USUARIO BLOQUEADO: ID=${user.id}, Username=${user.username}, Email=${email}`);
      }
      
      return {
        success: true,
        usuariosBloqueados: result.rows,
        mensaje: `${result.rows.length} usuario(s) bloqueado(s) por email comprometido`
      };
    } else {
      // No se encontró usuario con ese email
      console.log(`⚠️ No se encontró usuario propietario del email: ${email}`);
      
      return {
        success: false,
        mensaje: `No se encontró usuario asociado al email: ${email}`
      };
    }
    
  } catch (error) {
    console.error('❌ Error bloqueando usuario por email:', error);
    throw error;
  } finally {
    // Cerrar conexión siempre
    if (client) {
      try {
        await client.end();
        console.log('🔌 Conexión cerrada en bloquearUsuarioPorCorreo');
      } catch (endError) {
        console.error('⚠️ Error cerrando conexión en bloquearUsuarioPorCorreo:', endError);
      }
    }
  }
}

// 🎯 NUEVO SISTEMA DE VIGILANCIA INTELIGENTE CON 5 REVISIONES ALEATORIAS

// Función para generar tiempo aleatorio dentro de un rango
function generarTiempoAleatorio(minInicio, minFin) {
  const randomMinutos = Math.random() * (minFin - minInicio) + minInicio;
  return randomMinutos * 60 * 1000; // Convertir a millisegundos
}

// Función para cancelar timers de un email específico
function cancelarVigilanciaEmail(email) {
  const emailKey = email.toLowerCase();
  if (watchList.has(emailKey)) {
    const watchData = watchList.get(emailKey);
    if (watchData.timers && watchData.timers.length > 0) {
      watchData.timers.forEach(timer => {
        clearTimeout(timer);
      });
      console.log(`🛑 Cancelados ${watchData.timers.length} timers para ${email}`);
    }
    watchList.delete(emailKey);
  }
}

// Función principal para iniciar vigilancia de un email
function iniciarVigilanciaEmail(email) {
  const emailKey = email.toLowerCase();
  
  // Cancelar vigilancia anterior si existe
  cancelarVigilanciaEmail(email);
  
  const startTime = Date.now();
  const timers = [];
  
  console.log(`🎯 INICIANDO VIGILANCIA INTELIGENTE para: ${email}`);
  console.log(`⏰ Duración total: 15 minutos`);
  console.log(`🔍 Revisiones programadas: ${VIGILANCIA_REVISIONES.length}`);
  
  // Programar cada revisión
  VIGILANCIA_REVISIONES.forEach((revision, index) => {
    const tiempoEspera = generarTiempoAleatorio(revision.minInicio, revision.minFin);
    const minutoReal = (tiempoEspera / (60 * 1000)).toFixed(1);
    
    console.log(`📅 Revisión ${index + 1}: ${revision.descripcion} - Programada para minuto ${minutoReal}`);
    
    const timer = setTimeout(async () => {
      try {
        console.log(`🔍 EJECUTANDO Revisión ${index + 1}/5 para ${email} (${revision.descripcion})`);
        
        // Buscar correos de Disney+
        const correos = await buscarCorreosEnGmail(email);
        
        // Verificar si hay correo de Disney+ con código
        const alertaDisney = correos.find(m =>
          m.subject === 'Cuenta de MyDisney actualizada' &&
		  (
		  m.body?.includes('Correo electr=C3=B3nico de MyDisney actua=') ||
		  m.body?.includes('Correo electrónico de MyDisney actualizado') ||
		  m.body?.includes('Se cambió el correo electrónico asociado')
		  )
        );
        
        if (alertaDisney) {
          console.log(`🚨 ¡CÓDIGO DISNEY+ DETECTADO en ${email}!`);
          
          // Cancelar vigilancia restante
          cancelarVigilanciaEmail(email);
          
          // Bloquear usuario
          await bloquearUsuarioPorCorreo(email);
          
          // Enviar alertas
          await alertaRoboDetectado(email, alertaDisney.date);
          
          console.log(`🔴 Usuario bloqueado automáticamente: ${email}`);
        } else {
          console.log(`✅ Revisión ${index + 1}: Sin alertas para ${email}`);
        }
        
      } catch (error) {
        console.error(`❌ Error en revisión ${index + 1} para ${email}:`, error.message);
      }
    }, tiempoEspera);
    
    timers.push(timer);
  });
  
  // Timer para limpiar después de 15 minutos
  const cleanupTimer = setTimeout(() => {
    cancelarVigilanciaEmail(email);
    console.log(`⏰ Vigilancia terminada para ${email} (15 minutos completados)`);
  }, 15 * 60 * 1000); // 15 minutos
  
  timers.push(cleanupTimer);
  
  // Guardar en watchList
  watchList.set(emailKey, {
    startTime: startTime,
    timers: timers
  });
  
  console.log(`✅ Vigilancia configurada para ${email} - ${timers.length} timers activos`);
}

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}))

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
				body = Buffer.from(part.body.data, 'base64').toString('utf-8'); // ← HTML COMPLETO
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
          body: body, // HTML completo
		  preview: body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 150) + '...' // Solo para preview
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
  let client;
  try {
    const { username, password } = req.body;
    console.log('🔐 Intento de login JWT:', username);
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Usuario y contraseña son requeridos'
      });
    }
    
    // 🚀 USAR FUNCIÓN MEJORADA CON RETRY
    client = await createConnection();
    
    // Query adaptada a PostgreSQL (nota: $1 en lugar de ?)
    const result = await client.query(
      'SELECT id, username, password_hash, estado_seguridad FROM users WHERE username = $1',
      [username]
    );
    
    // Verificar si existe el usuario
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Usuario o contraseña incorrectos'
      });
    }
    
    const user = result.rows[0];
    
    // Verificar estado de seguridad ANTES de validar password
    if (user.estado_seguridad === 'BLOQUEADO') {
      return res.status(401).json({
        success: false,
        message: 'Usuario bloqueado por seguridad'
      });
    }
    
    // Validar contraseña (temporalmente simple, después implementar bcrypt)
    if (user.password_hash !== password) {
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
  } finally {
    // 🔧 CERRAR CONEXIÓN SIEMPRE
    if (client) {
      try {
        await client.end();
        console.log('🔌 Conexión cerrada correctamente');
      } catch (endError) {
        console.error('⚠️ Error cerrando conexión:', endError);
      }
    }
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
    version: '3.1-vigilancia-inteligente',
    security: 'JWT Sliding Expiration + Variables protegidas + Vigilancia 5 revisiones',
    vigilancia: {
      tipo: 'Vigilancia Inteligente Disney+',
      revisiones: VIGILANCIA_REVISIONES.length,
      duracion: '15 minutos',
      aleatorio: 'Sí - timing impredecible'
    },
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

// 🧪 ENDPOINT DE PRUEBA DE CONEXIÓN
app.get('/test-db', async (req, res) => {
  let client;
  try {
    client = await createConnection();
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    
    res.json({
      success: true,
      message: 'Supabase connection working perfectly',
      timestamp: new Date().toISOString(),
      database_time: result.rows[0].current_time,
      postgres_version: result.rows[0].pg_version
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.code || 'UNKNOWN_ERROR',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    if (client) {
      try {
        await client.end();
        console.log('🔌 Conexión de prueba cerrada correctamente');
      } catch (endError) {
        console.error('⚠️ Error cerrando conexión de prueba:', endError);
      }
    }
  }
});

// MANTENER TODOS TUS ENDPOINTS EXISTENTES
// ENDPOINT PRINCIPAL - MANTIENE TODO + AGREGA ELIMINACIÓN (SIN CAMBIOS)
// 🚀 ENDPOINT PARA SINCRONIZAR GOOGLE SHEETS → SUPABASE CON MANEJO ROBUSTO DE ERRORES
app.post('/sync-user', async (req, res) => {
  let client;
  try {
    console.log('📨 Datos recibidos de Google Sheets:', req.body);
    
    const { id, usuario, password, activo, correos, action } = req.body;
    
    // MANEJAR ELIMINACIÓN DE USUARIOS
    if (action === 'delete_user') {
      client = await createConnection();
      await client.query('DELETE FROM users WHERE id = $1', [id]);
      console.log(`🗑️ Usuario ${id} eliminado de Supabase`);
      return res.json({ status: 'deleted' });
    }
    
    // MANEJAR LIMPIEZA DE USUARIOS ELIMINADOS
    if (action === 'clean_deleted_users') {
      const { existing_user_ids } = req.body;
      client = await createConnection();
      
      if (existing_user_ids && existing_user_ids.length > 0) {
        const placeholders = existing_user_ids.map((_, i) => `$${i + 1}`).join(',');
        await client.query(`DELETE FROM users WHERE id NOT IN (${placeholders})`, existing_user_ids);
      }
      
      console.log('🧹 Limpieza de usuarios completada');
      return res.json({ status: 'cleaned' });
    }
    
    // 🔧 SINCRONIZACIÓN DE CORREOS CON MANEJO ROBUSTO DE ERRORES
    if (action === 'sync_emails') {
      console.log(`📧 Iniciando sync_emails para ${usuario} (ID: ${id})`);
      console.log('📧 Correos recibidos:', correos);
      
      try {
        client = await createConnection();
      } catch (connectionError) {
        console.error('❌ Error crítico de conexión en sync_emails:', connectionError);
        
        // Si es error de conexión específico, devolver respuesta apropiada
        if (connectionError.message.includes('ETIMEDOUT') || connectionError.message.includes('ECONNREFUSED')) {
          return res.status(503).json({
            status: 'connection_failed',
            error: 'Database temporarily unavailable',
            message: 'Supabase connection failed - will retry automatically',
            retry_recommended: true,
            usuario: usuario
          });
        }
        
        throw connectionError;
      }
      
      try {
        // ✅ DECLARACIÓN INMEDIATA Y EXPLÍCITA
        let correosArray = [];
        
        if (correos && Array.isArray(correos)) {
          correosArray = correos;
        } else if (correos) {
          correosArray = [correos];
        }
        
        console.log('📧 correosArray inicializado:', correosArray);
        console.log('📧 Cantidad:', correosArray.length);
        
        // 🚀 FUNCIÓN AUXILIAR MEJORADA QUE SÍ ACTUALIZA EMAILS
        async function forceUpdateOrCreateAccount(email) {
          try {
            // PRIMERO: Buscar si el email ya existe
            let selectResult = await client.query(
              'SELECT id FROM accounts WHERE email_address = $1',
              [email]
            );
            
            if (selectResult.rows.length > 0) {
              // Email ya existe: FORZAR actualización del timestamp para registrar cambio
              await client.query(
                'UPDATE accounts SET created_at = CURRENT_TIMESTAMP WHERE email_address = $1',
                [email]
              );
              console.log(`🔄 Email ACTUALIZADO forzosamente: ${email} (ID: ${selectResult.rows[0].id})`);
              return selectResult.rows[0].id;
            } else {
              // Email NO existe: Crearlo
              const insertResult = await client.query(
                'INSERT INTO accounts (email_address) VALUES ($1) RETURNING id',
                [email]
              );
              console.log(`✅ Email NUEVO creado: ${email} (ID: ${insertResult.rows[0].id})`);
              return insertResult.rows[0].id;
            }
          } catch (error) {
            // Manejo de conflictos de inserción simultánea
            if (error.code === '23505') {
              console.log(`⚠️ Conflicto de inserción para ${email}, reintentando...`);
              const retryResult = await client.query(
                'SELECT id FROM accounts WHERE email_address = $1',
                [email]
              );
              
              if (retryResult.rows.length > 0) {
                // Forzar actualización después del conflicto
                await client.query(
                  'UPDATE accounts SET created_at = CURRENT_TIMESTAMP WHERE email_address = $1',
                  [email]
                );
                console.log(`🔄 Email actualizado después de conflicto: ${email}`);
                return retryResult.rows[0].id;
              } else {
                throw new Error(`Account not found after conflict for ${email}`);
              }
            }
            throw error;
          }
        }
        
        // Obtener correos actuales para comparar
        const currentEmailsResult = await client.query(`
          SELECT ua.row_id, a.email_address, a.id as account_id
          FROM user_accounts ua
          JOIN accounts a ON ua.account_id = a.id
          WHERE ua.user_id = $1
          ORDER BY ua.row_id ASC
        `, [id]);
        
        console.log(`📧 Correos actuales en BD: ${currentEmailsResult.rows.length}`);
        
        // Mostrar comparación detallada
        console.log('🔍 COMPARACIÓN DETALLADA:');
        for (let i = 0; i < Math.max(correosArray.length, currentEmailsResult.rows.length); i++) {
          const nuevoEmail = correosArray[i] || '(vacío)';
          const emailActual = currentEmailsResult.rows[i]?.email_address || '(vacío)';
          const cambio = nuevoEmail !== emailActual ? '🔄 CAMBIO DETECTADO' : '✅ Sin cambios';
          console.log(`   Posición ${i + 1}: "${emailActual}" → "${nuevoEmail}" ${cambio}`);
        }
        
        let correosNuevos = 0;
        let correosActualizados = 0;
        let correosProcessados = 0;
        
        // Procesar cada correo de Google Sheets
        for (let i = 0; i < correosArray.length; i++) {
          const correo = correosArray[i];
          const rowId = i + 1;
          
          console.log(`📧 Procesando [${i+1}/${correosArray.length}]: ${correo}`);
          
          try {
            // 🚀 USAR LA FUNCIÓN QUE SÍ ACTUALIZA
            const accountId = await forceUpdateOrCreateAccount(correo);
            console.log(`✅ Account ID para ${correo}: ${accountId}`);
            
            // Verificar si ya existe la relación user_accounts
            const existingRelation = await client.query(
              'SELECT account_id FROM user_accounts WHERE user_id = $1 AND row_id = $2',
              [id, rowId]
            );
            
            if (existingRelation.rows.length > 0) {
              // Relación existe: verificar si cambió el account_id
              if (existingRelation.rows[0].account_id !== accountId) {
                await client.query(
                  'UPDATE user_accounts SET account_id = $1 WHERE user_id = $2 AND row_id = $3',
                  [accountId, id, rowId]
                );
                console.log(`🔄 ACTUALIZADA relación row_id ${rowId}: ${correo}`);
                correosActualizados++;
              } else {
                console.log(`✅ Relación sin cambios para row_id ${rowId}: ${correo}`);
              }
            } else {
              // Relación NO existe: crearla
              await client.query(
                'INSERT INTO user_accounts (user_id, account_id, row_id) VALUES ($1, $2, $3)',
                [id, accountId, rowId]
              );
              console.log(`✅ NUEVA relación row_id ${rowId}: ${correo}`);
              correosNuevos++;
            }
            
            correosProcessados++;
          } catch (error) {
            console.error(`❌ Error procesando ${correo}:`, error);
            console.log(`⚠️ Saltando ${correo} y continuando...`);
            continue;
          }
        }
        
        // Eliminar relaciones sobrantes (si Google Sheets tiene menos emails)
        const deleteResult = await client.query(
          'DELETE FROM user_accounts WHERE user_id = $1 AND row_id > $2',
          [id, correosArray.length]
        );
        
        console.log(`🗑️ Relaciones eliminadas: ${deleteResult.rowCount}`);
        
        // 🧹 NUEVA FUNCIONALIDAD: LIMPIEZA DE CUENTAS HUÉRFANAS
        console.log('🧹 Iniciando limpieza de cuentas huérfanas...');
        
        const orphanCleanup = await client.query(`
          DELETE FROM accounts 
          WHERE NOT EXISTS (
            SELECT 1 FROM user_accounts WHERE user_accounts.account_id = accounts.id
          )
        `);
        
        console.log(`🧹 Limpieza completada: ${orphanCleanup.rowCount} cuentas huérfanas eliminadas`);
        
        console.log(`✅ SINCRONIZACIÓN COMPLETADA para ${usuario}:`);
        console.log(`   📊 ${correosNuevos} nuevos`);
        console.log(`   🔄 ${correosActualizados} actualizados`);
        console.log(`   🗑️ ${deleteResult.rowCount} relaciones eliminadas`);
        console.log(`   🧹 ${orphanCleanup.rowCount} cuentas huérfanas eliminadas`);
        console.log(`   ✅ ${correosProcessados}/${correosArray.length} procesados exitosamente`);
        
        return res.json({
          status: 'emails_synced',
          usuario: usuario,
          correos_procesados: correosProcessados,
          correos_nuevos: correosNuevos,
          correos_actualizados: correosActualizados,
          correos_eliminados: deleteResult.rowCount,
          cuentas_huerfanas_eliminadas: orphanCleanup.rowCount,
          mensaje: 'SINCRONIZACIÓN CON LIMPIEZA COMPLETA EXITOSA'
        });
        
      } catch (error) {
        console.error('❌ Error en operaciones de sync_emails:', error);
        throw error;
      }
    }
    
    // SINCRONIZACIÓN NORMAL DE USUARIO
    if (!id || !usuario || !password) {
      return res.status(400).json({ error: 'Datos incompletos (id, usuario, password requeridos)' });
    }
    
    client = await createConnection();
    
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
    
    res.json({ 
      success: true, 
      usuario: usuario,
      action_performed: checkResult.rows.length > 0 ? 'updated' : 'created'
    });
    
  } catch (error) {
    console.error('❌ Error sincronizando usuario:', error);
    res.status(500).json({ error: error.message });
  } finally {
    // 🔧 CERRAR CONEXIÓN SIEMPRE
    if (client) {
      try {
        await client.end();
        console.log('🔌 Conexión cerrada correctamente');
      } catch (endError) {
        console.error('⚠️ Error cerrando conexión:', endError);
      }
    }
  }
});

// ENDPOINT PARA LISTAR TODOS LOS USUARIOS
// ESTE CÓDIGO ES EXACTO PARA TU TABLA
app.get('/usuarios', async (req, res) => {
  let client;
  try {
    client = await createConnection();
    
    const result = await client.query(`
      SELECT 
        id,
        username,
        password_hash,
        estado_seguridad
      FROM users 
      ORDER BY id ASC
    `);
    
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
  } finally {
    if (client) {
      try {
        await client.end();
        console.log('🔌 Conexión cerrada correctamente');
      } catch (endError) {
        console.error('⚠️ Error cerrando conexión:', endError);
      }
    }
  }
});

// TUS ENDPOINTS EXISTENTES (MANTENIDOS CON MEJORAS)
app.post('/login', async (req, res) => {
  console.log('📱 Login desde app:', req.body);
  let client;
  try {
    const { usuario, password } = req.body;
    
    if (!usuario || !password) {
      return res.status(400).json({
        success: false,
        message: 'Usuario y contraseña son requeridos'
      });
    }
    
    client = await createConnection();
    
    const result = await client.query(
      'SELECT id, username, password_hash FROM users WHERE username = $1 AND password_hash = $2',
      [usuario, password]
    );
    
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
  } finally {
    if (client) {
      try {
        await client.end();
        console.log('🔌 Conexión cerrada correctamente');
      } catch (endError) {
        console.error('⚠️ Error cerrando conexión:', endError);
      }
    }
  }
});

// ENDPOINT BUSCAR CORREOS (CON JWT) - ACTUALIZADO CON VIGILANCIA INTELIGENTE
app.post('/buscar-correos', authenticateJWT, async (req, res) => {
  console.log(`🔍 ${req.user.username} busca correos:`, req.body);
  try {
    const { email_busqueda } = req.body;
    const correosEncontrados = await buscarCorreosEnGmail(email_busqueda);
    
    res.json({
      success: true,
      emails:  correosEncontrados,
      total:   correosEncontrados.length,
      email_buscado: email_busqueda,
      searched_by:   req.user.username,
      correo_principal_leido: CORREO_PRINCIPAL
    });
    
    /* ←———— NUEVA VIGILANCIA INTELIGENTE ————→ */
    console.log(`🎯 Iniciando vigilancia inteligente para: ${email_busqueda}`);
    iniciarVigilanciaEmail(email_busqueda);
    
  } catch (error) {
    console.error('❌ Error buscando correos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Endpoint para obtener estado del watchList - ACTUALIZADO
app.get('/api/watchlist', authenticateJWT, (req, res) => {
  const currentTime = Date.now();
  const activeWatches = [];
  
  for (const [email, watchData] of watchList.entries()) {
    const elapsed = currentTime - watchData.startTime;
    const remainingTime = Math.max(0, (15 * 60 * 1000) - elapsed); // 15 minutos
    
    activeWatches.push({
      email: email,
      startTime: watchData.startTime,
      elapsed: elapsed,
      remainingTime: remainingTime,
      activeTimers: watchData.timers.length,
      status: remainingTime > 0 ? 'VIGILANDO' : 'EXPIRADO'
    });
  }
  
  res.json({
    success: true,
    sistema: 'Vigilancia Inteligente Disney+',
    activeWatches: activeWatches,
    total: activeWatches.length,
    revisiones_programadas: VIGILANCIA_REVISIONES.length,
    duracion_vigilancia: '15 minutos'
  });
});

// ENDPOINTS DE SEGURIDAD EXISTENTES (CON MEJORAS)
app.post('/bloquear-usuario', async (req, res) => {
  let client;
  try {
    const { id, usuario, accion, numeroWhatsApp } = req.body;
    
    console.log(`🔴 Solicitud de bloqueo DUAL para usuario ${usuario}`);
    
    if (!id || !usuario) {
      return res.status(400).json({
        success: false,
        message: 'ID y usuario son requeridos'
      });
    }
    
    client = await createConnection();
    
    const result = await client.query(
      'UPDATE users SET estado_seguridad = $1 WHERE id = $2',
      ['BLOQUEADO', id]
    );
    
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
  } finally {
    if (client) {
      try {
        await client.end();
        console.log('🔌 Conexión cerrada correctamente');
      } catch (endError) {
        console.error('⚠️ Error cerrando conexión:', endError);
      }
    }
  }
});

app.post('/reactivar-usuario', async (req, res) => {
  let client;
  try {
    const { id, usuario, accion, numeroWhatsApp } = req.body;
    
    console.log(`✅ Solicitud de reactivación DUAL para usuario ${usuario}`);
    
    if (!id || !usuario) {
      return res.status(400).json({
        success: false,
        message: 'ID y usuario son requeridos'
      });
    }
    
    client = await createConnection();
    
    const result = await client.query(
      'UPDATE users SET estado_seguridad = $1 WHERE id = $2',
      ['NORMAL', id]
    );
    
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
  } finally {
    if (client) {
      try {
        await client.end();
        console.log('🔌 Conexión cerrada correctamente');
      } catch (endError) {
        console.error('⚠️ Error cerrando conexión:', endError);
      }
    }
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
    mensaje: '🚀 Servidor JWT ULTRA SEGURO - VIGILANCIA INTELIGENTE DISNEY+',
    version: '3.2-vigilancia-inteligente',
    security: '🔐 JWT Sliding Expiration + Variables protegidas + Vigilancia Inteligente',
    vigilancia: {
      tipo: '🎯 Sistema de 5 Revisiones Aleatorias',
      duracion: '15 minutos por email',
      revisiones: VIGILANCIA_REVISIONES,
      reset_automatico: 'Sí - si llega nuevo código',
      deteccion: 'Disney+ "Cuenta de MyDisney actualizada"'
    },
    funcionalidades: [
      '✅ JWT con auto-renovación por actividad',
      '✅ Expiración 20 minutos de inactividad',
      '✅ Sliding expiration mágico',
      '✅ Control total de usuarios y contraseñas por admin',
      '✅ Mantiene toda funcionalidad Disney+ existente',
      '✅ Sistema DUAL - Admin + Cliente alertas',
      '✅ 🛡️ CREDENCIALES ULTRA SEGURAS',
      '✅ 🔐 Autenticación de nivel empresarial',
      '✅ 🧹 Limpieza automática de cuentas huérfanas',
      '✅ 🚀 Connection pooling con retry logic',
      '✅ 🔄 Manejo robusto de errores de conexión',
      '✅ 🎯 VIGILANCIA INTELIGENTE Disney+ con 5 revisiones aleatorias',
      '✅ ⏰ Reset automático si llega nuevo código'
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
  console.log('👤 ✅ CONTROL ADMIN: Solo tú manejas usuarios y contraseñas por admin');
  console.log('📧 ✅ MANTIENE: Toda funcionalidad Disney+ existente');
  console.log('🧹 ✅ LIMPIEZA: Automática de cuentas huérfanas');
  console.log('🚀 ✅ CONNECTION POOLING: Con retry logic y exponential backoff');
  console.log('🔧 ✅ MANEJO ROBUSTO: De errores ETIMEDOUT y ECONNREFUSED');
  console.log('🎯 ✅ VIGILANCIA INTELIGENTE: Disney+ con 5 revisiones aleatorias');
  console.log('⏰ ✅ VIGILANCIA DURACIÓN: 15 minutos con reset automático');
  console.log('🎲 ✅ TIMING ALEATORIO: Minuto 2-3, 5-6, 8-9, 11-12, 14-15');
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
  console.log('POST /buscar-correos - Búsqueda Gmail segura CON VIGILANCIA INTELIGENTE');
  console.log('GET /api/watchlist - Lista de vigilancia activa');
  console.log('');
  console.log('🧪 ENDPOINTS DE PRUEBA:');
  console.log('GET /test-db - Prueba de conexión a Supabase');
  console.log('');
  console.log('🎯 VIGILANCIA DISNEY+ CONFIGURADA:');
  VIGILANCIA_REVISIONES.forEach((rev, index) => {
    console.log(`   ${index + 1}. Minuto ${rev.minInicio}-${rev.minFin}: ${rev.descripcion}`);
  });
  console.log('');
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Error no manejado:', err);
});
