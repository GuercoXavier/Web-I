const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

const db = new Database(path.join(__dirname, '../../basgam.db'));

// =====================
// CONFIGURAÇÃO
// =====================
function configureDatabase() {
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');
}

// =====================
// CRIAÇÃO DE TABELAS
// =====================
function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS utilizadores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'cliente',
      creditos INTEGER DEFAULT 0,
      tentativas_login INTEGER DEFAULT 0,
      bloqueado_ate TEXT,
      reset_token TEXT,
      reset_token_expires TEXT,
      criado_em TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS subcategorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      categoria_id INTEGER NOT NULL,
      FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE CASCADE,
      UNIQUE (nome, categoria_id)
    );

    CREATE TABLE IF NOT EXISTS produtos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      descricao TEXT DEFAULT '',
      preco INTEGER NOT NULL CHECK (preco >= 0),
      stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
      marca TEXT DEFAULT '',
      imagem TEXT DEFAULT '',
      categoria_id INTEGER,
      subcategoria_id INTEGER,
      em_destaque INTEGER NOT NULL DEFAULT 0,
      criado_em TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE CASCADE,
      FOREIGN KEY (subcategoria_id) REFERENCES subcategorias(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS carrinhos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      utilizador_id INTEGER UNIQUE,
      criado_em TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (utilizador_id) REFERENCES utilizadores(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS carrinho_itens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      carrinho_id INTEGER NOT NULL,
      produto_id INTEGER NOT NULL,
      quantidade INTEGER NOT NULL DEFAULT 1 CHECK (quantidade > 0),
      FOREIGN KEY (carrinho_id) REFERENCES carrinhos(id) ON DELETE CASCADE,
      FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE,
      UNIQUE (carrinho_id, produto_id)
    );

    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      utilizador_id INTEGER,
      total INTEGER NOT NULL,
      estado TEXT NOT NULL DEFAULT 'pendente',
      criado_em TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (utilizador_id) REFERENCES utilizadores(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS pedido_itens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INTEGER NOT NULL,
      produto_id INTEGER NOT NULL,
      quantidade INTEGER NOT NULL,
      preco_unit INTEGER NOT NULL,
      FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
      FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transacoes_creditos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      utilizador_id INTEGER NOT NULL,
      valor INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      descricao TEXT,
      referencia TEXT,
      criado_em TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (utilizador_id) REFERENCES utilizadores(id) ON DELETE CASCADE
    );
  `);
}

// =====================
// INDEXES
// =====================
function createIndexes() {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria_id);
    CREATE INDEX IF NOT EXISTS idx_produtos_subcategoria ON produtos(subcategoria_id);
    CREATE INDEX IF NOT EXISTS idx_carrinho_itens_produto ON carrinho_itens(produto_id);
    CREATE INDEX IF NOT EXISTS idx_pedidos_utilizador ON pedidos(utilizador_id);
    CREATE INDEX IF NOT EXISTS idx_transacoes_utilizador ON transacoes_creditos(utilizador_id);
    CREATE INDEX IF NOT EXISTS idx_transacoes_data ON transacoes_creditos(criado_em);
  `);
}

// =====================
// SEED COMPLETO (Todas as categorias e subcategorias)
// =====================
async function seedDatabase() {
  const adminExiste = db.prepare(
    'SELECT id FROM utilizadores WHERE role = ? LIMIT 1'
  ).get('admin');

  if (adminExiste) return;

  console.log('🌱 A criar dados iniciais...');

  // ==================== CATEGORIAS ====================
  const insertCategoria = db.prepare('INSERT INTO categorias (nome) VALUES (?)');
  
  const celId = insertCategoria.run('celulares').lastInsertRowid;
  const compId = insertCategoria.run('computadores').lastInsertRowid;
  const acId = insertCategoria.run('acessórios').lastInsertRowid;

  // ==================== SUBCATEGORIAS ====================
  const insertSub = db.prepare('INSERT INTO subcategorias (nome, categoria_id) VALUES (?, ?)');
  
  // --- Computadores ---
  const lapId = insertSub.run('Laptop', compId).lastInsertRowid;
  const monId = insertSub.run('Monitor', compId).lastInsertRowid;
  const pcId = insertSub.run('Desktop', compId).lastInsertRowid;
  
  // --- Celulares ---
  insertSub.run('Smartphone', celId);
  insertSub.run('Tablet', celId);
  insertSub.run('Acessórios Celular', celId);
  
  // --- Acessórios completos ---
  // Áudio
  insertSub.run('Fones de Ouvido', acId);
  insertSub.run('Caixas de Som', acId);
  insertSub.run('Microfones', acId);
  
  // Periféricos
  insertSub.run('Teclados', acId);
  insertSub.run('Mouses', acId);
  insertSub.run('Tapetes de Mouse', acId);
  
  // Componentes PC
  insertSub.run('Placas de Vídeo (GPU)', acId);
  insertSub.run('Processadores (CPU)', acId);
  insertSub.run('Memória RAM', acId);
  insertSub.run('Placas-mãe', acId);
  insertSub.run('Armazenamento (SSD/HDD)', acId);
  insertSub.run('Fontes de Alimentação', acId);
  insertSub.run('Coolers e Ventoinhas', acId);
  insertSub.run('Gabinetes', acId);
  
  // Wearables
  insertSub.run('Smartwatches', acId);
  insertSub.run('Pulseiras Fitness', acId);
  
  // Rede e Conectividade
  insertSub.run('Routers e Switches', acId);
  insertSub.run('Cabos e Adaptadores', acId);
  
  // Gaming
  insertSub.run('Cadeiras Gamer', acId);
  insertSub.run('Volantes e Joysticks', acId);
  
  // Iluminação
  insertSub.run('LEDs e Iluminação', acId);
  
  // Carregadores
  insertSub.run('Carregadores', acId);
  insertSub.run('Power Banks', acId);
  insertSub.run('Bases de Carregamento', acId);
  
  // Suportes
  insertSub.run('Suportes para Monitor', acId);
  insertSub.run('Suportes para Notebook', acId);
  
  // Limpeza
  insertSub.run('Kits de Limpeza', acId);
  
  // Mochilas e Pastas
  insertSub.run('Mochilas para Notebook', acId);
  insertSub.run('Pastas e Cases', acId);

  // ==================== CRIAR ADMIN ====================
  const hash = await bcrypt.hash(
    process.env.ADMIN_PASSWORD || 'AdminAnik',
    10
  );

  db.prepare(`
    INSERT INTO utilizadores (username, email, password, role, creditos)
    VALUES (?, ?, ?, 'admin', 0)
  `).run(
    process.env.ADMIN_USERNAME || 'Admin',
    process.env.ADMIN_EMAIL || 'admin@basgam.com',
    hash
  );

  console.log('========================================');
  console.log('✔ Base de dados inicializada com sucesso!');
  console.log('========================================');
  console.log('📋 ADMIN:');
  console.log('   - Username: Admin');
  console.log('   - Password: AdminAnik');
  console.log('');
  console.log('📂 CATEGORIAS CRIADAS:');
  console.log('   1. Celulares');
  console.log('   2. Computadores');
  console.log('   3. Acessórios');
  console.log('');
  console.log('📁 SUBCATEGORIAS CRIADAS:');
  console.log('   Computadores: Laptop, Monitor, Desktop');
  console.log('   Celulares: Smartphone, Tablet, Acessórios Celular');
  console.log('   Acessórios: 25+ subcategorias');
  console.log('========================================');
  console.log('💡 Adicione os produtos manualmente pelo painel admin!');
  console.log('========================================');
}

// =====================
// INIT
// =====================
async function initDatabase() {
  configureDatabase();
  createTables();
  createIndexes();
  await seedDatabase();
}

initDatabase();

module.exports = db;