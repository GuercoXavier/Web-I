const express = require('express');

const authRouter = require('./auth');
const produtosRouter = require('./produtos');
const carrinhoRouter = require('./carrinho');
const pedidosRouter = require('./pedidos');
const categoriasRouter = require('./categorias');
const usersRoutes = require('./users');

const router = express.Router();
router.post('/', autenticar, somenteAdmin, upload.single('imagem'), (req, res) => {
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

        if (!nome || preco === undefined || preco < 0 || stock < 0) {
            return res.status(400).json({ erro: 'Dados inválidos.' });
        }

        const result = db.prepare(`
            INSERT INTO produtos (nome, descricao, preco, stock, marca, imagem, categoria_id, subcategoria_id, em_destaque)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(nome, descricao, preco, stock, marca, imagem, categoria_id, subcategoria_id, em_destaque ? 1 : 0);

        return res.status(201).json({
            mensagem: 'Produto adicionado.',
            id: result.lastInsertRowid,
            imagem
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ erro: 'Erro interno.' });
    }
});
router.use('/auth', authRouter);
router.use('/produtos', produtosRouter);
router.use('/carrinho', carrinhoRouter);
router.use('/pedidos', pedidosRouter);
router.use('/categorias', categoriasRouter);
router.use('/users', usersRoutes);
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

router.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada' });
});

module.exports = router;