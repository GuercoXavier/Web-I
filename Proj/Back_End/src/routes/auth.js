const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { autenticar } = require('../middleware/auth');
const { validarRegisto, validarLogin } = require('../middleware/validacao');
const router = express.Router();
const { 
  autenticar, 
  verificarTentativasLogin, 
  registrarTentativaFalha, 
  limparTentativasSucesso 
} = require('../middleware/auth');
// ==================== LOGIN ====================
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ erro: 'Campos obrigatórios.' });
  }

  try {
    const user = db.prepare(`
      SELECT id, username, email, password, role, creditos
      FROM utilizadores
      WHERE username = ?
    `).get(username);

    if (!user) {
      return res.status(401).json({ erro: 'Credenciais inválidas.' });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(401).json({ erro: 'Credenciais inválidas.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      mensagem: 'Login bem-sucedido.',
      token,
      utilizador: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        creditos: user.creditos || 0
      }
    });
router.post('/login', validarLogin, async (req, res) => { ... });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno.' });
  }
});

// ==================== REGISTO ====================
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ erro: 'Campos obrigatórios.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ erro: 'Password deve ter no mínimo 6 caracteres.' });
  }

  try {
    const existingUser = db.prepare(
      'SELECT id FROM utilizadores WHERE username = ? OR email = ?'
    ).get(username, email);

    if (existingUser) {
      return res.status(400).json({ erro: 'Username ou email já existe.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = db.prepare(`
      INSERT INTO utilizadores (username, email, password, role, creditos)
      VALUES (?, ?, ?, 'cliente', 0)
    `).run(username, email, hashedPassword);

    return res.status(201).json({
      mensagem: 'Conta criada com sucesso!',
      id: result.lastInsertRowid
    });
router.post('/register', validarRegisto, async (req, res) => { ... });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno.' });
  }
});

// ==================== CRÉDITOS ====================
router.get('/creditos', autenticar, (req, res) => {
  try {
    const user = db.prepare(`SELECT creditos FROM utilizadores WHERE id = ?`).get(req.utilizador.id);
    res.json({ creditos: user?.creditos || 0 });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar créditos' });
  }
});

router.post('/creditos', autenticar, (req, res) => {
  const { valor } = req.body;
  const userId = req.utilizador.id;

  if (!valor || valor <= 0) {
    return res.status(400).json({ erro: 'Valor inválido' });
  }

  try {
    db.prepare(`UPDATE utilizadores SET creditos = creditos + ? WHERE id = ?`).run(valor, userId);
    res.json({ mensagem: 'Créditos adicionados!', valor });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao adicionar créditos' });
  }
});

// ==================== RECUPERAR SENHA ====================
router.post('/recuperar-senha', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ erro: 'Email obrigatório.' });
  }

  try {
    const user = db.prepare('SELECT id, username FROM utilizadores WHERE email = ?').get(email);

    if (!user) {
      return res.status(404).json({ erro: 'Email não encontrado.' });
    }

    const resetToken = jwt.sign(
      { id: user.id, email: email, type: 'reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    db.prepare(`
      UPDATE utilizadores SET reset_token = ?, reset_token_expires = datetime('now', '+1 hour')
      WHERE id = ?
    `).run(resetToken, user.id);

    return res.json({
      mensagem: 'Token de recuperação gerado.',
      reset_token: resetToken
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno.' });
  }
});

// ==================== VERIFICAR TOKEN ====================
router.post('/verificar-token', (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ erro: 'Token obrigatório.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.type !== 'reset') {
      return res.status(400).json({ erro: 'Token inválido.' });
    }

    const user = db.prepare(`
      SELECT id FROM utilizadores 
      WHERE id = ? AND reset_token = ? AND reset_token_expires > datetime('now')
    `).get(decoded.id, token);

    if (!user) {
      return res.status(400).json({ erro: 'Token expirado ou inválido.' });
    }

    return res.json({ valido: true, id: user.id });

  } catch (err) {
    return res.status(400).json({ erro: 'Token inválido ou expirado.' });
  }
});

// ==================== REDEFINIR SENHA ====================
router.post('/redefinir-senha', async (req, res) => {
  const { token, nova_senha } = req.body;

  if (!token || !nova_senha) {
    return res.status(400).json({ erro: 'Dados incompletos.' });
  }

  if (nova_senha.length < 6) {
    return res.status(400).json({ erro: 'Senha deve ter no mínimo 6 caracteres.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.type !== 'reset') {
      return res.status(400).json({ erro: 'Token inválido.' });
    }

    const user = db.prepare(`
      SELECT id FROM utilizadores 
      WHERE id = ? AND reset_token = ? AND reset_token_expires > datetime('now')
    `).get(decoded.id, token);

    if (!user) {
      return res.status(400).json({ erro: 'Token expirado ou inválido.' });
    }

    const hashedPassword = await bcrypt.hash(nova_senha, 10);

    db.prepare(`
      UPDATE utilizadores 
      SET password = ?, reset_token = NULL, reset_token_expires = NULL
      WHERE id = ?
    `).run(hashedPassword, user.id);

    return res.json({ mensagem: 'Senha redefinida com sucesso!' });

  } catch (err) {
    return res.status(400).json({ erro: 'Token inválido ou expirado.' });
  }
});

module.exports = router;