// ==================== CONFIGURAÇÃO ====================
const API = `${window.location.protocol}//${window.location.hostname}:3000/api`;

let categoriaAtiva = '';
let produtos = [];
let carrinhoAtual = { itens: [], total: 0 };
let utilizadorLogado = null;

// ==================== HELPERS ====================
const getToken = () => localStorage.getItem('token');
const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    ...(getToken() && { Authorization: `Bearer ${getToken()}` })
});

// Formata moeda, convertendo centavos para unidades se necessário
const fmt = (v) => {
    if (v === undefined || v === null) return '0 MZN';
    let valor = v;
    // Se o valor for maior que 10000, assume que está em centavos e converte
    if (typeof v === 'number' && v > 10000) {
        valor = v / 100;
    }
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'MZN' }).format(valor);
};

async function apiFetch(path, opts = {}) {
    const res = await fetch(`${API}${path}`, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'Erro na requisição');
    return data;
}

// Normaliza URL da imagem (caminhos relativos -> absolutos)
function normalizarImagem(url) {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) return `${window.location.origin}${url}`;
    return `${window.location.origin}/${url}`;
}

// ==================== TOAST ====================
function mostrarMensagem(mensagem, tipo = 'info', duracao = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    let iconeHtml = '';
    switch (tipo) {
        case 'sucesso':
            iconeHtml = '<i class="bx bx-check-circle" style="font-size: 20px; color: #22c55e;"></i>';
            break;
        case 'erro':
            iconeHtml = '<i class="bx bx-x-circle" style="font-size: 20px; color: #ef4444;"></i>';
            break;
        default:
            iconeHtml = '<i class="bx bx-info-circle" style="font-size: 20px; color: #3b82f6;"></i>';
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.innerHTML = `
        <div class="toast-icon">${iconeHtml}</div>
        <div class="toast-mensagem">${mensagem}</div>
        <button class="toast-fechar" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'fadeOutRight 0.2s forwards';
            setTimeout(() => toast.remove(), 200);
        }
    }, duracao);
}

// ==================== CONFIRMAÇÃO ====================
function mostrarConfirmacao(mensagem, aoConfirmar, aoCancelar) {
    const modal = document.querySelector('.modal-confirmacao');
    const msgP = modal?.querySelector('.modal-confirmacao-body p');
    const btnSim = modal?.querySelector('#modalConfirmacaoBtnSim');
    const btnNao = modal?.querySelector('#modalConfirmacaoBtnNao');

    if (!modal || !msgP || !btnSim || !btnNao) {
        if (confirm(mensagem)) {
            if (aoConfirmar) aoConfirmar();
        } else {
            if (aoCancelar) aoCancelar();
        }
        return;
    }

    msgP.textContent = mensagem;
    modal.style.display = 'flex';

    const close = () => {
        modal.style.display = 'none';
        btnSim.removeEventListener('click', handleSim);
        btnNao.removeEventListener('click', handleNao);
        modal.removeEventListener('click', handleOutside);
    };
    const handleSim = () => { close(); if (aoConfirmar) aoConfirmar(); };
    const handleNao = () => { close(); if (aoCancelar) aoCancelar(); };
    const handleOutside = e => { if (e.target === modal) handleNao(); };

    btnSim.addEventListener('click', handleSim);
    btnNao.addEventListener('click', handleNao);
    modal.addEventListener('click', handleOutside);
}

// ==================== AUTH / USER ====================
function mostrarBotaoLogin() {
    const el = document.querySelector('.user-menu-container');
    if (el) el.innerHTML = `
        <a href="../TelaLogin/tela_login.html" class="btn-login-header">
            <img src="../../imagens/icon/person-circle.svg" alt="Login"/>
            <span>Entrar / Registrar</span>
        </a>`;
}

function atualizarUserDisplay() {
    const u = JSON.parse(localStorage.getItem('utilizador') || '{}');
    const span = document.getElementById('userNameDisplay');
    if (u.username && span)
        span.textContent = u.username.length > 15 ? u.username.slice(0, 12) + '...' : u.username;
    if (u.username === 'Admin') {
        const btn = document.querySelector('.dropdown-item[href*="RegistroAdm.html"]');
        if (btn) btn.style.display = 'flex';
    }
}

function toggleUserMenu() { document.getElementById('userMenu')?.classList.toggle('show'); }

document.addEventListener('click', e => {
    const c = document.querySelector('.user-menu-container');
    const m = document.getElementById('userMenu');
    if (c && m && !c.contains(e.target)) m.classList.remove('show');
});

function logout() {
    mostrarConfirmacao('Tem certeza que deseja sair?', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('utilizador');
        window.location.href = '../TelaLogin/tela_login.html';
    }, () => mostrarMensagem('Operação cancelada', 'info'));
}

// ==================== FILTROS ====================
const getMarcasSelecionadas = () => [...document.querySelectorAll('.filtro-marca:checked')].map(c => c.value);
const getApenasStock = () => document.querySelectorAll('.filtro-stock:checked').length > 0;

function getPrecoMin() {
    return [...document.querySelectorAll('.preco-min')]
        .map(i => parseInt(i.value) || 0).filter(v => v > 0).reduce((a, b) => Math.min(a, b), 0);
}

function getPrecoMax() {
    return [...document.querySelectorAll('.preco-max')]
        .map(i => parseInt(i.value) || 0).reduce((a, b) => Math.max(a, b), 0);
}

function aplicarFiltros() { carregarProdutos(); }

function limparFiltros() {
    document.querySelectorAll('.filtro-marca:checked, .filtro-stock:checked').forEach(c => c.checked = false);
    document.querySelectorAll('.preco-min, .preco-max').forEach(i => i.value = '');
    const search = document.getElementById('searchInput');
    if (search) search.value = '';
    categoriaAtiva = '';
    document.querySelectorAll('.filtro-grupo, .filtro-sub').forEach(el => el.removeAttribute('open'));
    carregarProdutos();
}

function toggleMarca() { document.getElementById('marcaFiltro')?.classList.toggle('open'); }

// ==================== PRODUTOS ====================
async function carregarProdutos() {
    try {
        const params = new URLSearchParams();
        const search = document.getElementById('searchInput')?.value;
        if (search) params.set('q', search);
        if (categoriaAtiva) params.set('categoria', categoriaAtiva);
        const min = getPrecoMin(), max = getPrecoMax();
        if (min > 0) params.set('min', min);
        if (max > 0) params.set('max', max);
        if (getApenasStock()) params.set('stock', 1);
        getMarcasSelecionadas().forEach(m => params.append('marca', m));

        const produtosData = await apiFetch(`/produtos?${params}`);
        // O backend retorna um array diretamente
        produtos = produtosData.map(p => ({
            id: p.id, nome: p.nome, preco: p.preco, descricao: p.descricao,
            imagem: normalizarImagem(p.imagem) || 'https://via.placeholder.com/300x200?text=Sem+Imagem',
            stock: p.stock, marca: p.marca,
            categoria_nome: p.categoria_nome, subcategoria_nome: p.subcategoria_nome,
            em_destaque: p.em_destaque
        }));

        renderizarProdutos();
        atualizarContador();
    } catch (err) {
        const grid = document.getElementById('grade-produtos');
        if (grid) grid.innerHTML = `<p class="sem-produtos">Erro: ${err.message}</p>`;
        mostrarMensagem(err.message, 'erro');
    }
}

function renderizarProdutos() {
    const grid = document.getElementById('grade-produtos');
    if (!grid) return;
    grid.innerHTML = produtos.length ? '' : `<p class="sem-produtos">Nenhum produto encontrado.</p>`;
    produtos.forEach(p => grid.appendChild(criarCard(p)));
}

function atualizarContador() {
    const c = document.getElementById('contador-resultados');
    if (c) c.textContent = `${produtos.length} produto(s)`;
}

function criarCard(p) {
    const card = document.createElement('div');
    card.className = 'produto';
    card.onclick = () => ir('detalhe', p.id);
    card.innerHTML = `
        <div class="produto-img">
            <img src="${p.imagem}" alt="${p.nome}"
                 onerror="this.src='https://via.placeholder.com/300x200?text=Sem+Imagem'">
        </div>
        <h3>${p.nome}</h3>
        <p class="preco">${fmt(p.preco)}</p>
        ${p.stock > 0
            ? `<button class="btn primario full" onclick="event.stopPropagation();addCarrinho(${p.id})">Comprar</button>`
            : '<p class="sem-stock">Sem stock</p>'}`;
    return card;
}

async function renderDestaque() {
    const grid = document.getElementById('grid-destaque');
    if (!grid) return;
    try {
        const lista = await apiFetch('/produtos?destaque=1');
        const produtosLista = Array.isArray(lista) ? lista : (lista.produtos || []);
        grid.innerHTML = '';
        if (!produtosLista.length) { grid.innerHTML = `<p style="color:var(--muted)">Nenhum produto em destaque.</p>`; return; }
        produtosLista.slice(0, 3).forEach(p => {
            p.imagem = normalizarImagem(p.imagem) || 'https://via.placeholder.com/300x200?text=Sem+Imagem';
            grid.appendChild(criarCard(p));
        });
    } catch { mostrarMensagem('Erro ao carregar produtos em destaque', 'erro'); }
}

// ==================== DETALHE ====================
async function renderDetalhe(id) {
    try {
        const p = await apiFetch(`/produtos/${id}`);
        // O backend agora retorna o produto diretamente (sem wrapper)
        p.imagem = normalizarImagem(p.imagem) || 'https://via.placeholder.com/500x400?text=Sem+Imagem';
        const container = document.getElementById('detalhe-conteudo');
        if (!container) return;

        const stockInfo = p.stock > 0
            ? `<span class="detalhe-meta-valor em-stock"><span class="stock-dot verde"></span>${p.stock} unidades</span>`
            : `<span class="detalhe-meta-valor sem-stock"><span class="stock-dot vermelho"></span>Esgotado</span>`;

        const botao = p.stock > 0
            ? `<button class="btn-carrinho-grande" onclick="addCarrinho(${p.id})">Adicionar ao Carrinho</button>`
            : `<button class="btn-carrinho-grande disabled" disabled>Indisponível</button>`;

        const metaItem = (label, valor) => valor ? `
            <div class="detalhe-meta-item">
                <span class="detalhe-meta-label">${label}</span>
                <span class="detalhe-meta-valor">${valor}</span>
            </div>` : '';

        const garantias = [
            ['shield-fill-check', 'Produto verificado e com garantia'],
            ['truck', 'Entrega rápida para Maputo'],
            ['headset', 'Suporte técnico especializado']
        ];

        container.innerHTML = `
            <div class="detalhe-grid">
                <div class="detalhe-imagem">
                    <img src="${p.imagem}" alt="${p.nome}" onerror="this.src='https://via.placeholder.com/500x400?text=Sem+Imagem'">
                </div>
                <div class="detalhe-info">
                    ${p.categoria_nome ? `<span class="detalhe-badge">${p.categoria_nome}</span>` : ''}
                    <h1>${p.nome}</h1>
                    <div class="detalhe-preco">${fmt(p.preco)}</div>
                    <hr class="detalhe-divisor">
                    <div class="detalhe-meta">
                        ${metaItem('Marca', p.marca)}
                        ${metaItem('Tipo', p.subcategoria_nome)}
                        <div class="detalhe-meta-item">
                            <span class="detalhe-meta-label">Disponibilidade</span>${stockInfo}
                        </div>
                        ${metaItem('Entrega', 'Maputo &amp; arredores')}
                    </div>
                    ${botao}
                    <div class="detalhe-garantias">
                        ${garantias.map(([ic, txt]) => `
                        <div class="detalhe-garantia-item">
                            <img src="../../imagens/icon/${ic}.svg" alt=""><span>${txt}</span>
                        </div>`).join('')}
                    </div>
                </div>
            </div>
            <div class="detalhe-descricao-secao">
                <h2>Sobre o Produto</h2>
                <div class="detalhe-descricao-box">${p.descricao || '<span class="detalhe-sem-descricao">Sem descrição disponível.</span>'}</div>
            </div>
            <div class="detalhe-veja-tambem" id="secao-veja-tambem">
                <h2>Veja Também</h2>
                <div class="veja-tambem-grade" id="grade-veja-tambem">
                    <p style="color:var(--muted);font-size:.9rem">Carregando sugestões...</p>
                </div>
            </div>`;

        carregarVejaTambem(p);
    } catch (err) { mostrarMensagem(err.message, 'erro'); }
}

async function carregarVejaTambem(produtoAtual) {
    const grade = document.getElementById('grade-veja-tambem');
    if (!grade) return;
    try {
        const param = produtoAtual.categoria_nome
            ? `categoria=${encodeURIComponent(produtoAtual.categoria_nome)}`
            : 'destaque=1';
        const lista = await apiFetch(`/produtos?${param}`);
        const produtosLista = Array.isArray(lista) ? lista : (lista.produtos || []);
        const sugestoes = produtosLista.filter(p => p.id !== produtoAtual.id).slice(0, 4);
        grade.innerHTML = sugestoes.length
            ? sugestoes.map(p => {
                const img = normalizarImagem(p.imagem) || 'https://via.placeholder.com/200x200?text=Sem+Imagem';
                return `
                <div class="veja-tambem-card"
                     onclick="renderDetalhe(${p.id});window.scrollTo({top:0,behavior:'smooth'})">
                    <div class="veja-tambem-img">
                        <img src="${img}" alt="${p.nome}" onerror="this.src='https://via.placeholder.com/200x200?text=Sem+Imagem'">
                    </div>
                    <div class="veja-tambem-nome">${p.nome}</div>
                    <div class="veja-tambem-preco">${fmt(p.preco)}</div>
                </div>`;
            }).join('')
            : `<p style="color:var(--muted);font-size:.9rem">Sem sugestões disponíveis.</p>`;
    } catch { grade.innerHTML = `<p style="color:var(--muted);font-size:.9rem">Não foi possível carregar sugestões.</p>`; }
}

// ==================== CARRINHO ====================
function getCarrinhoLocal() { return JSON.parse(localStorage.getItem('carrinho_local') || '{"itens":[],"total":0}'); }
function saveCarrinhoLocal(c) {
    c.total = c.itens.reduce((s, i) => s + i.preco * i.quantidade, 0);
    localStorage.setItem('carrinho_local', JSON.stringify(c));
    carrinhoAtual = c;
    renderCarrinho();
    atualizarBadge();
}

async function carregarCarrinho() {
    if (!getToken()) {
        carrinhoAtual = getCarrinhoLocal();
    } else {
        try {
            const data = await apiFetch('/carrinho', { headers: getAuthHeaders() });
            carrinhoAtual = {
                itens: (data.itens || []).map(item => ({
                    ...item,
                    imagem: normalizarImagem(item.imagem)
                })),
                total: data.total || 0
            };
        } catch (err) {
            console.error('Erro ao carregar carrinho:', err);
            carrinhoAtual = getCarrinhoLocal();
        }
    }
    renderCarrinho();
    atualizarBadge();
}

async function addCarrinho(produtoId) {
    let produto = produtos.find(p => p.id === produtoId);
    if (!produto) {
        try {
            produto = await apiFetch(`/produtos/${produtoId}`);
            produto.imagem = normalizarImagem(produto.imagem) || 'https://via.placeholder.com/80x80?text=Sem+Imagem';
        } catch { return; }
    }
    if (!getToken()) {
        const c = getCarrinhoLocal();
        const ex = c.itens.find(i => i.produto_id === produtoId);
        ex ? ex.quantidade++ : c.itens.push({ 
            produto_id: produto.id, 
            nome: produto.nome, 
            preco: produto.preco, 
            imagem: produto.imagem, 
            quantidade: 1 
        });
        saveCarrinhoLocal(c);
    } else {
        try {
            await apiFetch('/carrinho/adicionar', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ produto_id: produtoId, quantidade: 1 })
            });
            await carregarCarrinho();
        } catch (err) { mostrarMensagem(err.message, 'erro'); return; }
    }
    mostrarMensagem(`"${produto.nome}" adicionado ao carrinho!`, 'sucesso');
}

async function atualizarQuantidade(produtoId, quantidade) {
    if (quantidade < 0) return;
    if (!getToken()) {
        const c = getCarrinhoLocal();
        if (quantidade === 0) {
            c.itens = c.itens.filter(i => i.produto_id !== produtoId);
        } else {
            const item = c.itens.find(i => i.produto_id === produtoId);
            if (item) item.quantidade = quantidade;
        }
        saveCarrinhoLocal(c);
        return;
    }
    try {
        await apiFetch('/carrinho/atualizar', {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ produto_id: produtoId, quantidade })
        });
        await carregarCarrinho();
    } catch (err) { mostrarMensagem(err.message, 'erro'); }
}

const removerItemCarrinho = produtoId => atualizarQuantidade(produtoId, 0);

async function limparCarrinho() {
    mostrarConfirmacao('Limpar todo o carrinho?', async () => {
        if (!getToken()) {
            localStorage.removeItem('carrinho_local');
            carrinhoAtual = { itens: [], total: 0 };
            renderCarrinho(); atualizarBadge();
        } else {
            try {
                await apiFetch('/carrinho/limpar', { method: 'DELETE', headers: getAuthHeaders() });
                await carregarCarrinho();
            } catch (err) { mostrarMensagem(err.message, 'erro'); return; }
        }
        mostrarMensagem('Carrinho limpo', 'sucesso');
    }, () => mostrarMensagem('Operação cancelada', 'info'));
}

function renderCarrinho() {
    const container = document.getElementById('itens-carrinho');
    const subtotalSpan = document.getElementById('subtotal');
    const totalSpan = document.getElementById('total');
    if (!container) return;

    const itens = carrinhoAtual.itens || [];
    if (!itens.length) {
        container.innerHTML = `<p class="carrinho-vazio">Seu carrinho está vazio.</p>`;
        if (subtotalSpan) subtotalSpan.textContent = fmt(0);
        if (totalSpan) totalSpan.textContent = fmt(0);
        return;
    }

    let total = 0;
    container.innerHTML = itens.map(item => {
        const sub = item.preco * item.quantidade;
        total += sub;
        const pid = item.produto_id || item.id;
        const imgSrc = normalizarImagem(item.imagem) || 'https://via.placeholder.com/80x80?text=Sem+Imagem';
        return `
            <div class="item">
                <div class="item-img">
                    <img src="${imgSrc}" alt="${item.nome}" onerror="this.src='https://via.placeholder.com/80x80?text=Sem+Imagem'">
                </div>
                <div class="item-info">
                    <h3 onclick="ir('detalhe',${pid})">${item.nome}</h3>
                    <p class="preco">${fmt(item.preco)}</p>
                </div>
                <div class="qtd">
                    <button onclick="atualizarQuantidade(${pid},${item.quantidade - 1})">−</button>
                    <span>${item.quantidade}</span>
                    <button onclick="atualizarQuantidade(${pid},${item.quantidade + 1})">+</button>
                </div>
                <div class="item-total">${fmt(sub)}</div>
                <button class="btn-remover" onclick="removerItemCarrinho(${pid})">✕</button>
            </div>`;
    }).join('');

    if (subtotalSpan) subtotalSpan.textContent = fmt(total);
    if (totalSpan) totalSpan.textContent = fmt(total);
}

function atualizarBadge() {
    const badge = document.getElementById('badge');
    if (!badge) return;
    const total = carrinhoAtual.itens?.reduce((s, i) => s + i.quantidade, 0) || 0;
    badge.textContent = total;
    badge.classList.toggle('oculto', total === 0);
}

// ==================== CHECKOUT ====================
async function finalizar() {
    if (!getToken()) {
        mostrarConfirmacao(
            'Para finalizar precisa fazer login. Deseja ir para a página de login?',
            () => { localStorage.setItem('carrinho_local', JSON.stringify(carrinhoAtual)); window.location.href = '../TelaLogin/tela_login.html'; },
            () => mostrarMensagem('Compra não finalizada.', 'info')
        );
        return;
    }
    if (!carrinhoAtual.itens?.length) { mostrarMensagem('Carrinho vazio', 'erro'); return; }
    if (localStorage.getItem('carrinho_local')) await sincronizarCarrinhoLocal();
    try {
        const data = await apiFetch('/pedidos/checkout', { method: 'POST', headers: getAuthHeaders() });
        mostrarMensagem(`Pedido ${data.pedido_id} realizado! Total: ${fmt(data.total_gasto)}`, 'sucesso');
        localStorage.removeItem('carrinho_local');
        await carregarCarrinho();
        ir('produtos');
    } catch (err) { mostrarMensagem(err.message, 'erro'); }
}

async function sincronizarCarrinhoLocal() {
    const c = getCarrinhoLocal();
    for (const item of c.itens) {
        try {
            await apiFetch('/carrinho/adicionar', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ produto_id: item.produto_id, quantidade: item.quantidade })
            });
        } catch (err) { console.error('Erro ao sincronizar item:', err); }
    }
    localStorage.removeItem('carrinho_local');
    await carregarCarrinho();
}

// ==================== NAVEGAÇÃO ====================
const VIEW_MAP = { home: 'view-home', produtos: 'view-produtos', detalhe: 'view-detalhe', carrinho: 'view-carrinho', sobre: 'sobre', contato: 'view-contato' };

function ir(pagina, id = null) {
    document.querySelectorAll('.pagina').forEach(el => el.classList.add('oculta'));
    document.getElementById(VIEW_MAP[pagina])?.classList.remove('oculta');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (pagina === 'detalhe' && id) renderDetalhe(id);
    if (pagina === 'carrinho') renderCarrinho();
    atualizarHeader();
}

function filtrar(categoria) {
    categoriaAtiva = categoria;
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    ir('produtos');
    carregarProdutos();
}

function filtrarMarca(marca) {
    ir('produtos');
    setTimeout(() => {
        document.querySelectorAll('.filtro-marca:checked').forEach(c => c.checked = false);
        document.querySelectorAll('.preco-min, .preco-max').forEach(i => i.value = '');
        document.querySelectorAll(`.filtro-marca[value="${marca}"]`).forEach(c => c.checked = true);
        carregarProdutos();
    }, 100);
}

function setCat(btn, cat) {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    categoriaAtiva = cat;
    carregarProdutos();
}

// ==================== BUSCA ====================
function buscarProdutos(event) {
    if (event.key === 'Enter') carregarProdutos();
}
function buscarProdutosPorTexto() { carregarProdutos(); }

// ==================== UTILITÁRIOS ====================
function enviarForm(e) {
    e?.preventDefault();
    mostrarMensagem('Mensagem enviada com sucesso!', 'sucesso');
    e?.target?.reset();
}

function iniciarSlider() {
    const track = document.querySelector('.track');
    const container = document.getElementById('scroll-container');
    if (!track || !container) return;
    let index = 0;
    const slides = document.querySelectorAll('.track > *');
    const slideWidth = () => container.offsetWidth;
    const go = i => { index = i; track.style.transform = `translateX(-${index * slideWidth()}px)`; };
    document.getElementById('next')?.addEventListener('click', () => go(Math.min(index + 1, slides.length - 1)));
    document.getElementById('prev')?.addEventListener('click', () => go(Math.max(index - 1, 0)));
    window.addEventListener('resize', () => go(index));
}

function toggleMenu() { document.getElementById('menu')?.classList.toggle('aberto'); }

function atualizarHeader() {
    const header = document.querySelector('header');
    const home = document.getElementById('view-home');
    if (!header || !home) return;
    header.classList.toggle('scrolled', home.classList.contains('oculta') || window.scrollY > 200);
}
window.addEventListener('scroll', atualizarHeader);

// ==================== DESTAQUES POR CATEGORIA ====================
const DESTAQUE_CATS = [
    { id: 'grid-destaque-celulares', param: 'celulares' },
    { id: 'grid-destaque-laptops', param: 'laptop' },
    { id: 'grid-destaque-gpus', param: 'gpu' },
];

async function renderDestaquesCategorias() {
    await Promise.allSettled(DESTAQUE_CATS.map(async ({ id, param }) => {
        const grid = document.getElementById(id);
        if (!grid) return;
        try {
            const lista = await apiFetch(`/produtos?categoria=${encodeURIComponent(param)}`);
            const produtosLista = Array.isArray(lista) ? lista : (lista.produtos || []);
            grid.innerHTML = '';
            if (!produtosLista.length) { grid.innerHTML = `<p class="sem-produtos" style="padding:20px 0">Nenhum produto encontrado.</p>`; return; }
            produtosLista.sort(() => Math.random() - 0.5).slice(0, 3).forEach(p => {
                p.imagem = normalizarImagem(p.imagem) || 'https://via.placeholder.com/300x200?text=Sem+Imagem';
                grid.appendChild(criarCard(p));
            });
        } catch { grid.innerHTML = `<p class="sem-produtos">Erro ao carregar produtos.</p>`; }
    }));
}

// ==================== SIDEBAR ====================
const criarFiltroLeaf = (cat, marcas) => `
    <div class="filtro-corpo-marcas">
        ${marcas.map(m => `<label class="filtro-marca-label">
            <input type="checkbox" class="filtro-marca" data-cat="${cat}" value="${m}" onchange="aplicarFiltros()"/>${m}
        </label>`).join('')}
    </div>`;

function gerarSidebar() {
    const root = document.getElementById('sidebar-filtros-content');
    if (!root) return;

    const SIDEBAR_CONFIG = [
        {
            label: 'Celulares', id: 'grupo-celulares', cat: 'celulares',
            marcas: ['Apple', 'Samsung', 'Xiaomi', 'Tecno']
        },
        {
            label: 'Computadores', id: 'grupo-computadores',
            filhos: [
                { label: 'Laptop', id: 'grupo-laptop', cat: 'laptop', marcas: ['Apple', 'Asus', 'Samsung', 'Dell', 'Lenovo', 'HP'] },
                { label: 'Monitor', id: 'grupo-monitor', cat: 'monitor', marcas: ['Samsung', 'Dell', 'HP', 'Asus', 'Apple'] }
            ]
        },
        {
            label: 'Acessórios', id: 'grupo-acessorios',
            filhos: [
                { label: 'Fone', cat: 'fone', marcas: ['Apple', 'Samsung', 'JBL'] },
                { label: 'Teclado', cat: 'teclado', marcas: ['Logitech', 'Corsair', 'Razer'] },
                { label: 'Mouse', cat: 'mouse', marcas: ['Logitech', 'Razer', 'Dell'] },
                { label: 'GPU', cat: 'gpu', marcas: ['NVIDIA', 'AMD', 'Intel'] },
                { label: 'Relógio Digital', cat: 'relogio', marcas: ['Apple', 'Samsung', 'Xiaomi'] },
                { label: 'Memória RAM', cat: 'ram', marcas: ['Kingston', 'Corsair', 'Crucial'] },
                { label: 'Cooler', cat: 'cooler', marcas: ['CoolerMaster', 'Noctua', 'Corsair'] },
                { label: 'CPU', cat: 'cpu', marcas: ['Intel', 'AMD'] },
                { label: 'Placa-mãe', cat: 'placamae', marcas: ['ASUS', 'MSI', 'Gigabyte'] }
            ]
        }
    ];

    const globais = `
        <div class="filtro-globais">
            <label class="filtro-marca-label">
                <input type="checkbox" class="filtro-stock" onchange="aplicarFiltros()"/>
                Em Stock
            </label>
            <div class="filtro-preco">
                <p>Preço</p>
                <div class="preco-inputs">
                    <input type="number" placeholder="Mín" class="preco-min" onchange="aplicarFiltros()" />
                    <span>–</span>
                    <input type="number" placeholder="Máx" class="preco-max" onchange="aplicarFiltros()" />
                </div>
            </div>
        </div>
    `;

    root.innerHTML = globais + SIDEBAR_CONFIG.map(g => {
        const corpo = g.filhos
            ? g.filhos.map(f => `
                <details class="filtro-sub"${f.id ? ` id="${f.id}"` : ''}>
                    <summary>${f.label}</summary>
                    <div class="filtro-corpo filtro-aninhado">
                        ${criarFiltroLeaf(f.cat, f.marcas)}
                    </div>
                </details>`).join('')
            : criarFiltroLeaf(g.cat, g.marcas);

        return `
            <details class="filtro-grupo" id="${g.id}">
                <summary class="filtro-grupo-titulo">${g.label}</summary>
                <div class="filtro-corpo">${corpo}</div>
            </details>`;
    }).join('');
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', async () => {
    document.querySelectorAll('#ano, #anoFooter').forEach(el => {
        if (el) el.textContent = new Date().getFullYear();
    });

    const token = getToken();
    if (token) {
        utilizadorLogado = JSON.parse(localStorage.getItem('utilizador') || '{}');
        atualizarUserDisplay();
    } else {
        mostrarBotaoLogin();
    }

    await renderDestaquesCategorias();
    gerarSidebar();
    await carregarProdutos();
    await carregarCarrinho();
    atualizarBadge();
    iniciarSlider();
    renderDestaque();

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keyup', buscarProdutos);
    }
});