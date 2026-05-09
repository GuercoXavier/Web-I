const express = require('express');
const db = require('../config/database');
const { autenticar, somenteAdmin } = require('../middleware/auth');
const { validarId } = require('../middleware/validacao');

const router = express.Router();

// ===================== LISTAR UTILIZADORES (ADMIN) =====================
router.get('/', autenticar, somenteAdmin, (req, res) => {
  try {
    const users = db.prepare(`
      SELECT id, username, email, role, creditos, criado_em
      FROM utilizadores
      ORDER BY id DESC
    `).all();

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar utilizadores' });
  }
});

// ===================== OBTER UTILIZADOR POR ID =====================
router.get('/:id', autenticar, somenteAdmin, validarId, (req, res) => {
  try {
    const { id } = req.params;
    
    const user = db.prepare(`
      SELECT id, username, email, role, creditos, criado_em
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

// ===================== ALTERAR ROLE (ADMIN CONTROL) =====================
router.patch('/:id/role', autenticar, somenteAdmin, validarId, (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const rolesValidos = ['cliente', 'admin'];

    if (!rolesValidos.includes(role)) {
      return res.status(400).json({ erro: 'Role inválido' });
    }

    // Verificar se não está tentando remover o próprio admin
    if (req.utilizador.id === id && role !== 'admin') {
      return res.status(400).json({ erro: 'Não pode alterar o seu próprio role' });
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

// ===================== REMOVER UTILIZADOR (ADMIN) =====================
router.delete('/:id', autenticar, somenteAdmin, validarId, (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar se não está tentando remover a si mesmo
    if (req.utilizador.id === id) {
      return res.status(400).json({ erro: 'Não pode remover o seu próprio perfil' });
    }
    
    // Verificar se é admin
    const user = db.prepare('SELECT role FROM utilizadores WHERE id = ?').get(id);
    if (user && user.role === 'admin') {
      return res.status(400).json({ erro: 'Não pode remover outro administrador' });
    }

    // Remover transações de créditos primeiro
    db.prepare('DELETE FROM transacoes_creditos WHERE utilizador_id = ?').run(id);
    
    // Remover utilizador
    const result = db.prepare(`DELETE FROM utilizadores WHERE id = ?`).run(id);

    if (result.changes === 0) {
      return res.status(404).json({ erro: 'Utilizador não encontrado' });
    }

    res.json({ mensagem: 'Utilizador removido com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao remover utilizador' });
  }
});

// ===================== OBTER CRÉDITOS DO UTILIZADOR =====================
router.get('/:id/creditos', autenticar, somenteAdmin, validarId, (req, res) => {
  try {
    const { id } = req.params;
    
    const user = db.prepare(`
      SELECT id, username, creditos
      FROM utilizadores
      WHERE id = ?
    `).get(id);

    if (!user) {
      return res.status(404).json({ erro: 'Utilizador não encontrado' });
    }

    const historico = db.prepare(`
      SELECT id, valor, tipo, descricao, criado_em
      FROM transacoes_creditos
      WHERE utilizador_id = ?
      ORDER BY criado_em DESC
      LIMIT 20
    `).all(id);

    res.json({
      creditos: user.creditos || 0,
      historico
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar créditos' });
  }
});

module.exports = router;