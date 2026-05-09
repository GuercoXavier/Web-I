const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const routes = require('./routes');

const app = express();

// ==================== MIDDLEWARES GLOBAIS ====================
app.use(cors({ origin: '*' }));
app.use(helmet());
app.use(express.json({ limit: '10mb' })); // Aumentar limite para uploads

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { erro: 'Muitas requisições. Tente novamente mais tarde.' }
}));

// ==================== ROTAS DA API ====================
app.use('/api', routes);

// ==================== ARQUIVOS ESTÁTICOS ====================

// Garantir que a pasta uploads existe
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Servir arquivos estáticos (uploads)
app.use('/uploads', express.static(uploadsDir));

// Servir frontend estático
app.use(express.static(path.join(__dirname, '../../Front_End')));

// ==================== 404 PARA API (UMA VEZ SÓ) ====================
app.use('/api', (req, res) => {
  res.status(404).json({ erro: 'Rota da API não encontrada' });
});

// ==================== TRATAMENTO DE ROTAS NÃO ENCONTRADAS (FRONTEND) ====================
app.use((req, res) => {
  // Se for pedido de API (já tratado acima, mas por segurança)
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ erro: 'Rota da API não encontrada' });
  }
  
  // Se pedir um arquivo com extensão que não existe (.css, .js, etc)
  if (req.path.includes('.')) {
    return res.status(404).send('Arquivo não encontrado');
  }
  
  // Para todas as outras rotas, mostrar página 404
  res.status(404).sendFile(path.join(__dirname, '../../Front_End/404.html'));
});

// ==================== ERROR HANDLER GLOBAL ====================
app.use((err, req, res, next) => {
  console.error('❌ Erro:', err.message || err);
  
  // Erro do multer (upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ erro: 'Arquivo muito grande. Máximo 5MB.' });
  }
  if (err.message === 'Formato inválido') {
    return res.status(400).json({ erro: 'Formato de imagem inválido. Use JPG, PNG ou WEBP.' });
  }
  
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

module.exports = app;