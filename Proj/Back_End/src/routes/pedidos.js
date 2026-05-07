const express = require('express');
const db = require('../config/database');
const { autenticar } = require('../middleware/auth');

const router = express.Router();

// ─────────────────────────────────────────────
// CHECKOUT (já integrado com carrinho atual)
// ─────────────────────────────────────────────
router.post('/checkout', autenticar, (req, res) => {
  const userId = req.utilizador.id;

  const carrinho = db.prepare(
    'SELECT * FROM carrinhos WHERE utilizador_id = ?'
  ).get(userId);

  if (!carrinho) {
    return res.status(400).json({ erro: 'Carrinho não encontrado.' });
  }

  const itens = db.prepare(`
    SELECT 
      ci.*, 
      p.preco, 
      p.stock, 
      p.nome
    FROM carrinho_itens ci
    JOIN produtos p ON p.id = ci.produto_id
    WHERE ci.carrinho_id = ?
  `).all(carrinho.id);

  if (!itens.length) {
    return res.status(400).json({ erro: 'Carrinho vazio.' });
  }

  for (const item of itens) {
    if (item.quantidade > item.stock) {
      return res.status(400).json({
        erro: `Stock insuficiente para ${item.nome}`
      });
    }
  }

  const total = itens.reduce(
    (sum, item) => sum + item.preco * item.quantidade,
    0
  );

  const pedido = db.prepare(`
    INSERT INTO pedidos (utilizador_id, total, estado)
    VALUES (?, ?, 'pendente')
  `).run(userId, total);

  const pedidoId = pedido.lastInsertRowid;

  const insertItem = db.prepare(`
    INSERT INTO pedido_itens
    (pedido_id, produto_id, quantidade, preco_unit)
    VALUES (?, ?, ?, ?)
  `);

  const updateStock = db.prepare(`
    UPDATE produtos
    SET stock = stock - ?
    WHERE id = ?
  `);

  const transaction = db.transaction(() => {
    for (const item of itens) {
      insertItem.run(
        pedidoId,
        item.produto_id,
        item.quantidade,
        item.preco
      );

      updateStock.run(item.quantidade, item.produto_id);
    }

    db.prepare(`
      DELETE FROM carrinho_itens
      WHERE carrinho_id = ?
    `).run(carrinho.id);
  });

  transaction();

  res.json({
    mensagem: 'Pedido realizado com sucesso.',
    pedido_id: pedidoId,
    total
  });
});

// ─────────────────────────────────────────────
// LISTAR pedidos do utilizador
// ─────────────────────────────────────────────
router.get('/', autenticar, (req, res) => {
  const userId = req.utilizador.id;

  const pedidos = db.prepare(`
    SELECT *
    FROM pedidos
    WHERE utilizador_id = ?
    ORDER BY id DESC
  `).all(userId);

  res.json(pedidos);
});

// ─────────────────────────────────────────────
// DETALHE do pedido
// ─────────────────────────────────────────────
router.get('/:id', autenticar, (req, res) => {
  const userId = req.utilizador.id;

  const pedido = db.prepare(`
    SELECT *
    FROM pedidos
    WHERE id = ? AND utilizador_id = ?
  `).get(req.params.id, userId);

  if (!pedido) {
    return res.status(404).json({ erro: 'Pedido não encontrado.' });
  }

  const itens = db.prepare(`
    SELECT 
      pi.*, 
      p.nome
    FROM pedido_itens pi
    JOIN produtos p ON p.id = pi.produto_id
    WHERE pi.pedido_id = ?
  `).all(pedido.id);

  res.json({
    pedido,
    itens
  });
});

// ─────────────────────────────────────────────
// RELATÓRIO ADMIN
// ─────────────────────────────────────────────
router.get('/admin/relatorio', autenticar, (req, res) => {
  if (req.utilizador.role !== 'admin') {
    return res.status(403).json({ erro: 'Acesso negado.' });
  }

  const totalPedidos = db.prepare(
    'SELECT COUNT(*) AS total FROM pedidos'
  ).get().total;

  const faturacao = db.prepare(
    'SELECT SUM(total) AS total FROM pedidos'
  ).get().total || 0;

  const topProdutos = db.prepare(`
    SELECT 
      p.nome,
      SUM(pi.quantidade) AS vendidos
    FROM pedido_itens pi
    JOIN produtos p ON p.id = pi.produto_id
    GROUP BY p.id
    ORDER BY vendidos DESC
    LIMIT 5
  `).all();

  const vendasPorDia = db.prepare(`
    SELECT date(criado_em) AS dia, SUM(total) AS total
    FROM pedidos
    GROUP BY dia
    ORDER BY dia DESC
    LIMIT 7
  `).all();

  res.json({
    totalPedidos,
    faturacao,
    topProdutos,
    vendasPorDia
  });
});

module.exports = router;