
const API = 'http://localhost:3000/api';

let produtos = [];

let carrinho =
    JSON.parse(localStorage.getItem('carrinho')) || [];

/* ───────────────────────────────────────────── */
/* INIT */
/* ───────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', async () => {

    document.getElementById('ano') &&
    (
        document.getElementById('ano').textContent =
        new Date().getFullYear()
    );

    document.getElementById('anoFooter') &&
    (
        document.getElementById('anoFooter').textContent =
        new Date().getFullYear()
    );

    await carregarProdutos();

    atualizarBadge();
});

/* ───────────────────────────────────────────── */
/* API */
/* ───────────────────────────────────────────── */

async function carregarProdutos() {

    try {

        const res =
            await fetch(`${API}/produtos`);

        const data =
            await res.json();

        if (!res.ok) {

            throw new Error(
                data.erro ||
                'Erro ao carregar produtos'
            );
        }

        produtos = data;

        renderDestaque();

        renderProdutos();

    } catch (err) {

        console.error(err);

        const grid =
            document.getElementById('grade-produtos');

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
        'Telas/TelaLogin/tela_login.html';
}

/* ── Navegação ───────────────────────────────── */

function ir(pagina, id = null) {

    document
        .querySelectorAll('.pagina')
        .forEach(el =>
            el.classList.add('oculta')
        );

    document
        .getElementById(`view-${pagina}`)
        .classList.remove('oculta');

    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });

    if (pagina === 'detalhe' && id) {
        renderDetalhe(id);
    }

    if (pagina === 'carrinho') {
        renderCarrinho();
    }
}

function toggleMenu() {

    document
        .getElementById('menu')
        .classList.toggle('aberto');
}

function fmt(valor) {

    return valor.toLocaleString(
        'pt-BR',
        {
            style: 'currency',
            currency: 'BRL'
        }
    );
}

/* ── Cards ───────────────────────────────────── */

function criarCard(p) {

    const card =
        document.createElement('div');

    card.className = 'produto';

    card.onclick =
        () => ir('detalhe', p.id);

    card.innerHTML = `
        <div class="produto-img">
            <img src="${p.img}" alt="${p.nome}">
        </div>

        <h3>${p.nome}</h3>

        <p class="preco">
            ${fmt(p.preco)}
        </p>
    `;

    return card;
}

/* ── Destaque ────────────────────────────────── */

function renderDestaque() {

    const grid =
        document.getElementById('grid-destaque');

    if (!grid) return;

    grid.innerHTML = '';

    if (produtos.length === 0) {

        grid.innerHTML = `
            <p style="
                color:var(--muted);
                padding:40px 0 0 24px
            ">
                Nenhum produto em destaque.
            </p>
        `;

        return;
    }

    produtos
        .slice(0, 3)
        .forEach(p =>
            grid.appendChild(criarCard(p))
        );
}

/* ── Lista Produtos ──────────────────────────── */

function renderProdutosLista(lista) {

    const grid =
        document.getElementById('grade-produtos');

    const counter =
        document.getElementById('contador-resultados');

    if (!grid) return;

    grid.innerHTML = '';

    if (lista.length === 0) {

        grid.innerHTML = `
            <p class="sem-produtos">
                Nenhum produto encontrado.
            </p>
        `;

        if (counter) {
            counter.textContent = '';
        }

        return;
    }

    lista.forEach(p =>
        grid.appendChild(criarCard(p))
    );

    if (counter) {

        counter.textContent =
            `${lista.length} produto${lista.length !== 1 ? 's' : ''}`;
    }
}

function renderProdutos() {

    aplicarFiltros();
}

/* ── Filtros ─────────────────────────────────── */

function aplicarFiltros() {

    if (produtos.length === 0) {

        renderProdutosLista([]);

        return;
    }

    const globalMarcas =
        marcasSelecionadas('global');

    const globalPrecoMin =
        precoValor('.preco-min[data-cat="global"]');

    const globalPrecoMax =
        precoValor('.preco-max[data-cat="global"]');

    const globalStock =
        stockActivo('global');

    const cats = [
        'celulares',
        'laptop',
        'monitor',
        'fone',
        'teclado',
        'mouse',
        'gpu',
        'relogio',
        'ram',
        'cooler',
        'cpu',
        'placamae'
    ];

    const lista = produtos.filter(p => {

        if (
            globalMarcas.length &&
            !globalMarcas.includes(p.marca)
        ) {
            return false;
        }

        if (
            globalPrecoMin !== null &&
            p.preco < globalPrecoMin
        ) {
            return false;
        }

        if (
            globalPrecoMax !== null &&
            p.preco > globalPrecoMax
        ) {
            return false;
        }

        if (
            globalStock &&
            !p.emStock
        ) {
            return false;
        }

        for (const cat of cats) {

            const marcas =
                marcasSelecionadas(cat);

            const precoMin =
                precoValor(`.preco-min[data-cat="${cat}"]`);

            const precoMax =
                precoValor(`.preco-max[data-cat="${cat}"]`);

            const stock =
                stockActivo(cat);

            const temFiltroActivo =
                marcas.length ||
                precoMin !== null ||
                precoMax !== null ||
                stock;

            if (!temFiltroActivo) {
                continue;
            }

            if (
                p.categoria !== cat &&
                p.subcategoria !== cat
            ) {
                continue;
            }

            if (
                marcas.length &&
                !marcas.includes(p.marca)
            ) {
                return false;
            }

            if (
                precoMin !== null &&
                p.preco < precoMin
            ) {
                return false;
            }

            if (
                precoMax !== null &&
                p.preco > precoMax
            ) {
                return false;
            }

            if (
                stock &&
                !p.emStock
            ) {
                return false;
            }
        }

        return true;
    });

    renderProdutosLista(lista);
}

/* ── Helpers ─────────────────────────────────── */

function marcasSelecionadas(cat) {

    return [
        ...document.querySelectorAll(
            `.filtro-marca[data-cat="${cat}"]:checked`
        )
    ].map(el => el.value);
}

function precoValor(selector) {

    const el =
        document.querySelector(selector);

    if (!el || el.value === '') {
        return null;
    }

    const v =
        parseFloat(el.value);

    return isNaN(v) ? null : v;
}

function stockActivo(cat) {

    const el =
        document.querySelector(
            `.filtro-stock[data-cat="${cat}"]`
        );

    return el ? el.checked : false;
}

/* ── Footer ──────────────────────────────────── */

function filtrar(cat) {

    const mapa = {
        todos: null,
        laptops: 'grupo-computadores',
        laptop: 'grupo-computadores',
        celulares: 'grupo-celulares',
        acessorios: 'grupo-acessorios',
        monitor: 'grupo-computadores',
        gpu: 'grupo-acessorios',
        cpu: 'grupo-acessorios',
    };

    const grupoId =
        mapa[cat] ?? null;

    if (grupoId) {

        const el =
            document.getElementById(grupoId);

        if (el) {
            el.open = true;
        }
    }

    aplicarFiltros();
}

function limparFiltros() {

    document
        .querySelectorAll(
            '.filtro-marca, .filtro-stock'
        )
        .forEach(el =>
            el.checked = false
        );

    document
        .querySelectorAll(
            '.preco-min, .preco-max'
        )
        .forEach(el =>
            el.value = ''
        );

    aplicarFiltros();
}

/* ── Busca ───────────────────────────────────── */

function buscarProdutos(e) {

    if (e.key === 'Enter') {
        buscarProdutosPorTexto();
    }
}

function buscarProdutosPorTexto() {

    const termo =
        (
            document
                .getElementById('searchInput')
                ?.value || ''
        )
        .toLowerCase()
        .trim();

    if (!termo) {

        renderProdutos();

        return;
    }

    const lista = produtos.filter(p =>

        p.nome
            .toLowerCase()
            .includes(termo)

        ||

        (
            p.desc &&
            p.desc
                .toLowerCase()
                .includes(termo)
        )

        ||

        (
            p.marca &&
            p.marca
                .toLowerCase()
                .includes(termo)
        )
    );

    ir('produtos');

    renderProdutosLista(lista);
}

/* ── Detalhe ─────────────────────────────────── */

function renderDetalhe(id) {

    const p =
        produtos.find(x => x.id === id);

    if (!p) {

        ir('produtos');

        return;
    }

    document
        .getElementById('detalhe-conteudo')
        .innerHTML = `

        <div class="detalhe-img">
            <img src="${p.img}" alt="${p.nome}">
        </div>

        <div class="detalhe-info">

            <p class="categoria">
                ${p.categoria}
            </p>

            <h1>${p.nome}</h1>

            <p class="preco-grande">
                ${fmt(p.preco)}
            </p>

            <hr class="divisor">

            <p>${p.desc}</p>

            <button
                class="btn primario"
                onclick="addCarrinho(${p.id})"
            >
                Adicionar ao Carrinho 🛒
            </button>

            <ul class="garantias">
                <li>📦 Frete grátis e devoluções</li>
                <li>🛡️ 1 ano de garantia</li>
            </ul>

        </div>
    `;
}

/* ── Carrinho ────────────────────────────────── */

function addCarrinho(id) {

    const produto =
        produtos.find(p => p.id === id);

    if (!produto) return;

    const existente =
        carrinho.find(i => i.id === id);

    if (existente) {

        existente.qtd++;

    } else {

        carrinho.push({
            ...produto,
            qtd: 1
        });
    }

    localStorage.setItem(
        'carrinho',
        JSON.stringify(carrinho)
    );

    atualizarBadge();

    alert(
        `"${produto.nome}" adicionado ao carrinho! 🛒`
    );
}

function remover(id) {

    carrinho =
        carrinho.filter(i => i.id !== id);

    localStorage.setItem(
        'carrinho',
        JSON.stringify(carrinho)
    );

    atualizarBadge();

    renderCarrinho();
}

function mudarQtd(id, delta) {

    const item =
        carrinho.find(i => i.id === id);

    if (!item) return;

    item.qtd += delta;

    if (item.qtd <= 0) {

        remover(id);

    } else {

        localStorage.setItem(
            'carrinho',
            JSON.stringify(carrinho)
        );

        renderCarrinho();

        atualizarBadge();
    }
}

function atualizarBadge() {

    const badge =
        document.getElementById('badge');

    if (!badge) return;

    const total =
        carrinho.reduce(
            (s, i) => s + i.qtd,
            0
        );

    badge.textContent = total;

    total > 0
        ? badge.classList.remove('oculto')
        : badge.classList.add('oculto');
}

function renderCarrinho() {

    const lista =
        document.getElementById('itens-carrinho');

    const subtotal =
        document.getElementById('subtotal');

    const total =
        document.getElementById('total');

    if (carrinho.length === 0) {

        lista.innerHTML = `
            <div class="vazio">
                <span class="emoji">🛒</span>
                <h2>Seu carrinho está vazio</h2>
                <p>
                    Parece que você ainda não adicionou nada.
                </p>
                <a onclick="ir('produtos')">
                    Continuar comprando
                </a>
            </div>
        `;

        subtotal.textContent = fmt(0);

        total.textContent = fmt(0);

        return;
    }

    let soma = 0;

    let html = '';

    carrinho.forEach(item => {

        const itemTotal =
            item.preco * item.qtd;

        soma += itemTotal;

        html += `
            <div class="item">

                <div
                    class="item-img"
                    onclick="ir('detalhe', ${item.id})"
                >
                    <img src="${item.img}" alt="${item.nome}">
                </div>

                <div class="item-info">
                    <h3 onclick="ir('detalhe', ${item.id})">
                        ${item.nome}
                    </h3>

                    <p class="preco">
                        ${fmt(item.preco)}
                    </p>
                </div>

                <div class="qtd">
                    <button onclick="mudarQtd(${item.id}, -1)">
                        −
                    </button>

                    <span>${item.qtd}</span>

                    <button onclick="mudarQtd(${item.id}, 1)">
                        +
                    </button>
                </div>

                <div class="item-total">
                    ${fmt(itemTotal)}
                </div>

                <button
                    class="btn-remover"
                    onclick="remover(${item.id})"
                >
                    ✕
                </button>

            </div>
        `;
    });

    lista.innerHTML = html;

    subtotal.textContent = fmt(soma);

    total.textContent = fmt(soma);
}

<<<<<<< HEAD
function finalizar() {
    //if (carrinho.length === 0) return;
    alert('Simulação! O checkout seria iniciado aqui.');
    window.open("../TelaRecibo/Recibo.html", "_blank");
    carrinho = [];
    atualizarBadge();
    renderCarrinho();
=======
/* ── Checkout ────────────────────────────────── */

async function finalizar() {

    if (carrinho.length === 0) {
        return;
    }

    const token =
        getToken();

    if (!token) {

        alert('Faça login primeiro.');

        window.location.href =
            'Telas/TelaLogin/tela_login.html';

        return;
    }

    try {

        const res =
            await fetch(
                `${API}/pedidos`,
                {
                    method: 'POST',

                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },

                    body: JSON.stringify({
                        itens: carrinho
                    })
                }
            );

        const data =
            await res.json();

        if (!res.ok) {

            throw new Error(
                data.erro ||
                'Erro ao finalizar pedido'
            );
        }

        alert(
            'Pedido realizado com sucesso! 🎉'
        );

        carrinho = [];

        localStorage.removeItem('carrinho');

        atualizarBadge();

        renderCarrinho();

    } catch (err) {

        console.error(err);

        alert(err.message);
    }
>>>>>>> 03c0150 (Versao com back-end ja funcional)
}

/* ── Contacto ────────────────────────────────── */

function enviarForm(e) {

    e.preventDefault();
<<<<<<< HEAD
    alert('Mensagem enviada! (simulação) ');
=======

    alert('Mensagem enviada! ✅');

>>>>>>> 03c0150 (Versao com back-end ja funcional)
    e.target.reset();
}

/* ── Posters ─────────────────────────────────── */

let index = 0;

const track =
    document.querySelector('.track');

const slideWidth = () =>
    document
        .getElementById('scroll-container')
        .offsetWidth;

const total =
    document
        .querySelectorAll('.track > *')
        .length;

document.getElementById('next').onclick = () => {

    index = Math.min(
        index + 1,
        total - 1
    );

    track.style.transform =
        `translateX(-${index * slideWidth()}px)`;
};

document.getElementById('prev').onclick = () => {

    index = Math.max(
        index - 1,
        0
    );

    track.style.transform =
        `translateX(-${index * slideWidth()}px)`;
};

