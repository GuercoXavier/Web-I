const express = require('express');
const { db } = require('../config/database');
const { validarId, validarQuantidade } = require('../middleware/validacao');

const router = express.Router();

function getCarrinho(utilizador_id) {
  return db.prepare('SELECT id, criado_em FROM carrinhos WHERE utilizador_id = ?').get(utilizador_id);
}

function criarCarrinho(utilizador_id) {
  const result = db.prepare('INSERT INTO carrinhos (utilizador_id) VALUES (?)').run(utilizador_id);
  return { id: result.lastInsertRowid };
}

// ✅ Função para converter preços de centavos para unidade
function converterPrecoItem(item) {
  if (!item) return item;
  const convertido = { ...item };
  if (convertido.preco !== undefined && convertido.preco !== null) {
    convertido.preco = convertido.preco / 100;
    if (convertido.subtotal) convertido.subtotal = convertido.subtotal / 100;
  }
  return convertido;
}

function getCarrinhoComItens(carrinhoId) {
  const itens = db.prepare(`
    SELECT
      ci.id,
      ci.quantidade,
      p.id AS produto_id,
      p.nome,
      p.preco,
      p.imagem,
      p.stock,
      (p.preco * ci.quantidade) AS subtotal
    FROM carrinho_itens ci
    JOIN produtos p ON p.id = ci.produto_id
    WHERE ci.carrinho_id = ?
  `).all(carrinhoId);

  // Converter preços para unidade
  const itensConvertidos = itens.map(item => converterPrecoItem(item));

  const total = itensConvertidos.reduce((sum, item) => sum + item.subtotal, 0);
  const totalItens = itensConvertidos.reduce((sum, item) => sum + item.quantidade, 0);

  return { itens: itensConvertidos, total, totalItens };
}

function verificarStockProduto(produtoId, quantidadeSolicitada, carrinhoId = null) {
  const produto = db.prepare('SELECT id, nome, stock FROM produtos WHERE id = ?').get(produtoId);

  if (!produto) {
    return { valido: false, erro: 'Produto não encontrado.' };
  }

  let quantidadeAtualNoCarrinho = 0;

  if (carrinhoId) {
    const itemExistente = db.prepare(`
      SELECT quantidade FROM carrinho_itens
      WHERE carrinho_id = ? AND produto_id = ?
    `).get(carrinhoId, produtoId);

    if (itemExistente) {
      quantidadeAtualNoCarrinho = itemExistente.quantidade;
    }
  }

  const quantidadeTotal = quantidadeAtualNoCarrinho + quantidadeSolicitada;

  if (produto.stock < quantidadeTotal) {
    return {
      valido: false,
      erro: `Stock insuficiente para "${produto.nome}". Disponível: ${produto.stock} unidades.`,
      stock_disponivel: produto.stock,
      produto_nome: produto.nome
    };
  }

  return {
    valido: true,
    produto,
    quantidade_atual_carrinho: quantidadeAtualNoCarrinho,
    quantidade_total: quantidadeTotal
  };
}

// ==================== GET CARRINHO ====================
router.get('/', (req, res) => {
  const userId = req.utilizador.id;

  try {
    let carrinho = getCarrinho(userId);
    if (!carrinho) carrinho = criarCarrinho(userId);

    const { itens, total, totalItens } = getCarrinhoComItens(carrinho.id);

    // ✅ Resposta simplificada que o frontend espera
    res.json({
      itens: itens,
      total: total,
      total_itens: totalItens
    });
  } catch (err) {
    console.error('Erro ao buscar carrinho:', err);
    res.status(500).json({ erro: 'Erro ao buscar carrinho.' });
  }
});

// ==================== ADICIONAR ====================
router.post('/adicionar', validarQuantidade, (req, res) => {
  const userId = req.utilizador.id;
  const { produto_id, quantidade } = req.body;

  try {
    let carrinho = getCarrinho(userId);
    if (!carrinho) carrinho = criarCarrinho(userId);

    const verificacao = verificarStockProduto(produto_id, quantidade, carrinho.id);

    if (!verificacao.valido) {
      return res.status(400).json({ erro: verificacao.erro });
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

    const { itens, total, totalItens } = getCarrinhoComItens(carrinho.id);

    res.json({
      success: true,
      mensagem: 'Produto adicionado ao carrinho.',
      carrinho: { total_itens: totalItens, total, itens }
    });
  } catch (err) {
    console.error('Erro ao adicionar produto:', err);
    res.status(500).json({ erro: 'Erro ao adicionar produto ao carrinho.' });
  }
});

// ==================== ATUALIZAR QUANTIDADE ====================
router.put('/atualizar', validarQuantidade, (req, res) => {
  const userId = req.utilizador.id;
  const { produto_id, quantidade } = req.body;

  try {
    const carrinho = getCarrinho(userId);

    if (!carrinho) {
      return res.status(404).json({ erro: 'Carrinho não encontrado.' });
    }

    const itemExistente = db.prepare(`
      SELECT id, quantidade
      FROM carrinho_itens
      WHERE carrinho_id = ? AND produto_id = ?
    `).get(carrinho.id, produto_id);

    if (!itemExistente) {
      return res.status(404).json({ erro: 'Produto não encontrado no carrinho.' });
    }

    if (quantidade === 0) {
      db.prepare('DELETE FROM carrinho_itens WHERE carrinho_id = ? AND produto_id = ?')
        .run(carrinho.id, produto_id);

      const { itens, total, totalItens } = getCarrinhoComItens(carrinho.id);
      return res.json({
        success: true,
        mensagem: 'Produto removido do carrinho.',
        carrinho: { total_itens: totalItens, total, itens }
      });
    }

    const produto = db.prepare('SELECT stock, nome FROM produtos WHERE id = ?').get(produto_id);

    if (!produto) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }

    if (produto.stock < quantidade) {
      return res.status(400).json({
        erro: `Stock insuficiente para "${produto.nome}". Disponível: ${produto.stock} unidades.`,
        stock_disponivel: produto.stock
      });
    }

    db.prepare(`
      UPDATE carrinho_itens
      SET quantidade = ?
      WHERE carrinho_id = ? AND produto_id = ?
    `).run(quantidade, carrinho.id, produto_id);

    const { itens, total, totalItens } = getCarrinhoComItens(carrinho.id);

    res.json({
      success: true,
      mensagem: 'Carrinho atualizado.',
      carrinho: { total_itens: totalItens, total, itens }
    });
  } catch (err) {
    console.error('Erro ao atualizar carrinho:', err);
    res.status(500).json({ erro: 'Erro ao atualizar carrinho.' });
  }
});

// ==================== REMOVER PRODUTO ====================
router.delete('/remover/:id', validarId, (req, res) => {
  const userId = req.utilizador.id;
  const produto_id = req.params.id;

  try {
    const carrinho = getCarrinho(userId);

    if (!carrinho) {
      return res.status(404).json({ erro: 'Carrinho não encontrado.' });
    }

    const itemExistente = db.prepare(`
      SELECT id FROM carrinho_itens
      WHERE carrinho_id = ? AND produto_id = ?
    `).get(carrinho.id, produto_id);

    if (!itemExistente) {
      return res.status(404).json({ erro: 'Produto não encontrado no carrinho.' });
    }

    db.prepare('DELETE FROM carrinho_itens WHERE carrinho_id = ? AND produto_id = ?')
      .run(carrinho.id, produto_id);

    const { itens, total, totalItens } = getCarrinhoComItens(carrinho.id);

    res.json({
      success: true,
      mensagem: 'Produto removido do carrinho.',
      carrinho: { total_itens: totalItens, total, itens }
    });
  } catch (err) {
    console.error('Erro ao remover produto:', err);
    res.status(500).json({ erro: 'Erro ao remover produto do carrinho.' });
  }
});

// ==================== LIMPAR CARRINHO ====================
router.delete('/limpar', (req, res) => {
  const userId = req.utilizador.id;

  try {
    const carrinho = getCarrinho(userId);

    if (!carrinho) {
      return res.status(404).json({ erro: 'Carrinho não encontrado.' });
    }

    db.prepare('DELETE FROM carrinho_itens WHERE carrinho_id = ?').run(carrinho.id);

    res.json({
      success: true,
      mensagem: 'Carrinho limpo com sucesso.',
      carrinho: { total_itens: 0, total: 0, itens: [] }
    });
  } catch (err) {
    console.error('Erro ao limpar carrinho:', err);
    res.status(500).json({ erro: 'Erro ao limpar carrinho.' });
  }
});

// ==================== RESUMO PARA CHECKOUT ====================
router.get('/resumo', (req, res) => {
  const userId = req.utilizador.id;

  try {
    const carrinho = getCarrinho(userId);

    if (!carrinho) {
      return res.json({
        success: true,
        carrinho: { total_itens: 0, total: 0, itens: [] }
      });
    }

    const { itens, total, totalItens } = getCarrinhoComItens(carrinho.id);
    const user = db.prepare('SELECT creditos FROM utilizadores WHERE id = ?').get(userId);
    const creditos = user?.creditos || 0;

    res.json({
      success: true,
      carrinho: {
        id: carrinho.id,
        total_itens: totalItens,
        total,
        itens
      },
      utilizador: {
        creditos,
        pode_comprar: creditos >= total,
        faltam_creditos: creditos < total ? total - creditos : 0
      }
    });
  } catch (err) {
    console.error('Erro ao buscar resumo:', err);
    res.status(500).json({ erro: 'Erro ao buscar resumo do carrinho.' });
  }
});

module.exports = router;