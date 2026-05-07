require('dotenv').config();

let app;

try {
  app = require('./src/app');
} catch (err) {
  console.error('Erro ao carregar aplicação:', err.message);
  process.exit(1);
}

const PORT = Number(process.env.PORT) || 3000;
const ENV = process.env.NODE_ENV || 'development';

app.listen(PORT, () => {
  console.log('--------------------------------');
  console.log(`Ambiente: ${ENV}`);
  console.log(`Servidor: http://localhost:${PORT}`);
  console.log('Base de dados: basgam.db');
  console.log('--------------------------------');
});