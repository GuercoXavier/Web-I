const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

// ===================== CONEXÃO =====================
const dbPath = process.env.NODE_ENV === 'production'
    ? path.join(__dirname, '../../data/basgam.db')
    : path.join(__dirname, '../../basgam.db');

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db;

try {
  db = new Database(dbPath);
  console.log('📂 Banco de dados conectado em:', dbPath);
} catch (err) {
  console.error('❌ Erro ao conectar ao banco de dados:', err.message);
  process.exit(1);
}

// ===================== CONFIGURAÇÃO =====================
function configureDatabase() {
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA cache_size = -20000;');
}

// ===================== CRIAÇÃO DE TABELAS =====================
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
      FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL,
      FOREIGN KEY (subcategoria_id) REFERENCES subcategorias(id) ON DELETE SET NULL
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
  
  console.log('✅ Tabelas verificadas/criadas');
}

// ===================== INDEXES =====================
function createIndexes() {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria_id);
    CREATE INDEX IF NOT EXISTS idx_produtos_subcategoria ON produtos(subcategoria_id);
    CREATE INDEX IF NOT EXISTS idx_produtos_preco ON produtos(preco);
    CREATE INDEX IF NOT EXISTS idx_carrinho_itens_produto ON carrinho_itens(produto_id);
    CREATE INDEX IF NOT EXISTS idx_pedidos_utilizador ON pedidos(utilizador_id);
    CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);
    CREATE INDEX IF NOT EXISTS idx_pedidos_criado_em ON pedidos(criado_em);
    CREATE INDEX IF NOT EXISTS idx_transacoes_utilizador ON transacoes_creditos(utilizador_id);
    CREATE INDEX IF NOT EXISTS idx_transacoes_data ON transacoes_creditos(criado_em);
    CREATE INDEX IF NOT EXISTS idx_utilizadores_username ON utilizadores(username);
    CREATE INDEX IF NOT EXISTS idx_utilizadores_email ON utilizadores(email);
  `);
  
  console.log('✅ Índices verificados/criados');
}

// ===================== SEED DATABASE =====================
async function seedDatabase() {
  const adminExiste = db.prepare(
    'SELECT id FROM utilizadores WHERE role = ? LIMIT 1'
  ).get('admin');

  if (adminExiste) {
    console.log('📋 Dados iniciais já existem');
    return;
  }

  console.log('🌱 A criar dados iniciais...');

  // ==================== CATEGORIAS (compatíveis com frontend) ====================
  const insertCategoria = db.prepare('INSERT INTO categorias (nome) VALUES (?)');
  
  // ✅ Categorias compatíveis com o frontend
  const categoriasMap = {
    'celulares': insertCategoria.run('celulares').lastInsertRowid,
    'computadores': insertCategoria.run('computadores').lastInsertRowid,
    'acessórios': insertCategoria.run('acessórios').lastInsertRowid
  };
  
  // Adicionar também categorias específicas que o frontend usa nos filtros
  const categoriasExtras = ['laptop', 'gpu', 'monitor', 'fone', 'teclado', 'mouse', 'relogio', 'ram', 'cooler', 'cpu', 'placamae'];
  for (const cat of categoriasExtras) {
    const exists = db.prepare('SELECT id FROM categorias WHERE nome = ?').get(cat);
    if (!exists) {
      insertCategoria.run(cat);
      console.log(`   Categoria extra criada: ${cat}`);
    }
  }

  // ==================== SUBCATEGORIAS ====================
  const insertSub = db.prepare('INSERT INTO subcategorias (nome, categoria_id) VALUES (?, ?)');
  
  // Re-obter IDs atualizados
  const getCatId = (nome) => db.prepare('SELECT id FROM categorias WHERE nome = ?').get(nome)?.id;
  
  const celId = getCatId('celulares');
  const compId = getCatId('computadores');
  const acId = getCatId('acessórios');
  const laptopId = getCatId('laptop') || compId;
  const gpuId = getCatId('gpu') || acId;
  
  if (celId) {
    insertSub.run('Smartphone', celId);
    insertSub.run('Tablet', celId);
  }
  
  if (compId || laptopId) {
    insertSub.run('Laptop', laptopId || compId);
    insertSub.run('Desktop', compId);
  }
  
  if (gpuId) {
    insertSub.run('Placa de Vídeo', gpuId);
  }
  
  if (acId) {
    const acessorios = [
      'Fones de Ouvido', 'Caixas de Som', 'Teclados', 'Mouses',
      'Processadores', 'Memória RAM', 'Armazenamento SSD/HDD',
      'Fontes de Alimentação', 'Gabinetes', 'Smartwatches', 'Routers',
      'Cadeiras Gamer', 'Carregadores', 'Power Banks', 'Monitores', 'Coolers'
    ];
    acessorios.forEach(nome => {
      try { insertSub.run(nome, acId); } catch(e) {}
    });
  }

  // ==================== CRIAR ADMIN ====================
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminAnik';
  const hash = await bcrypt.hash(adminPassword, 10);

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
  console.log(`   - Username: ${process.env.ADMIN_USERNAME || 'Admin'}`);
  console.log(`   - Password: ${adminPassword}`);
  console.log('');
  console.log('📂 CATEGORIAS: Celulares, Computadores, Acessórios, Laptop, GPU, Monitor, etc.');
  console.log('========================================');
}

// ===================== FUNÇÕES AUXILIARES =====================

function verificarCreditos(utilizadorId) {
  const user = db.prepare('SELECT creditos FROM utilizadores WHERE id = ?').get(utilizadorId);
  return user ? user.creditos : 0;
}

function verificarStockCarrinho(carrinhoId) {
  const itens = db.prepare(`
    SELECT p.id, p.nome, ci.quantidade, p.stock, p.preco
    FROM carrinho_itens ci
    JOIN produtos p ON ci.produto_id = p.id
    WHERE ci.carrinho_id = ?
  `).all(carrinhoId);
  
  for (const item of itens) {
    if (item.quantidade > item.stock) {
      return {
        valido: false,
        produto: item.nome,
        disponivel: item.stock,
        solicitado: item.quantidade
      };
    }
  }
  
  const total = itens.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);
  return { valido: true, total: total / 100, itens };
}

// ===================== INIT =====================
async function initDatabase() {
  console.log('🔄 Inicializando base de dados...');
  configureDatabase();
  createTables();
  createIndexes();
  await seedDatabase();
  console.log('✅ Base de dados pronta!');
}

initDatabase().catch(err => {
  console.error('❌ Erro fatal na inicialização do banco:', err);
  process.exit(1);
});

module.exports = { db, verificarCreditos, verificarStockCarrinho };