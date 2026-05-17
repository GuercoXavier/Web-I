// ==================== CONFIGURAÇÃO ====================
const API = (() => {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `${protocol}//${hostname}:3000/api`;
    }
    return `${protocol}//${hostname}/api`;
})();

const token = localStorage.getItem('token');

const marcas = [
    'Apple', 'Samsung', 'Xiaomi', 'Asus', 'Dell', 'Lenovo', 'HP', 'Tecno', 'JBL',
    'NVIDIA', 'AMD', 'Intel', 'Corsair', 'Logitech', 'Razer', 'MSI', 'Gigabyte'
];

let categorias = [];

// ==================== TOAST ====================
function mostrarToast(mensagem, erro = false) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.style.cssText = `
            position: fixed; bottom: 30px; right: 30px;
            background: #1f2937; color: white;
            padding: 12px 24px; border-radius: 10px;
            font-size: 14px; font-weight: 500;
            z-index: 9999; display: none;
        `;
        document.body.appendChild(toast);
    }
    toast.textContent = erro ? `✗ ${mensagem}` : `✓ ${mensagem}`;
    toast.style.display = 'block';
    setTimeout(() => (toast.style.display = 'none'), 3000);
}

// ==================== VALIDAÇÃO DE TOKEN ====================
if (!token) {
    mostrarToast('Faça login primeiro!', true);
    setTimeout(() => (window.location.href = '/Telas/TelaLogin/tela_login.html'), 2000);
}

// ==================== UTILITÁRIOS ====================
function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'MZN',
        minimumFractionDigits: 2
    }).format(valor);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function formatarImagem(imagem) {
    if (!imagem) return '/imagens/placeholder.png';
    if (imagem.startsWith('http')) return imagem;
    if (imagem.startsWith('/uploads')) return `${API.replace('/api', '')}${imagem}`;
    return `${API.replace('/api', '')}/uploads/produtos/${imagem}`;
}

// ==================== CARREGAR PRODUTOS (lista) ====================
async function carregarProdutos() {
    try {
        const res = await fetch(`${API}/produtos`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Erro ao carregar produtos');
        const data = await res.json();
        const produtos = data.produtos || data || [];

        const grid = document.getElementById('grid-registados');
        const vazio = document.getElementById('estado-vazio');
        const badge = document.getElementById('badge-count');

        if (grid && vazio && badge) {
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
                            <div class="card-reg-preco">${formatarMoeda(p.preco)}</div>
                            <div class="card-reg-stock ${p.stock > 0 ? 'ok' : 'zero'}">${p.stock}</div>
                        </div>
                    </div>
                    <button class="btn-remover-card" onclick="removerProduto(${p.id})">Remover</button>
                </div>
            `).join('');
        }
    } catch (err) {
        mostrarToast(err.message, true);
    }
}

// ==================== REMOVER PRODUTO (botão na lista) ====================
window.removerProduto = async function(id) {
    if (!confirm('Tem certeza que quer remover este produto?')) return;
    try {
        const res = await fetch(`${API}/produtos/${id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            }
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.erro || 'Erro ao remover');
        }
        mostrarToast('Produto removido com sucesso');
        carregarProdutos();
    } catch (err) {
        mostrarToast(err.message, true);
    }
};

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
        if (selCat) {
            selCat.innerHTML = '<option value="">— selecione —</option>';
            categorias.forEach(cat => {
                selCat.innerHTML += `<option value="${cat.id}">${escapeHtml(cat.nome)}</option>`;
            });
        }
        document.getElementById('wrap-sub')?.classList.add('hidden');
        document.getElementById('wrap-marca')?.classList.add('hidden');
    } catch (err) {
        mostrarToast('Erro ao carregar categorias', true);
    }
}

// ==================== MUDANÇA DE CATEGORIA ====================
window.onCategoria = async function() {
    const catId = document.getElementById('sel-cat')?.value;
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

        if (selSub) {
            selSub.innerHTML = '<option value="">— selecione —</option>';
            subcats.forEach(sub => {
                selSub.innerHTML += `<option value="${sub.id}">${escapeHtml(sub.nome)}</option>`;
            });
        }
        wrapSub?.classList.remove('hidden');

        const selMarca = document.getElementById('sel-marca');
        if (selMarca) {
            selMarca.innerHTML = '<option value="">— selecione —</option>';
            marcas.forEach(m => {
                selMarca.innerHTML += `<option value="${m}">${escapeHtml(m)}</option>`;
            });
        }
        wrapMarca?.classList.remove('hidden');
    } catch (err) {
        mostrarToast('Erro ao carregar subcategorias', true);
    }
};

// ==================== CRIAR PRODUTO ====================
const btnAdicionar = document.getElementById('btn-adicionar');
if (btnAdicionar) {
    btnAdicionar.addEventListener('click', async () => {
        const formData = new FormData();
        formData.append('nome', document.getElementById('inp-nome')?.value || '');
        formData.append('preco', document.getElementById('inp-preco')?.value || 0);
        formData.append('stock', document.getElementById('inp-stock')?.value || 0);
        formData.append('descricao', document.getElementById('inp-desc')?.value || '');
        formData.append('categoria_id', document.getElementById('sel-cat')?.value || '');
        formData.append('subcategoria_id', document.getElementById('sel-sub')?.value || '');
        formData.append('marca', document.getElementById('sel-marca')?.value || '');
        const file = document.getElementById('input-foto')?.files[0];
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
            if (document.getElementById('sel-sub')) document.getElementById('sel-sub').innerHTML = '<option value="">— selecione —</option>';
            if (document.getElementById('sel-marca')) document.getElementById('sel-marca').innerHTML = '<option value="">— selecione —</option>';
            document.getElementById('input-foto').value = '';
            const preview = document.getElementById('preview-img');
            const placeholder = document.querySelector('.placeholder-foto');
            if (preview) preview.classList.add('hidden');
            if (placeholder) placeholder.style.display = 'block';
            document.getElementById('zona-foto')?.classList.remove('tem-foto');
            carregarProdutos();
        } catch (err) {
            mostrarToast(err.message, true);
        }
    });
}

// ==================== REMOVER PRODUTO POR ID (aba específica) ====================
const btnRemoverProduto = document.getElementById('btn-remover-produto');
if (btnRemoverProduto) {
    btnRemoverProduto.addEventListener('click', async () => {
        const id = document.getElementById('inp-id-produto')?.value.trim();
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
}

// ==================== REMOVER UTILIZADOR ====================
const btnRemoverPerfil = document.getElementById('btn-remover-perfil');
if (btnRemoverPerfil) {
    btnRemoverPerfil.addEventListener('click', async () => {
        const nome = document.getElementById('inp-nome-perfil')?.value.trim();
        const email = document.getElementById('inp-email-perfil')?.value.trim();
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
}

// ==================== RELATÓRIOS ====================
async function carregarRelatorio() {
    const dataInicio = document.getElementById('dataInicio')?.value || '';
    const dataFim = document.getElementById('dataFim')?.value || '';
    let url = `${API}/pedidos/admin/relatorio?`;
    if (dataInicio) url += `data_inicio=${dataInicio}&`;
    if (dataFim) url += `data_fim=${dataFim}&`;

    try {
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
            if (res.status === 401) {
                mostrarToast('Sessão expirada. Faça login novamente.', true);
                return;
            }
            throw new Error('Erro ao carregar relatório');
        }
        const data = await res.json();

        document.getElementById('totalVendas').textContent = data.resumo?.total_pedidos || 0;
        document.getElementById('faturacaoTotal').textContent = formatarMoeda(data.resumo?.faturacao_total || 0);
        document.getElementById('totalClientes').textContent = data.resumo?.total_clientes || 0;

        const tbody = document.getElementById('tabelaBody');
        if (!data.pedidos?.length) {
            tbody.innerHTML = '<tr><td colspan="5" style="padding:12px;text-align:center;">Nenhum pedido encontrado</td></tr>';
        } else {
            tbody.innerHTML = data.pedidos.map(p => `
                <tr>
                    <td style="padding:12px;">#${p.pedido_id || p.id}</td>
                    <td style="padding:12px;">${new Date(p.criado_em).toLocaleDateString('pt-PT')}</td>
                    <td style="padding:12px;">${escapeHtml(p.username || 'Anónimo')}</td>
                    <td style="padding:12px;">${formatarMoeda(p.total)}</td>
                    <td style="padding:12px;">${p.estado}</td>
                </tr>
            `).join('');
        }

        const topDiv = document.getElementById('topProdutos');
        if (!data.top_produtos?.length) {
            topDiv.innerHTML = '<p>Nenhum produto vendido ainda.</p>';
        } else {
            topDiv.innerHTML = data.top_produtos.map(p => `
                <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #e5e7eb;">
                    <span><strong>${escapeHtml(p.nome)}</strong></span>
                    <span>${p.quantidade_vendida} vendidos | ${formatarMoeda(p.receita_total)}</span>
                </div>
            `).join('');
        }
    } catch (err) {
        mostrarToast(err.message, true);
    }
}

// ==================== ABAS ====================
window.mudarAba = function(id, el) {
    document.querySelectorAll('.aba-conteudo').forEach(a => a.classList.remove('ativa'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('ativo'));
    document.getElementById(`aba-${id}`).classList.add('ativa');
    if (el) el.classList.add('ativo');
};

// ==================== LOGOUT ====================
window.confirmarSair = function() {
    if (confirm('Deseja realmente sair?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('utilizador');
        window.location.href = '/Telas/TelaLogin/tela_login.html';
    }
};

// ==================== PREVIEW DE IMAGEM ====================
window.fotoSelecionada = function(input) {
    const file = input.files[0];
    const preview = document.getElementById('preview-img');
    const placeholder = document.querySelector('.placeholder-foto');
    const zona = document.getElementById('zona-foto');
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
            preview.classList.remove('hidden');
            if (placeholder) placeholder.style.display = 'none';
            if (zona) zona.classList.add('tem-foto');
        };
        reader.readAsDataURL(file);
    } else {
        preview.classList.add('hidden');
        if (placeholder) placeholder.style.display = 'block';
        if (zona) zona.classList.remove('tem-foto');
    }
};

window.dragOver = function(e) { e.preventDefault(); };
window.dragLeave = function(e) { e.preventDefault(); };
window.drop = function(e) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    const input = document.getElementById('input-foto');
    if (file && input) {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        fotoSelecionada(input);
    }
};

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', () => {
    carregarCategorias();
    carregarProdutos();

    const inputFoto = document.getElementById('input-foto');
    if (inputFoto) {
        inputFoto.addEventListener('change', () => fotoSelecionada(inputFoto));
    }

    const observer = new MutationObserver(() => {
        const abaRelatorios = document.getElementById('aba-relatorios');
        if (abaRelatorios && abaRelatorios.classList.contains('ativa')) {
            carregarRelatorio();
            observer.disconnect();
        }
    });
    observer.observe(document.getElementById('aba-relatorios'), { attributes: true, attributeFilter: ['class'] });
});