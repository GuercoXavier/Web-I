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

module.exports = { autenticar, somenteAdmin };