const API = 'http://localhost:3000/api';

let produtos = [];
let carrinho = JSON.parse(localStorage.getItem('carrinho')) || [];

/* ───────────────────────────────────────────── */
/* INIT */
/* ───────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', async () => {
    const ano = document.getElementById('ano');
    if (ano) ano.textContent = new Date().getFullYear();

    const anoFooter = document.getElementById('anoFooter');
    if (anoFooter) anoFooter.textContent = new Date().getFullYear();

    await carregarProdutos();
    atualizarBadge();
    iniciarSlider();
});

/* ───────────────────────────────────────────── */
/* AUTH GUARD */
/* ───────────────────────────────────────────── */

const token = localStorage.getItem('token');

if (!token) {
    window.location.href = window.location.origin + '/Telas/TelaLogin/tela_login.html';
}

/* ───────────────────────────────────────────── */
/* API */
/* ───────────────────────────────────────────── */

async function carregarProdutos() {
    try {
        const res = await fetch(`${API}/produtos`);
        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.erro || 'Erro ao carregar produtos');
        }

        // Mapear os campos do backend para o formato esperado
        produtos = data.map(p => ({
            id: p.id,
            nome: p.nome,
            preco: p.preco,
            descricao: p.descricao,
            img: p.imagem || 'https://via.placeholder.com/300x200?text=Sem+Imagem',
            stock: p.stock,
            marca: p.marca,
            categoria_nome: p.categoria_nome,
            subcategoria_nome: p.subcategoria_nome,
            em_destaque: p.em_destaque
        }));

        renderDestaque();
        renderProdutos();

    } catch (err) {
        console.error(err);
        const grid = document.getElementById('grade-produtos');
        if (grid) {
            grid.innerHTML = `<p class="sem-produtos">Erro ao carregar produtos: ${err.message}</p>`;
        }
    }
}

function getToken() {
    return localStorage.getItem('token');
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('carrinho');
    window.location.href = window.location.origin + '/Telas/TelaLogin/tela_login.html';
}

/* ───────────────────────────────────────────── */
/* NAVEGAÇÃO */
/* ───────────────────────────────────────────── */

function ir(pagina, id = null) {
    document.querySelectorAll('.pagina').forEach(el => el.classList.add('oculta'));

    const view = document.getElementById(`view-${pagina}`);
    if (view) view.classList.remove('oculta');

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (pagina === 'detalhe' && id) renderDetalhe(id);
    if (pagina === 'carrinho') renderCarrinho();
}

/* ───────────────────────────────────────────── */
/* FORMATAÇÃO MOEDA */
/* ───────────────────────────────────────────── */

function fmt(valor) {
    return new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'MZN'
    }).format(valor);
}

/* ───────────────────────────────────────────── */
/* CARDS */
/* ───────────────────────────────────────────── */

function criarCard(p) {
    const card = document.createElement('div');
    card.className = 'produto';
    card.onclick = () => ir('detalhe', p.id);

    card.innerHTML = `
        <div class="produto-img">
            <img src="${p.img}" alt="${p.nome}" onerror="this.src='https://via.placeholder.com/300x200?text=Sem+Imagem'">
        </div>
        <h3>${p.nome}</h3>
        <p class="preco">${fmt(p.preco)}</p>
        ${p.stock > 0 ? `<button class="btn-carrinho" onclick="event.stopPropagation(); addCarrinho(${p.id})">🛒 Comprar</button>` : '<p class="sem-stock">Sem stock</p>'}
    `;

    return card;
}

/* ───────────────────────────────────────────── */
/* DESTAQUE */
/* ───────────────────────────────────────────── */

function renderDestaque() {
    const grid = document.getElementById('grid-destaque');
    if (!grid) return;

    grid.innerHTML = '';

    if (!produtos.length) {
        grid.innerHTML = `<p style="color:var(--muted)">Nenhum produto em destaque.</p>`;
        return;
    }

    // Filtrar produtos em destaque ou pegar os 3 primeiros
    const destaques = produtos.filter(p => p.em_destaque === 1).slice(0, 3);
    const produtosParaMostrar = destaques.length ? destaques : produtos.slice(0, 3);

    produtosParaMostrar.forEach(p => grid.appendChild(criarCard(p)));
}

/* ───────────────────────────────────────────── */
/* LISTA COM FILTROS */
/* ───────────────────────────────────────────── */

function renderProdutosLista(lista) {
    const grid = document.getElementById('grade-produtos');
    const counter = document.getElementById('contador-resultados');

    if (!grid) return;

    grid.innerHTML = '';

    if (!lista.length) {
        grid.innerHTML = `<p class="sem-produtos">Nenhum produto encontrado.</p>`;
        if (counter) counter.textContent = '';
        return;
    }

    lista.forEach(p => grid.appendChild(criarCard(p)));

    if (counter) {
        counter.textContent = `${lista.length} produto(s)`;
    }
}

function renderProdutos() {
    aplicarFiltros();
}

/* ───────────────────────────────────────────── */
/* FILTROS CORRIGIDOS */
/* ───────────────────────────────────────────── */

function aplicarFiltros() {
    if (!produtos.length) {
        renderProdutosLista([]);
        return;
    }

    // Pegar valores dos filtros
    const searchTerm = document.getElementById('search')?.value.toLowerCase() || '';
    const categoria = document.getElementById('categoria')?.value || '';
    const precoMax = parseInt(document.getElementById('preco-max')?.value) || Infinity;

    let lista = [...produtos];

    // Filtro por busca (nome ou descrição)
    if (searchTerm) {
        lista = lista.filter(p => 
            p.nome.toLowerCase().includes(searchTerm) || 
            (p.descricao && p.descricao.toLowerCase().includes(searchTerm))
        );
    }

    // Filtro por categoria
    if (categoria) {
        lista = lista.filter(p => 
            p.categoria_nome && p.categoria_nome.toLowerCase() === categoria.toLowerCase()
        );
    }

    // Filtro por preço máximo
    if (precoMax !== Infinity) {
        lista = lista.filter(p => p.preco <= precoMax);
    }

    renderProdutosLista(lista);
}

// Event listeners para filtros
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search');
    const categoriaSelect = document.getElementById('categoria');
    const precoInput = document.getElementById('preco-max');

    if (searchInput) searchInput.addEventListener('input', () => aplicarFiltros());
    if (categoriaSelect) categoriaSelect.addEventListener('change', () => aplicarFiltros());
    if (precoInput) precoInput.addEventListener('input', () => aplicarFiltros());
});

/* ───────────────────────────────────────────── */
/* DETALHE DO PRODUTO */
/* ───────────────────────────────────────────── */

function renderDetalhe(id) {
    const produto = produtos.find(p => p.id === id);
    if (!produto) return;

    const container = document.getElementById('detalhe-container');
    if (!container) return;

    container.innerHTML = `
        <div class="detalhe-grid">
            <div class="detalhe-imagem">
                <img src="${produto.img}" alt="${produto.nome}" onerror="this.src='https://via.placeholder.com/500x400?text=Sem+Imagem'">
            </div>
            <div class="detalhe-info">
                <h1>${produto.nome}</h1>
                <p class="detalhe-preco">${fmt(produto.preco)}</p>
                ${produto.marca ? `<p><strong>Marca:</strong> ${produto.marca}</p>` : ''}
                ${produto.categoria_nome ? `<p><strong>Categoria:</strong> ${produto.categoria_nome}</p>` : ''}
                <p><strong>Stock:</strong> ${produto.stock > 0 ? `${produto.stock} unidades` : 'Esgotado'}</p>
                <p class="detalhe-descricao">${produto.descricao || 'Sem descrição'}</p>
                ${produto.stock > 0 ? 
                    `<button class="btn-carrinho-grande" onclick="addCarrinho(${produto.id})">🛒 Adicionar ao Carrinho</button>` : 
                    '<button class="btn-carrinho-grande disabled" disabled>Indisponível</button>'
                }
            </div>
        </div>
    `;
}

/* ───────────────────────────────────────────── */
/* CARRINHO */
/* ───────────────────────────────────────────── */

function addCarrinho(id) {
    const produto = produtos.find(p => p.id === id);
    if (!produto) return;

    const existente = carrinho.find(i => i.id === id);

    if (existente) {
        existente.qtd++;
    } else {
        carrinho.push({ ...produto, qtd: 1 });
    }

    localStorage.setItem('carrinho', JSON.stringify(carrinho));
    atualizarBadge();
    renderCarrinho();
    alert(`"${produto.nome}" adicionado ao carrinho 🛒`);
}

function removerItemCarrinho(id) {
    carrinho = carrinho.filter(i => i.id !== id);
    localStorage.setItem('carrinho', JSON.stringify(carrinho));
    atualizarBadge();
    renderCarrinho();
}

function atualizarQuantidade(id, delta) {
    const item = carrinho.find(i => i.id === id);
    if (item) {
        item.qtd += delta;
        if (item.qtd <= 0) {
            removerItemCarrinho(id);
        } else {
            localStorage.setItem('carrinho', JSON.stringify(carrinho));
            renderCarrinho();
        }
    }
    atualizarBadge();
}

function renderCarrinho() {
    const container = document.getElementById('carrinho-container');
    const resumo = document.getElementById('carrinho-resumo');
    
    if (!container) return;

    if (!carrinho.length) {
        container.innerHTML = `<p class="carrinho-vazio">Seu carrinho está vazio.</p>`;
        if (resumo) resumo.innerHTML = '';
        return;
    }

    let total = 0;
    let itemsHtml = '';

    carrinho.forEach(item => {
        const subtotal = item.preco * item.qtd;
        total += subtotal;

        itemsHtml += `
            <div class="carrinho-item">
                <img src="${item.img}" alt="${item.nome}" onerror="this.src='https://via.placeholder.com/80x80?text=Sem+Imagem'">
                <div class="carrinho-item-info">
                    <h4>${item.nome}</h4>
                    <p>${fmt(item.preco)}</p>
                </div>
                <div class="carrinho-item-qtd">
                    <button onclick="atualizarQuantidade(${item.id}, -1)">-</button>
                    <span>${item.qtd}</span>
                    <button onclick="atualizarQuantidade(${item.id}, 1)">+</button>
                </div>
                <div class="carrinho-item-subtotal">
                    ${fmt(subtotal)}
                </div>
                <button class="carrinho-item-remove" onclick="removerItemCarrinho(${item.id})">🗑️</button>
            </div>
        `;
    });

    container.innerHTML = itemsHtml;

    if (resumo) {
        resumo.innerHTML = `
            <h3>Resumo</h3>
            <p>Total: <strong>${fmt(total)}</strong></p>
            <button class="btn-finalizar" onclick="finalizar()">Finalizar Pedido</button>
        `;
    }
}

function atualizarBadge() {
    const badge = document.getElementById('badge');
    if (!badge) return;

    const total = carrinho.reduce((s, i) => s + i.qtd, 0);
    badge.textContent = total;
    badge.classList.toggle('oculto', total === 0);
}

/* ───────────────────────────────────────────── */
/* CHECKOUT */
/* ───────────────────────────────────────────── */

async function finalizar() {
    if (!carrinho.length) {
        alert('Carrinho vazio!');
        return;
    }

    const token = getToken();

    if (!token) {
        window.location.href = window.location.origin + '/Telas/TelaLogin/tela_login.html';
        return;
    }

    try {
        const res = await fetch(`${API}/pedidos/checkout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ itens: carrinho })
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.erro || 'Erro ao finalizar pedido');

        alert('Pedido realizado com sucesso 🎉');

        carrinho = [];
        localStorage.removeItem('carrinho');
        atualizarBadge();
        renderCarrinho();
        ir('catalogo');

    } catch (err) {
        console.error(err);
        alert(err.message);
    }
}

/* ───────────────────────────────────────────── */
/* CONTACTO */
/* ───────────────────────────────────────────── */

function enviarForm(e) {
    if (e) e.preventDefault();
    alert('Mensagem enviada com sucesso ✅');
    if (e && e.target) e.target.reset();
}

/* ───────────────────────────────────────────── */
/* SLIDER */
/* ───────────────────────────────────────────── */

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

    // Ajustar no redimensionamento
    window.addEventListener('resize', () => {
        track.style.transform = `translateX(-${index * slideWidth()}px)`;
    });
}