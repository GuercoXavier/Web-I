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
      FOREIGN KEY (categoria_id) REFERENCES categorias(id),
      FOREIGN KEY (subcategoria_id) REFERENCES subcategorias(id)
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
      FOREIGN KEY (utilizador_id) REFERENCES utilizadores(id)
    );

    CREATE TABLE IF NOT EXISTS pedido_itens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INTEGER NOT NULL,
      produto_id INTEGER NOT NULL,
      quantidade INTEGER NOT NULL,
      preco_unit INTEGER NOT NULL,
      FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
      FOREIGN KEY (produto_id) REFERENCES produtos(id)
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
  `);
}

// =====================
// SEED SEGURO
// =====================
async function seedDatabase() {
  const adminExiste = db.prepare(
    'SELECT id FROM utilizadores WHERE role = ? LIMIT 1'
  ).get('admin');

  if (adminExiste) return;

  const insertCategoria = db.prepare('INSERT INTO categorias (nome) VALUES (?)');

  const celId = insertCategoria.run('celulares').lastInsertRowid;
  const compId = insertCategoria.run('computadores').lastInsertRowid;
  const acId = insertCategoria.run('acessórios').lastInsertRowid;

  const insertSub = db.prepare(
    'INSERT INTO subcategorias (nome, categoria_id) VALUES (?, ?)'
  );

  const lapId = insertSub.run('Laptop', compId).lastInsertRowid;
  const monId = insertSub.run('Monitor', compId).lastInsertRowid;

  ['Fone', 'Teclado', 'Mouse', 'GPU', 'CPU'].forEach(nome => {
    insertSub.run(nome, acId);
  });

  // 🔥 MELHORIA: bcrypt async (não bloqueia servidor)
  const hash = await bcrypt.hash(
    process.env.ADMIN_PASSWORD || 'AdminAnik',
    10
  );

  db.prepare(`
    INSERT INTO utilizadores (username, email, password, role)
    VALUES (?, ?, ?, 'admin')
  `).run(
    process.env.ADMIN_USERNAME || 'Admin',
    process.env.ADMIN_EMAIL || 'admin@basgam.com',
    hash
  );

  const insertProd = db.prepare(`
    INSERT INTO produtos
    (nome, descricao, preco, stock, marca, categoria_id, subcategoria_id, em_destaque)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertProd.run('iPhone 15 Pro', 'Chip A17 Pro, câmera 48MP, titânio.', 85000, 10, 'Apple', celId, null, 1);
  insertProd.run('Samsung Galaxy S24', 'Display Dynamic AMOLED, 200MP.', 72000, 8, 'Samsung', celId, null, 1);
  insertProd.run('MacBook Air M3', '15.3", 8GB RAM, 256GB SSD.', 145000, 5, 'Apple', compId, lapId, 1);
  insertProd.run('ASUS ROG Zephyrus', 'Ryzen 9, RTX 4070, 16GB RAM.', 180000, 3, 'Asus', compId, lapId, 0);
  insertProd.run('Dell UltraSharp 27"', '4K IPS, 60Hz, USB-C.', 65000, 6, 'Dell', compId, monId, 0);

  console.log('✔ Base de dados inicializada com sucesso.');
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