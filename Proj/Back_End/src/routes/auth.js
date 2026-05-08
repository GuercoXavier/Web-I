const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { autenticar } = require('../middleware/auth');

const router = express.Router();

// REGISTER
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ erro: 'Preencha todos os campos.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ erro: 'Password muito curta.' });
  }

  try {
    const existe = db.prepare(
      'SELECT id FROM utilizadores WHERE username = ? OR email = ?'
    ).get(username, email);

    if (existe) {
      return res.status(409).json({ erro: 'Utilizador já existe.' });
    }

    const hash = await bcrypt.hash(password, 10);

    const result = db.prepare(`
      INSERT INTO utilizadores (username, email, password, role)
      VALUES (?, ?, ?, 'cliente')
    `).run(username, email, hash);

    return res.status(201).json({
      mensagem: 'Conta criada com sucesso.',
      id: result.lastInsertRowid
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno.' });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ erro: 'Campos obrigatórios.' });
  }

  try {
    const user = db.prepare(`
      SELECT id, username, email, password, role
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

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ erro: 'JWT_SECRET não definido.' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      mensagem: 'Login bem-sucedido.',
      token,
      redirectUrl: user.role === 'admin' ? '/admin/RegistroAdm.html' : '/index.html',
      utilizador: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno.' });
  }
});

// ME
router.get('/me', autenticar, (req, res) => {
  try {
    const user = db.prepare(`
      SELECT id, username, email, role, criado_em
      FROM utilizadores
      WHERE id = ?
    `).get(req.utilizador.id);

    if (!user) {
      return res.status(404).json({ erro: 'Utilizador não encontrado.' });
    }

    return res.json(user);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno.' });
  }
});

module.exports = router;