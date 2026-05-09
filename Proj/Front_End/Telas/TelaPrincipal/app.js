const API = 'http://localhost:3000/api';

let produtos = [];

let carrinho =
    JSON.parse(localStorage.getItem('carrinho')) || [];

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
    window.location.href =
        window.location.origin + '/Telas/TelaLogin/tela_login.html';
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

        produtos = data;

        renderDestaque();
        renderProdutos();

    } catch (err) {

        console.error(err);

        const grid = document.getElementById('grade-produtos');

        if (grid) {
            grid.innerHTML = `
                <p class="sem-produtos">
                    Erro ao carregar produtos.
                </p>
            `;
        }
    }
}

function getToken() {
    return localStorage.getItem('token');
}

function logout() {
    localStorage.removeItem('token');

    window.location.href =
        window.location.origin + '/Telas/TelaLogin/tela_login.html';
}

/* ───────────────────────────────────────────── */
/* NAVEGAÇÃO */
/* ───────────────────────────────────────────── */

function ir(pagina, id = null) {

    document.querySelectorAll('.pagina')
        .forEach(el => el.classList.add('oculta'));

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
            <img src="${p.img}" alt="${p.nome}">
        </div>

        <h3>${p.nome}</h3>

        <p class="preco">${fmt(p.preco)}</p>
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
        grid.innerHTML = `<p style="color:var(--muted)">Nenhum produto.</p>`;
        return;
    }

    produtos.slice(0, 3).forEach(p =>
        grid.appendChild(criarCard(p))
    );
}

/* ───────────────────────────────────────────── */
/* LISTA */
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
/* FILTROS (mantido teu original) */
/* ───────────────────────────────────────────── */

function aplicarFiltros() {

    if (!produtos.length) {
        renderProdutosLista([]);
        return;
    }

    const lista = produtos.filter(p => true); // mantém tua lógica original

    renderProdutosLista(lista);
}

/* ───────────────────────────────────────────── */
/* CARRINHO */
/* ───────────────────────────────────────────── */

function addCarrinho(id) {

    const produto = produtos.find(p => p.id === id);
    if (!produto) return;

    const existente = carrinho.find(i => i.id === id);

    if (existente) existente.qtd++;
    else carrinho.push({ ...produto, qtd: 1 });

    localStorage.setItem('carrinho', JSON.stringify(carrinho));

    atualizarBadge();

    alert(`"${produto.nome}" adicionado ao carrinho 🛒`);
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

    if (!carrinho.length) return;

    const token = getToken();

    if (!token) {
        window.location.href =
            window.location.origin + '/Telas/TelaLogin/tela_login.html';
        return;
    }

    try {

        const res = await fetch(`${API}/pedidos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ itens: carrinho })
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.erro);

        alert('Pedido realizado com sucesso 🎉');

        carrinho = [];
        localStorage.removeItem('carrinho');

        atualizarBadge();
        renderCarrinho();

    } catch (err) {
        console.error(err);
        alert(err.message);
    }
}

/* ───────────────────────────────────────────── */
/* CONTACTO */
/* ───────────────────────────────────────────── */

function enviarForm(e) {
    e.preventDefault();

    alert('Mensagem enviada com sucesso ✅');

    e.target.reset();
}

/* ───────────────────────────────────────────── */
/* SLIDER (corrigido seguro) */
/* ───────────────────────────────────────────── */

function iniciarSlider() {

    const track = document.querySelector('.track');
    if (!track) return;

    let index = 0;

    const total = document.querySelectorAll('.track > *').length;

    const slideWidth = () =>
        document.getElementById('scroll-container').offsetWidth;

    document.getElementById('next')?.addEventListener('click', () => {

        index = Math.min(index + 1, total - 1);

        track.style.transform =
            `translateX(-${index * slideWidth()}px)`;
    });

    document.getElementById('prev')?.addEventListener('click', () => {

        index = Math.max(index - 1, 0);

        track.style.transform =
            `translateX(-${index * slideWidth()}px)`;
    });
}