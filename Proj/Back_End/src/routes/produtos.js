const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const { autenticar, somenteAdmin } = require('../middleware/auth');
const { validarProduto, validarId, limitarDescricao } = require('../middleware/validacao');

const router = express.Router();

// ==================== CONFIGURAR MULTER (UPLOAD DE IMAGENS) ====================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/produtos');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, unique + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Formato inválido'), false);
  }
});

// ==================== CACHE ====================
const cache = new Map();
const CACHE_TTL = 30 * 1000;

function setCache(key, data) {
  cache.set(key, { data, expire: Date.now() + CACHE_TTL });
}

function getCache(key) {
  const cached = cache.get(key);
  if (!cached) return null;
  if (cached.expire < Date.now()) {
    cache.delete(key);
    return null;
  }
  return cached.data;
}

// ==================== GET ALL PRODUTOS ====================
router.get('/', (req, res) => {
  try {
    const cacheKey = JSON.stringify(req.query);
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const { categoria, subcategoria, marca, min, max, stock, destaque, q, sort } = req.query;

    let query = `
      SELECT p.*, c.nome AS categoria_nome, s.nome AS subcategoria_nome
      FROM produtos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN subcategorias s ON p.subcategoria_id = s.id
      WHERE 1=1
    `;

    const params = [];

    if (categoria) {
      query += ' AND c.nome = ?';
      params.push(categoria);
    }

    if (subcategoria) {
      query += ' AND s.nome = ?';
      params.push(subcategoria);
    }

    if (marca) {
      query += ' AND p.marca = ?';
      params.push(marca);
    }

    if (min !== undefined && min > 0) {
      query += ' AND p.preco >= ?';
      params.push(Number(min));
    }

    if (max !== undefined && max > 0) {
      query += ' AND p.preco <= ?';
      params.push(Number(max));
    }

    if (stock === '1') {
      query += ' AND p.stock > 0';
    }

    if (destaque === '1') {
      query += ' AND p.em_destaque = 1';
    }

    if (q) {
      query += `
        AND (
          LOWER(p.nome) LIKE LOWER(?)
          OR LOWER(p.descricao) LIKE LOWER(?)
          OR LOWER(p.marca) LIKE LOWER(?)
        )
      `;
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    const orderMap = {
      preco_asc: 'p.preco ASC',
      preco_desc: 'p.preco DESC',
      recentes: 'p.id DESC',
      stock: 'p.stock DESC'
    };

    const orderBy = orderMap[sort] || 'p.id DESC';
    query += ` ORDER BY ${orderBy}`;

    const result = db.prepare(query).all(...params);

    setCache(cacheKey, result);
    return res.json(result);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno.' });
  }
});

// ==================== GET BY ID ====================
router.get('/:id', validarId, (req, res) => {
  try {
    const { id } = req.params;
    const produto = db.prepare(`
      SELECT p.*, c.nome AS categoria_nome, s.nome AS subcategoria_nome
      FROM produtos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN subcategorias s ON p.subcategoria_id = s.id
      WHERE p.id = ?
    `).get(id);

    if (!produto) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }

    return res.json(produto);

  } catch (err) {
    return res.status(500).json({ erro: 'Erro interno.' });
  }
});

// ==================== CREATE PRODUTO (COM UPLOAD DE IMAGEM) ====================
router.post('/', autenticar, somenteAdmin, upload.single('imagem'), validarProduto, limitarDescricao, (req, res) => {
  try {
    const {
      nome,
      descricao = '',
      preco,
      stock = 0,
      marca = '',
      categoria_id = null,
      subcategoria_id = null,
      em_destaque = 0
    } = req.body;

    const imagem = req.file ? `/uploads/produtos/${req.file.filename}` : '';

    const result = db.prepare(`
      INSERT INTO produtos (nome, descricao, preco, stock, marca, imagem, categoria_id, subcategoria_id, em_destaque)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(nome, descricao, preco, stock, marca, imagem, categoria_id, subcategoria_id, em_destaque ? 1 : 0);

    return res.status(201).json({
      mensagem: 'Produto adicionado com sucesso.',
      id: result.lastInsertRowid,
      imagem
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno.' });
  }
});

// ==================== UPDATE PRODUTO ====================
router.put('/:id', autenticar, somenteAdmin, validarId, validarProduto, limitarDescricao, (req, res) => {
  try {
    const { id } = req.params;
    const produto = db.prepare('SELECT * FROM produtos WHERE id = ?').get(id);

    if (!produto) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }

    const {
      nome = produto.nome,
      descricao = produto.descricao,
      preco = produto.preco,
      stock = produto.stock,
      marca = produto.marca,
      imagem = produto.imagem,
      categoria_id = produto.categoria_id,
      subcategoria_id = produto.subcategoria_id,
      em_destaque = produto.em_destaque
    } = req.body;

    db.prepare(`
      UPDATE produtos
      SET nome=?, descricao=?, preco=?, stock=?, marca=?, imagem=?,
          categoria_id=?, subcategoria_id=?, em_destaque=?
      WHERE id=?
    `).run(nome, descricao, preco, stock, marca, imagem, categoria_id, subcategoria_id, em_destaque, id);

    return res.json({ mensagem: 'Produto atualizado com sucesso.' });

  } catch (err) {
    return res.status(500).json({ erro: 'Erro interno.' });
  }
});

// ==================== DELETE PRODUTO (COM LIMPEZA DE DEPENDÊNCIAS) ====================
router.delete('/:id', autenticar, somenteAdmin, validarId, (req, res) => {
  try {
    const { id } = req.params;
    
    const produto = db.prepare('SELECT id FROM produtos WHERE id = ?').get(id);
    
    if (!produto) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }
    
    // Remover referências nas tabelas relacionadas
    db.prepare('DELETE FROM carrinho_itens WHERE produto_id = ?').run(id);
    db.prepare('DELETE FROM pedido_itens WHERE produto_id = ?').run(id);
    
    const result = db.prepare('DELETE FROM produtos WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }
    
    return res.json({ mensagem: 'Produto removido com sucesso.' });
    
  } catch (err) {
    console.error('Erro ao remover produto:', err.message);
    return res.status(500).json({ erro: 'Erro interno: ' + err.message });
  }
});

module.exports = router;