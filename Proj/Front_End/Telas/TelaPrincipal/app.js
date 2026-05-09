const API = 'http://localhost:3000/api';

let produtos = [];
let carrinhoAtual = { itens: [], total: 0 };
let utilizadorLogado = null;

document.addEventListener('DOMContentLoaded', async () => {
    const ano = document.getElementById('ano');
    if (ano) ano.textContent = new Date().getFullYear();

    const anoFooter = document.getElementById('anoFooter');
    if (anoFooter) anoFooter.textContent = new Date().getFullYear();

    // Verificar se utilizador está logado
    const token = localStorage.getItem('token');
    if (token) {
        utilizadorLogado = JSON.parse(localStorage.getItem('utilizador') || '{}');
        atualizarUserDisplay();
    } else {
        // Mostrar botão de login no header
        mostrarBotaoLogin();
    }

    await carregarProdutos();
    await carregarCarrinho(); // Carrinho anónimo funciona sem login
    atualizarBadge();
    iniciarSlider();
    renderDestaque();
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') carregarProdutos();
        });
    }
});

function mostrarBotaoLogin() {
    const userContainer = document.querySelector('.user-menu-container');
    if (userContainer) {
        userContainer.innerHTML = `
            <a href="../TelaLogin/tela_login.html" class="btn-login-header">
                <img src="../../imagens/icon/person-circle.svg" alt="Login" />
                <span>Entrar</span>
            </a>
        `;
    }
}

function getToken() {
    return localStorage.getItem('token');
}

function getAuthHeaders() {
    const token = getToken();
    if (!token) return { 'Content-Type': 'application/json' };
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

function logout() {
    if (confirm('Tem certeza que deseja sair?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('utilizador');
        window.location.href = '../TelaLogin/tela_login.html';
    }
}

function getMarcasSelecionadas() {
    const marcas = [];
    document.querySelectorAll('.filtro-marca:checked').forEach(cb => {
        marcas.push(cb.value);
    });
    return marcas;
}

function getCategoriaSelecionada() {
    const grupos = document.querySelectorAll('.filtro-grupo');
    for (let grupo of grupos) {
        const titulo = grupo.querySelector('.filtro-grupo-titulo');
        if (titulo && grupo.hasAttribute('open')) {
            const texto = titulo.innerText;
            if (texto === 'Celulares') return 'celulares';
            if (texto === 'Computadores') return 'computadores';
            if (texto === 'Acessórios') return 'acessorios';
        }
    }
    return '';
}

function getPrecoMin() {
    let min = 0;
    
    const globalMin = document.getElementById('preco-min-global');
    if (globalMin && globalMin.value) {
        min = parseInt(globalMin.value);
    }
    
    const allMinInputs = document.querySelectorAll('.preco-min');
    for (let input of allMinInputs) {
        if (input.value && parseInt(input.value) > 0) {
            const val = parseInt(input.value);
            if (min === 0 || val < min) min = val;
        }
    }
    
    return min;
}

function getPrecoMax() {
    let max = 0;
    
    const globalMax = document.getElementById('preco-max-global');
    if (globalMax && globalMax.value) {
        max = parseInt(globalMax.value);
    }
    
    const allMaxInputs = document.querySelectorAll('.preco-max');
    for (let input of allMaxInputs) {
        if (input.value && parseInt(input.value) > 0) {
            const val = parseInt(input.value);
            if (val > max) max = val;
        }
    }
    
    return max;
}

function getApenasStock() {
    const stockChecks = document.querySelectorAll('.filtro-stock:checked');
    return stockChecks.length > 0;
}

async function carregarProdutos() {
    try {
        const search = document.getElementById('searchInput')?.value || '';
        const categoria = getCategoriaSelecionada();
        const precoMin = getPrecoMin();
        const precoMax = getPrecoMax();
        const apenasStock = getApenasStock();
        const marcasSelecionadas = getMarcasSelecionadas();

        let url = `${API}/produtos?`;
        const params = [];

        if (search) params.push(`q=${encodeURIComponent(search)}`);
        if (categoria) params.push(`categoria=${encodeURIComponent(categoria)}`);
        if (precoMin > 0) params.push(`min=${precoMin}`);
        if (precoMax > 0) params.push(`max=${precoMax}`);
        if (apenasStock) params.push(`stock=1`);
        
        marcasSelecionadas.forEach(marca => {
            params.push(`marca=${encodeURIComponent(marca)}`);
        });

        url += params.join('&');

        const res = await fetch(url);
        const data = await res.json();

        if (!res.ok) throw new Error(data.erro || 'Erro ao carregar produtos');

        produtos = data.map(p => ({
            id: p.id,
            nome: p.nome,
            preco: p.preco,
            descricao: p.descricao,
            imagem: p.imagem || 'https://via.placeholder.com/300x200?text=Sem+Imagem',
            stock: p.stock,
            marca: p.marca,
            categoria_nome: p.categoria_nome,
            subcategoria_nome: p.subcategoria_nome,
            em_destaque: p.em_destaque
        }));

        renderizarProdutos();
        atualizarContador();

    } catch (err) {
        console.error('Erro:', err);
        const grid = document.getElementById('grade-produtos');
        if (grid) {
            grid.innerHTML = `<p class="sem-produtos">Erro ao carregar produtos: ${err.message}</p>`;
        }
    }
}

function aplicarFiltros() {
    carregarProdutos();
}

function limparFiltros() {
    document.querySelectorAll('.filtro-marca:checked, .filtro-stock:checked').forEach(cb => {
        cb.checked = false;
    });
    document.querySelectorAll('.preco-min, .preco-max').forEach(input => {
        input.value = '';
    });
    carregarProdutos();
}

function buscarProdutosPorTexto() {
    carregarProdutos();
}

function buscarProdutos(event) {
    if (event.key === 'Enter') {
        carregarProdutos();
    }
}

function renderizarProdutos() {
    const grid = document.getElementById('grade-produtos');
    if (!grid) return;

    if (!produtos.length) {
        grid.innerHTML = `<p class="sem-produtos">Nenhum produto encontrado.</p>`;
        return;
    }

    grid.innerHTML = '';
    produtos.forEach(p => grid.appendChild(criarCard(p)));
}

function atualizarContador() {
    const counter = document.getElementById('contador-resultados');
    if (counter) {
        counter.textContent = `${produtos.length} produto(s)`;
    }
}

function criarCard(p) {
    const card = document.createElement('div');
    card.className = 'produto';
    card.onclick = () => ir('detalhe', p.id);

    card.innerHTML = `
        <div class="produto-img">
            <img src="${p.imagem}" alt="${p.nome}" onerror="this.src='https://via.placeholder.com/300x200?text=Sem+Imagem'">
        </div>
        <h3>${p.nome}</h3>
        <p class="preco">${fmt(p.preco)}</p>
        ${p.stock > 0 ? 
            `<button class="btn-carrinho" onclick="event.stopPropagation(); addCarrinho(${p.id})">Comprar</button>` : 
            '<p class="sem-stock">Sem stock</p>'
        }
    `;

    return card;
}

async function renderDestaque() {
    try {
        const res = await fetch(`${API}/produtos?destaque=1`);
        const destaques = await res.json();

        const grid = document.getElementById('grid-destaque');
        if (!grid) return;

        grid.innerHTML = '';
        
        if (!destaques.length) {
            grid.innerHTML = `<p style="color:var(--muted)">Nenhum produto em destaque.</p>`;
            return;
        }

        destaques.slice(0, 3).forEach(p => {
            const card = criarCard({
                ...p,
                imagem: p.imagem || 'https://via.placeholder.com/300x200?text=Sem+Imagem'
            });
            grid.appendChild(card);
        });
    } catch (err) {
        console.error('Erro ao carregar destaques:', err);
    }
}

// ==================== CARRINHO (Funciona sem login) ====================
async function carregarCarrinho() {
    // Carrinho local para utilizadores não logados
    const carrinhoLocal = localStorage.getItem('carrinho_local');
    if (carrinhoLocal && !getToken()) {
        carrinhoAtual = JSON.parse(carrinhoLocal);
        renderCarrinho();
        atualizarBadge();
        return;
    }

    // Se estiver logado, buscar do backend
    if (getToken()) {
        try {
            const res = await fetch(`${API}/carrinho`, {
                headers: getAuthHeaders()
            });

            if (res.ok) {
                carrinhoAtual = await res.json();
            }
        } catch (err) {
            console.error('Erro ao carregar carrinho:', err);
        }
    }
    
    renderCarrinho();
    atualizarBadge();
}

async function addCarrinho(produtoId) {
    const produto = produtos.find(p => p.id === produtoId);
    if (!produto) return;

    // Se não estiver logado, guardar no localStorage
    if (!getToken()) {
        const carrinhoLocal = JSON.parse(localStorage.getItem('carrinho_local') || '{"itens":[], "total":0}');
        const itemExistente = carrinhoLocal.itens.find(i => i.produto_id === produtoId);
        
        if (itemExistente) {
            itemExistente.quantidade++;
        } else {
            carrinhoLocal.itens.push({
                produto_id: produto.id,
                nome: produto.nome,
                preco: produto.preco,
                imagem: produto.imagem,
                quantidade: 1
            });
        }
        
        carrinhoLocal.total = carrinhoLocal.itens.reduce((s, i) => s + (i.preco * i.quantidade), 0);
        localStorage.setItem('carrinho_local', JSON.stringify(carrinhoLocal));
        carrinhoAtual = carrinhoLocal;
        
        renderCarrinho();
        atualizarBadge();
        alert('Produto adicionado ao carrinho!');
        return;
    }

    // Se estiver logado, usar API
    try {
        const res = await fetch(`${API}/carrinho/adicionar`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                produto_id: produtoId,
                quantidade: 1
            })
        });

        if (!res.ok) {
            const erro = await res.json();
            throw new Error(erro.erro || 'Erro ao adicionar');
        }

        await carregarCarrinho();
        alert('Produto adicionado ao carrinho');

    } catch (err) {
        console.error('Erro:', err);
        alert(err.message);
    }
}

async function atualizarQuantidade(produtoId, quantidade) {
    if (quantidade < 0) return;

    // Se não estiver logado, atualizar localStorage
    if (!getToken()) {
        const carrinhoLocal = JSON.parse(localStorage.getItem('carrinho_local') || '{"itens":[]}');
        const item = carrinhoLocal.itens.find(i => i.produto_id === produtoId);
        
        if (item) {
            if (quantidade === 0) {
                carrinhoLocal.itens = carrinhoLocal.itens.filter(i => i.produto_id !== produtoId);
            } else {
                item.quantidade = quantidade;
            }
        }
        
        carrinhoLocal.total = carrinhoLocal.itens.reduce((s, i) => s + (i.preco * i.quantidade), 0);
        localStorage.setItem('carrinho_local', JSON.stringify(carrinhoLocal));
        carrinhoAtual = carrinhoLocal;
        
        renderCarrinho();
        atualizarBadge();
        return;
    }

    // Se estiver logado, usar API
    try {
        const res = await fetch(`${API}/carrinho/atualizar`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                produto_id: produtoId,
                quantidade: quantidade
            })
        });

        if (!res.ok) throw new Error('Erro ao atualizar');

        await carregarCarrinho();

    } catch (err) {
        console.error('Erro:', err);
        alert(err.message);
    }
}

async function removerItemCarrinho(produtoId) {
    await atualizarQuantidade(produtoId, 0);
}

async function limparCarrinho() {
    if (!confirm('Limpar todo o carrinho?')) return;

    if (!getToken()) {
        localStorage.removeItem('carrinho_local');
        carrinhoAtual = { itens: [], total: 0 };
        renderCarrinho();
        atualizarBadge();
        return;
    }

    try {
        const res = await fetch(`${API}/carrinho/limpar`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (!res.ok) throw new Error('Erro ao limpar');

        await carregarCarrinho();

    } catch (err) {
        console.error('Erro:', err);
        alert(err.message);
    }
}

function renderCarrinho() {
    const container = document.getElementById('itens-carrinho');
    const subtotalSpan = document.getElementById('subtotal');
    const totalSpan = document.getElementById('total');
    
    if (!container) return;

    if (!carrinhoAtual.itens || carrinhoAtual.itens.length === 0) {
        container.innerHTML = `<p class="carrinho-vazio">Seu carrinho está vazio.</p>`;
        if (subtotalSpan) subtotalSpan.textContent = fmt(0);
        if (totalSpan) totalSpan.textContent = fmt(0);
        return;
    }

    let itemsHtml = '';
    let total = 0;

    carrinhoAtual.itens.forEach(item => {
        const subtotal = item.preco * item.quantidade;
        total += subtotal;
        const produtoId = item.produto_id || item.id;

        itemsHtml += `
            <div class="carrinho-item">
                <div class="carrinho-item-img">
                    <img src="${item.imagem || 'https://via.placeholder.com/80x80?text=Sem+Imagem'}" alt="${item.nome}">
                </div>
                <div class="carrinho-item-info">
                    <h4>${item.nome}</h4>
                    <p>${fmt(item.preco)}</p>
                </div>
                <div class="carrinho-item-qtd">
                    <button onclick="atualizarQuantidade(${produtoId}, ${item.quantidade - 1})">-</button>
                    <span>${item.quantidade}</span>
                    <button onclick="atualizarQuantidade(${produtoId}, ${item.quantidade + 1})">+</button>
                </div>
                <div class="carrinho-item-subtotal">
                    ${fmt(subtotal)}
                </div>
                <button class="carrinho-item-remove" onclick="removerItemCarrinho(${produtoId})">Remover</button>
            </div>
        `;
    });

    container.innerHTML = itemsHtml;

    if (subtotalSpan) subtotalSpan.textContent = fmt(total);
    if (totalSpan) totalSpan.textContent = fmt(total);
}

function atualizarBadge() {
    const badge = document.getElementById('badge');
    if (!badge) return;

    const total = carrinhoAtual.itens?.reduce((s, i) => s + i.quantidade, 0) || 0;
    badge.textContent = total;
    if (total === 0) {
        badge.classList.add('oculto');
    } else {
        badge.classList.remove('oculto');
    }
}

// ==================== FINALIZAR COMPRA (Exige Login) ====================
async function finalizar() {
    // Verificar se está logado
    if (!getToken()) {
        const confirmar = confirm('Para finalizar a compra, precisa fazer login. Deseja ir para a página de login?');
        if (confirmar) {
            // Guardar carrinho atual antes de redirecionar
            if (!getToken()) {
                localStorage.setItem('carrinho_local', JSON.stringify(carrinhoAtual));
            }
            window.location.href = '../TelaLogin/tela_login.html';
        }
        return;
    }

    // Se estiver logado, verificar carrinho
    if (!carrinhoAtual.itens || carrinhoAtual.itens.length === 0) {
        alert('Carrinho vazio');
        return;
    }

    // Verificar se há carrinho local para sincronizar
    const carrinhoLocal = localStorage.getItem('carrinho_local');
    if (carrinhoLocal) {
        await sincronizarCarrinhoLocal();
    }

    try {
        const res = await fetch(`${API}/pedidos/checkout`, {
            method: 'POST',
            headers: getAuthHeaders()
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.erro || 'Erro ao finalizar');

        alert(`Pedido ${data.pedido_id} realizado! Total: ${fmt(data.total)}`);
        
        // Limpar carrinho local após compra
        localStorage.removeItem('carrinho_local');
        await carregarCarrinho();
        ir('produtos');

    } catch (err) {
        console.error('Erro:', err);
        alert(err.message);
    }
}

async function sincronizarCarrinhoLocal() {
    const carrinhoLocal = JSON.parse(localStorage.getItem('carrinho_local') || '{"itens":[]}');
    
    for (const item of carrinhoLocal.itens) {
        try {
            await fetch(`${API}/carrinho/adicionar`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    produto_id: item.produto_id,
                    quantidade: item.quantidade
                })
            });
        } catch (err) {
            console.error('Erro ao sincronizar:', err);
        }
    }
    
    localStorage.removeItem('carrinho_local');
    await carregarCarrinho();
}

function ir(pagina, id = null) {
    document.querySelectorAll('.pagina').forEach(el => el.classList.add('oculta'));

    let viewId = '';
    if (pagina === 'home') viewId = 'view-home';
    else if (pagina === 'produtos') viewId = 'view-produtos';
    else if (pagina === 'detalhe') viewId = 'view-detalhe';
    else if (pagina === 'carrinho') viewId = 'view-carrinho';
    else if (pagina === 'sobre') viewId = 'view-sobre';
    else if (pagina === 'contato') viewId = 'view-contato';

    const view = document.getElementById(viewId);
    if (view) view.classList.remove('oculta');

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (pagina === 'detalhe' && id) renderDetalhe(id);
    if (pagina === 'carrinho') renderCarrinho();
}

function filtrar(categoria) {
    document.querySelectorAll('.pagina').forEach(el => el.classList.add('oculta'));
    const view = document.getElementById('view-produtos');
    if (view) view.classList.remove('oculta');
    
    setTimeout(() => {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = categoria;
        carregarProdutos();
    }, 100);
}

async function renderDetalhe(id) {
    try {
        const res = await fetch(`${API}/produtos/${id}`);
        const p = await res.json();

        if (!res.ok) throw new Error('Produto nao encontrado');

        const container = document.getElementById('detalhe-conteudo');
        if (!container) return;

        container.innerHTML = `
            <div class="detalhe-grid">
                <div class="detalhe-imagem">
                    <img src="${p.imagem || 'https://via.placeholder.com/500x400?text=Sem+Imagem'}" alt="${p.nome}">
                </div>
                <div class="detalhe-info">
                    <h1>${p.nome}</h1>
                    <p class="detalhe-preco">${fmt(p.preco)}</p>
                    ${p.marca ? `<p><strong>Marca:</strong> ${p.marca}</p>` : ''}
                    ${p.categoria_nome ? `<p><strong>Categoria:</strong> ${p.categoria_nome}</p>` : ''}
                    <p><strong>Stock:</strong> ${p.stock > 0 ? p.stock + ' unidades' : 'Esgotado'}</p>
                    <p class="detalhe-descricao">${p.descricao || 'Sem descricao'}</p>
                    ${p.stock > 0 ? 
                        `<button class="btn-carrinho-grande" onclick="addCarrinho(${p.id})">Adicionar ao Carrinho</button>` : 
                        '<button class="btn-carrinho-grande disabled" disabled>Indisponivel</button>'
                    }
                </div>
            </div>
        `;
    } catch (err) {
        console.error('Erro:', err);
    }
}

function fmt(valor) {
    return new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'MZN'
    }).format(valor);
}

function enviarForm(e) {
    if (e) e.preventDefault();
    alert('Mensagem enviada com sucesso');
    if (e && e.target) e.target.reset();
}

function iniciarSlider() {
    const track = document.querySelector('.track');
    const container = document.getElementById('scroll-container');
    
    if (!track || !container) return;

    let index = 0;
    const slides = document.querySelectorAll('.track > *');
    const total = slides.length;

    if (total === 0) return;

    const slideWidth = () => container.offsetWidth;

    const nextBtn = document.getElementById('next');
    const prevBtn = document.getElementById('prev');

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            index = Math.min(index + 1, total - 1);
            track.style.transform = `translateX(-${index * slideWidth()}px)`;
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            index = Math.max(index - 1, 0);
            track.style.transform = `translateX(-${index * slideWidth()}px)`;
        });
    }

    window.addEventListener('resize', () => {
        track.style.transform = `translateX(-${index * slideWidth()}px)`;
    });
}

function toggleMenu() {
    const menu = document.getElementById('menu');
    if (menu) {
        menu.classList.toggle('aberto');
    }
}

// ===================== USER MENU =====================
function toggleUserMenu() {
    const menu = document.getElementById('userMenu');
    if (menu) {
        menu.classList.toggle('show');
    }
}

document.addEventListener('click', function(e) {
    const container = document.querySelector('.user-menu-container');
    const menu = document.getElementById('userMenu');
    if (container && menu && !container.contains(e.target)) {
        menu.classList.remove('show');
    }
});

function atualizarUserDisplay() {
    const utilizador = JSON.parse(localStorage.getItem('utilizador') || '{}');
    const userNameSpan = document.getElementById('userNameDisplay');
    
    if (utilizador.username && userNameSpan) {
        userNameSpan.textContent = utilizador.username.length > 15 
            ? utilizador.username.substring(0, 12) + '...' 
            : utilizador.username;
    }
}