const API = 'http://localhost:3000/api';

let produtos = [];

// O carrinho local serve apenas como cache/fallback
let carrinho = JSON.parse(localStorage.getItem('carrinho')) || [];

/* ───────────────────────────────────────────── */
/* INIT                                          */
/* ───────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', async () => {

    document.getElementById('ano') &&
        (document.getElementById('ano').textContent = new Date().getFullYear());

    document.getElementById('anoFooter') &&
        (document.getElementById('anoFooter').textContent = new Date().getFullYear());

    await carregarProdutos();
    await carregarCategorias();

    // Se o utilizador estiver logado, carrega o carrinho do servidor
    if (getToken()) {
        await sincronizarCarrinhoDoServidor();
    }

    atualizarBadge();

    const track = document.querySelector('.track');
    const total = document.querySelectorAll('.track > *').length;
    const slideWidth = () => document.getElementById('scroll-container').offsetWidth;
    let index = 0;

    document.getElementById('next').onclick = () => {
        index = Math.min(index + 1, total - 1);
        track.style.transform = `translateX(-${index * slideWidth()}px)`;
    };

    document.getElementById('prev').onclick = () => {
        index = Math.max(index - 1, 0);
        track.style.transform = `translateX(-${index * slideWidth()}px)`;
    };
});

/* ───────────────────────────────────────────── */
/* AUTH  →  /api/auth                            */
/* ───────────────────────────────────────────── */

function getToken() {
    return localStorage.getItem('token');
}

/**
 * POST /auth/login
 * body: { email, senha }
 * Guarda o token no localStorage e redireciona.
 */
async function login(email, senha) {
    try {
        const res  = await fetch(`${API}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, senha })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.erro || 'Credenciais inválidas.');

        localStorage.setItem('token', data.token);

        // Após login, sincroniza o carrinho local com o servidor
        await sincronizarCarrinhoDoServidor();
        atualizarBadge();

        window.location.href = '../../index.html';

    } catch (err) {
        alert(err.message);
    }
}

/**
 * POST /auth/registar
 * body: { nome, email, senha }
 */
async function registar(nome, email, senha) {
    try {
        const res  = await fetch(`${API}/auth/registar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, email, senha })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.erro || 'Erro ao criar conta.');

        alert('Conta criada com sucesso! Faça login. ✅');
        window.location.href = 'tela_login.html';

    } catch (err) {
        alert(err.message);
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('carrinho');
    carrinho = [];
    atualizarBadge();
    window.location.href = 'Telas/TelaLogin/tela_login.html';
}

/* ───────────────────────────────────────────── */
/* USERS  →  /api/users                          */
/* ───────────────────────────────────────────── */

/**
 * GET /users/perfil  (ou rota equivalente do teu users.js)
 * Carrega os dados do utilizador logado e preenche o formulário de perfil.
 */
async function carregarPerfil() {
    const token = getToken();
    if (!token) return;

    try {
        const res  = await fetch(`${API}/users/perfil`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.erro || 'Erro ao carregar perfil.');

        // Preenche os campos se existirem na página
        const campos = { 'perfil-nome': data.nome, 'perfil-email': data.email };
        Object.entries(campos).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el) el.value = val || '';
        });

    } catch (err) {
        console.error('Erro ao carregar perfil:', err);
    }
}

/**
 * PUT /users/perfil
 * Atualiza nome e/ou senha do utilizador logado.
 */
async function atualizarPerfil(e) {
    e.preventDefault();
    const token = getToken();
    if (!token) { alert('Faça login primeiro.'); return; }

    const nome      = document.getElementById('perfil-nome')?.value.trim();
    const novaSenha = document.getElementById('perfil-senha')?.value.trim();

    const body = {};
    if (nome)      body.nome  = nome;
    if (novaSenha) body.senha = novaSenha;

    if (Object.keys(body).length === 0) {
        alert('Nenhum dado para atualizar.');
        return;
    }

    try {
        const res  = await fetch(`${API}/users/perfil`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.erro || 'Erro ao atualizar perfil.');

        alert('Perfil atualizado com sucesso! ✅');

    } catch (err) {
        alert(err.message);
    }
}

/* ───────────────────────────────────────────── */
/* API — PRODUTOS                                */
/* ───────────────────────────────────────────── */

async function carregarProdutos() {
    try {
        const res  = await fetch(`${API}/produtos`);
        const data = await res.json();

        if (!res.ok) throw new Error(data.erro || 'Erro ao carregar produtos');

        produtos = data;
        renderDestaque();
        renderProdutos();

    } catch (err) {
        console.error(err);
        const grid = document.getElementById('grade-produtos');
        if (grid) grid.innerHTML = `<p class="sem-produtos">Erro ao carregar produtos.</p>`;
    }
}

/* ───────────────────────────────────────────── */
/* API — CARRINHO (servidor)                     */
/* ───────────────────────────────────────────── */

/**
 * Busca o carrinho do servidor e substitui o cache local.
 */
async function sincronizarCarrinhoDoServidor() {
    try {
        const res  = await fetch(`${API}/carrinho`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        if (!res.ok) return; // silencioso; usa o cache local

        const data = await res.json();

        // Converte o formato do servidor para o formato local
        // Servidor: { itens: [{ produto_id, nome, preco, imagem, quantidade }] }
        // Local:    [{ id, nome, preco, img, qtd }]
        carrinho = data.itens.map(i => ({
            id:    i.produto_id,
            nome:  i.nome,
            preco: i.preco,
            img:   i.imagem,
            qtd:   i.quantidade
        }));

        localStorage.setItem('carrinho', JSON.stringify(carrinho));

    } catch (err) {
        console.warn('Não foi possível sincronizar o carrinho:', err);
    }
}

/**
 * Adiciona um produto ao carrinho.
 * - Atualiza o estado local imediatamente (UX responsiva).
 * - Sincroniza com o servidor em background se o utilizador estiver logado.
 */
async function addCarrinho(id) {
    const produto = produtos.find(p => p.id === id);
    if (!produto) return;

    // 1. Actualiza o estado local
    const existente = carrinho.find(i => i.id === id);
    if (existente) {
        existente.qtd++;
    } else {
        carrinho.push({ ...produto, qtd: 1 });
    }

    localStorage.setItem('carrinho', JSON.stringify(carrinho));
    atualizarBadge();

    // 2. Sincroniza com o servidor
    const token = getToken();
    if (token) {
        try {
            const res = await fetch(`${API}/carrinho/adicionar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                // ✅ Usa "produto_id" e "quantidade" — formato esperado pelo servidor
                body: JSON.stringify({ produto_id: id, quantidade: 1 })
            });

            if (!res.ok) {
                const data = await res.json();
                console.warn('Erro ao sincronizar carrinho:', data.erro);
            }

        } catch (err) {
            console.warn('Servidor indisponível. Produto salvo apenas localmente.', err);
        }
    }

    alert(`"${produto.nome}" adicionado ao carrinho! 🛒`);
}

/**
 * Remove um produto do carrinho (local + servidor).
 */
async function remover(id) {
    carrinho = carrinho.filter(i => i.id !== id);
    localStorage.setItem('carrinho', JSON.stringify(carrinho));
    atualizarBadge();
    renderCarrinho();

    const token = getToken();
    if (token) {
        try {
            await fetch(`${API}/carrinho/atualizar`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                // quantidade 0 → o servidor deleta o item (ver carrinho.js router.put)
                body: JSON.stringify({ produto_id: id, quantidade: 0 })
            });
        } catch (err) {
            console.warn('Erro ao remover item no servidor:', err);
        }
    }
}

/**
 * Altera a quantidade de um item (local + servidor).
 */
async function mudarQtd(id, delta) {
    const item = carrinho.find(i => i.id === id);
    if (!item) return;

    item.qtd += delta;

    if (item.qtd <= 0) {
        await remover(id);
        return;
    }

    localStorage.setItem('carrinho', JSON.stringify(carrinho));
    renderCarrinho();
    atualizarBadge();

    const token = getToken();
    if (token) {
        try {
            await fetch(`${API}/carrinho/atualizar`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ produto_id: id, quantidade: item.qtd })
            });
        } catch (err) {
            console.warn('Erro ao atualizar quantidade no servidor:', err);
        }
    }
}

/**
 * Limpa o carrinho inteiro (local + servidor).
 */
async function limparCarrinho() {
    carrinho = [];
    localStorage.removeItem('carrinho');
    atualizarBadge();
    renderCarrinho();

    const token = getToken();
    if (token) {
        try {
            await fetch(`${API}/carrinho/limpar`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (err) {
            console.warn('Erro ao limpar carrinho no servidor:', err);
        }
    }
}

/* ───────────────────────────────────────────── */
/* PEDIDOS  →  /api/pedidos                      */
/* ───────────────────────────────────────────── */

/**
 * POST /pedidos/checkout
 * O servidor lê o carrinho diretamente da BD,
 * valida stock, cria o pedido e limpa o carrinho.
 */
async function finalizar() {
    if (carrinho.length === 0) return;

    const token = getToken();
    if (!token) {
        alert('Faça login primeiro.');
        window.location.href = 'Telas/TelaLogin/tela_login.html';
        return;
    }

    try {
        const res  = await fetch(`${API}/pedidos/checkout`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
            // ✅ Sem body — o servidor lê o carrinho direto da BD
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.erro || 'Erro ao finalizar pedido.');

        alert(`Pedido #${data.pedido_id} realizado! Total: ${fmt(data.total)} 🎉`);

        // Limpa o estado local após checkout confirmado
        await limparCarrinho();

    } catch (err) {
        console.error(err);
        alert(err.message);
    }
}

/**
 * GET /pedidos
 * Lista todos os pedidos do utilizador logado.
 */
async function carregarPedidos() {
    const token = getToken();
    if (!token) return;

    try {
        const res  = await fetch(`${API}/pedidos`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.erro || 'Erro ao carregar pedidos.');

        renderPedidos(data);

    } catch (err) {
        console.error('Erro ao carregar pedidos:', err);
    }
}

function renderPedidos(pedidos) {
    const lista = document.getElementById('lista-pedidos');
    if (!lista) return;

    if (pedidos.length === 0) {
        lista.innerHTML = `<p class="sem-produtos">Ainda não tens pedidos.</p>`;
        return;
    }

    lista.innerHTML = pedidos.map(p => `
        <div class="pedido-card" onclick="carregarDetalhePedido(${p.id})">
            <span class="pedido-id">Pedido #${p.id}</span>
            <span class="pedido-estado estado-${p.estado}">${p.estado}</span>
            <span class="pedido-total">${fmt(p.total)}</span>
        </div>
    `).join('');
}

/**
 * GET /pedidos/:id
 * Carrega o detalhe de um pedido específico.
 */
async function carregarDetalhePedido(id) {
    const token = getToken();
    if (!token) return;

    try {
        const res  = await fetch(`${API}/pedidos/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.erro || 'Erro ao carregar pedido.');

        renderDetalhePedido(data);

    } catch (err) {
        console.error('Erro ao carregar detalhe do pedido:', err);
        alert(err.message);
    }
}

function renderDetalhePedido({ pedido, itens }) {
    const conteudo = document.getElementById('detalhe-pedido-conteudo');
    if (!conteudo) return;

    const linhasItens = itens.map(i => `
        <tr>
            <td>${i.nome}</td>
            <td>${i.quantidade}</td>
            <td>${fmt(i.preco_unit)}</td>
            <td>${fmt(i.preco_unit * i.quantidade)}</td>
        </tr>
    `).join('');

    conteudo.innerHTML = `
        <h2>Pedido #${pedido.id}</h2>
        <p>Estado: <strong class="estado-${pedido.estado}">${pedido.estado}</strong></p>
        <table class="tabela-pedido">
            <thead>
                <tr>
                    <th>Produto</th>
                    <th>Qtd</th>
                    <th>Preço unit.</th>
                    <th>Subtotal</th>
                </tr>
            </thead>
            <tbody>${linhasItens}</tbody>
        </table>
        <p class="pedido-total-final">Total: <strong>${fmt(pedido.total)}</strong></p>
    `;

    ir('detalhe-pedido');
}

/**
 * GET /pedidos/admin/relatorio
 * Apenas para utilizadores com role = 'admin'.
 */
async function carregarRelatorio() {
    const token = getToken();
    if (!token) return;

    try {
        const res  = await fetch(`${API}/pedidos/admin/relatorio`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.erro || 'Acesso negado.');

        renderRelatorio(data);

    } catch (err) {
        console.error('Erro ao carregar relatório:', err);
        alert(err.message);
    }
}

function renderRelatorio({ totalPedidos, faturacao, topProdutos, vendasPorDia }) {
    const conteudo = document.getElementById('relatorio-conteudo');
    if (!conteudo) return;

    const topHtml = topProdutos.map(p => `
        <li>${p.nome} — <strong>${p.vendidos}</strong> vendidos</li>
    `).join('');

    const vendasHtml = vendasPorDia.map(v => `
        <li>${v.dia}: <strong>${fmt(v.total)}</strong></li>
    `).join('');

    conteudo.innerHTML = `
        <div class="relatorio-resumo">
            <div class="resumo-card">
                <h3>Total de Pedidos</h3>
                <p>${totalPedidos}</p>
            </div>
            <div class="resumo-card">
                <h3>Faturação Total</h3>
                <p>${fmt(faturacao)}</p>
            </div>
        </div>
        <h3>Top 5 Produtos</h3>
        <ul>${topHtml}</ul>
        <h3>Vendas (últimos 7 dias)</h3>
        <ul>${vendasHtml}</ul>
    `;
}

/* ───────────────────────────────────────────── */
/* UI — BADGE                                    */
/* ───────────────────────────────────────────── */

function atualizarBadge() {
    const badge = document.getElementById('badge');
    if (!badge) return;
    const total = carrinho.reduce((s, i) => s + i.qtd, 0);
    badge.textContent = total;
    total > 0 ? badge.classList.remove('oculto') : badge.classList.add('oculto');
}

/* ───────────────────────────────────────────── */
/* UI — CARRINHO (render)                        */
/* ───────────────────────────────────────────── */

function renderCarrinho() {
    const lista    = document.getElementById('itens-carrinho');
    const subtotal = document.getElementById('subtotal');
    const total    = document.getElementById('total');

    if (carrinho.length === 0) {
        lista.innerHTML = `
            <div class="vazio">
                <span class="emoji">🛒</span>
                <h2>Seu carrinho está vazio</h2>
                <p>Parece que você ainda não adicionou nada.</p>
                <a onclick="ir('produtos')">Continuar comprando</a>
            </div>`;
        subtotal.textContent = fmt(0);
        total.textContent    = fmt(0);
        return;
    }

    let soma = 0;
    let html = '';

    carrinho.forEach(item => {
        const itemTotal = item.preco * item.qtd;
        soma += itemTotal;
        html += `
            <div class="item">
                <div class="item-img" onclick="ir('detalhe', ${item.id})">
                    <img src="${item.img}" alt="${item.nome}">
                </div>
                <div class="item-info">
                    <h3 onclick="ir('detalhe', ${item.id})">${item.nome}</h3>
                    <p class="preco">${fmt(item.preco)}</p>
                </div>
                <div class="qtd">
                    <button onclick="mudarQtd(${item.id}, -1)">−</button>
                    <span>${item.qtd}</span>
                    <button onclick="mudarQtd(${item.id}, +1)">+</button>
                </div>
                <div class="item-total">${fmt(itemTotal)}</div>
                <button class="btn-remover" onclick="remover(${item.id})">✕</button>
            </div>`;
    });

    lista.innerHTML      = html;
    subtotal.textContent = fmt(soma);
    total.textContent    = fmt(soma);
}

/* ───────────────────────────────────────────── */
/* UI — NAVEGAÇÃO                                */
/* ───────────────────────────────────────────── */

function ir(pagina, id = null) {
    document.querySelectorAll('.pagina').forEach(el => el.classList.add('oculta'));
    document.getElementById(`view-${pagina}`).classList.remove('oculta');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (pagina === 'detalhe' && id) renderDetalhe(id);
    if (pagina === 'carrinho')      renderCarrinho();
}

function toggleMenu() {
    document.getElementById('menu').classList.toggle('aberto');
}

function fmt(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/* ───────────────────────────────────────────── */
/* UI — CARDS / DESTAQUE / LISTA                 */
/* ───────────────────────────────────────────── */

function criarCard(p) {
    const card = document.createElement('div');
    card.className = 'produto';
    card.onclick = () => ir('detalhe', p.id);
    card.innerHTML = `
        <div class="produto-img"><img src="${p.img}" alt="${p.nome}"></div>
        <h3>${p.nome}</h3>
        <p class="preco">${fmt(p.preco)}</p>`;
    return card;
}

function renderDestaque() {
    const grid = document.getElementById('grid-destaque');
    if (!grid) return;
    grid.innerHTML = '';
    if (produtos.length === 0) {
        grid.innerHTML = `<p style="color:var(--muted);padding:40px 0 0 24px">Nenhum produto em destaque.</p>`;
        return;
    }
    produtos.slice(0, 3).forEach(p => grid.appendChild(criarCard(p)));
}

function renderProdutosLista(lista) {
    const grid    = document.getElementById('grade-produtos');
    const counter = document.getElementById('contador-resultados');
    if (!grid) return;
    grid.innerHTML = '';

    if (lista.length === 0) {
        grid.innerHTML = `<p class="sem-produtos">Nenhum produto encontrado.</p>`;
        if (counter) counter.textContent = '';
        return;
    }

    lista.forEach(p => grid.appendChild(criarCard(p)));
    if (counter) counter.textContent = `${lista.length} produto${lista.length !== 1 ? 's' : ''}`;
}

function renderProdutos() { aplicarFiltros(); }

/* ───────────────────────────────────────────── */
/* UI — DETALHE                                  */
/* ───────────────────────────────────────────── */

function renderDetalhe(id) {
    const p = produtos.find(x => x.id === id);
    if (!p) { ir('produtos'); return; }

    document.getElementById('detalhe-conteudo').innerHTML = `
        <div class="detalhe-img"><img src="${p.img}" alt="${p.nome}"></div>
        <div class="detalhe-info">
            <p class="categoria">${p.categoria}</p>
            <h1>${p.nome}</h1>
            <p class="preco-grande">${fmt(p.preco)}</p>
            <hr class="divisor">
            <p>${p.desc}</p>
            <button class="btn primario" onclick="addCarrinho(${p.id})">
                Adicionar ao Carrinho 🛒
            </button>
            <ul class="garantias">
                <li>📦 Frete grátis e devoluções</li>
                <li>🛡️ 1 ano de garantia</li>
            </ul>
        </div>`;
}

/* ───────────────────────────────────────────── */
/* API — CATEGORIAS                              */
/* ───────────────────────────────────────────── */

/**
 * Carrega categorias e subcategorias do servidor
 * e renderiza o menu de navegação lateral/dropdown.
 *
 * Estrutura recebida do servidor:
 * [
 *   { id, nome, subcategorias: [{ id, nome, categoria_id }] }
 * ]
 */
async function carregarCategorias() {
    try {
        const res  = await fetch(`${API}/categorias`);
        const data = await res.json();

        if (!res.ok) throw new Error(data.erro || 'Erro ao carregar categorias');

        renderMenuCategorias(data);

    } catch (err) {
        console.error('Erro ao carregar categorias:', err);
    }
}

function renderMenuCategorias(categorias) {
    const menu = document.getElementById('menu-categorias');
    if (!menu) return;

    menu.innerHTML = '';

    // Opção "Todos"
    const todos = document.createElement('li');
    todos.textContent = 'Todos';
    todos.onclick = () => filtrar('todos');
    menu.appendChild(todos);

    categorias.forEach(cat => {
        const nomeCat = cat.nome.toLowerCase();

        if (cat.subcategorias && cat.subcategorias.length > 0) {
            // Categoria com subcategorias → renderiza como grupo expansível
            const grupo = document.createElement('li');
            grupo.className = 'categoria-grupo';

            const titulo = document.createElement('span');
            titulo.textContent = cat.nome;
            titulo.className = 'categoria-titulo';
            titulo.onclick = () => filtrar(nomeCat);
            grupo.appendChild(titulo);

            const subLista = document.createElement('ul');
            subLista.className = 'subcategorias';

            cat.subcategorias.forEach(sub => {
                const subItem = document.createElement('li');
                subItem.textContent = sub.nome;
                subItem.onclick = () => filtrar(sub.nome.toLowerCase());
                subLista.appendChild(subItem);
            });

            grupo.appendChild(subLista);
            menu.appendChild(grupo);

        } else {
            // Categoria simples, sem subcategorias
            const item = document.createElement('li');
            item.textContent = cat.nome;
            item.onclick = () => filtrar(nomeCat);
            menu.appendChild(item);
        }
    });
}

/* ───────────────────────────────────────────── */
/* FILTROS                                       */
/* ───────────────────────────────────────────── */

function aplicarFiltros() {
    if (produtos.length === 0) { renderProdutosLista([]); return; }

    const globalMarcas   = marcasSelecionadas('global');
    const globalPrecoMin = precoValor('.preco-min[data-cat="global"]');
    const globalPrecoMax = precoValor('.preco-max[data-cat="global"]');
    const globalStock    = stockActivo('global');

    const cats = ['celulares','laptop','monitor','fone','teclado','mouse','gpu','relogio','ram','cooler','cpu','placamae'];

    const lista = produtos.filter(p => {
        if (globalMarcas.length   && !globalMarcas.includes(p.marca)) return false;
        if (globalPrecoMin !== null && p.preco < globalPrecoMin)       return false;
        if (globalPrecoMax !== null && p.preco > globalPrecoMax)       return false;
        if (globalStock && !p.emStock)                                 return false;

        for (const cat of cats) {
            const marcas   = marcasSelecionadas(cat);
            const precoMin = precoValor(`.preco-min[data-cat="${cat}"]`);
            const precoMax = precoValor(`.preco-max[data-cat="${cat}"]`);
            const stock    = stockActivo(cat);
            const temFiltro = marcas.length || precoMin !== null || precoMax !== null || stock;

            if (!temFiltro) continue;
            if (p.categoria !== cat && p.subcategoria !== cat) continue;
            if (marcas.length   && !marcas.includes(p.marca)) return false;
            if (precoMin !== null && p.preco < precoMin)       return false;
            if (precoMax !== null && p.preco > precoMax)       return false;
            if (stock && !p.emStock)                           return false;
        }
        return true;
    });

    renderProdutosLista(lista);
}

function marcasSelecionadas(cat) {
    return [...document.querySelectorAll(`.filtro-marca[data-cat="${cat}"]:checked`)].map(el => el.value);
}

function precoValor(selector) {
    const el = document.querySelector(selector);
    if (!el || el.value === '') return null;
    const v = parseFloat(el.value);
    return isNaN(v) ? null : v;
}

function stockActivo(cat) {
    const el = document.querySelector(`.filtro-stock[data-cat="${cat}"]`);
    return el ? el.checked : false;
}

function filtrar(cat) {
    const mapa = {
        todos: null, laptops: 'grupo-computadores', laptop: 'grupo-computadores',
        celulares: 'grupo-celulares', acessorios: 'grupo-acessorios',
        monitor: 'grupo-computadores', gpu: 'grupo-acessorios', cpu: 'grupo-acessorios',
    };
    const grupoId = mapa[cat] ?? null;
    if (grupoId) { const el = document.getElementById(grupoId); if (el) el.open = true; }
    aplicarFiltros();
}

function limparFiltros() {
    document.querySelectorAll('.filtro-marca, .filtro-stock').forEach(el => el.checked = false);
    document.querySelectorAll('.preco-min, .preco-max').forEach(el => el.value = '');
    aplicarFiltros();
}

/* ───────────────────────────────────────────── */
/* BUSCA                                         */
/* ───────────────────────────────────────────── */

function buscarProdutos(e) {
    if (e.key === 'Enter') buscarProdutosPorTexto();
}

function buscarProdutosPorTexto() {
    const termo = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
    if (!termo) { renderProdutos(); return; }

    const lista = produtos.filter(p =>
        p.nome.toLowerCase().includes(termo) ||
        (p.desc  && p.desc.toLowerCase().includes(termo)) ||
        (p.marca && p.marca.toLowerCase().includes(termo))
    );

    ir('produtos');
    renderProdutosLista(lista);
}

/* ───────────────────────────────────────────── */
/* CONTACTO                                      */
/* ───────────────────────────────────────────── */

function enviarForm(e) {
    e.preventDefault();
    alert('Mensagem enviada! ✅');
    e.target.reset();
}