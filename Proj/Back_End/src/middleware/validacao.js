// src/middleware/validacao.js
const db = require('../config/database');

// Validar email
function validarEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// Validar username (apenas letras, números, underscore)
function validarUsername(username) {
  const regex = /^[a-zA-Z0-9_]{3,30}$/;
  return regex.test(username);
}

// Sanitizar inputs (prevenir XSS)
function sanitizar(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ==================== MIDDLEWARES ====================

// Validar registo de utilizador
function validarRegisto(req, res, next) {
  const { username, email, password } = req.body;

  const erros = [];

  if (!username || username.trim().length < 3) {
    erros.push('Username deve ter pelo menos 3 caracteres');
  } else if (!validarUsername(username)) {
    erros.push('Username só pode conter letras, números e underscore');
  }

  if (!email || !validarEmail(email)) {
    erros.push('Email inválido');
  }

  if (!password || password.length < 6) {
    erros.push('Password deve ter pelo menos 6 caracteres');
  }

  if (erros.length > 0) {
    return res.status(400).json({ erro: erros.join(', ') });
  }

  // Sanitizar
  req.body.username = sanitizar(username).toLowerCase();
  req.body.email = sanitizar(email).toLowerCase();

  next();
}

// Validar login
function validarLogin(req, res, next) {
  const { username, password } = req.body;

  const erros = [];

  if (!username || username.trim().length < 3) {
    erros.push('Username inválido');
  }

  if (!password || password.length < 1) {
    erros.push('Password obrigatória');
  }

  if (erros.length > 0) {
    return res.status(400).json({ erro: erros.join(', ') });
  }

  req.body.username = sanitizar(username);
  next();
}

// Validar produto
function validarProduto(req, res, next) {
  const { nome, preco, stock, descricao, marca } = req.body;

  const erros = [];

  if (!nome || nome.trim().length < 3) {
    erros.push('Nome do produto deve ter pelo menos 3 caracteres');
  }

  if (!preco || preco <= 0) {
    erros.push('Preço deve ser maior que zero');
  }

  if (stock === undefined || stock < 0) {
    erros.push('Stock não pode ser negativo');
  }

  if (descricao && descricao.length > 1000) {
    erros.push('Descrição muito longa (máx 1000 caracteres)');
  }

  if (erros.length > 0) {
    return res.status(400).json({ erro: erros.join(', ') });
  }

  req.body.nome = sanitizar(nome);
  req.body.descricao = descricao ? sanitizar(descricao) : '';
  req.body.marca = marca ? sanitizar(marca) : '';

  next();
}

// Validar ID (para parâmetros de URL)
function validarId(req, res, next) {
  const id = parseInt(req.params.id);

  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ erro: 'ID inválido' });
  }

  req.params.id = id;
  next();
}

// Validar quantidade do carrinho
function validarQuantidade(req, res, next) {
  const { produto_id, quantidade } = req.body;

  if (!produto_id || produto_id <= 0) {
    return res.status(400).json({ erro: 'ID do produto inválido' });
  }

  if (!quantidade || quantidade <= 0) {
    return res.status(400).json({ erro: 'Quantidade inválida' });
  }

  next();
}

// Limitar tamanho da descrição
function limitarDescricao(req, res, next) {
  if (req.body.descricao && req.body.descricao.length > 500) {
    req.body.descricao = req.body.descricao.substring(0, 500);
  }
  next();
}

module.exports = {
  validarRegisto,
  validarLogin,
  validarProduto,
  validarId,
  validarQuantidade,
  limitarDescricao,
  sanitizar,
  validarEmail,
  validarUsername
};