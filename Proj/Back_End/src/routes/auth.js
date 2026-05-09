const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { autenticar } = require('../middleware/auth');
const { validarRegisto, validarLogin } = require('../middleware/validacao');

const router = express.Router();

// ==================== FUNÇÕES DE TENTATIVAS (USANDO BANCO) ====================

function verificarTentativasLogin(username) {
  try {
    const user = db.prepare(`
      SELECT tentativas_login, bloqueado_ate 
      FROM utilizadores 
      WHERE username = ?
    `).get(username);

    if (!user) return { blocked: false };

    if (user.bloqueado_ate && new Date() < new Date(user.bloqueado_ate)) {
      const remainingTime = Math.ceil((new Date(user.bloqueado_ate) - new Date()) / 1000 / 60);
      return { blocked: true, remainingTime };
    }

    return { blocked: false };
  } catch (err) {
    console.error('Erro ao verificar tentativas:', err);
    return { blocked: false };
  }
}

function registrarTentativaFalha(username) {
  try {
    const user = db.prepare(`
      SELECT id, tentativas_login, bloqueado_ate 
      FROM utilizadores 
      WHERE username = ?
    `).get(username);

    if (!user) return;

    let novasTentativas = (user.tentativas_login || 0) + 1;
    let bloqueadoAte = user.bloqueado_ate;

    if (novasTentativas >= 5) {
      bloqueadoAte = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      novasTentativas = 0;
    }

    db.prepare(`
      UPDATE utilizadores 
      SET tentativas_login = ?, bloqueado_ate = ?
      WHERE id = ?
    `).run(novasTentativas, bloqueadoAte, user.id);

  } catch (err) {
    console.error('Erro ao registrar tentativa falha:', err);
  }
}

function limparTentativasSucesso(username) {
  try {
    db.prepare(`
      UPDATE utilizadores 
      SET tentativas_login = 0, bloqueado_ate = NULL
      WHERE username = ?
    `).run(username);
  } catch (err) {
    console.error('Erro ao limpar tentativas:', err);
  }
}

// ==================== LOGIN ====================
router.post('/login', validarLogin, async (req, res) => {
  const { username, password } = req.body;

  const tentativaCheck = verificarTentativasLogin(username);
  if (tentativaCheck.blocked) {
    return res.status(429).json({ 
      erro: `Muitas tentativas. Tente novamente em ${tentativaCheck.remainingTime} minutos.` 
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
      return res.status(401).json({ erro: 'Credenciais inválidas.' });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      registrarTentativaFalha(username);
      return res.status(401).json({ erro: 'Credenciais inválidas.' });
    }

    limparTentativasSucesso(username);

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

  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno.' });
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

    return res.status(201).json({
      mensagem: 'Conta criada com sucesso!',
      id: result.lastInsertRowid
    });

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

router.get('/creditos/historico', autenticar, (req, res) => {
  try {
    const userId = req.utilizador.id;
    
    const creditos = db.prepare(`SELECT creditos FROM utilizadores WHERE id = ?`).get(userId);
    
    const historico = db.prepare(`
      SELECT id, valor, tipo, descricao, referencia, criado_em
      FROM transacoes_creditos
      WHERE utilizador_id = ?
      ORDER BY criado_em DESC
      LIMIT 50
    `).all(userId);
    
    res.json({
      creditos: creditos?.creditos || 0,
      historico: historico
    });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar histórico' });
  }
});

router.post('/creditos/adicionar', autenticar, (req, res) => {
  const { valor, descricao } = req.body;
  const userId = req.utilizador.id;

  if (!valor || valor <= 0) {
    return res.status(400).json({ erro: 'Valor inválido' });
  }

  try {
    db.prepare(`UPDATE utilizadores SET creditos = creditos + ? WHERE id = ?`).run(valor, userId);
    
    db.prepare(`
      INSERT INTO transacoes_creditos (utilizador_id, valor, tipo, descricao)
      VALUES (?, ?, 'adicionar', ?)
    `).run(userId, valor, descricao || 'Adição manual de créditos');

    res.json({ mensagem: 'Créditos adicionados com sucesso!', valor });
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