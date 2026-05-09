const jwt = require('jsonwebtoken');
const db = require('../config/database');

function autenticar(req, res, next) {
  const header = req.headers.authorization;

  if (!header || typeof header !== 'string') {
    return res.status(401).json({ erro: 'Token em falta.' });
  }

  const parts = header.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ erro: 'Formato inválido do token.' });
  }

  const token = parts[1];
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    return res.status(500).json({ erro: 'JWT_SECRET não configurado.' });
  }

  try {
    const decoded = jwt.verify(token, secret);
    req.utilizador = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
}

function somenteAdmin(req, res, next) {
  if (!req.utilizador) {
    return res.status(401).json({ erro: 'Não autenticado.' });
  }

  if (req.utilizador.role !== 'admin') {
    return res.status(403).json({ erro: 'Acesso restrito a administradores.' });
  }

  return next();
}

// ==================== CONTROLE DE TENTATIVAS DE LOGIN (COM BANCO) ====================

function verificarTentativasLogin(username) {
  try {
    const user = db.prepare(`
      SELECT tentativas_login, bloqueado_ate 
      FROM utilizadores 
      WHERE username = ?
    `).get(username);

    if (!user) return { blocked: false };

    // Verificar se está bloqueado
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
    // Buscar utilizador
    const user = db.prepare(`
      SELECT id, tentativas_login, bloqueado_ate 
      FROM utilizadores 
      WHERE username = ?
    `).get(username);

    if (!user) return;

    let novasTentativas = (user.tentativas_login || 0) + 1;
    let bloqueadoAte = user.bloqueado_ate;

    // Se atingiu 5 tentativas, bloquear por 15 minutos
    if (novasTentativas >= 5) {
      bloqueadoAte = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      novasTentativas = 0; // Reset após bloqueio
    }

    // Atualizar no banco
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

module.exports = { 
  autenticar, 
  somenteAdmin, 
  verificarTentativasLogin, 
  registrarTentativaFalha, 
  limparTentativasSucesso 
};