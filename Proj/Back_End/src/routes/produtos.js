const express = require('express');
const db = require('../config/database');
const { autenticar, somenteAdmin } = require('../middleware/auth');

const router = express.Router();

const cache = new Map();
const CACHE_TTL = 30 * 1000;

function setCache(key, data) {
  cache.set(key, {
    data,
    expire: Date.now() + CACHE_TTL
  });
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

// GET ALL PRODUTOS
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

    if (min !== undefined) {
      query += ' AND p.preco >= ?';
      params.push(Number(min));
    }

    if (max !== undefined) {
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

// GET BY ID
router.get('/:id', (req, res) => {
  try {
    const produto = db.prepare(`
      SELECT p.*, c.nome AS categoria_nome, s.nome AS subcategoria_nome
      FROM produtos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN subcategorias s ON p.subcategoria_id = s.id
      WHERE p.id = ?
    `).get(req.params.id);

    if (!produto) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }

    return res.json(produto);

  } catch (err) {
    return res.status(500).json({ erro: 'Erro interno.' });
  }
});

// CREATE
router.post('/', autenticar, somenteAdmin, (req, res) => {
  try {
    const {
      nome,
      descricao = '',
      preco,
      stock = 0,
      marca = '',
      imagem = '',
      categoria_id = null,
      subcategoria_id = null,
      em_destaque = 0
    } = req.body;

    if (!nome || preco === undefined || preco < 0 || stock < 0) {
      return res.status(400).json({ erro: 'Dados inválidos.' });
    }

    const result = db.prepare(`
      INSERT INTO produtos
      (nome, descricao, preco, stock, marca, imagem, categoria_id, subcategoria_id, em_destaque)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      nome,
      descricao,
      preco,
      stock,
      marca,
      imagem,
      categoria_id,
      subcategoria_id,
      em_destaque ? 1 : 0
    );

    return res.status(201).json({
      mensagem: 'Produto adicionado.',
      id: result.lastInsertRowid
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno.' });
  }
});

// UPDATE
router.put('/:id', autenticar, somenteAdmin, (req, res) => {
  try {
    const produto = db.prepare('SELECT * FROM produtos WHERE id = ?').get(req.params.id);

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
    `).run(
      nome,
      descricao,
      preco,
      stock,
      marca,
      imagem,
      categoria_id,
      subcategoria_id,
      em_destaque,
      req.params.id
    );

    return res.json({ mensagem: 'Produto atualizado.' });

  } catch (err) {
    return res.status(500).json({ erro: 'Erro interno.' });
  }
});

// DELETE - REMOVER PRODUTO (CORRIGIDO)
// DELETE - REMOVER PRODUTO (COM CASCADE MANUAL)
router.delete('/:id', autenticar, somenteAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ erro: 'ID inválido.' });
    }
    
    const produto = db.prepare('SELECT id FROM produtos WHERE id = ?').get(id);
    
    if (!produto) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }
    
    // Remover referências primeiro
    db.prepare('DELETE FROM carrinho_itens WHERE produto_id = ?').run(id);
    db.prepare('DELETE FROM pedido_itens WHERE produto_id = ?').run(id);
    
    // Agora remover o produto
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
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configurar multer
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
module.exports = router;