const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const router = express.Router();
const { db } = require('../config/database');
const {
  verificarTentativasLogin,
  registrarTentativaFalha,
  limparTentativasSucesso,
  gerarToken,
  autenticar,
  verificarSessaoAtual
} = require('../middleware/auth');
const { validarRegisto, validarLogin } = require('../middleware/validacao');

// ==================== LOGIN ====================

router.post('/login', validarLogin, async (req, res) => {
  const { username, password } = req.body;

  const verifica = verificarTentativasLogin(username);

  if (verifica.blocked) {
    return res.status(429).json({
      erro: verifica.message,
      esperar_minutos: verifica.remainingMinutes
    });
  }

  try {
    const user = db.prepare(`
      SELECT id, username, email, password, role, creditos
      FROM utilizadores
      WHERE username = ?
    `).get(username);

    if (!user) {
      registrarTentativaFalha(username);
      return res.status(401).json({ erro: 'Credenciais inválidas' });
    }

    const passwordValida = await bcrypt.compare(password, user.password);

    if (!passwordValida) {
      registrarTentativaFalha(username);
      return res.status(401).json({ erro: 'Credenciais inválidas' });
    }

    limparTentativasSucesso(username);

    const token = gerarToken(user);
    delete user.password;

    res.json({
      success: true,
      message: 'Login efetuado com sucesso',
      token,
      utilizador: user
    });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// ==================== REGISTO ====================

router.post('/register', validarRegisto, async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const existingUser = db.prepare(
      'SELECT id FROM utilizadores WHERE username = ? OR email = ?'
    ).get(username, email);

    if (existingUser) {
      return res.status(400).json({ erro: 'Username ou email já existe.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = db.prepare(`
      INSERT INTO utilizadores (username, email, password, role, creditos, tentativas_login, bloqueado_ate)
      VALUES (?, ?, ?, 'cliente', 0, 0, NULL)
    `).run(username, email, hashedPassword);

    db.prepare('INSERT INTO carrinhos (utilizador_id) VALUES (?)').run(result.lastInsertRowid);

    return res.status(201).json({
      success: true,
      mensagem: 'Conta criada com sucesso!',
      id: result.lastInsertRowid
    });
  } catch (err) {
    console.error('Erro no registo:', err);
    return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// ==================== SESSÃO ACTUAL ====================

router.get('/sessao', autenticar, verificarSessaoAtual);

// ==================== PERFIL ====================

router.get('/perfil', autenticar, (req, res) => {
  try {
    const user = db.prepare(`
      SELECT id, username, email, role, creditos, criado_em
      FROM utilizadores
      WHERE id = ?
    `).get(req.utilizador.id);

    if (!user) {
      return res.status(404).json({ erro: 'Utilizador não encontrado.' });
    }

    res.json({ utilizador: user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar perfil.' });
  }
});

// ==================== CRÉDITOS ====================

router.get('/creditos', autenticar, (req, res) => {
  try {
    const user = db.prepare('SELECT creditos FROM utilizadores WHERE id = ?').get(req.utilizador.id);
    res.json({ creditos: user?.creditos || 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar créditos' });
  }
});

// ==================== RECUPERAR SENHA ====================

router.post('/recuperar-senha', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ erro: 'Email é obrigatório.' });
  }

  try {
    const user = db.prepare('SELECT id, username FROM utilizadores WHERE email = ?').get(email);

    if (!user) {
      return res.json({
        mensagem: 'Se o email existir, receberá instruções para redefinir a senha.'
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 3600000).toISOString();

    db.prepare(`
      UPDATE utilizadores
      SET reset_token = ?, reset_token_expires = ?
      WHERE id = ?
    `).run(resetToken, tokenExpiry, user.id);

    console.log(`Token de recuperação para ${user.username}: ${resetToken}`);

    res.json({
      success: true,
      mensagem: 'Se o email existir, receberá instruções para redefinir a senha.',
      reset_token: process.env.NODE_ENV === 'development' ? resetToken : undefined
    });
  } catch (err) {
    console.error('Erro na recuperação:', err);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// ==================== REDEFINIR SENHA ====================

router.post('/redefinir-senha', async (req, res) => {
  const { email, nova_senha } = req.body;

  if (!email || !nova_senha) {
    return res.status(400).json({ erro: 'Email e nova senha são obrigatórios.' });
  }

  try {
    const user = db.prepare(
      'SELECT id FROM utilizadores WHERE email = ?'
    ).get(email);

    if (!user) {
      return res.status(404).json({ erro: 'Utilizador não encontrado.' });
    }

    const hashed = await bcrypt.hash(nova_senha, 10);

    db.prepare(`
      UPDATE utilizadores 
      SET password = ? 
      WHERE id = ?
    `).run(hashed, user.id);

    res.json({ success: true, mensagem: 'Senha alterada com sucesso!' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});
// ==================== ALTERAR PASSWORD ====================

router.post('/alterar-password', autenticar, async (req, res) => {
  const { password_atual, nova_password } = req.body;
  const userId = req.utilizador.id;

  if (!password_atual || !nova_password) {
    return res.status(400).json({ erro: 'Senha atual e nova senha são obrigatórias.' });
  }

  if (nova_password.length < 6) {
    return res.status(400).json({ erro: 'A nova senha deve ter no mínimo 6 caracteres.' });
  }

  try {
    const user = db.prepare('SELECT password FROM utilizadores WHERE id = ?').get(userId);

    const passwordValida = await bcrypt.compare(password_atual, user.password);
    if (!passwordValida) {
      return res.status(401).json({ erro: 'Senha atual incorreta.' });
    }

    const hashedPassword = await bcrypt.hash(nova_password, 10);
    db.prepare('UPDATE utilizadores SET password = ? WHERE id = ?').run(hashedPassword, userId);

    res.json({ success: true, mensagem: 'Senha alterada com sucesso!' });
  } catch (err) {
    console.error('Erro ao alterar senha:', err);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// ==================== LOGOUT ====================

router.post('/logout', autenticar, (req, res) => {
  res.json({ mensagem: 'Logout efetuado.' });
});

module.exports = router;