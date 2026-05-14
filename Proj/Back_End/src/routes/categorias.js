const express = require('express');
const { db } = require('../config/database');
const { autenticar, somenteAdmin } = require('../middleware/auth');
const { validarId } = require('../middleware/validacao');

const router = express.Router();

// ==================== GET CATEGORIAS COM SUBCATEGORIAS ====================
router.get('/', (req, res) => {
  try {
    const categorias = db.prepare(`
      SELECT id, nome
      FROM categorias
      ORDER BY nome ASC
    `).all();

    const resultado = categorias.map(cat => {
      const subcategorias = db.prepare(`
        SELECT
          s.id,
          s.nome,
          s.categoria_id,
          COUNT(p.id) as produtos_count
        FROM subcategorias s
        LEFT JOIN produtos p
          ON p.subcategoria_id = s.id
        WHERE s.categoria_id = ?
        GROUP BY s.id
        ORDER BY s.nome ASC
      `).all(cat.id);

      return {
        id: cat.id,
        nome: cat.nome,
        subcategorias,
        total_produtos: subcategorias.reduce(
          (sum, sub) => sum + sub.produtos_count,
          0
        )
      };
    });

    res.json({
      success: true,
      categorias: resultado
    });

  } catch (err) {
    console.error('Erro ao buscar categorias:', err);

    res.status(500).json({
      erro: 'Erro interno ao carregar categorias.'
    });
  }
});

// ==================== GET SUBCATEGORIA POR ID ====================
// ⚠️ Deve vir antes de "/:id"
router.get('/subcategoria/:id', validarId, (req, res) => {
  try {
    const { id } = req.params;

    const subcategoria = db.prepare(`
      SELECT
        s.id,
        s.nome,
        s.categoria_id,
        c.nome as categoria_nome
      FROM subcategorias s
      LEFT JOIN categorias c
        ON c.id = s.categoria_id
      WHERE s.id = ?
    `).get(id);

    if (!subcategoria) {
      return res.status(404).json({
        erro: 'Subcategoria não encontrada.'
      });
    }

    const produtos = db.prepare(`
      SELECT
        id,
        nome,
        preco,
        imagem,
        stock
      FROM produtos
      WHERE subcategoria_id = ?
      ORDER BY criado_em DESC
      LIMIT 20
    `).all(id);

    const totalProdutos = db.prepare(`
      SELECT COUNT(*) as total
      FROM produtos
      WHERE subcategoria_id = ?
    `).get(id);

    res.json({
      success: true,
      subcategoria,
      produtos,
      total_produtos: totalProdutos.total
    });

  } catch (err) {
    console.error('Erro ao buscar subcategoria:', err);

    res.status(500).json({
      erro: 'Erro interno ao carregar subcategoria.'
    });
  }
});

// ==================== GET CATEGORIA POR ID ====================
router.get('/:id', validarId, (req, res) => {
  try {
    const { id } = req.params;

    const categoria = db.prepare(`
      SELECT id, nome
      FROM categorias
      WHERE id = ?
    `).get(id);

    if (!categoria) {
      return res.status(404).json({
        erro: 'Categoria não encontrada.'
      });
    }

    const subcategorias = db.prepare(`
      SELECT
        s.id,
        s.nome,
        s.categoria_id,
        COUNT(p.id) as produtos_count
      FROM subcategorias s
      LEFT JOIN produtos p
        ON p.subcategoria_id = s.id
      WHERE s.categoria_id = ?
      GROUP BY s.id
      ORDER BY s.nome ASC
    `).all(id);

    res.json({
      success: true,
      categoria: {
        ...categoria,
        subcategorias,
        total_produtos: subcategorias.reduce(
          (sum, sub) => sum + sub.produtos_count,
          0
        )
      }
    });

  } catch (err) {
    console.error('Erro ao buscar categoria:', err);

    res.status(500).json({
      erro: 'Erro interno ao carregar categoria.'
    });
  }
});

// ==================== CRIAR CATEGORIA (ADMIN) ====================
router.post('/', autenticar, somenteAdmin, (req, res) => {
  try {
    const { nome } = req.body;

    if (
      typeof nome !== 'string' ||
      nome.trim().length < 3
    ) {
      return res.status(400).json({
        erro: 'Nome da categoria deve ter pelo menos 3 caracteres.'
      });
    }

    const nomeFormatado = nome.trim();

    const existing = db.prepare(`
      SELECT id
      FROM categorias
      WHERE LOWER(nome) = LOWER(?)
    `).get(nomeFormatado);

    if (existing) {
      return res.status(400).json({
        erro: 'Categoria já existe.'
      });
    }

    const result = db.prepare(`
      INSERT INTO categorias (nome)
      VALUES (?)
    `).run(nomeFormatado);

    res.status(201).json({
      success: true,
      mensagem: 'Categoria criada com sucesso.',
      id: result.lastInsertRowid,
      nome: nomeFormatado
    });

  } catch (err) {
    console.error('Erro ao criar categoria:', err);

    res.status(500).json({
      erro: 'Erro interno ao criar categoria.'
    });
  }
});

// ==================== CRIAR SUBCATEGORIA (ADMIN) ====================
router.post('/subcategoria', autenticar, somenteAdmin, (req, res) => {
  try {
    const { nome, categoria_id } = req.body;

    if (
      typeof nome !== 'string' ||
      nome.trim().length < 3
    ) {
      return res.status(400).json({
        erro: 'Nome da subcategoria deve ter pelo menos 3 caracteres.'
      });
    }

    const categoriaId = parseInt(categoria_id);

    if (isNaN(categoriaId) || categoriaId <= 0) {
      return res.status(400).json({
        erro: 'ID da categoria inválido.'
      });
    }

    const categoria = db.prepare(`
      SELECT id
      FROM categorias
      WHERE id = ?
    `).get(categoriaId);

    if (!categoria) {
      return res.status(404).json({
        erro: 'Categoria não encontrada.'
      });
    }

    const nomeFormatado = nome.trim();

    const existing = db.prepare(`
      SELECT id
      FROM subcategorias
      WHERE LOWER(nome) = LOWER(?)
      AND categoria_id = ?
    `).get(nomeFormatado, categoriaId);

    if (existing) {
      return res.status(400).json({
        erro: 'Subcategoria já existe nesta categoria.'
      });
    }

    const result = db.prepare(`
      INSERT INTO subcategorias (nome, categoria_id)
      VALUES (?, ?)
    `).run(nomeFormatado, categoriaId);

    res.status(201).json({
      success: true,
      mensagem: 'Subcategoria criada com sucesso.',
      id: result.lastInsertRowid,
      nome: nomeFormatado,
      categoria_id: categoriaId
    });

  } catch (err) {
    console.error('Erro ao criar subcategoria:', err);

    res.status(500).json({
      erro: 'Erro interno ao criar subcategoria.'
    });
  }
});

// ==================== DELETAR CATEGORIA (ADMIN) ====================
router.delete('/:id', autenticar, somenteAdmin, validarId, (req, res) => {
  try {
    const { id } = req.params;

    const categoria = db.prepare(`
      SELECT id, nome
      FROM categorias
      WHERE id = ?
    `).get(id);

    if (!categoria) {
      return res.status(404).json({
        erro: 'Categoria não encontrada.'
      });
    }

    const produtosCount = db.prepare(`
      SELECT COUNT(*) as total
      FROM produtos
      WHERE categoria_id = ?
    `).get(id);

    if (produtosCount.total > 0) {
      return res.status(400).json({
        erro: `Não é possível remover a categoria "${categoria.nome}". Existem ${produtosCount.total} produtos associados.`
      });
    }

    db.prepare(`
      DELETE FROM categorias
      WHERE id = ?
    `).run(id);

    res.json({
      success: true,
      mensagem: 'Categoria removida com sucesso.'
    });

  } catch (err) {
    console.error('Erro ao remover categoria:', err);

    res.status(500).json({
      erro: 'Erro interno ao remover categoria.'
    });
  }
});

module.exports = router;