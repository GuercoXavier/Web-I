const express = require('express');

const authRouter = require('./auth');
const produtosRouter = require('./produtos');
const carrinhoRouter = require('./carrinho');
const pedidosRouter = require('./pedidos');
const categoriasRouter = require('./categorias');
const usersRoutes = require('./users');

const router = express.Router();

router.use('/auth', authRouter);
router.use('/produtos', produtosRouter);
router.use('/carrinho', carrinhoRouter);
router.use('/pedidos', pedidosRouter);
router.use('/categorias', categoriasRouter);
router.use('/users', usersRoutes);
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

router.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada' });
});

module.exports = router;