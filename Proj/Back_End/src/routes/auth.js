const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

const router = express.Router();

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

// REGISTER (se tiver)
router.post('/register', async (req, res) => {
  // seu código de register aqui
});

module.exports = router;