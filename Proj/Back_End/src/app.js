const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

let morgan;
try {
  morgan = require('morgan');
} catch (e) {
  if (process.env.NODE_ENV !== 'production') {
    console.log('⚠️ Morgan não instalado - logging desabilitado');
  }
}

const routes = require('./routes');
const app = express();

const isProduction = process.env.NODE_ENV === 'production';
const BACKEND_ROOT = path.join(__dirname, '..');

// Middlewares
app.use(compression());
if (morgan) {
  if (process.env.LOG_LEVEL === 'debug') app.use(morgan('dev'));
  else if (!isProduction) app.use(morgan('tiny'));
}

const corsOptions = {
  origin: isProduction ? (process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000']) : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Helmet com CSP desativada (para permitir iframes e estilos inline)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { erro: 'Muitas requisições. Tente novamente mais tarde.', tentar_novamente_em: '15 minutos' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { erro: 'Muitas tentativas. Tente novamente em 15 minutos.' }
});
app.use('/api', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');   // permite iframes da mesma origem
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// ==================== ARQUIVOS ESTÁTICOS ====================
const uploadsDir = path.join(BACKEND_ROOT, 'uploads');
const produtosDir = path.join(uploadsDir, 'produtos');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(produtosDir)) fs.mkdirSync(produtosDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

const frontendPath = path.join(__dirname, '../../Front_End');
if (fs.existsSync(frontendPath)) {
  // Servir toda a pasta Front_End (inclui Telas/, imagens/, posters/)
  app.use(express.static(frontendPath));
  
  // Para que a página inicial (raiz) consiga carregar CSS/JS que estão dentro de Telas/TelaPrincipal
  app.use(express.static(path.join(frontendPath, 'Telas/TelaPrincipal')));
  
  // Servir também as subpastas das outras telas
  app.use(express.static(path.join(frontendPath, 'Telas/TelaLogin')));
  app.use(express.static(path.join(frontendPath, 'Telas/TelaPerfil')));
  app.use(express.static(path.join(frontendPath, 'Telas/TelaRegistro')));
  app.use(express.static(path.join(frontendPath, 'Telas/TelaRecibo')));
  
  // Servir os posters com cabeçalho X-Frame-Options apropriado
  app.use('/posters', (req, res, next) => {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
  });
  app.use('/posters', express.static(path.join(frontendPath, 'posters')));
  
  console.log('📁 Frontend estático disponível em:', frontendPath);
} else {
  console.warn('⚠️ Pasta Front_End NÃO encontrada em:', frontendPath);
}

// ==================== ROTAS DA API ====================
app.use('/api', routes);

// ==================== HEALTH CHECK ====================
app.get('/health', (req, res) => {
  try {
    const { db } = require('./config/database');
    db.prepare('SELECT 1').get();
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV || 'development',
      database: 'connected',
      jwt: process.env.JWT_SECRET ? 'configured' : 'missing',
      version: '1.0.0'
    });
  } catch (err) {
    res.status(500).json({ status: 'error', database: 'disconnected', error: err.message });
  }
});

// ==================== ROTA PRINCIPAL ====================
app.get('/', (req, res) => {
  const indexPath = path.join(frontendPath, 'Telas/TelaPrincipal/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Página não encontrada');
  }
});

// ==================== 404 PARA API ====================
app.use('/api/*', (req, res) => {
  res.status(404).json({ erro: 'Rota da API não encontrada', path: req.originalUrl, method: req.method, timestamp: new Date().toISOString() });
});

// ==================== TRATAMENTO DE ROTAS NÃO ENCONTRADAS ====================
app.use((req, res) => {
  if (process.env.NODE_ENV !== 'production') console.log(`❌ 404: ${req.method} ${req.originalUrl}`);
  if (req.path.startsWith('/api')) return res.status(404).json({ erro: 'Rota da API não encontrada' });
  const errorPagePath = path.join(frontendPath, '404.html');
  if (fs.existsSync(errorPagePath)) return res.status(404).sendFile(errorPagePath);
  if (req.path.includes('.')) return res.status(404).json({ erro: 'Arquivo não encontrado', arquivo: req.path });
  res.status(404).json({ erro: 'Rota não encontrada', path: req.path, method: req.method });
});

// ==================== ERROR HANDLER GLOBAL ====================
app.use((err, req, res, next) => {
  console.error('❌ Erro não tratado:', err);
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ erro: 'Arquivo muito grande. Máximo 5MB.', limite: '5MB' });
  if (err.message === 'Formato inválido' || err.message === 'Apenas imagens são permitidas!') return res.status(400).json({ erro: err.message, formatos_aceitos: ['JPG', 'PNG', 'WEBP'] });
  if (err.name === 'JsonWebTokenError') return res.status(401).json({ erro: 'Token inválido.' });
  if (err.name === 'TokenExpiredError') return res.status(401).json({ erro: 'Token expirado. Faça login novamente.' });
  if (err.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ erro: 'Conflito de dados. Recurso já existe.' });
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({ erro: err.message || 'Erro interno do servidor', ...(process.env.NODE_ENV === 'development' && { stack: err.stack }) });
});

module.exports = app;