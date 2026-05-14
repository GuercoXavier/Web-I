const express = require('express');
const { db } = require('../config/database');
const { autenticar, somenteAdmin } = require('../middleware/auth');
const { validarId } = require('../middleware/validacao');

const router = express.Router();

function getEstatisticasUsuario(userId) {
  const totalPedidos = db.prepare(
    'SELECT COUNT(*) as total FROM pedidos WHERE utilizador_id = ?'
  ).get(userId)?.total || 0;

  const totalGasto = db.prepare(
    "SELECT SUM(total) as total FROM pedidos WHERE utilizador_id = ? AND estado = 'entregue'"
  ).get(userId)?.total || 0;

  const creditosUsados = db.prepare(
    "SELECT SUM(ABS(valor)) as total FROM transacoes_creditos WHERE utilizador_id = ? AND tipo = 'compra'"
  ).get(userId)?.total || 0;

  return { totalPedidos, totalGasto, creditosUsados };
}

// ==================== ROTAS LITERAIS (antes de /:id) ====================

router.get('/', autenticar, somenteAdmin, (req, res) => {
  try {
    const { limite = 50, pagina = 1, role, busca } = req.query;
    const offset = (parseInt(pagina) - 1) * parseInt(limite);

    let query = `
      SELECT id, username, email, role, creditos, criado_em
      FROM utilizadores
      WHERE 1=1
    `;
    const params = [];

    if (role && (role === 'cliente' || role === 'admin')) {
      query += ` AND role = ?`;
      params.push(role);
    }

    if (busca) {
      query += ` AND (username LIKE ? OR email LIKE ?)`;
      params.push(`%${busca}%`, `%${busca}%`);
    }

    query += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limite), offset);

    const users = db.prepare(query).all(...params);

    let countQuery = `SELECT COUNT(*) as total FROM utilizadores WHERE 1=1`;
    const countParams = [];
    if (role && (role === 'cliente' || role === 'admin')) {
      countQuery += ` AND role = ?`;
      countParams.push(role);
    }
    if (busca) {
      countQuery += ` AND (username LIKE ? OR email LIKE ?)`;
      countParams.push(`%${busca}%`, `%${busca}%`);
    }
    const total = db.prepare(countQuery).get(...countParams)?.total || 0;

    const usersComStats = users.map(user => ({
      ...user,
      estatisticas: getEstatisticasUsuario(user.id)
    }));

    res.json({
      success: true,
      utilizadores: usersComStats,
      paginacao: {
        pagina: parseInt(pagina),
        limite: parseInt(limite),
        total,
        total_paginas: Math.ceil(total / parseInt(limite))
      },
      filtros: { role: role || null, busca: busca || null }
    });
  } catch (err) {
    console.error('Erro ao listar utilizadores:', err);
    res.status(500).json({ erro: 'Erro ao listar utilizadores' });
  }
});

router.get('/admin/resumo', autenticar, somenteAdmin, (req, res) => {
  try {
    const totalUsuarios = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins,
        SUM(CASE WHEN role = 'cliente' THEN 1 ELSE 0 END) as clientes
      FROM utilizadores
    `).get();

    const totalCreditos = db.prepare(
      'SELECT SUM(creditos) as total FROM utilizadores'
    ).get()?.total || 0;

    const usuariosRegistradosHoje = db.prepare(`
      SELECT COUNT(*) as total
      FROM utilizadores
      WHERE date(criado_em) = date('now')
    `).get()?.total || 0;

    res.json({
      success: true,
      resumo: {
        total_utilizadores: totalUsuarios.total || 0,
        total_admins: totalUsuarios.admins || 0,
        total_clientes: totalUsuarios.clientes || 0,
        total_creditos_sistema: totalCreditos,
        registos_hoje: usuariosRegistradosHoje
      }
    });
  } catch (err) {
    console.error('Erro ao buscar resumo:', err);
    res.status(500).json({ erro: 'Erro ao buscar resumo do sistema' });
  }
});

// ==================== ROTAS COM /:id ====================

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

    const estatisticas = getEstatisticasUsuario(id);

    const ultimosPedidos = db.prepare(`
      SELECT id, total, estado, criado_em
      FROM pedidos
      WHERE utilizador_id = ?
      ORDER BY criado_em DESC
      LIMIT 5
    `).all(id);

    const historicoCreditos = db.prepare(`
      SELECT id, valor, tipo, descricao, referencia, criado_em
      FROM transacoes_creditos
      WHERE utilizador_id = ?
      ORDER BY criado_em DESC
      LIMIT 10
    `).all(id);

    res.json({
      success: true,
      utilizador: user,
      estatisticas: {
        ...estatisticas,
        pedidos_recentes: ultimosPedidos.length,
        historico_creditos: historicoCreditos
      },
      ultimos_pedidos: ultimosPedidos
    });
  } catch (err) {
    console.error('Erro ao buscar utilizador:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

router.patch('/:id/role', autenticar, somenteAdmin, validarId, (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const rolesValidos = ['cliente', 'admin'];

    if (!rolesValidos.includes(role)) {
      return res.status(400).json({
        erro: 'Role inválido',
        roles_permitidos: rolesValidos
      });
    }

    if (req.utilizador.id === parseInt(id)) {
      return res.status(400).json({ erro: 'Não pode alterar o seu próprio role' });
    }

    const user = db.prepare('SELECT role FROM utilizadores WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ erro: 'Utilizador não encontrado' });
    }

    if (user.role === 'admin' && role !== 'admin') {
      const adminCount = db.prepare(
        "SELECT COUNT(*) as total FROM utilizadores WHERE role = 'admin'"
      ).get().total;

      if (adminCount <= 1) {
        return res.status(400).json({
          erro: 'Não pode remover o último administrador do sistema'
        });
      }
    }

    db.prepare('UPDATE utilizadores SET role = ? WHERE id = ?').run(role, id);

    console.log(`Admin ${req.utilizador.username} alterou role do user ${id} para ${role}`);

    res.json({
      success: true,
      mensagem: 'Role atualizado com sucesso',
      utilizador_id: id,
      novo_role: role
    });
  } catch (err) {
    console.error('Erro ao atualizar role:', err);
    res.status(500).json({ erro: 'Erro ao atualizar role' });
  }
});

router.post('/:id/creditos', autenticar, somenteAdmin, validarId, (req, res) => {
  try {
    const { id } = req.params;
    const { valor, descricao } = req.body;

    if (!valor || valor <= 0) {
      return res.status(400).json({ erro: 'Valor inválido. Deve ser maior que zero.' });
    }

    if (valor > 10000) {
      return res.status(400).json({ erro: 'Valor máximo por transação é €10.000' });
    }

    const user = db.prepare('SELECT id, username, creditos FROM utilizadores WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ erro: 'Utilizador não encontrado' });
    }

    const adicionarCreditos = db.transaction(() => {
      db.prepare('UPDATE utilizadores SET creditos = creditos + ? WHERE id = ?').run(valor, id);

      db.prepare(`
        INSERT INTO transacoes_creditos (utilizador_id, valor, tipo, descricao)
        VALUES (?, ?, 'adicionar', ?)
      `).run(id, valor, descricao || `Adicionado por admin: ${req.utilizador.username}`);

      return db.prepare('SELECT creditos FROM utilizadores WHERE id = ?').get(id).creditos;
    });

    const novoSaldo = adicionarCreditos();

    res.json({
      success: true,
      mensagem: 'Créditos adicionados com sucesso',
      utilizador: user.username,
      valor_adicionado: valor,
      novo_saldo: novoSaldo
    });
  } catch (err) {
    console.error('Erro ao adicionar créditos:', err);
    res.status(500).json({ erro: 'Erro ao adicionar créditos' });
  }
});

router.get('/:id/creditos', autenticar, somenteAdmin, validarId, (req, res) => {
  try {
    const { id } = req.params;

    const user = db.prepare('SELECT id, username, creditos FROM utilizadores WHERE id = ?').get(id);

    if (!user) {
      return res.status(404).json({ erro: 'Utilizador não encontrado' });
    }

    const historico = db.prepare(`
      SELECT
        id,
        valor,
        tipo,
        descricao,
        referencia,
        criado_em,
        CASE
          WHEN valor > 0 THEN 'credito_adicionado'
          WHEN valor < 0 THEN 'credito_gasto'
          ELSE 'transacao'
        END as tipo_formatado
      FROM transacoes_creditos
      WHERE utilizador_id = ?
      ORDER BY criado_em DESC
      LIMIT 50
    `).all(id);

    const totalAdicionado = db.prepare(
      'SELECT SUM(valor) as total FROM transacoes_creditos WHERE utilizador_id = ? AND valor > 0'
    ).get(id)?.total || 0;

    const totalGasto = db.prepare(
      'SELECT SUM(ABS(valor)) as total FROM transacoes_creditos WHERE utilizador_id = ? AND valor < 0'
    ).get(id)?.total || 0;

    res.json({
      success: true,
      utilizador: {
        id: user.id,
        username: user.username,
        creditos_atual: user.creditos || 0
      },
      resumo_creditos: {
        total_adicionado: totalAdicionado,
        total_gasto: totalGasto,
        saldo_atual: user.creditos || 0
      },
      historico
    });
  } catch (err) {
    console.error('Erro ao buscar créditos:', err);
    res.status(500).json({ erro: 'Erro ao buscar créditos' });
  }
});

router.delete('/:id', autenticar, somenteAdmin, validarId, (req, res) => {
  try {
    const { id } = req.params;

    if (req.utilizador.id === parseInt(id)) {
      return res.status(400).json({ erro: 'Não pode remover o seu próprio perfil' });
    }

    const user = db.prepare('SELECT id, role, username FROM utilizadores WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ erro: 'Utilizador não encontrado' });
    }

    if (user.role === 'admin') {
      const adminCount = db.prepare(
        "SELECT COUNT(*) as total FROM utilizadores WHERE role = 'admin'"
      ).get().total;

      if (adminCount <= 1) {
        return res.status(400).json({
          erro: 'Não pode remover o último administrador do sistema'
        });
      }

      return res.status(400).json({ erro: 'Não pode remover outro administrador' });
    }

    db.transaction(() => {
      db.prepare('DELETE FROM transacoes_creditos WHERE utilizador_id = ?').run(id);

      const carrinho = db.prepare('SELECT id FROM carrinhos WHERE utilizador_id = ?').get(id);
      if (carrinho) {
        db.prepare('DELETE FROM carrinho_itens WHERE carrinho_id = ?').run(carrinho.id);
        db.prepare('DELETE FROM carrinhos WHERE id = ?').run(carrinho.id);
      }

      db.prepare('UPDATE pedidos SET utilizador_id = NULL WHERE utilizador_id = ?').run(id);
      db.prepare('DELETE FROM utilizadores WHERE id = ?').run(id);
    })();

    console.log(`Utilizador ${user.username} (ID: ${id}) removido por ${req.utilizador.username}`);

    res.json({
      success: true,
      mensagem: 'Utilizador removido com sucesso',
      utilizador_removido: { id: parseInt(id), username: user.username }
    });
  } catch (err) {
    console.error('Erro ao remover utilizador:', err);
    res.status(500).json({ erro: 'Erro ao remover utilizador' });
  }
});

module.exports = router;