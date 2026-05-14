// ==================== CONFIGURAÇÃO ====================
const API = `${window.location.protocol}//${window.location.hostname}:3000/api`;

let categorias = [];
let subcategorias = [];
const marcas = [
    'Apple', 'Samsung', 'Xiaomi', 'Asus', 'Dell', 'Lenovo', 'HP', 'Tecno', 'JBL',
    'NVIDIA', 'AMD', 'Intel', 'Corsair', 'Logitech', 'Razer', 'MSI', 'Gigabyte'
];

const token = localStorage.getItem('token');

// ==================== TOAST ====================
function mostrarToast(mensagem, erro = false) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: #1f2937;
            color: white;
            padding: 12px 24px;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 500;
            z-index: 9999;
            display: none;
        `;
        document.body.appendChild(toast);
    }
    toast.textContent = erro ? `✗ ${mensagem}` : `✓ ${mensagem}`;
    toast.style.display = 'block';
    setTimeout(() => (toast.style.display = 'none'), 3000);
}

if (!token) {
    mostrarToast('Faça login primeiro!', true);
    setTimeout(() => (window.location.href = '../TelaLogin/tela_login.html'), 2000);
}

// ==================== CARREGAR PRODUTOS ====================
async function carregarProdutos() {
    try {
        const res = await fetch(`${API}/produtos`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Erro ao carregar produtos');
        const data = await res.json();
        const produtos = data.produtos || [];

        const grid = document.getElementById('grid-registados');
        const vazio = document.getElementById('estado-vazio');
        const badge = document.getElementById('badge-count');

        badge.textContent = `${produtos.length} produtos`;

        if (!produtos.length) {
            vazio.style.display = 'block';
            grid.innerHTML = '';
            return;
        }

        vazio.style.display = 'none';

        grid.innerHTML = produtos.map(p => `
            <div class="card-reg">
                <div class="card-reg-img">
                    <img src="${formatarImagem(p.imagem)}" />
                </div>
                <div class="card-reg-corpo">
                    <div class="card-reg-nome">${escapeHtml(p.nome)}</div>
                    <div class="card-reg-cat">
                        <span>${p.categoria_nome || ''}</span>
                        <span>${p.subcategoria_nome || ''}</span>
                        <span>${p.marca || ''}</span>
                    </div>
                    <div class="card-reg-desc">${escapeHtml(p.descricao || '')}</div>
                    <div class="card-reg-meta">
                        <div class="card-reg-preco">${Number(p.preco).toLocaleString()} MZN</div>
                        <div class="card-reg-stock ${p.stock > 0 ? 'ok' : 'zero'}">${p.stock}</div>
                    </div>
                </div>
                <button class="btn-remover-card" onclick="removerProduto(${p.id})">Remover</button>
            </div>
        `).join('');
    } catch (err) {
        console.error(err);
        mostrarToast('Erro ao carregar produtos', true);
    }
}

function formatarImagem(imagem) {
    if (!imagem) return '../../imagens/placeholder.png';
    if (imagem.startsWith('http')) return imagem;
    if (imagem.startsWith('/uploads')) return `${API.replace('/api', '')}${imagem}`;
    return `${API.replace('/api', '')}/uploads/produtos/${imagem}`;
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

// ==================== REMOVER PRODUTO (botão na lista) ====================
async function removerProduto(id) {
    if (!confirm('Tens a certeza que queres remover este produto?')) return;
    try {
        const res = await fetch(`${API}/produtos/${id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.erro || 'Erro ao remover');
        mostrarToast('Produto removido com sucesso');
        carregarProdutos(); // recarrega a lista
    } catch (err) {
        mostrarToast(err.message, true);
    }
}

// ==================== CARREGAR CATEGORIAS ====================
async function carregarCategorias() {
    try {
        const res = await fetch(`${API}/categorias`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Erro ao carregar categorias');
        const data = await res.json();
        categorias = data.categorias || [];

        const selCat = document.getElementById('sel-cat');
        selCat.innerHTML = '<option value="">- selecione -</option>';
        categorias.forEach(c => {
            selCat.innerHTML += `<option value="${c.id}">${c.nome}</option>`;
        });
        document.getElementById('wrap-sub')?.classList.add('hidden');
        document.getElementById('wrap-marca')?.classList.add('hidden');
    } catch (err) {
        mostrarToast('Erro ao carregar categorias', true);
    }
}

// ==================== MUDANÇA DE CATEGORIA ====================
async function onCategoria() {
    const catId = document.getElementById('sel-cat').value;
    const wrapSub = document.getElementById('wrap-sub');
    const selSub = document.getElementById('sel-sub');
    const wrapMarca = document.getElementById('wrap-marca');

    if (!catId) {
        wrapSub?.classList.add('hidden');
        wrapMarca?.classList.add('hidden');
        return;
    }

    try {
        const res = await fetch(`${API}/categorias/${catId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        const subcats = data.categoria?.subcategorias || [];

        selSub.innerHTML = '<option value="">- selecione -</option>';
        subcats.forEach(sub => {
            selSub.innerHTML += `<option value="${sub.id}">${sub.nome}</option>`;
        });
        wrapSub?.classList.remove('hidden');

        const selMarca = document.getElementById('sel-marca');
        selMarca.innerHTML = '<option value="">- selecione -</option>';
        marcas.forEach(m => {
            selMarca.innerHTML += `<option value="${m}">${m}</option>`;
        });
        wrapMarca?.classList.remove('hidden');
    } catch (err) {
        mostrarToast('Erro ao carregar subcategorias', true);
    }
}

function onSubcategoria() {} // Placeholder
function onMarca() {}       // Placeholder

// ==================== CRIAR PRODUTO ====================
document.getElementById('btn-adicionar')?.addEventListener('click', async () => {
    const formData = new FormData();
    formData.append('nome', document.getElementById('inp-nome').value);
    formData.append('preco', document.getElementById('inp-preco').value);
    formData.append('stock', document.getElementById('inp-stock').value);
    formData.append('descricao', document.getElementById('inp-desc').value);
    formData.append('categoria_id', document.getElementById('sel-cat').value);
    formData.append('subcategoria_id', document.getElementById('sel-sub').value);
    formData.append('marca', document.getElementById('sel-marca').value);
    const file = document.getElementById('input-foto').files[0];
    if (file) formData.append('imagem', file);

    try {
        const res = await fetch(`${API}/produtos`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.erro || 'Erro ao criar produto');
        mostrarToast('Produto criado com sucesso!');
        // Limpar formulário
        document.getElementById('inp-nome').value = '';
        document.getElementById('inp-preco').value = '';
        document.getElementById('inp-stock').value = '';
        document.getElementById('inp-desc').value = '';
        document.getElementById('sel-cat').value = '';
        document.getElementById('sel-sub').innerHTML = '<option value="">- selecione -</option>';
        document.getElementById('sel-marca').innerHTML = '<option value="">- selecione -</option>';
        document.getElementById('input-foto').value = '';
        document.getElementById('preview-img').classList.add('hidden');
        document.getElementById('zona-foto').classList.remove('tem-foto');
        document.querySelector('.placeholder-foto').style.display = 'block';
        carregarProdutos();
    } catch (err) {
        mostrarToast(err.message, true);
    }
});

// ==================== REMOVER PRODUTO (aba por ID) ====================
document.getElementById('btn-remover-produto')?.addEventListener('click', async () => {
    const id = document.getElementById('inp-id-produto').value.trim();
    if (!id) {
        mostrarToast('Digite o ID do produto', true);
        return;
    }
    if (!confirm(`Remover produto ID ${id}?`)) return;
    try {
        const res = await fetch(`${API}/produtos/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.erro || 'Erro ao remover');
        }
        mostrarToast('Produto removido com sucesso');
        document.getElementById('inp-id-produto').value = '';
        carregarProdutos();
    } catch (err) {
        mostrarToast(err.message, true);
    }
});

// ==================== REMOVER PERFIL (utilizador) ====================
document.getElementById('btn-remover-perfil')?.addEventListener('click', async () => {
    const nome = document.getElementById('inp-nome-perfil').value.trim();
    const email = document.getElementById('inp-email-perfil').value.trim();
    if (!nome && !email) {
        mostrarToast('Digite nome ou email do utilizador', true);
        return;
    }
    try {
        const busca = nome || email;
        const res = await fetch(`${API}/users?busca=${encodeURIComponent(busca)}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Erro ao buscar utilizador');
        const data = await res.json();
        const users = data.utilizadores || [];
        if (users.length === 0) {
            mostrarToast('Utilizador não encontrado', true);
            return;
        }
        const user = users[0];
        if (!confirm(`Remover utilizador "${user.username}" (ID ${user.id})?`)) return;

        const delRes = await fetch(`${API}/users/${user.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!delRes.ok) {
            const errData = await delRes.json();
            throw new Error(errData.erro || 'Erro ao remover utilizador');
        }
        mostrarToast('Utilizador removido com sucesso');
        document.getElementById('inp-nome-perfil').value = '';
        document.getElementById('inp-email-perfil').value = '';
    } catch (err) {
        mostrarToast(err.message, true);
    }
});

// ==================== ABAS ====================
function mudarAba(id, el) {
    document.querySelectorAll('.aba-conteudo').forEach(a => a.classList.remove('ativa'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('ativo'));
    document.getElementById(`aba-${id}`).classList.add('ativa');
    el.classList.add('ativo');
}

function confirmarSair() {
    if (confirm('Deseja realmente sair?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('utilizador');
        window.location.href = '../TelaLogin/tela_login.html';
    }
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    carregarCategorias();
    carregarProdutos();

    // Preview da imagem
    const inputFoto = document.getElementById('input-foto');
    const zonaFoto = document.getElementById('zona-foto');
    const preview = document.getElementById('preview-img');
    const placeholder = document.querySelector('.placeholder-foto');

    if (inputFoto) {
        inputFoto.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    preview.src = ev.target.result;
                    preview.classList.remove('hidden');
                    if (placeholder) placeholder.style.display = 'none';
                    if (zonaFoto) zonaFoto.classList.add('tem-foto');
                };
                reader.readAsDataURL(file);
            } else {
                preview.classList.add('hidden');
                if (placeholder) placeholder.style.display = 'block';
                if (zonaFoto) zonaFoto.classList.remove('tem-foto');
            }
        });
    }
});