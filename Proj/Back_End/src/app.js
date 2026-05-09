const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const routes = require('./routes');

const app = express();

// ==================== MIDDLEWARES GLOBAIS ====================
app.use(cors({ origin: '*' }));
app.use(helmet());
app.use(express.json()); // <-- ESTAVA FALTANDO

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));

// ==================== ROTAS DA API ====================
app.use('/api', routes);

// Servir arquivos estáticos (uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Servir frontend estático
app.use(express.static(path.join(__dirname, '../../Front_End')));

// ==================== 404 PARA API ====================
app.use('/api', (req, res) => {
  res.status(404).json({ erro: 'Rota da API não encontrada' });
});

// ==================== SPA FALLBACK ====================
// ==================== TRATAMENTO DE ROTAS NÃO ENCONTRADAS ====================

// Rotas da API (404 para API)
app.use('/api', (req, res) => {
  res.status(404).json({ erro: 'Rota da API não encontrada' });
});

// Rotas do frontend
app.use(express.static(path.join(__dirname, '../../Front_End')));

// Página 404 para rotas não encontradas
app.use((req, res) => {
  // Verificar se o pedido é para uma página HTML
  if (req.accepts('html')) {
    res.status(404).sendFile(path.join(__dirname, '../../Front_End/404.html'));
  } else if (req.accepts('json')) {
    res.status(404).json({ erro: 'Página não encontrada' });
  } else {
    res.status(404).type('txt').send('Página não encontrada');
  }
});

// ==================== ERROR HANDLER GLOBAL ====================
app.use((err, req, res, next) => {
  console.error(err.message || err);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

module.exports = app;