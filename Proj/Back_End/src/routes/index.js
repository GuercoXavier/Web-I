const express = require('express');
const authRouter = require('./auth');
const produtosRouter = require('./produtos');
const carrinhoRouter = require('./carrinho');
const pedidosRouter = require('./pedidos');
const categoriasRouter = require('./categorias');
const usersRoutes = require('./users');
const { autenticar } = require('../middleware/auth');

const router = express.Router();

// ==================== ROTAS PÚBLICAS ====================
router.use('/auth', authRouter);
router.use('/produtos', produtosRouter);
router.use('/categorias', categoriasRouter);

// ==================== ROTAS PROTEGIDAS ====================
// autenticar aplicado aqui uma única vez — os routers internos não repetem
router.use('/carrinho', autenticar, carrinhoRouter);
router.use('/pedidos', autenticar, pedidosRouter);
router.use('/users', autenticar, usersRoutes);

// ==================== HEALTH CHECK ====================
router.get('/health', (req, res) => {
  const { db } = require('../config/database');

  try {
    db.prepare('SELECT 1').get();

    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV || 'development',
      database: 'connected',
      version: '1.0.0'
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: err.message
    });
  }
});

// ==================== ROTA RAIZ ====================
router.get('/', (req, res) => {
  res.json({
    nome: 'BasGam API',
    versao: '1.0.0',
    descricao: 'API para loja de produtos gaming/eletrônicos',
    endpoints_disponiveis: {
      publicos: {
        auth: '/api/auth',
        produtos: '/api/produtos',
        categorias: '/api/categorias'
      },
      privados: {
        carrinho: '/api/carrinho',
        pedidos: '/api/pedidos',
        users: '/api/users'
      },
      documentacao: '/api/health'
    }
  });
});

// ==================== 404 ====================
router.use((req, res) => {
  res.status(404).json({
    erro: 'Rota não encontrada',
    path: req.originalUrl,
    method: req.method,
    sugestoes: [
      'Verifique se o endpoint existe',
      'Consulte /api para lista de endpoints',
      'Verifique se está usando o método HTTP correto'
    ]
  });
});

// ==================== ERROR HANDLER GLOBAL ====================
router.use((err, req, res, next) => {
  console.error('Erro na rota:', err);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ erro: 'Arquivo muito grande. Máximo 5MB.' });
  }

  if (err.message === 'Apenas imagens são permitidas!' || err.message === 'Formato inválido. Use JPG, PNG ou WEBP.') {
    return res.status(400).json({ erro: err.message });
  }

  res.status(500).json({
    erro: 'Erro interno do servidor',
    mensagem: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = router;