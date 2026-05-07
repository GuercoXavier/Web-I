const express = require('express');
const db = require('../config/database');
const { autenticar } = require('../middleware/auth');

const router = express.Router();

function getCarrinho(utilizador_id) {
  return db.prepare(
    'SELECT * FROM carrinhos WHERE utilizador_id = ?'
  ).get(utilizador_id);
}

function criarCarrinho(utilizador_id) {
  const result = db.prepare(
    'INSERT INTO carrinhos (utilizador_id) VALUES (?)'
  ).run(utilizador_id);

  return { id: result.lastInsertRowid };
}

// GET carrinho atual
router.get('/', autenticar, (req, res) => {
  const userId = req.utilizador.id;

  let carrinho = getCarrinho(userId);

  if (!carrinho) {
    carrinho = criarCarrinho(userId);
  }

  const itens = db.prepare(`
    SELECT 
      ci.id,
      ci.quantidade,
      p.id AS produto_id,
      p.nome,
      p.preco,
      p.imagem,
      p.stock
    FROM carrinho_itens ci
    JOIN produtos p ON p.id = ci.produto_id
    WHERE ci.carrinho_id = ?
  `).all(carrinho.id);

  const total = itens.reduce(
    (sum, item) => sum + item.preco * item.quantidade,
    0
  );

  res.json({
    carrinho_id: carrinho.id,
    itens,
    total
  });
});

// ADICIONAR produto ao carrinho
router.post('/adicionar', autenticar, (req, res) => {
  const userId = req.utilizador.id;
  const { produto_id, quantidade } = req.body;

  if (!produto_id || !quantidade || quantidade <= 0) {
    return res.status(400).json({ erro: 'Dados inválidos.' });
  }

  let carrinho = getCarrinho(userId);

  if (!carrinho) {
    carrinho = criarCarrinho(userId);
  }

  const produto = db.prepare(
    'SELECT id, stock FROM produtos WHERE id = ?'
  ).get(produto_id);

  if (!produto) {
    return res.status(404).json({ erro: 'Produto não encontrado.' });
  }

  const existente = db.prepare(`
    SELECT id, quantidade 
    FROM carrinho_itens 
    WHERE carrinho_id = ? AND produto_id = ?
  `).get(carrinho.id, produto_id);

  if (existente) {
    db.prepare(`
      UPDATE carrinho_itens
      SET quantidade = quantidade + ?
      WHERE id = ?
    `).run(quantidade, existente.id);
  } else {
    db.prepare(`
      INSERT INTO carrinho_itens (carrinho_id, produto_id, quantidade)
      VALUES (?, ?, ?)
    `).run(carrinho.id, produto_id, quantidade);
  }

  res.json({ mensagem: 'Produto adicionado ao carrinho.' });
});

// ATUALIZAR quantidade
router.put('/atualizar', autenticar, (req, res) => {
  const userId = req.utilizador.id;
  const { produto_id, quantidade } = req.body;

  if (!produto_id || quantidade < 0) {
    return res.status(400).json({ erro: 'Dados inválidos.' });
  }

  const carrinho = getCarrinho(userId);

  if (!carrinho) {
    return res.status(404).json({ erro: 'Carrinho não encontrado.' });
  }

  if (quantidade === 0) {
    db.prepare(`
      DELETE FROM carrinho_itens
      WHERE carrinho_id = ? AND produto_id = ?
    `).run(carrinho.id, produto_id);

    return res.json({ mensagem: 'Produto removido.' });
  }

  db.prepare(`
    UPDATE carrinho_itens
    SET quantidade = ?
    WHERE carrinho_id = ? AND produto_id = ?
  `).run(quantidade, carrinho.id, produto_id);

  res.json({ mensagem: 'Carrinho atualizado.' });
});

// LIMPAR carrinho
router.delete('/limpar', autenticar, (req, res) => {
  const userId = req.utilizador.id;

  const carrinho = getCarrinho(userId);

  if (!carrinho) {
    return res.status(404).json({ erro: 'Carrinho não encontrado.' });
  }

  db.prepare(`
    DELETE FROM carrinho_itens
    WHERE carrinho_id = ?
  `).run(carrinho.id);

  res.json({ mensagem: 'Carrinho limpo.' });
});

module.exports = router;