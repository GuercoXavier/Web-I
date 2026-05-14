const path = require('path');
const fs = require('fs');

// ✅ Carregar .env da raiz do projeto
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// ✅ Validar JWT_SECRET antes de iniciar
if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET não configurado no ficheiro .env');
  console.error('⚠️ Adicione JWT_SECRET=... no ficheiro .env');
  process.exit(1);
}

// ✅ Verificar se a pasta uploads existe
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Pasta uploads criada automaticamente');
}

console.log('🔑 JWT_SECRET:', process.env.JWT_SECRET ? '✅ Configurado' : '❌ NÃO CONFIGURADO');

let app;

try {
  app = require('./src/app');
  console.log('✅ App carregado de ./src/app');
} catch (err) {
  console.error('❌ Erro ao carregar aplicação:', err.message);
  process.exit(1);
}

const PORT = Number(process.env.PORT) || 3000;
const ENV = process.env.NODE_ENV || 'development';

const server = app.listen(PORT, () => {
  console.log('========================================');
  console.log('🚀 BasGam API - Servidor Iniciado');
  console.log('========================================');
  console.log(`📡 Ambiente: ${ENV}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`🏥 Health: http://localhost:${PORT}/health`);
  console.log(`📚 API: http://localhost:${PORT}/api`);
  console.log(`🗄️  Banco: ${path.join(__dirname, 'basgam.db')}`);
  console.log(`📁 Uploads: ${path.join(__dirname, 'uploads')}`);
  console.log(`🔑 JWT: ${process.env.JWT_SECRET ? '✅' : '❌'}`);
  console.log('========================================');
});

// ✅ Graceful shutdown melhorado
function gracefulShutdown(signal) {
  console.log(`\n🛑 Recebido sinal ${signal}. Encerrando servidor...`);
  
  // Fechar conexão com o banco de dados se existir
  try {
    const { db } = require('./src/config/database');
    if (db && db.close) {
      db.close();
      console.log('✅ Conexão com banco de dados fechada');
    }
  } catch (err) {
    // Banco já pode estar fechado
  }
  
  server.close(() => {
    console.log('✅ Servidor encerrado com sucesso');
    process.exit(0);
  });
  
  setTimeout(() => {
    console.error('⚠️ Timeout - Forçando encerramento');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ✅ Tratamento de exceções não capturadas
process.on('uncaughtException', (err) => {
  console.error('❌ Exceção não capturada:', err);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Promise rejeitada não tratada:', reason);
  gracefulShutdown('unhandledRejection');
});

module.exports = server;