

const produtos = [
    { id: 1, nome: 'BASGAM ProBook 14"',    preco: 7499, categoria: 'laptops',    img: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80', desc: 'Alta performance em chassi de alumínio leve e elegante. Processador equivalente ao M2, 16 GB de RAM e bateria para o dia inteiro.' },
    { id: 2, nome: 'BASGAM Book Air',        preco: 5999, categoria: 'laptops',    img: 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&w=800&q=80', desc: 'O laptop ideal para estudantes e profissionais em movimento. Design fanless silencioso com display retina deslumbrante.' },
    { id: 3, nome: 'BASGAM Phone X',         preco: 4599, categoria: 'celulares',  img: 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&w=800&q=80', desc: 'Smartphone revolucionário com tela OLED de borda a borda, câmera dupla avançada e bateria que dura o dia inteiro.' },
    { id: 4, nome: 'Fone com Cancelamento',  preco: 1399, categoria: 'acessorios', img: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&w=800&q=80', desc: 'Imersão total em áudio de alta fidelidade. Cancelamento ativo de ruído, áudio espacial e espuma viscoelástica premium.' },
    { id: 5, nome: 'Base de Carregamento',   preco: 289,  categoria: 'acessorios', img: 'https://images.unsplash.com/photo-1622445275576-721325763afe?auto=format&fit=crop&w=800&q=80', desc: 'Carregador sem fio minimalista e elegante. Carrega rapidamente seu celular e fone ao mesmo tempo.' },
    { id: 6, nome: 'Monitor UltraWide 34"',  preco: 2899, categoria: 'acessorios', img: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=80', desc: 'Expanda seu espaço de trabalho com este monitor curvo e preciso em cores. Perfeito para produtividade e entretenimento imersivo.' }
];

let carrinho    = [];
let filtroAtual = 'todos';

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('ano').textContent = new Date().getFullYear();
    renderDestaque();
    renderProdutos();
    atualizarBadge();
});

function ir(pagina, id = null) {
    document.querySelectorAll('.pagina').forEach(el => el.classList.add('oculta'));
    document.getElementById(`view-${pagina}`).classList.remove('oculta');

    document.querySelectorAll('#menu button').forEach(btn => {
        btn.classList.remove('ativo');
        if (btn.textContent.trim().toLowerCase() === pagina) btn.classList.add('ativo');
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (pagina === 'detalhe' && id) renderDetalhe(id);
    if (pagina === 'carrinho') renderCarrinho();
}

function toggleMenu() {
    document.getElementById('menu').classList.toggle('aberto');
}

function fmt(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

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

function renderDestaque() {
    const grid = document.getElementById('grid-destaque');
    grid.innerHTML = '';
    produtos.slice(0, 3).forEach(p => grid.appendChild(criarCard(p)));
}

function renderProdutos() {
    const grid = document.getElementById('grade-produtos');
    const lista = filtroAtual === 'todos' ? produtos : produtos.filter(p => p.categoria === filtroAtual);
    grid.innerHTML = '';
    if (lista.length === 0) {
        grid.innerHTML = '<p style="color:var(--muted);padding:40px 0">Nenhum produto encontrado.</p>';
        return;
    }
    lista.forEach(p => grid.appendChild(criarCard(p)));
}

function filtrar(cat) {
    filtroAtual = cat;
    document.querySelectorAll('.filtros button').forEach(btn => btn.classList.remove('ativo'));
    document.getElementById(`f-${cat}`).classList.add('ativo');
    renderProdutos();
}

function renderDetalhe(id) {
    const p = produtos.find(x => x.id === id);
    if (!p) return ir('produtos');
    document.getElementById('detalhe-conteudo').innerHTML = `
        <div class="detalhe-img">
            <img src="${p.img}" alt="${p.nome}">
        </div>
        <div class="detalhe-info">
            <p class="categoria">${p.categoria}</p>
            <h1>${p.nome}</h1>
            <p class="preco-grande">${fmt(p.preco)}</p>
            <hr class="divisor">
            <p>${p.desc}</p>
            <button class="btn primario" onclick="addCarrinho(${p.id})">Adicionar ao Carrinho 🛒</button>
            <ul class="garantias">
                <li>📦 Frete grátis e devoluções</li>
                <li>🛡️ 1 ano de garantia</li>
            </ul>
        </div>
    `;
}

function addCarrinho(id) {
    const produto = produtos.find(p => p.id === id);
    const existente = carrinho.find(i => i.id === id);
    if (existente) { existente.qtd++; } else { carrinho.push({ ...produto, qtd: 1 }); }
    atualizarBadge();
    alert(`"${produto.nome}" adicionado ao carrinho! 🛒`);
}

function remover(id) {
    carrinho = carrinho.filter(i => i.id !== id);
    atualizarBadge();
    renderCarrinho();
}

function mudarQtd(id, delta) {
    const item = carrinho.find(i => i.id === id);
    if (!item) return;
    item.qtd += delta;
    if (item.qtd <= 0) { remover(id); } else { renderCarrinho(); atualizarBadge(); }
}

function atualizarBadge() {
    const badge = document.getElementById('badge');
    const total = carrinho.reduce((s, i) => s + i.qtd, 0);
    badge.textContent = total;
    total > 0 ? badge.classList.remove('oculto') : badge.classList.add('oculto');
}

function renderCarrinho() {
    const lista   = document.getElementById('itens-carrinho');
    const subtotal = document.getElementById('subtotal');
    const total   = document.getElementById('total');

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

function finalizar() {
    if (carrinho.length === 0) return;
    alert('Simulação! O checkout seria iniciado aqui. 🎉');
    carrinho = [];
    atualizarBadge();
    renderCarrinho();
}

function enviarForm(e) {
    e.preventDefault();
    alert('Mensagem enviada! (simulação) ✅');
    e.target.reset();
}


// scroll
let index = 0;
const track = document.querySelector('.track');
const slideWidth = () => document.getElementById('scroll-container').offsetWidth;
const total = document.querySelectorAll('.track > *').length;

document.getElementById('next').onclick = () => {
    index = Math.min(index + 1, total - 1);
    track.style.transform = `translateX(-${index * slideWidth()}px)`;
};

document.getElementById('prev').onclick = () => {
    index = Math.max(index - 1, 0);
    track.style.transform = `translateX(-${index * slideWidth()}px)`;
};