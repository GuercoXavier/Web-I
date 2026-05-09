const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const routes = require('./routes');

const app = express();

app.use(cors({ origin: '*' }));
app.use(helmet());
app.use(express.json());

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));

app.use('/api', routes);

// 404 para API
app.use('/api', (req, res) => {
  res.status(404).json({ erro: 'Rota da API não encontrada' });
});

// frontend estático
app.use(express.static(path.join(__dirname, '../../Front_End')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(
    path.join(__dirname, '../../Front_End/Telas/TelaPrincipal/index.html')
  );
});

// erro global
app.use((err, req, res, next) => {
  console.error(err.message || err);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

module.exports = app;