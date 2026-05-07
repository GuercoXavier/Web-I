const express = require('express');
const db = require('../config/database');

const router = express.Router();

// ─────────────────────────────────────────────
// GET /categorias (com subcategorias)
// versão otimizada
// ─────────────────────────────────────────────
router.get('/', (req, res) => {
  const categorias = db.prepare(`
    SELECT * FROM categorias
    ORDER BY nome ASC
  `).all();

  const subcategorias = db.prepare(`
    SELECT * FROM subcategorias
    ORDER BY nome ASC
  `).all();

  const result = categorias.map(cat => ({
    ...cat,
    subcategorias: subcategorias.filter(
      sub => sub.categoria_id === cat.id
    )
  }));

  res.json(result);
});

// ─────────────────────────────────────────────
// GET /categorias/:id
// ─────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const categoria = db.prepare(`
    SELECT * FROM categorias WHERE id = ?
  `).get(req.params.id);

  if (!categoria) {
    return res.status(404).json({
      erro: 'Categoria não encontrada.'
    });
  }

  const subcategorias = db.prepare(`
    SELECT * FROM subcategorias
    WHERE categoria_id = ?
    ORDER BY nome ASC
  `).all(categoria.id);

  res.json({
    ...categoria,
    subcategorias
  });
});

module.exports = router;