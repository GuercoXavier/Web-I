const express = require('express');
const db = require('../config/database');
const { validarId } = require('../middleware/validacao');

const router = express.Router();

// ==================== GET CATEGORIAS COM SUBCATEGORIAS (OTIMIZADO) ====================
router.get('/', (req, res) => {
  try {
    const result = db.prepare(`
      SELECT 
        c.id,
        c.nome,
        COALESCE(
          json_group_array(
            CASE WHEN s.id IS NOT NULL THEN 
              json_object('id', s.id, 'nome', s.nome, 'categoria_id', s.categoria_id)
            END
          ),
          '[]'
        ) as subcategorias_json
      FROM categorias c
      LEFT JOIN subcategorias s ON s.categoria_id = c.id
      GROUP BY c.id
      ORDER BY c.nome ASC
    `).all();

    // Converter JSON string para array
    const categorias = result.map(cat => ({
      id: cat.id,
      nome: cat.nome,
      subcategorias: JSON.parse(cat.subcategorias_json).filter(s => s !== null)
    }));

    res.json(categorias);

  } catch (err) {
    console.error('Erro ao buscar categorias:', err);
    res.status(500).json({ erro: 'Erro interno ao carregar categorias.' });
  }
});

// ==================== GET CATEGORIA POR ID ====================
router.get('/:id', validarId, (req, res) => {
  const { id } = req.params;
  
  try {
    const categoria = db.prepare(`
      SELECT id, nome FROM categorias WHERE id = ?
    `).get(id);

    if (!categoria) {
      return res.status(404).json({ erro: 'Categoria não encontrada.' });
    }

    const subcategorias = db.prepare(`
      SELECT id, nome, categoria_id
      FROM subcategorias
      WHERE categoria_id = ?
      ORDER BY nome ASC
    `).all(id);

    res.json({
      id: categoria.id,
      nome: categoria.nome,
      subcategorias
    });

  } catch (err) {
    console.error('Erro ao buscar categoria:', err);
    res.status(500).json({ erro: 'Erro interno ao carregar categoria.' });
  }
});

module.exports = router;