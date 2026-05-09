const jwt = require('jsonwebtoken');

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

// ==================== CONTROLE DE TENTATIVAS DE LOGIN ====================
const tentativasLogin = new Map();

function verificarTentativasLogin(username) {
  const tentativas = tentativasLogin.get(username) || { count: 0, blockedUntil: null };
  
  if (tentativas.blockedUntil && new Date() < tentativas.blockedUntil) {
    return { 
      blocked: true, 
      remainingTime: Math.ceil((tentativas.blockedUntil - new Date()) / 1000 / 60) 
    };
  }
  
  return { blocked: false };
}

function registrarTentativaFalha(username) {
  const tentativas = tentativasLogin.get(username) || { count: 0, blockedUntil: null };
  
  tentativas.count++;
  
  if (tentativas.count >= 5) {
    tentativas.blockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
  }
  
  tentativasLogin.set(username, tentativas);
  
  // Limpar após 30 minutos se não houver mais tentativas
  setTimeout(() => {
    if (tentativasLogin.has(username) && tentativasLogin.get(username).count >= 5) {
      tentativasLogin.delete(username);
    }
  }, 30 * 60 * 1000);
}

function limparTentativasSucesso(username) {
  tentativasLogin.delete(username);
}

// Exportar tudo
module.exports = { 
  autenticar, 
  somenteAdmin, 
  verificarTentativasLogin, 
  registrarTentativaFalha, 
  limparTentativasSucesso 
};