const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET não configurado');
  process.exit(1);
}

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

console.log('🔑 JWT_SECRET:', process.env.JWT_SECRET ? '✅ Configurado' : '❌');

let app;
try {
  app = require('./src/app');
  console.log('✅ App carregado de ./src/app');
} catch (err) {
  console.error('❌ Erro ao carregar aplicação:', err.message);
  console.error(err.stack);
  process.exit(1);
}

const PORT = Number(process.env.PORT) || 3000;
const ENV = process.env.NODE_ENV || 'development';

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('========================================');
  console.log('🚀 BasGam API - Servidor Iniciado');
  console.log('========================================');
  console.log(`📡 Ambiente: ${ENV}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`🏥 Health: http://localhost:${PORT}/health`);
  console.log(`📚 API: http://localhost:${PORT}/api`);
  console.log(`🗄️  Banco: ${path.join(__dirname, 'basgam.db')}`);
  console.log(`📁 Uploads: ${path.join(__dirname, 'uploads')}`);
  console.log(`🔑 JWT: ✅`);
  console.log('========================================');
});

function gracefulShutdown(signal) {
  console.log(`\n🛑 Recebido sinal ${signal}. Encerrando servidor...`);
  try {
    const { db } = require('./src/config/database');
    if (db && db.close) db.close();
  } catch (e) {}
  server.close(() => {
    console.log('✅ Servidor encerrado');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('⚠️ Timeout - forçando saída');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = server;