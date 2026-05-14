const jwt = require('jsonwebtoken');
const { db } = require('../config/database');

const MAX_TENTATIVAS = parseInt(process.env.MAX_TENTATIVAS) || 5;
const BLOQUEIO_MINUTOS = parseInt(process.env.BLOQUEIO_MINUTOS) || 15;
const TOKEN_EXPIRATION = process.env.TOKEN_EXPIRATION || '7d';

function verificarTentativasLogin(username) {
  try {
    const user = db.prepare(`
      SELECT tentativas_login, bloqueado_ate
      FROM utilizadores
      WHERE username = ?
    `).get(username);

    if (!user) return { blocked: false };

    if (user.bloqueado_ate && new Date() < new Date(user.bloqueado_ate)) {
      const remainingMinutes = Math.ceil((new Date(user.bloqueado_ate) - new Date()) / 1000 / 60);
      const remainingSeconds = Math.ceil((new Date(user.bloqueado_ate) - new Date()) / 1000);
      return {
        blocked: true,
        remainingMinutes,
        remainingSeconds,
        message: `Demasiadas tentativas. Tente novamente em ${remainingMinutes} minutos.`
      };
    }

    if (user.bloqueado_ate && new Date() >= new Date(user.bloqueado_ate)) {
      limparTentativasSucesso(username);
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

    if (!user) return false;

    let novasTentativas = (user.tentativas_login || 0) + 1;
    let bloqueadoAte = user.bloqueado_ate;

    if (novasTentativas >= MAX_TENTATIVAS) {
      bloqueadoAte = new Date(Date.now() + BLOQUEIO_MINUTOS * 60 * 1000).toISOString();
      novasTentativas = 0;
      console.warn(`Utilizador ${username} bloqueado por ${BLOQUEIO_MINUTOS} minutos`);
    }

    db.prepare(`
      UPDATE utilizadores
      SET tentativas_login = ?, bloqueado_ate = ?
      WHERE id = ?
    `).run(novasTentativas, bloqueadoAte, user.id);

    return true;
  } catch (err) {
    console.error('Erro ao registar tentativa falhada:', err);
    return false;
  }
}

function limparTentativasSucesso(username) {
  try {
    db.prepare(`
      UPDATE utilizadores
      SET tentativas_login = 0, bloqueado_ate = NULL
      WHERE username = ?
    `).run(username);
    return true;
  } catch (err) {
    console.error('Erro ao limpar tentativas:', err);
    return false;
  }
}

function gerarToken(utilizador) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET não configurado no ficheiro .env');
  }

  return jwt.sign(
    {
      id: utilizador.id,
      username: utilizador.username,
      email: utilizador.email,
      role: utilizador.role
    },
    secret,
    { expiresIn: TOKEN_EXPIRATION }
  );
}

function autenticar(req, res, next) {
  const header = req.headers.authorization;

  if (!header || typeof header !== 'string') {
    return res.status(401).json({ erro: 'Token em falta.' });
  }

  const parts = header.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ erro: 'Formato inválido do token. Use "Bearer <token>"' });
  }

  const token = parts[1];
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    console.error('JWT_SECRET não configurado no .env');
    return res.status(500).json({ erro: 'Erro de configuração do servidor.' });
  }

  try {
    const decoded = jwt.verify(token, secret);

    const userExists = db.prepare(`
      SELECT id, role FROM utilizadores WHERE id = ?
    `).get(decoded.id);

    if (!userExists) {
      return res.status(401).json({ erro: 'Utilizador não encontrado.' });
    }

    req.utilizador = {
      id: decoded.id,
      username: decoded.username,
      email: decoded.email,
      role: userExists.role
    };

    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ erro: 'Token expirado. Faça login novamente.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ erro: 'Token inválido.' });
    }
    console.error('Erro na autenticação:', err);
    return res.status(401).json({ erro: 'Erro na autenticação.' });
  }
}

function somenteAdmin(req, res, next) {
  if (!req.utilizador) {
    return res.status(401).json({ erro: 'Não autenticado.' });
  }

  if (req.utilizador.role !== 'admin') {
    return res.status(403).json({
      erro: 'Acesso restrito a administradores.',
      sua_role: req.utilizador.role
    });
  }

  return next();
}

function mesmoUsuario(req, res, next) {
  const userId = parseInt(req.params.id);

  if (!req.utilizador) {
    return res.status(401).json({ erro: 'Não autenticado.' });
  }

  if (req.utilizador.role === 'admin') {
    return next();
  }

  if (req.utilizador.id !== userId) {
    return res.status(403).json({
      erro: 'Acesso negado. Só pode aceder aos seus próprios dados.'
    });
  }

  return next();
}

function verificarSessaoAtual(req, res) {
  if (!req.utilizador) {
    return res.status(401).json({
      autenticado: false,
      erro: 'Não autenticado'
    });
  }

  res.json({
    autenticado: true,
    utilizador: {
      id: req.utilizador.id,
      username: req.utilizador.username,
      email: req.utilizador.email,
      role: req.utilizador.role
    }
  });
}

module.exports = {
  autenticar,
  somenteAdmin,
  mesmoUsuario,
  verificarTentativasLogin,
  registrarTentativaFalha,
  limparTentativasSucesso,
  gerarToken,
  verificarSessaoAtual
};