const express = require('express');
const db = require('../config/database');
const { autenticar, somenteAdmin } = require('../middleware/auth');

const router = express.Router();

// =====================
// LISTAR UTILIZADORES (ADMIN)
// =====================
router.get('/', autenticar, somenteAdmin, (req, res) => {
  try {
    const users = db.prepare(`
      SELECT id, username, email, role, criado_em
      FROM utilizadores
      ORDER BY id DESC
    `).all();

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar utilizadores' });
  }
});

// =====================
// OBTER UTILIZADOR POR ID
// =====================
router.get('/:id', autenticar, somenteAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ erro: 'ID inválido' });
    }

    const user = db.prepare(`
      SELECT id, username, email, role, criado_em
      FROM utilizadores
      WHERE id = ?
    `).get(id);

    if (!user) {
      return res.status(404).json({ erro: 'Utilizador não encontrado' });
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro no servidor' });
  }
});

// =====================
// ALTERAR ROLE (ADMIN CONTROL)
// =====================
router.patch('/:id/role', autenticar, somenteAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);
    const { role } = req.body;

    const rolesValidos = ['cliente', 'admin'];

    if (!Number.isInteger(id)) {
      return res.status(400).json({ erro: 'ID inválido' });
    }

    if (!rolesValidos.includes(role)) {
      return res.status(400).json({ erro: 'Role inválido' });
    }

    const result = db.prepare(`
      UPDATE utilizadores
      SET role = ?
      WHERE id = ?
    `).run(role, id);

    if (result.changes === 0) {
      return res.status(404).json({ erro: 'Utilizador não encontrado' });
    }

    res.json({ mensagem: 'Role atualizado com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao atualizar role' });
  }
});

// =====================
// REMOVER UTILIZADOR (ADMIN)
// =====================
router.delete('/:id', autenticar, somenteAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ erro: 'ID inválido' });
    }

    const result = db.prepare(`
      DELETE FROM utilizadores WHERE id = ?
    `).run(id);

    if (result.changes === 0) {
      return res.status(404).json({ erro: 'Utilizador não encontrado' });
    }

    res.json({ mensagem: 'Utilizador removido com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao remover utilizador' });
  }
});

module.exports = router;