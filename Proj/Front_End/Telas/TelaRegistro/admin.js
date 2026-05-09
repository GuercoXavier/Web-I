// admin.js - Versão Final
// Local: Front_End/Telas/TelaRegistro/admin.js

const API_URL = 'http://localhost:3000/api';
let authToken = localStorage.getItem('token');
let fotoDataUrl = null;
let produtos = [];

// VERIFICAR AUTENTICAÇÃO
/*if (!authToken) {
    alert('Faça login primeiro!');
    window.location.href = '../TelaLogin/tela_login.html';
}

const user = JSON.parse(localStorage.getItem('utilizador') || '{}');
if (user.role !== 'admin') {
    alert('Acesso negado! Apenas administradores podem acessar esta página.');
    window.location.href = '../TelaPrincipal/index.html';
}

function q(id) { return document.getElementById(id); }
function hide(id) { const el = q(id); if(el) el.style.display = 'none'; }
function show(id) { const el = q(id); if(el) el.style.display = ''; }

function mostrarToast(msg, erro = false) {
    const toast = q('toast');
    if (!toast) return;
    toast.textContent = erro ? `✗ ${msg}` : `✓ ${msg}`;
    toast.classList.add('visivel');
    setTimeout(() => toast.classList.remove('visivel'), 3000);
}

function getHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
    };
}
*/
function criarModalCSS() {
    if (document.getElementById('modal-sistema-style')) return;
    const style = document.createElement('style');
    style.id = 'modal-sistema-style';
    style.textContent = `
        #modal-overlay {
            position: fixed; inset: 0; z-index: 9999;
            background: rgba(0,0,0,0.55);
            backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center;
            opacity: 0; transition: opacity 0.2s ease;
            pointer-events: none;
        }
        #modal-overlay.visivel {
            opacity: 1; pointer-events: all;
        }
        #modal-caixa {
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 12px;
            padding: 28px 32px 24px;
            min-width: 320px; max-width: 420px; width: 90%;
            box-shadow: 0 24px 64px rgba(0,0,0,0.6);
            transform: translateY(10px) scale(0.97);
            transition: transform 0.22s ease, opacity 0.2s ease;
            opacity: 0;
        }
        #modal-overlay.visivel #modal-caixa {
            transform: translateY(0) scale(1); opacity: 1;
        }
        #modal-icone {
            font-size: 2rem; margin-bottom: 10px; display: block;
        }
        #modal-titulo {
            font-family: 'Segoe UI', sans-serif;
            font-size: 1rem; font-weight: 600;
            color: #f0f0f0; margin: 0 0 8px;
        }
        #modal-mensagem {
            font-family: 'Segoe UI', sans-serif;
            font-size: 0.88rem; color: #aaa;
            line-height: 1.5; margin: 0 0 22px;
        }
        #modal-acoes {
            display: flex; gap: 10px; justify-content: flex-end;
        }
        .modal-btn {
            font-family: 'Segoe UI', sans-serif;
            font-size: 0.85rem; font-weight: 500;
            padding: 8px 20px; border-radius: 7px;
            border: none; cursor: pointer;
            transition: opacity 0.15s, transform 0.1s;
        }
        .modal-btn:hover { opacity: 0.85; }
        .modal-btn:active { transform: scale(0.97); }
        .modal-btn-cancelar {
            background: #2e2e2e; color: #ccc;
            border: 1px solid #444;
        }
        .modal-btn-confirmar {
            background: #e53e3e; color: #fff;
        }
        .modal-btn-confirmar.seguro {
            background: #2563eb;
        }
        .modal-btn-ok {
            background: #2e2e2e; color: #f0f0f0;
            border: 1px solid #444; min-width: 80px;
        }
    `;
    document.head.appendChild(style);
}
// ===================== CARREGAR CATEGORIAS =====================
async function carregarCategorias() {
    try {
        const response = await fetch(`${API_URL}/categorias`);
        const categorias = await response.json();
        
        window.CATEGORIAS = {};
        categorias.forEach(cat => {
            window.CATEGORIAS[cat.nome.toLowerCase()] = {
                label: cat.nome,
                subcategorias: {},
                marcas: []
            };
            if (cat.subcategorias) {
                cat.subcategorias.forEach(sub => {
                    window.CATEGORIAS[cat.nome.toLowerCase()].subcategorias[sub.nome] = [];
                });
            }
        });
        
        const selCat = q('sel-cat');
        if (selCat) {
            selCat.innerHTML = '<option value="">— selecione —</option>';
            categorias.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.nome.toLowerCase();
                option.textContent = cat.nome;
                selCat.appendChild(option);
            });
        }
    } catch (err) {
        console.error('Erro categorias:', err);
        mostrarToast('Erro ao carregar categorias', true);
    }
}

// ===================== LISTAR PRODUTOS =====================
async function listarProdutos() {
    try {
        const response = await fetch(`${API_URL}/produtos`);
        if (!response.ok) throw new Error('Erro ao buscar produtos');
        produtos = await response.json();
        renderizarLista();
    } catch (err) {
        console.error('Erro produtos:', err);
        mostrarToast('Erro ao carregar produtos', true);
    }
}

// ===================== ADICIONAR PRODUTO =====================
async function adicionarProduto() {
    const nome = q('inp-nome').value.trim();
    const preco = parseFloat(q('inp-preco').value);
    const stock = parseInt(q('inp-stock').value);
    const descricao = q('inp-desc').value.trim();
    const catNome = q('sel-cat').value;
    const subNome = q('sel-sub').value;
    const marca = q('sel-marca').value;
    
    if (!nome) {
        mostrarToast('Preencha o nome do produto', true);
        q('inp-nome').focus();
        return;
    }
    
    if (isNaN(preco) || preco < 0) {
        mostrarToast('Preço inválido', true);
        return;
    }
    
    let categoria_id = null;
    let subcategoria_id = null;
    
    if (catNome) {
        try {
            const catResponse = await fetch(`${API_URL}/categorias`);
            const categorias = await catResponse.json();
            const cat = categorias.find(c => c.nome.toLowerCase() === catNome);
            categoria_id = cat ? cat.id : null;
            
            if (subNome && cat && cat.subcategorias) {
                const sub = cat.subcategorias.find(s => s.nome === subNome);
                subcategoria_id = sub ? sub.id : null;
            }
        } catch (err) {
            console.error('Erro ao buscar IDs:', err);
        }
    }
    
    const produto = {
        nome: nome,
        descricao: descricao || '',
        preco: preco || 0,
        stock: stock || 0,
        marca: marca || '',
        imagem: fotoDataUrl || '',
        categoria_id: categoria_id,
        subcategoria_id: subcategoria_id,
        em_destaque: 0
    };
    
    try {
        const response = await fetch(`${API_URL}/produtos`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(produto)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            mostrarToast('Produto adicionado com sucesso!');
            limparForm();
            await listarProdutos();
        } else {
            mostrarToast(data.erro || 'Erro ao adicionar produto', true);
        }
    } catch (err) {
        console.error('Erro:', err);
        mostrarToast('Erro de conexão com o servidor', true);
    }
}

// ===================== REMOVER PRODUTO (CARD) =====================
async function removerProduto(id) {
    if (!confirm('Remover este produto permanentemente?')) return;
    
    try {
        const response = await fetch(`${API_URL}/produtos/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        
        const data = await response.json();
        
        if (response.ok) {
            mostrarToast('Produto removido com sucesso!');
            await listarProdutos();
        } else if (response.status === 404) {
            mostrarToast('Produto não encontrado', true);
        } else {
            mostrarToast(data.erro || 'Erro ao remover produto', true);
        }
    } catch (err) {
        console.error('Erro:', err);
        mostrarToast('Erro de conexão com o servidor', true);
    }
}

// ===================== REMOVER PRODUTO POR ID (ABA) =====================
async function removerProdutoPorId() {
    const id = q('inp-id-produto').value.trim();
    if (!id) {
        mostrarToast('Digite o ID do produto', true);
        return;
    }
    
    if (!confirm(`Remover produto ID ${id} permanentemente?`)) return;
    
    try {
        const response = await fetch(`${API_URL}/produtos/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        
        const data = await response.json();
        
        if (response.ok) {
            mostrarToast(`Produto ${id} removido com sucesso!`);
            q('inp-id-produto').value = '';
            q('inp-nome-busca-produto').value = '';
            await listarProdutos();
        } else if (response.status === 404) {
            mostrarToast('Produto não encontrado', true);
        } else {
            mostrarToast(data.erro || 'Erro ao remover produto', true);
        }
    } catch (err) {
        console.error('Erro:', err);
        mostrarToast('Erro de conexão com o servidor', true);
    }
}

// ===================== REMOVER PERFIL =====================
async function removerPerfil() {
    const nome = q('inp-nome-perfil').value.trim();
    const email = q('inp-email-perfil').value.trim();
    
    if (!nome && !email) {
        mostrarToast('Digite nome ou email do perfil', true);
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/users`, {
            headers: getHeaders()
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                mostrarToast('Sessão expirada. Faça login novamente.', true);
                localStorage.removeItem('token');
                setTimeout(() => {
                    window.location.href = '../TelaLogin/tela_login.html';
                }, 2000);
                return;
            }
            if (response.status === 403) {
                mostrarToast('Acesso negado. Apenas administradores.', true);
                return;
            }
            mostrarToast('Erro ao buscar usuários', true);
            return;
        }
        
        const usuarios = await response.json();
        
        let usuario = null;
        
        if (nome) {
            usuario = usuarios.find(u => u.username.toLowerCase() === nome.toLowerCase());
        }
        
        if (!usuario && email) {
            usuario = usuarios.find(u => u.email.toLowerCase() === email.toLowerCase());
        }
        
        if (!usuario) {
            mostrarToast(`Usuário "${nome || email}" não encontrado`, true);
            return;
        }
        
        const logado = JSON.parse(localStorage.getItem('utilizador') || '{}');
        
        if (usuario.role === 'admin') {
            mostrarToast('Não é possível remover um administrador', true);
            return;
        }
        
        if (usuario.id === logado.id) {
            mostrarToast('Você não pode remover seu próprio perfil', true);
            return;
        }
        
        if (!confirm(`Remover permanentemente o perfil "${usuario.username}" (${usuario.email})?`)) return;
        
        const deleteResponse = await fetch(`${API_URL}/users/${usuario.id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        
        if (deleteResponse.ok) {
            mostrarToast(`Perfil "${usuario.username}" removido com sucesso!`);
            q('inp-nome-perfil').value = '';
            q('inp-email-perfil').value = '';
            await listarProdutos();
        } else {
            const erro = await deleteResponse.json();
            mostrarToast(erro.erro || 'Erro ao remover perfil', true);
        }
    } catch (err) {
        console.error('Erro detalhado:', err);
        mostrarToast('Erro de conexão com o servidor', true);
    }
}

// ===================== RENDERIZAR LISTA =====================
function renderizarLista() {
    const grid = q('grid-registados');
    const vazio = q('estado-vazio');
    const badge = q('badge-count');
    
    if (!grid) return;
    
    badge.textContent = `${produtos.length} produto${produtos.length !== 1 ? 's' : ''}`;
    
    if (produtos.length === 0) {
        if (vazio) vazio.style.display = 'flex';
        grid.innerHTML = '';
        return;
    }
    
    if (vazio) vazio.style.display = 'none';
    
    grid.innerHTML = produtos.map(p => {
        const precoFmt = (p.preco || 0).toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN' });
        const stockClass = (p.stock || 0) > 0 ? 'ok' : 'zero';
        const stockLabel = (p.stock || 0) > 0 ? `${p.stock} un.` : 'Sem stock';
        
        const imgHtml = p.imagem && p.imagem !== ''
            ? `<img src="${p.imagem}" alt="${p.nome}" style="width:100%; height:100%; object-fit:cover;">`
            : `<div class="card-reg-img-vazia"><span style="color:#666;">sem foto</span></div>`;
        
        let catHtml = '';
        if (p.categoria_nome) {
            catHtml = `<div class="card-reg-cat">
                <span class="card-reg-cat-tag cat">${p.categoria_nome}</span>
                ${p.subcategoria_nome ? `<span class="card-reg-sep">›</span><span class="card-reg-cat-tag sub">${p.subcategoria_nome}</span>` : ''}
                ${p.marca ? `<span class="card-reg-sep">›</span><span class="card-reg-cat-tag marca">${p.marca}</span>` : ''}
            </div>`;
        }
        
        return `
            <div class="card-reg">
                <div class="card-reg-img">${imgHtml}</div>
                <div class="card-reg-corpo">
                    <p class="card-reg-nome">${escapeHtml(p.nome)}</p>
                    ${catHtml}
                    ${p.descricao ? `<p class="card-reg-desc">${escapeHtml(p.descricao.substring(0, 80))}</p>` : ''}
                    <div class="card-reg-meta">
                        <span class="card-reg-preco">${precoFmt}</span>
                        <span class="card-reg-stock ${stockClass}">${stockLabel}</span>
                    </div>
                    <button class="btn-remover-card" onclick="removerProduto(${p.id})">Remover</button>
                </div>
            </div>`;
    }).join('');
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ===================== FUNÇÕES DE FOTO =====================
function fotoSelecionada(input) {
    const file = input.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        mostrarToast('Por favor, selecione uma imagem válida', true);
        return;
    }
    
    const reader = new FileReader();
    reader.onload = e => aplicarFoto(e.target.result);
    reader.readAsDataURL(file);
}

function aplicarFoto(src) {
    fotoDataUrl = src;
    const img = q('preview-img');
    const zona = q('zona-foto');
    if (img) img.src = src;
    if (zona) zona.classList.add('tem-foto');
}

function dragOver(e) { 
    e.preventDefault(); 
    const zona = q('zona-foto'); 
    if(zona) zona.classList.add('drag-over'); 
}

function dragLeave(e) { 
    const zona = q('zona-foto'); 
    if(zona) zona.classList.remove('drag-over'); 
}

function drop(e) {
    e.preventDefault();
    const zona = q('zona-foto');
    if (zona) zona.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = ev => aplicarFoto(ev.target.result);
    reader.readAsDataURL(file);
}

// ===================== LIMPAR FORMULÁRIO =====================
function limparForm() {
    q('inp-nome').value = '';
    q('inp-preco').value = '';
    q('inp-stock').value = '';
    q('inp-desc').value = '';
    q('input-foto').value = '';
    fotoDataUrl = null;
    q('sel-cat').value = '';
    q('sel-sub').innerHTML = '';
    q('sel-marca').innerHTML = '';
    hide('wrap-sub');
    hide('wrap-marca');
    q('caminho-filtro').innerHTML = '';
    q('zona-foto').classList.remove('tem-foto');
    q('preview-img').src = '';
}

// ===================== FUNÇÕES DE CATEGORIA =====================
function onCategoria() {
    const cat = q('sel-cat').value;
    hide('wrap-sub');
    hide('wrap-marca');
    q('sel-sub').innerHTML = '';
    q('sel-marca').innerHTML = '';
    atualizarCaminho();
    
    if (!cat || !window.CATEGORIAS || !window.CATEGORIAS[cat]) return;
    
    const dados = window.CATEGORIAS[cat];
    if (dados.subcategorias && Object.keys(dados.subcategorias).length > 0) {
        const subSelect = q('sel-sub');
        subSelect.innerHTML = '<option value="">— selecione —</option>';
        Object.keys(dados.subcategorias).forEach(sub => {
            const option = document.createElement('option');
            option.value = sub;
            option.textContent = sub;
            subSelect.appendChild(option);
        });
        show('wrap-sub');
    }
}

function onSubcategoria() {
    const cat = q('sel-cat').value;
    const sub = q('sel-sub').value;
    hide('wrap-marca');
    atualizarCaminho();
    
    if (!sub || !window.CATEGORIAS || !window.CATEGORIAS[cat] || !window.CATEGORIAS[cat].subcategorias[sub]) return;
    
    const marcas = window.CATEGORIAS[cat].subcategorias[sub];
    if (marcas && marcas.length > 0) {
        const marcaSelect = q('sel-marca');
        marcaSelect.innerHTML = '<option value="">— selecione —</option>';
        marcas.forEach(marca => {
            const option = document.createElement('option');
            option.value = marca;
            option.textContent = marca;
            marcaSelect.appendChild(option);
        });
        show('wrap-marca');
    }
}

function onMarca() { 
    atualizarCaminho(); 
}

function atualizarCaminho() {
    const cat = q('sel-cat').value;
    const sub = q('sel-sub').value;
    const marca = q('sel-marca').value;
    const wrap = q('caminho-filtro');
    
    if (!wrap) return;
    if (!cat) { 
        wrap.innerHTML = ''; 
        return; 
    }
    
    const catLabel = window.CATEGORIAS && window.CATEGORIAS[cat] ? window.CATEGORIAS[cat].label : cat;
    let html = `<span class="caminho-pilula cat">${catLabel}</span>`;
    if (sub) html += `<span class="caminho-sep">›</span><span class="caminho-pilula">${sub}</span>`;
    if (marca) html += `<span class="caminho-sep">›</span><span class="caminho-pilula marca">${marca}</span>`;
    wrap.innerHTML = html;
}

function mudarAba(aba) {
    document.querySelectorAll('.nav-aba').forEach(b => b.classList.remove('ativa'));
    document.querySelectorAll('.aba-conteudo').forEach(c => c.classList.remove('ativa'));
    const botao = Array.from(document.querySelectorAll('.nav-aba')).find(b => b.getAttribute('onclick')?.includes(aba));
    if (botao) botao.classList.add('ativa');
    const conteudo = q(`aba-${aba}`);
    if (conteudo) conteudo.classList.add('ativa');
}

// ===================== INICIALIZAÇÃO =====================
async function init() {
    const btnAdicionar = q('btn-adicionar');
    const btnRemoverProduto = q('btn-remover-produto');
    const btnRemoverPerfil = q('btn-remover-perfil');
    
    if (btnAdicionar) btnAdicionar.onclick = adicionarProduto;
    if (btnRemoverProduto) btnRemoverProduto.onclick = removerProdutoPorId;
    if (btnRemoverPerfil) btnRemoverPerfil.onclick = removerPerfil;
    
    await carregarCategorias();
    await listarProdutos();
}

window.onload = init;
