const express = require('express');
const db = require('../config/database');
const { autenticar } = require('../middleware/auth');
const { validarId } = require('../middleware/validacao');

const router = express.Router();

// ==================== CHECKOUT NORMAL ====================
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

// ==================== CHECKOUT COM CRÉDITOS ====================
router.post('/checkout-com-creditos', autenticar, (req, res) => {
  const userId = req.utilizador.id;
  const { usar_creditos, valor_creditos } = req.body;

  const carrinho = db.prepare('SELECT * FROM carrinhos WHERE utilizador_id = ?').get(userId);

  if (!carrinho) {
    return res.status(400).json({ erro: 'Carrinho não encontrado.' });
  }

  const itens = db.prepare(`
    SELECT ci.*, p.preco, p.stock, p.nome
    FROM carrinho_itens ci
    JOIN produtos p ON p.id = ci.produto_id
    WHERE ci.carrinho_id = ?
  `).all(carrinho.id);

  if (!itens.length) {
    return res.status(400).json({ erro: 'Carrinho vazio.' });
  }

  for (const item of itens) {
    if (item.quantidade > item.stock) {
      return res.status(400).json({ erro: `Stock insuficiente para ${item.nome}` });
    }
  }

  let total = itens.reduce((sum, item) => sum + item.preco * item.quantidade, 0);
  let creditosUsados = 0;
  let totalPago = total;

  if (usar_creditos && valor_creditos > 0) {
    const user = db.prepare('SELECT creditos FROM utilizadores WHERE id = ?').get(userId);
    creditosUsados = Math.min(valor_creditos, user.creditos, total);
    totalPago = total - creditosUsados;

    db.prepare('UPDATE utilizadores SET creditos = creditos - ? WHERE id = ?').run(creditosUsados, userId);
    
    // Registrar transação
    db.prepare(`
      INSERT INTO transacoes_creditos (utilizador_id, valor, tipo, descricao)
      VALUES (?, ?, 'usar', 'Créditos usados na compra')
    `).run(userId, creditosUsados);
  }

  const pedido = db.prepare(`
    INSERT INTO pedidos (utilizador_id, total, estado)
    VALUES (?, ?, 'pendente')
  `).run(userId, totalPago);

  const pedidoId = pedido.lastInsertRowid;

  const insertItem = db.prepare(`
    INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, preco_unit)
    VALUES (?, ?, ?, ?)
  `);

  const updateStock = db.prepare(`UPDATE produtos SET stock = stock - ? WHERE id = ?`);

  const transaction = db.transaction(() => {
    for (const item of itens) {
      insertItem.run(pedidoId, item.produto_id, item.quantidade, item.preco);
      updateStock.run(item.quantidade, item.produto_id);
    }
    db.prepare(`DELETE FROM carrinho_itens WHERE carrinho_id = ?`).run(carrinho.id);
  });

  transaction();

  res.json({
    mensagem: 'Pedido realizado com sucesso.',
    pedido_id: pedidoId,
    total_pago: totalPago,
    creditos_usados: creditosUsados
  });
});

// ==================== LISTAR PEDIDOS DO UTILIZADOR ====================
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

// ==================== DETALHE DO PEDIDO ====================
router.get('/:id', autenticar, validarId, (req, res) => {
  const userId = req.utilizador.id;
  const { id } = req.params;

  const pedido = db.prepare(`
    SELECT *
    FROM pedidos
    WHERE id = ? AND utilizador_id = ?
  `).get(id, userId);

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

// ==================== RELATÓRIO ADMIN (APENAS UMA VEZ) ====================
router.get('/admin/relatorio', autenticar, (req, res) => {
  if (req.utilizador.role !== 'admin') {
    return res.status(403).json({ erro: 'Acesso negado.' });
  }

  try {
    const { data_inicio, data_fim } = req.query;
    
    let query = `
      SELECT 
        p.id AS pedido_id,
        p.total,
        p.estado,
        p.criado_em,
        u.username,
        u.email
      FROM pedidos p
      LEFT JOIN utilizadores u ON u.id = p.utilizador_id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (data_inicio) {
      query += ' AND date(p.criado_em) >= date(?)';
      params.push(data_inicio);
    }
    
    if (data_fim) {
      query += ' AND date(p.criado_em) <= date(?)';
      params.push(data_fim);
    }
    
    query += ' ORDER BY p.id DESC';
    
    const pedidos = db.prepare(query).all(...params);
    
    const totalVendas = pedidos.length;
    const faturacaoTotal = pedidos.reduce((sum, p) => sum + p.total, 0);
    const totalClientes = db.prepare('SELECT COUNT(*) as total FROM utilizadores WHERE role = "cliente"').get().total;
    
    const topProdutos = db.prepare(`
      SELECT 
        pr.nome,
        SUM(pi.quantidade) as vendidos,
        SUM(pi.quantidade * pi.preco_unit) as receita
      FROM pedido_itens pi
      JOIN produtos pr ON pr.id = pi.produto_id
      GROUP BY pr.id
      ORDER BY vendidos DESC
      LIMIT 5
    `).all();

    res.json({
      resumo: {
        total_vendas: totalVendas,
        faturacao_total: faturacaoTotal,
        total_clientes: totalClientes
      },
      pedidos: pedidos,
      top_produtos: topProdutos
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao gerar relatório.' });
  }
});

module.exports = router;