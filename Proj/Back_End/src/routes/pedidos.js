const express = require('express');
const { db } = require('../config/database');
const { autenticar, somenteAdmin } = require('../middleware/auth');
const { validarId } = require('../middleware/validacao');

const router = express.Router();

function getEstadoFormatado(estado) {
  const estados = {
    pendente: '⏳ Pendente',
    pago: '💰 Pago',
    processando: '⚙️ Processando',
    enviado: '📦 Enviado',
    entregue: '✅ Entregue',
    cancelado: '❌ Cancelado'
  };
  return estados[estado] || estado;
}

function getEstadoCor(estado) {
  const cores = {
    pendente: '#f39c12',
    pago: '#3498db',
    processando: '#9b59b6',
    enviado: '#2ecc71',
    entregue: '#27ae60',
    cancelado: '#e74c3c'
  };
  return cores[estado] || '#95a5a6';
}

function getCarrinho(utilizador_id) {
  return db.prepare('SELECT * FROM carrinhos WHERE utilizador_id = ?').get(utilizador_id);
}

// ✅ Função para converter preços de centavos para unidade
function converterPrecoPedido(pedido) {
  if (!pedido) return pedido;
  const convertido = { ...pedido };
  if (convertido.total !== undefined && convertido.total !== null) {
    convertido.total = convertido.total / 100;
    if (convertido.subtotal) convertido.subtotal = convertido.subtotal / 100;
  }
  return convertido;
}

function converterPrecoItem(item) {
  if (!item) return item;
  const convertido = { ...item };
  if (convertido.preco_unit !== undefined && convertido.preco_unit !== null) {
    convertido.preco_unit = convertido.preco_unit / 100;
    if (convertido.subtotal) convertido.subtotal = convertido.subtotal / 100;
  }
  return convertido;
}

function getCarrinhoItens(carrinhoId) {
  const itens = db.prepare(`
    SELECT
      ci.*,
      p.preco,
      p.stock,
      p.nome,
      (p.preco * ci.quantidade) AS subtotal
    FROM carrinho_itens ci
    JOIN produtos p ON p.id = ci.produto_id
    WHERE ci.carrinho_id = ?
  `).all(carrinhoId);

  return itens.map(item => converterPrecoItem(item));
}

function verificarStockItens(itens) {
  for (const item of itens) {
    if (item.quantidade > item.stock) {
      return {
        valido: false,
        produto: item.nome,
        disponivel: item.stock,
        solicitado: item.quantidade
      };
    }
  }
  return { valido: true };
}

// ==================== ROTAS ADMIN ====================

router.get('/admin/todos', autenticar, somenteAdmin, (req, res) => {
  const { estado, limite = 50, pagina = 1 } = req.query;
  const offset = (parseInt(pagina) - 1) * parseInt(limite);

  try {
    let query = `
      SELECT
        p.id,
        p.total,
        p.estado,
        p.criado_em,
        u.id AS usuario_id,
        u.username,
        u.email,
        COUNT(pi.id) AS total_itens
      FROM pedidos p
      LEFT JOIN utilizadores u ON u.id = p.utilizador_id
      LEFT JOIN pedido_itens pi ON pi.pedido_id = p.id
      WHERE 1=1
    `;

    const params = [];

    if (estado) {
      query += ` AND p.estado = ?`;
      params.push(estado);
    }

    query += ` GROUP BY p.id ORDER BY p.id DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limite), offset);

    const pedidos = db.prepare(query).all(...params);
    const pedidosConvertidos = pedidos.map(p => converterPrecoPedido(p));

    let countQuery = `SELECT COUNT(DISTINCT p.id) as total FROM pedidos p WHERE 1=1`;
    if (estado) countQuery += ` AND p.estado = ?`;
    const total = db.prepare(countQuery).get(...(estado ? [estado] : []))?.total || 0;

    res.json({
      success: true,
      pedidos: pedidosConvertidos,
      paginacao: {
        pagina: parseInt(pagina),
        limite: parseInt(limite),
        total,
        total_paginas: Math.ceil(total / parseInt(limite))
      }
    });
  } catch (err) {
    console.error('Erro ao listar pedidos (admin):', err);
    res.status(500).json({ erro: 'Erro ao buscar pedidos.' });
  }
});

router.put('/admin/:id/estado', autenticar, somenteAdmin, validarId, (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  const estadosValidos = ['pendente', 'pago', 'processando', 'enviado', 'entregue', 'cancelado'];

  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({
      erro: 'Estado inválido',
      estados_permitidos: estadosValidos
    });
  }

  try {
    const pedido = db.prepare('SELECT id, estado FROM pedidos WHERE id = ?').get(id);

    if (!pedido) {
      return res.status(404).json({ erro: 'Pedido não encontrado.' });
    }

    db.prepare('UPDATE pedidos SET estado = ? WHERE id = ?').run(estado, id);

    res.json({
      success: true,
      mensagem: 'Estado do pedido atualizado',
      estado_anterior: pedido.estado,
      estado_novo: estado
    });
  } catch (err) {
    console.error('Erro ao atualizar estado:', err);
    res.status(500).json({ erro: 'Erro ao atualizar estado do pedido.' });
  }
});

router.get('/admin/relatorio', autenticar, somenteAdmin, (req, res) => {
  const { data_inicio, data_fim, periodo } = req.query;

  try {
    let query = `
      SELECT
        p.id AS pedido_id,
        p.total,
        p.estado,
        p.criado_em,
        u.username,
        u.email,
        u.id AS usuario_id
      FROM pedidos p
      LEFT JOIN utilizadores u ON u.id = p.utilizador_id
      WHERE 1=1
    `;

    const params = [];

    if (periodo) {
      let dataInicio = new Date();
      switch (periodo) {
        case 'hoje':
          dataInicio.setHours(0, 0, 0, 0);
          query += ' AND p.criado_em >= datetime(?)';
          params.push(dataInicio.toISOString());
          break;
        case 'semana':
          dataInicio.setDate(dataInicio.getDate() - 7);
          query += ' AND p.criado_em >= datetime(?)';
          params.push(dataInicio.toISOString());
          break;
        case 'mes':
          dataInicio.setMonth(dataInicio.getMonth() - 1);
          query += ' AND p.criado_em >= datetime(?)';
          params.push(dataInicio.toISOString());
          break;
      }
    } else {
      if (data_inicio) {
        query += ' AND date(p.criado_em) >= date(?)';
        params.push(data_inicio);
      }
      if (data_fim) {
        query += ' AND date(p.criado_em) <= date(?)';
        params.push(data_fim);
      }
    }

    query += ' ORDER BY p.id DESC';

    const pedidos = db.prepare(query).all(...params);
    const pedidosConvertidos = pedidos.map(p => converterPrecoPedido(p));

    const pedidosConcluidos = pedidosConvertidos.filter(p => p.estado === 'entregue');
    const totalVendas = pedidos.length;
    const totalConcluidas = pedidosConcluidos.length;
    const faturacaoTotal = pedidosConcluidos.reduce((sum, p) => sum + p.total, 0);
    const totalClientes = db.prepare('SELECT COUNT(*) as total FROM utilizadores WHERE role = "cliente"').get().total || 0;

    const topProdutos = db.prepare(`
      SELECT
        pr.id,
        pr.nome,
        pr.imagem,
        SUM(pi.quantidade) as quantidade_vendida,
        SUM(pi.quantidade * pi.preco_unit) as receita_total
      FROM pedido_itens pi
      JOIN produtos pr ON pr.id = pi.produto_id
      JOIN pedidos p ON p.id = pi.pedido_id
      WHERE p.estado = 'entregue'
      GROUP BY pr.id
      ORDER BY quantidade_vendida DESC
      LIMIT 10
    `).all();

    const topProdutosConvertidos = topProdutos.map(p => ({
      ...p,
      receita_total: p.receita_total / 100
    }));

    const vendasPorDia = db.prepare(`
      SELECT
        date(p.criado_em) as data,
        COUNT(*) as total_pedidos,
        SUM(p.total) as faturacao
      FROM pedidos p
      WHERE p.estado = 'entregue'
        AND p.criado_em >= datetime('now', '-30 days')
      GROUP BY date(p.criado_em)
      ORDER BY data DESC
    `).all();

    const vendasPorDiaConvertidas = vendasPorDia.map(v => ({
      ...v,
      faturacao: v.faturacao / 100
    }));

    const statusCount = db.prepare(`
      SELECT estado, COUNT(*) as total
      FROM pedidos
      GROUP BY estado
    `).all();

    res.json({
      success: true,
      resumo: {
        total_pedidos: totalVendas,
        total_concluidos: totalConcluidas,
        taxa_conclusao: totalVendas > 0 ? ((totalConcluidas / totalVendas) * 100).toFixed(2) : 0,
        faturacao_total: faturacaoTotal,
        total_clientes: totalClientes,
        ticket_medio: totalConcluidas > 0 ? (faturacaoTotal / totalConcluidas).toFixed(2) : 0
      },
      pedidos: pedidosConvertidos,
      top_produtos: topProdutosConvertidos,
      vendas_por_dia: vendasPorDiaConvertidas,
      status_pedidos: statusCount
    });
  } catch (err) {
    console.error('Erro ao gerar relatório:', err);
    res.status(500).json({ erro: 'Erro ao gerar relatório.' });
  }
});

// ==================== CHECKOUT ====================
router.post('/checkout', autenticar, (req, res) => {
  const userId = req.utilizador.id;

  try {
    const carrinho = getCarrinho(userId);

    if (!carrinho) {
      return res.status(400).json({ erro: 'Carrinho não encontrado.' });
    }

    const itens = getCarrinhoItens(carrinho.id);

    if (!itens.length) {
      return res.status(400).json({ erro: 'Carrinho vazio.' });
    }

    const verificacao = verificarStockItens(itens);
    if (!verificacao.valido) {
      return res.status(400).json({
        erro: `Stock insuficiente para "${verificacao.produto}".`,
        disponivel: verificacao.disponivel,
        solicitado: verificacao.solicitado
      });
    }

    const total = itens.reduce((sum, item) => sum + item.subtotal, 0);

    const realizarPedido = db.transaction(() => {
      const user = db.prepare('SELECT creditos FROM utilizadores WHERE id = ?').get(userId);

      if (!user || user.creditos < total) {
        throw Object.assign(new Error('Créditos insuficientes'), {
          statusCode: 400,
          creditos_disponiveis: user?.creditos || 0,
          total_compra: total,
          faltam: total - (user?.creditos || 0)
        });
      }

      db.prepare('UPDATE utilizadores SET creditos = creditos - ? WHERE id = ?')
        .run(total, userId);

      db.prepare(`
        INSERT INTO transacoes_creditos (utilizador_id, valor, tipo, descricao, referencia)
        VALUES (?, ?, 'compra', 'Compra de produtos', ?)
      `).run(userId, -total, `pedido_${Date.now()}`);

      const pedido = db.prepare(`
        INSERT INTO pedidos (utilizador_id, total, estado)
        VALUES (?, ?, 'pago')
      `).run(userId, total);

      const pedidoId = pedido.lastInsertRowid;

      const insertItem = db.prepare(`
        INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, preco_unit)
        VALUES (?, ?, ?, ?)
      `);

      const updateStock = db.prepare(`
        UPDATE produtos SET stock = stock - ? WHERE id = ?
      `);

      for (const item of itens) {
        insertItem.run(pedidoId, item.produto_id, item.quantidade, item.preco_unit);
        updateStock.run(item.quantidade, item.produto_id);
      }

      db.prepare('DELETE FROM carrinho_itens WHERE carrinho_id = ?').run(carrinho.id);

      return pedidoId;
    });

    let pedidoId;
    try {
      pedidoId = realizarPedido();
    } catch (err) {
      if (err.statusCode === 400) {
        return res.status(400).json({
          erro: err.message,
          creditos_disponiveis: err.creditos_disponiveis,
          total_compra: err.total_compra,
          faltam: err.faltam
        });
      }
      throw err;
    }

    const novoSaldo = db.prepare('SELECT creditos FROM utilizadores WHERE id = ?').get(userId)?.creditos || 0;

    res.json({
      success: true,
      mensagem: 'Pedido realizado com sucesso!',
      pedido_id: pedidoId,
      total_gasto: total,
      creditos_restantes: novoSaldo,
      total_itens: itens.length
    });
  } catch (err) {
    console.error('Erro no checkout:', err);
    res.status(500).json({ erro: 'Erro ao processar pedido.' });
  }
});

// ==================== LISTAR PEDIDOS DO UTILIZADOR ====================
router.get('/meus-pedidos', autenticar, (req, res) => {
  const userId = req.utilizador.id;

  try {
    const pedidos = db.prepare(`
      SELECT
        p.id,
        p.total,
        p.estado,
        p.criado_em,
        COUNT(pi.id) as total_itens
      FROM pedidos p
      LEFT JOIN pedido_itens pi ON pi.pedido_id = p.id
      WHERE p.utilizador_id = ?
      GROUP BY p.id
      ORDER BY p.id DESC
    `).all(userId);

    const pedidosConvertidos = pedidos.map(p => ({
      ...p,
      total: p.total / 100,
      estado_formatado: getEstadoFormatado(p.estado),
      cor: getEstadoCor(p.estado)
    }));

    res.json({
      success: true,
      total: pedidosConvertidos.length,
      pedidos: pedidosConvertidos
    });
  } catch (err) {
    console.error('Erro ao listar pedidos:', err);
    res.status(500).json({ erro: 'Erro ao buscar pedidos.' });
  }
});

// ==================== GET / ====================
router.get('/', autenticar, (req, res) => {
  const userId = req.utilizador.id;

  try {
    const pedidos = db.prepare(`
      SELECT
        p.id,
        p.total,
        p.estado,
        p.criado_em,
        COUNT(pi.id) as total_itens
      FROM pedidos p
      LEFT JOIN pedido_itens pi ON pi.pedido_id = p.id
      WHERE p.utilizador_id = ?
      GROUP BY p.id
      ORDER BY p.id DESC
    `).all(userId);

    const pedidosConvertidos = pedidos.map(p => ({
      ...p,
      total: p.total / 100,
      estado_formatado: getEstadoFormatado(p.estado),
      cor: getEstadoCor(p.estado)
    }));

    res.json({
      success: true,
      total: pedidosConvertidos.length,
      pedidos: pedidosConvertidos
    });
  } catch (err) {
    console.error('Erro ao listar pedidos:', err);
    res.status(500).json({ erro: 'Erro ao buscar pedidos.' });
  }
});

// ==================== DETALHE DO PEDIDO ====================
router.get('/:id', autenticar, validarId, (req, res) => {
  const userId = req.utilizador.id;
  const { id } = req.params;

  try {
    const pedido = db.prepare(`
      SELECT id, total, estado, criado_em
      FROM pedidos
      WHERE id = ? AND utilizador_id = ?
    `).get(id, userId);

    if (!pedido) {
      return res.status(404).json({ erro: 'Pedido não encontrado.' });
    }

    const itens = db.prepare(`
      SELECT
        pi.id,
        pi.quantidade,
        pi.preco_unit,
        (pi.quantidade * pi.preco_unit) AS subtotal,
        p.id AS produto_id,
        p.nome,
        p.imagem,
        p.marca
      FROM pedido_itens pi
      JOIN produtos p ON p.id = pi.produto_id
      WHERE pi.pedido_id = ?
    `).all(pedido.id);

    const itensConvertidos = itens.map(item => ({
      ...item,
      preco_unit: item.preco_unit / 100,
      subtotal: item.subtotal / 100
    }));

    res.json({
      success: true,
      pedido: {
        ...pedido,
        total: pedido.total / 100,
        estado_formatado: getEstadoFormatado(pedido.estado),
        cor: getEstadoCor(pedido.estado),
        total_itens: itensConvertidos.length,
        subtotal: pedido.total / 100
      },
      itens: itensConvertidos
    });
  } catch (err) {
    console.error('Erro ao buscar detalhe do pedido:', err);
    res.status(500).json({ erro: 'Erro ao buscar detalhes do pedido.' });
  }
});

module.exports = router;