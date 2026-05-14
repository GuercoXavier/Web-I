const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression'); // ✅ Adicionar: npm install compression

// Morgan é opcional - se não estiver instalado, ignorar
let morgan;
try {
  morgan = require('morgan');
} catch (e) {
  // Morgan não instalado - logging desabilitado (apenas em desenvolvimento)
  if (process.env.NODE_ENV !== 'production') {
    console.log('⚠️ Morgan não instalado - logging desabilitado');
  }
}

const routes = require('./routes');

const app = express();

// ==================== CONFIGURAÇÕES ====================
const isProduction = process.env.NODE_ENV === 'production';
const BACKEND_ROOT = path.join(__dirname, '..');

// ==================== MIDDLEWARES GLOBAIS ====================

// Compressão para respostas mais rápidas
app.use(compression());

// Morgan apenas se instalado
if (morgan) {
  if (process.env.LOG_LEVEL === 'debug') {
    app.use(morgan('dev'));
  } else if (!isProduction) {
    app.use(morgan('tiny'));
  }
}

// CORS - Configuração mais segura
const corsOptions = {
  origin: isProduction 
    ? (process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000'])
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Segurança - Helmet
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
    },
  },
}));

// Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { 
    erro: 'Muitas requisições. Tente novamente mais tarde.',
    tentar_novamente_em: '15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { 
    erro: 'Muitas tentativas. Tente novamente em 15 minutos.' 
  }
});

app.use('/api', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Headers de segurança adicionais
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// ==================== ARQUIVOS ESTÁTICOS ====================

// Uploads
const uploadsDir = path.join(BACKEND_ROOT, 'uploads');
const produtosDir = path.join(uploadsDir, 'produtos');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Pasta uploads criada em:', uploadsDir);
}

if (!fs.existsSync(produtosDir)) {
  fs.mkdirSync(produtosDir, { recursive: true });
  console.log('📁 Pasta uploads/produtos criada');
}

app.use('/uploads', express.static(uploadsDir));

// Frontend - Caminho correto (Proj/Front_End)
const frontendPath = path.join(__dirname, '../../Front_End');

if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  console.log('📁 Frontend estático disponível em:', frontendPath);
} else {
  console.warn('⚠️ Pasta Front_End NÃO encontrada em:', frontendPath);
  console.warn('⚠️ Certifique-se que os ficheiros do frontend estão em Proj/Front_End/');
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
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: err.message
    });
  }
});

// ==================== ROTA PRINCIPAL ====================
app.get('/', (req, res) => {
  res.json({
    nome: 'BasGam API',
    versao: '1.0.0',
    descricao: 'API para loja de produtos gaming/eletrônicos',
    endpoints: {
      documentacao: '/api',
      health: '/health',
      api: '/api'
    },
    status: 'online'
  });
});

// ==================== 404 PARA API ====================
app.use('/api/*', (req, res) => {
  res.status(404).json({ 
    erro: 'Rota da API não encontrada',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// ==================== TRATAMENTO DE ROTAS NÃO ENCONTRADAS ====================
app.use((req, res) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`❌ 404: ${req.method} ${req.originalUrl}`);
  }
  
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ erro: 'Rota da API não encontrada' });
  }
  
  const errorPagePath = path.join(frontendPath, '404.html');
  if (fs.existsSync(errorPagePath)) {
    return res.status(404).sendFile(errorPagePath);
  }
  
  if (req.path.includes('.')) {
    return res.status(404).json({ 
      erro: 'Arquivo não encontrado',
      arquivo: req.path
    });
  }
  
  res.status(404).json({
    erro: 'Rota não encontrada',
    path: req.path,
    method: req.method
  });
});

// ==================== ERROR HANDLER GLOBAL ====================
app.use((err, req, res, next) => {
  console.error('❌ Erro não tratado:', err);
  
  // Erros do Multer (upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ 
      erro: 'Arquivo muito grande. Máximo 5MB.',
      limite: '5MB'
    });
  }
  
  if (err.message === 'Formato inválido' || err.message === 'Apenas imagens são permitidas!') {
    return res.status(400).json({ 
      erro: err.message,
      formatos_aceitos: ['JPG', 'PNG', 'WEBP']
    });
  }
  
  // Erros JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ erro: 'Token inválido.' });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ erro: 'Token expirado. Faça login novamente.' });
  }
  
  // Erros SQLite
  if (err.code === 'SQLITE_CONSTRAINT') {
    return res.status(409).json({ erro: 'Conflito de dados. Recurso já existe.' });
  }
  
  // Erro genérico
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({ 
    erro: err.message || 'Erro interno do servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

module.exports = app;