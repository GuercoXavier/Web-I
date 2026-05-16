const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../config/database');
const { autenticar, somenteAdmin } = require('../middleware/auth');
const { validarProduto, validarId, limitarDescricao } = require('../middleware/validacao');

const router = express.Router();

// ==================== FUNÇÃO AUXILIAR: URL absoluta para imagens ====================
function normalizarImagemUrl(imagem) {
    if (!imagem) return '';
    if (imagem.startsWith('http://') || imagem.startsWith('https://')) return imagem;
    if (imagem.startsWith('/')) {
        const baseUrl = process.env.BASE_URL || `http://localhost:3000`;
        return `${baseUrl}${imagem}`;
    }
    return imagem;
}

// ==================== FUNÇÃO AUXILIAR: converter preço de centavos para unidade ====================
function converterPreco(produto) {
    if (!produto) return produto;
    const convertido = { ...produto };
    if (convertido.preco !== undefined && convertido.preco !== null) {
        convertido.preco = Math.round(convertido.preco) / 100;
    }
    if (convertido.imagem) {
        convertido.imagem = normalizarImagemUrl(convertido.imagem);
    }
    return convertido;
}

function converterPrecosArray(produtos) {
    return produtos.map(p => converterPreco(p));
}

// ==================== CONFIGURAÇÃO DO UPLOAD ====================
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
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Formato inválido. Use JPG, PNG ou WEBP.'), false);
        }
    }
});

// ==================== ROTAS LITERAIS (antes de /:id) ====================
router.get('/destaque/lista', (req, res) => {
    try {
        const produtos = db.prepare(`
            SELECT id, nome, preco, imagem, stock, em_destaque
            FROM produtos
            WHERE em_destaque = 1 AND stock > 0
            ORDER BY id DESC
            LIMIT 8
        `).all();
        const produtosConvertidos = converterPrecosArray(produtos);
        res.json({ success: true, produtos: produtosConvertidos, total: produtosConvertidos.length });
    } catch (err) {
        console.error('Erro ao buscar produtos em destaque:', err);
        res.status(500).json({ erro: 'Erro ao buscar produtos em destaque.' });
    }
});

router.get('/marcas/lista', (req, res) => {
    try {
        const marcas = db.prepare(`
            SELECT DISTINCT marca, COUNT(*) as total
            FROM produtos
            WHERE marca != ''
            GROUP BY marca
            ORDER BY marca ASC
        `).all();
        res.json({ success: true, marcas });
    } catch (err) {
        console.error('Erro ao buscar marcas:', err);
        res.status(500).json({ erro: 'Erro ao buscar marcas.' });
    }
});

router.get('/mais-vendidos/lista', (req, res) => {
    try {
        const produtos = db.prepare(`
            SELECT p.id, p.nome, p.preco, p.imagem, SUM(pi.quantidade) as total_vendidos
            FROM produtos p
            JOIN pedido_itens pi ON pi.produto_id = p.id
            JOIN pedidos ped ON ped.id = pi.pedido_id
            WHERE ped.estado = 'entregue'
            GROUP BY p.id
            ORDER BY total_vendidos DESC
            LIMIT 10
        `).all();
        const produtosConvertidos = converterPrecosArray(produtos);
        res.json({ success: true, produtos: produtosConvertidos, total: produtosConvertidos.length });
    } catch (err) {
        console.error('Erro ao buscar produtos mais vendidos:', err);
        res.status(500).json({ erro: 'Erro ao buscar produtos mais vendidos.' });
    }
});

// ==================== GET ALL PRODUTOS ====================
router.get('/', (req, res) => {
    try {
        const { categoria, subcategoria, marca, min, max, stock, destaque, q, sort, limite = 100, pagina = 1 } = req.query;
        let query = `
            SELECT p.*, c.nome AS categoria_nome, s.nome AS subcategoria_nome
            FROM produtos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            LEFT JOIN subcategorias s ON p.subcategoria_id = s.id
            WHERE 1=1
        `;
        const params = [];

        if (categoria) { query += ' AND LOWER(c.nome) = LOWER(?)'; params.push(categoria); }
        if (subcategoria) { query += ' AND LOWER(s.nome) = LOWER(?)'; params.push(subcategoria); }
        if (marca) {
            if (Array.isArray(marca)) {
                const placeholders = marca.map(() => 'LOWER(p.marca) = LOWER(?)').join(' OR ');
                query += ` AND (${placeholders})`;
                marca.forEach(m => params.push(m));
            } else {
                query += ' AND LOWER(p.marca) = LOWER(?)';
                params.push(marca);
            }
        }
        if (min !== undefined && min > 0) { query += ' AND p.preco >= ?'; params.push(Number(min) * 100); }
        if (max !== undefined && max > 0) { query += ' AND p.preco <= ?'; params.push(Number(max) * 100); }
        if (stock === '1') { query += ' AND p.stock > 0'; }
        if (destaque === '1') { query += ' AND p.em_destaque = 1'; }
        if (q) {
            query += ` AND (LOWER(p.nome) LIKE LOWER(?) OR LOWER(p.descricao) LIKE LOWER(?) OR LOWER(p.marca) LIKE LOWER(?))`;
            params.push(`%${q}%`, `%${q}%`, `%${q}%`);
        }

        const orderMap = { preco_asc: 'p.preco ASC', preco_desc: 'p.preco DESC', recentes: 'p.id DESC', stock: 'p.stock DESC', nome_asc: 'p.nome ASC', nome_desc: 'p.nome DESC' };
        const orderBy = orderMap[sort] || 'p.id DESC';
        query += ` ORDER BY ${orderBy}`;
        const offset = (parseInt(pagina) - 1) * parseInt(limite);
        query += ` LIMIT ? OFFSET ?`;
        params.push(parseInt(limite), offset);

        const result = db.prepare(query).all(...params);
        // Calcular total de registos (ignorando paginação)
        let countQuery = `SELECT COUNT(*) as total FROM produtos p LEFT JOIN categorias c ON p.categoria_id = c.id LEFT JOIN subcategorias s ON p.subcategoria_id = s.id WHERE 1=1`;
        const countParams = [];
        if (categoria) { countQuery += ' AND LOWER(c.nome) = LOWER(?)'; countParams.push(categoria); }
        if (subcategoria) { countQuery += ' AND LOWER(s.nome) = LOWER(?)'; countParams.push(subcategoria); }
        if (marca) {
            if (Array.isArray(marca)) {
                const placeholders = marca.map(() => 'LOWER(p.marca) = LOWER(?)').join(' OR ');
                countQuery += ` AND (${placeholders})`;
                marca.forEach(m => countParams.push(m));
            } else {
                countQuery += ' AND LOWER(p.marca) = LOWER(?)';
                countParams.push(marca);
            }
        }
        if (min !== undefined && min > 0) { countQuery += ' AND p.preco >= ?'; countParams.push(Number(min) * 100); }
        if (max !== undefined && max > 0) { countQuery += ' AND p.preco <= ?'; countParams.push(Number(max) * 100); }
        if (stock === '1') { countQuery += ' AND p.stock > 0'; }
        if (destaque === '1') { countQuery += ' AND p.em_destaque = 1'; }
        if (q) { countQuery += ` AND (LOWER(p.nome) LIKE LOWER(?) OR LOWER(p.descricao) LIKE LOWER(?) OR LOWER(p.marca) LIKE LOWER(?))`; countParams.push(`%${q}%`, `%${q}%`, `%${q}%`); }
        const total = db.prepare(countQuery).get(...countParams)?.total || 0;

        const produtosConvertidos = converterPrecosArray(result);
        // O frontend espera um array diretamente
        res.json(produtosConvertidos);
    } catch (err) {
        console.error('Erro ao buscar produtos:', err);
        res.status(500).json({ erro: 'Erro interno ao carregar produtos.' });
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
        const produtoConvertido = converterPreco(produto);
        // Retorna o produto directamente (sem wrapper) para compatibilidade com o frontend
        res.json(produtoConvertido);
    } catch (err) {
        console.error('Erro ao buscar produto:', err);
        res.status(500).json({ erro: 'Erro interno ao carregar produto.' });
    }
});

// ==================== CREATE ====================
router.post('/', autenticar, somenteAdmin, upload.single('imagem'), validarProduto, limitarDescricao, (req, res) => {
    try {
        const { nome, descricao = '', preco, stock = 0, marca = '', categoria_id = null, subcategoria_id = null, em_destaque = 0 } = req.body;
        const imagem = req.file ? `/uploads/produtos/${req.file.filename}` : '';

        // Validação de categoria/subcategoria (omitida para brevidade, mas deve permanecer)
        const result = db.prepare(`
            INSERT INTO produtos (nome, descricao, preco, stock, marca, imagem, categoria_id, subcategoria_id, em_destaque)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(nome, descricao, preco, stock, marca, imagem, categoria_id || null, subcategoria_id || null, em_destaque ? 1 : 0);

        res.status(201).json({
            success: true,
            mensagem: 'Produto adicionado com sucesso.',
            id: result.lastInsertRowid,
            imagem: normalizarImagemUrl(imagem),
            preco: preco / 100
        });
    } catch (err) {
        console.error('Erro ao criar produto:', err);
        if (req.file) { try { fs.unlinkSync(req.file.path); } catch (e) {} }
        res.status(500).json({ erro: 'Erro interno ao criar produto.' });
    }
});

// ==================== UPDATE ====================
router.put('/:id', autenticar, somenteAdmin, validarId, upload.single('imagem'), validarProduto, limitarDescricao, (req, res) => {
    try {
        const { id } = req.params;
        const produto = db.prepare('SELECT * FROM produtos WHERE id = ?').get(id);
        if (!produto) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(404).json({ erro: 'Produto não encontrado.' });
        }
        const { nome = produto.nome, descricao = produto.descricao, preco = produto.preco, stock = produto.stock, marca = produto.marca, categoria_id = produto.categoria_id, subcategoria_id = produto.subcategoria_id, em_destaque = produto.em_destaque } = req.body;
        if (stock < 0) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ erro: 'Stock não pode ser negativo.' });
        }
        let imagem = produto.imagem;
        if (req.file) {
            if (produto.imagem && produto.imagem !== '') {
                const oldPath = path.join(__dirname, '../..', produto.imagem);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            imagem = `/uploads/produtos/${req.file.filename}`;
        }
        db.prepare(`
            UPDATE produtos
            SET nome=?, descricao=?, preco=?, stock=?, marca=?, imagem=?,
                categoria_id=?, subcategoria_id=?, em_destaque=?
            WHERE id=?
        `).run(nome, descricao, preco, stock, marca, imagem, categoria_id || null, subcategoria_id || null, em_destaque ? 1 : 0, id);
        res.json({
            success: true,
            mensagem: 'Produto atualizado com sucesso.',
            id: parseInt(id),
            preco: preco / 100
        });
    } catch (err) {
        console.error('Erro ao atualizar produto:', err);
        if (req.file) { try { fs.unlinkSync(req.file.path); } catch (e) {} }
        res.status(500).json({ erro: 'Erro interno ao atualizar produto.' });
    }
});

// ==================== DELETE ====================
router.delete('/:id', autenticar, somenteAdmin, validarId, (req, res) => {
    try {
        const { id } = req.params;
        const produto = db.prepare('SELECT id, nome, imagem FROM produtos WHERE id = ?').get(id);
        if (!produto) return res.status(404).json({ erro: 'Produto não encontrado.' });
        if (produto.imagem && produto.imagem !== '') {
            const imagePath = path.join(__dirname, '../..', produto.imagem);
            if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
        }
        db.prepare('DELETE FROM carrinho_itens WHERE produto_id = ?').run(id);
        db.prepare('DELETE FROM pedido_itens WHERE produto_id = ?').run(id);
        const result = db.prepare('DELETE FROM produtos WHERE id = ?').run(id);
        if (result.changes === 0) return res.status(404).json({ erro: 'Produto não encontrado.' });
        res.json({ success: true, mensagem: 'Produto removido com sucesso.', produto_id: id, produto_nome: produto.nome });
    } catch (err) {
        console.error('Erro ao remover produto:', err);
        res.status(500).json({ erro: 'Erro interno ao remover produto.' });
    }
});

// ==================== ATUALIZAR STOCK ====================
router.patch('/:id/stock', autenticar, somenteAdmin, validarId, (req, res) => {
    try {
        const { id } = req.params;
        const { stock } = req.body;
        if (stock === undefined || stock < 0) return res.status(400).json({ erro: 'Stock inválido. Deve ser um número não negativo.' });
        const produto = db.prepare('SELECT id, nome FROM produtos WHERE id = ?').get(id);
        if (!produto) return res.status(404).json({ erro: 'Produto não encontrado.' });
        db.prepare('UPDATE produtos SET stock = ? WHERE id = ?').run(stock, id);
        res.json({ success: true, mensagem: 'Stock atualizado com sucesso.', produto_id: id, novo_stock: stock });
    } catch (err) {
        console.error('Erro ao atualizar stock:', err);
        res.status(500).json({ erro: 'Erro interno ao atualizar stock.' });
    }
});

module.exports = router;