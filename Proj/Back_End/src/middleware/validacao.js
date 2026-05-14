const validarEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const validarUsername = (username) => /^[a-zA-Z0-9_]{3,30}$/.test(username);

const validarTelefone = (telefone) => {
  if (!telefone) return true;
  return /^[0-9]{9}$/.test(telefone);
};

const validarUrlImagem = (url) => {
  if (!url) return true;
  return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
};

function sanitizar(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizarNumero(valor) {
  const num = parseInt(valor);
  return isNaN(num) ? 0 : Math.abs(num);
}

function validarRegisto(req, res, next) {
  const { username, email, password, telefone } = req.body;
  const erros = [];

  if (!username || username.trim().length < 3) {
    erros.push('Username deve ter pelo menos 3 caracteres');
  } else if (!validarUsername(username)) {
    erros.push('Username só pode conter letras, números e underscore (3-30 caracteres)');
  } else if (username.length > 30) {
    erros.push('Username deve ter no máximo 30 caracteres');
  }

  if (!email || !validarEmail(email)) {
    erros.push('Email inválido');
  } else if (email.length > 100) {
    erros.push('Email muito longo (máx 100 caracteres)');
  }

  if (!password) {
    erros.push('Password é obrigatória');
  } else if (password.length < 6) {
    erros.push('Password deve ter pelo menos 6 caracteres');
  } else if (password.length > 72) {
    erros.push('Password muito longa (máx 72 caracteres)');
  } else {
    if (!/[A-Z]/.test(password)) {
      erros.push('Password deve conter pelo menos uma letra maiúscula');
    }
    if (!/[0-9]/.test(password)) {
      erros.push('Password deve conter pelo menos um número');
    }
  }

  if (telefone && !validarTelefone(telefone)) {
    erros.push('Telefone inválido (deve ter 9 dígitos)');
  }

  if (erros.length > 0) {
    return res.status(400).json({ erro: 'Dados inválidos', detalhes: erros });
  }

  req.body.username = sanitizar(username).toLowerCase();
  req.body.email = sanitizar(email).toLowerCase();
  req.body.telefone = telefone ? sanitizar(telefone) : null;

  next();
}

function validarLogin(req, res, next) {
  const { username, password } = req.body;
  const erros = [];

  if (!username || username.trim().length < 3) {
    erros.push('Username inválido');
  } else if (username.length > 30) {
    erros.push('Username muito longo');
  }

  if (!password || password.length < 1) {
    erros.push('Password obrigatória');
  } else if (password.length > 72) {
    erros.push('Password muito longa');
  }

  if (erros.length > 0) {
    return res.status(400).json({ erro: 'Dados inválidos', detalhes: erros });
  }

  req.body.username = sanitizar(username);
  next();
}

function validarProduto(req, res, next) {
  const { nome, preco, stock, descricao, marca, categoria_id, subcategoria_id, imagem } = req.body;
  const erros = [];

  if (!nome || nome.trim().length < 3) {
    erros.push('Nome do produto deve ter pelo menos 3 caracteres');
  } else if (nome.length > 200) {
    erros.push('Nome do produto muito longo (máx 200 caracteres)');
  }

  if (preco === undefined || preco === null) {
    erros.push('Preço é obrigatório');
  } else {
    const precoNum = parseFloat(preco);
    if (isNaN(precoNum) || precoNum <= 0) {
      erros.push('Preço deve ser um número maior que zero');
    } else if (precoNum > 999999) {
      erros.push('Preço muito alto (máx 999.999)');
    }
  }

  if (stock !== undefined) {
    const stockNum = parseInt(stock);
    if (isNaN(stockNum) || stockNum < 0) {
      erros.push('Stock não pode ser negativo');
    } else if (stockNum > 999999) {
      erros.push('Stock muito alto (máx 999.999)');
    }
  }

  if (descricao && descricao.length > 1000) {
    erros.push('Descrição muito longa (máx 1000 caracteres)');
  }

  if (marca && marca.length > 100) {
    erros.push('Marca muito longa (máx 100 caracteres)');
  }

  if (imagem && !validarUrlImagem(imagem)) {
    erros.push('URL da imagem inválida (apenas jpg, png, gif, webp, svg)');
  }

  if (categoria_id) {
    const catId = parseInt(categoria_id);
    if (isNaN(catId) || catId <= 0) {
      erros.push('ID da categoria inválido');
    }
  }

  if (subcategoria_id) {
    const subId = parseInt(subcategoria_id);
    if (isNaN(subId) || subId <= 0) {
      erros.push('ID da subcategoria inválido');
    }
  }

  if (erros.length > 0) {
    return res.status(400).json({ erro: 'Dados do produto inválidos', detalhes: erros });
  }

  req.body.nome = sanitizar(nome);
  req.body.descricao = descricao ? sanitizar(descricao) : '';
  req.body.marca = marca ? sanitizar(marca) : '';
  // ✅ Guarda preço em centavos (INTEGER)
  req.body.preco = Math.round(parseFloat(preco) * 100);
  req.body.stock = stock !== undefined ? parseInt(stock) : 0;
  req.body.categoria_id = categoria_id ? parseInt(categoria_id) : null;
  req.body.subcategoria_id = subcategoria_id ? parseInt(subcategoria_id) : null;

  next();
}

function validarId(req, res, next) {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ erro: 'ID inválido' });
  }
  req.params.id = id;
  next();
}

function validarQuantidade(req, res, next) {
  const { produto_id, quantidade } = req.body;
  const erros = [];

  if (!produto_id) {
    erros.push('ID do produto é obrigatório');
  } else {
    const prodId = parseInt(produto_id);
    if (isNaN(prodId) || prodId <= 0) {
      erros.push('ID do produto inválido');
    }
  }

  if (!quantidade) {
    erros.push('Quantidade é obrigatória');
  } else {
    const qtd = parseInt(quantidade);
    if (isNaN(qtd) || qtd <= 0) {
      erros.push('Quantidade deve ser um número positivo');
    } else if (qtd > 999) {
      erros.push('Quantidade máxima é 999 unidades por produto');
    }
  }

  if (erros.length > 0) {
    return res.status(400).json({ erro: 'Dados inválidos', detalhes: erros });
  }

  req.body.produto_id = parseInt(produto_id);
  req.body.quantidade = parseInt(quantidade);
  next();
}

function validarCompra(req, res, next) {
  const { metodo_pagamento } = req.body;
  const metodosValidos = ['creditos', 'mbway', 'referencia_multibanco', 'cartao_credito'];

  if (!metodo_pagamento) {
    return res.status(400).json({ erro: 'Método de pagamento é obrigatório' });
  }

  if (!metodosValidos.includes(metodo_pagamento)) {
    return res.status(400).json({
      erro: 'Método de pagamento inválido',
      metodos_disponiveis: metodosValidos
    });
  }

  next();
}

function validarBusca(req, res, next) {
  const { q, preco_min, preco_max, ordenar } = req.query;

  if (q) {
    req.query.q = sanitizar(q).substring(0, 100);
  }

  if (preco_min) {
    const min = parseFloat(preco_min);
    if (isNaN(min) || min < 0) {
      return res.status(400).json({ erro: 'Preço mínimo inválido' });
    }
    req.query.preco_min = min;
  }

  if (preco_max) {
    const max = parseFloat(preco_max);
    if (isNaN(max) || max < 0) {
      return res.status(400).json({ erro: 'Preço máximo inválido' });
    }
    req.query.preco_max = max;
  }

  const ordenacoesValidas = ['preco_asc', 'preco_desc', 'nome_asc', 'nome_desc', 'mais_recentes'];
  if (ordenar && !ordenacoesValidas.includes(ordenar)) {
    return res.status(400).json({
      erro: 'Ordenação inválida',
      opcoes: ordenacoesValidas
    });
  }

  next();
}

function limitarDescricao(req, res, next) {
  if (req.body.descricao && req.body.descricao.length > 500) {
    req.body.descricao = req.body.descricao.substring(0, 500);
  }
  next();
}

function validarPerfil(req, res, next) {
  const { email, telefone, username } = req.body;
  const erros = [];

  if (email && !validarEmail(email)) {
    erros.push('Email inválido');
  }

  if (telefone && !validarTelefone(telefone)) {
    erros.push('Telefone inválido (9 dígitos)');
  }

  if (username && (!validarUsername(username) || username.length < 3)) {
    erros.push('Username inválido (3-30 caracteres, apenas letras, números e underscore)');
  }

  if (erros.length > 0) {
    return res.status(400).json({ erro: 'Dados inválidos', detalhes: erros });
  }

  if (email) req.body.email = sanitizar(email).toLowerCase();
  if (telefone) req.body.telefone = sanitizar(telefone);
  if (username) req.body.username = sanitizar(username).toLowerCase();

  next();
}

module.exports = {
  validarRegisto,
  validarLogin,
  validarProduto,
  validarId,
  validarQuantidade,
  validarCompra,
  validarBusca,
  validarPerfil,
  limitarDescricao,
  sanitizar,
  validarEmail,
  validarUsername,
  validarTelefone,
  sanitizarNumero,
  validarUrlImagem
};