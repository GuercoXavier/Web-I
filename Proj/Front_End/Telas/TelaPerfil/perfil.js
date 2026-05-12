const API = 'http://localhost:3000/api';

let utilizadorAtual = null;
let pedidosUsuario = [];

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '../TelaLogin/tela_login.html';
        return;
    }
    await carregarUtilizador();
    await carregarPedidos();
    await carregarCreditos();
    preencherDadosPerfil();
    carregarAvatarSalvo();
});

function getAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
    };
}

// ==================== TOAST MELHORADO ====================
function mostrarToast(mensagem, tipo = 'info', duracao = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo === 'sucesso' ? 'sucesso' : (tipo === 'erro' ? 'erro' : 'info')}`;
    let icone = tipo === 'sucesso' ? '<img src="../../imagens/icon/check-circle-fill.svg">' : (tipo === 'erro' ? '<img src="../../imagens/icon/x-circle-fill.svg">' : '<img src="../../imagens/icon/info-circle-fill.svg">');
    toast.innerHTML = `
        <div class="toast-icon">${icone}</div>
        <div class="toast-mensagem">${mensagem}</div>
        <button class="toast-fechar" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        if (toast && toast.parentElement) {
            toast.style.animation = 'fadeOutRight 0.2s forwards';
            setTimeout(() => toast.remove(), 200);
        }
    }, duracao);
}

// ==================== CONFIRMAÇÃO PERSONALIZADA ====================
function mostrarConfirmacao(mensagem, aoConfirmar, aoCancelar) {
    const modal = document.getElementById('modalConfirmacao');
    const msgSpan = document.getElementById('confirmacaoMensagem');
    const btnSim = document.getElementById('btnConfirmarSim');
    const btnNao = document.getElementById('btnConfirmarNao');

    if (!modal) {
        // fallback para confirm nativo caso o modal não exista
        if (confirm(mensagem)) {
            if (aoConfirmar) aoConfirmar();
        } else {
            if (aoCancelar) aoCancelar();
        }
        return;
    }

    msgSpan.textContent = mensagem;
    modal.classList.add('aberto');

    // Remove listeners antigos clonando botões
    const novoSim = btnSim.cloneNode(true);
    const novoNao = btnNao.cloneNode(true);
    btnSim.parentNode.replaceChild(novoSim, btnSim);
    btnNao.parentNode.replaceChild(novoNao, btnNao);

    novoSim.addEventListener('click', () => {
        modal.classList.remove('aberto');
        if (aoConfirmar) aoConfirmar();
    });
    novoNao.addEventListener('click', () => {
        modal.classList.remove('aberto');
        if (aoCancelar) aoCancelar();
    });
    // Fechar ao clicar fora
    modal.addEventListener('click', function fecharFora(e) {
        if (e.target === modal) {
            modal.classList.remove('aberto');
            if (aoCancelar) aoCancelar();
            modal.removeEventListener('click', fecharFora);
        }
    });
}

// ==================== FUNÇÕES EXISTENTES (adaptadas) ====================
async function carregarUtilizador() {
    try {
        const usuarioSalvo = localStorage.getItem('utilizador');
        if (usuarioSalvo) {
            utilizadorAtual = JSON.parse(usuarioSalvo);
        } else {
            const token = localStorage.getItem('token');
            const payload = JSON.parse(atob(token.split('.')[1]));
            utilizadorAtual = {
                id: payload.id,
                username: payload.username,
                role: payload.role
            };
        }
    } catch (err) {
        console.error('Erro ao carregar utilizador:', err);
    }
}

async function carregarCreditos() {
    try {
        const response = await fetch(`${API}/auth/creditos`, { headers: getAuthHeaders() });
        if (response.ok) {
            const data = await response.json();
            const statCreditos = document.getElementById('stat-creditos');
            if (statCreditos) statCreditos.textContent = data.creditos || 0;
        }
    } catch (err) {
        console.error('Erro ao carregar créditos:', err);
    }
}

async function carregarPedidos() {
    try {
        const response = await fetch(`${API}/pedidos`, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('Erro ao carregar pedidos');
        pedidosUsuario = await response.json();
        renderizarPedidos();
        const statPedidos = document.getElementById('stat-pedidos');
        if (statPedidos) statPedidos.textContent = pedidosUsuario.length;
    } catch (err) {
        console.error('Erro:', err);
        pedidosUsuario = [];
        renderizarPedidos();
    }
}

function renderizarPedidos() {
    const container = document.querySelector('.lista-pedidos');
    if (!container) return;
    if (!pedidosUsuario || pedidosUsuario.length === 0) {
         container.innerHTML = `
            <div class="estado-vazio-pedidos">
                <div class="icone">
                    <img src="../../imagens/icon/box-seam-fill.svg" style="width:70px; height:70px;" />
                </div>
                <p>Nenhum pedido!</p>
                <button class="btn-ir-comprar" onclick="irPara('produtos')">Fazer Compras</button>
            </div>`;
        return;
    }
    let html = '';
    for (const pedido of pedidosUsuario) {
        const dataPedido = new Date(pedido.criado_em).toLocaleDateString('pt-PT');
        const statusClasse = getStatusClasse(pedido.estado);
        const statusTexto = getStatusTexto(pedido.estado);
        html += `
            <div class="pedido-card" onclick="verDetalhePedido(${pedido.id})">
                <div class="pedido-header">
                    <div class="pedido-info">
                        <span class="pedido-id">Pedido #${pedido.id}</span>
                        <span class="pedido-data">${dataPedido}</span>
                    </div>
                    <div class="pedido-status ${statusClasse}">${statusTexto}</div>
                </div>
                <div class="pedido-body">
                    <div class="pedido-total"><span>Total:</span> <strong>${formatarMoeda(pedido.total)}</strong></div>
                </div>
                <div class="pedido-footer">
                    <button class="btn-detalhe" onclick="event.stopPropagation(); verDetalhePedido(${pedido.id})">Ver Detalhes →</button>
                </div>
            </div>`;
    }
    container.innerHTML = html;
}

function getStatusClasse(estado) {
    const estados = { 'pendente': 'status-pendente', 'pago': 'status-pago', 'enviado': 'status-enviado', 'entregue': 'status-entregue', 'cancelado': 'status-cancelado' };
    return estados[estado] || 'status-pendente';
}
function getStatusTexto(estado) {
    const textos = { 'pendente': 'Pendente', 'pago': 'Pago', 'enviado': 'Enviado', 'entregue': 'Entregue', 'cancelado': 'Cancelado' };
    return textos[estado] || estado;
}

async function verDetalhePedido(pedidoId) {
    try {
        const response = await fetch(`${API}/pedidos/${pedidoId}`, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('Erro ao carregar detalhes');
        const data = await response.json();
        mostrarModalDetalhe(data);
    } catch (err) {
        console.error('Erro:', err);
        mostrarToast('Erro ao carregar detalhes do pedido', 'erro');
    }
}

function mostrarModalDetalhe(pedido) {
    const pedidoInfo = pedido.pedido || pedido;
    const itens = pedido.itens || [];
    let itensHtml = '';
    for (const item of itens) {
        const precoUnit = item.preco_unit || item.preco || 0;
        const quantidade = item.quantidade || 1;
        const subtotal = precoUnit * quantidade;
        itensHtml += `
            <div class="modal-item">
                <div class="modal-item-nome">${escapeHtml(item.nome || 'Produto')}</div>
                <div class="modal-item-qtd">x${quantidade}</div>
                <div class="modal-item-preco">${formatarMoeda(precoUnit)}</div>
                <div class="modal-item-subtotal">${formatarMoeda(subtotal)}</div>
            </div>`;
    }
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-container">
            <div class="modal-header">
                <h2>Pedido #${pedidoInfo.id}</h2>
                <button class="modal-fechar" onclick="this.closest('.modal-overlay').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="modal-info">
                    <div class="modal-info-linha"><span>Data:</span> <strong>${new Date(pedidoInfo.criado_em).toLocaleString('pt-PT')}</strong></div>
                    <div class="modal-info-linha"><span>Estado:</span> <strong class="${getStatusClasse(pedidoInfo.estado)}">${getStatusTexto(pedidoInfo.estado)}</strong></div>
                </div>
                <div class="modal-itens-header"><div>Produto</div><div>Qtd</div><div>Preço Unit</div><div>Subtotal</div></div>
                <div class="modal-itens">${itensHtml}</div>
                <div class="modal-total"><span>Total do Pedido:</span> <strong>${formatarMoeda(pedidoInfo.total)}</strong></div>
            </div>
            <div class="modal-footer">
                <button class="btn-modal-fechar" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
                <button class="btn-modal-imprimir" onclick="imprimirRecibo(${pedidoInfo.id})">Imprimir Recibo</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function imprimirRecibo(pedidoId) {
    window.open(`../TelaRecibo/Recibo.html?id=${pedidoId}`, '_blank');
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : (m === '<' ? '&lt;' : '&gt;'));
}

async function adicionarCredito() {
    const input = document.getElementById('inp-credito');
    const btn = document.querySelector('.btn-adicionar-credito');
    const valor = parseInt(input.value);
    if (!valor || valor <= 0) {
        mostrarToast('Valor inválido', 'erro');
        return;
    }
    // Loading no botão
    const textoOriginal = btn.textContent;
    btn.textContent = '⏳ Adicionando...';
    btn.disabled = true;
    try {
        const response = await fetch(`${API}/auth/creditos/adicionar`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ valor, descricao: 'Adicionado pelo perfil' })
        });
        if (!response.ok) {
            const erro = await response.json();
            throw new Error(erro.erro || 'Erro ao adicionar créditos');
        }
        await carregarCreditos();
        input.value = '';
        mostrarToast(`${formatarMoeda(valor)} adicionado com sucesso!`, 'sucesso');
    } catch (err) {
        console.error('Erro:', err);
        mostrarToast(err.message || 'Erro ao adicionar créditos', 'erro');
    } finally {
        btn.textContent = textoOriginal;
        btn.disabled = false;
    }
}

function preencherDadosPerfil() {
    const nomeSpan = document.getElementById('sidebar-nome');
    const avatarDiv = document.getElementById('avatarVisual');
    
    if (utilizadorAtual) {
        const nome = utilizadorAtual.username || 'Utilizador';
        if (nomeSpan) nomeSpan.textContent = nome;
        
        const avatarSalvo = localStorage.getItem('avatar');
        

        if (avatarSalvo) {
            avatarDiv.innerHTML = `<img src="${avatarSalvo}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
            return;
        }

        const imagemExistente = avatarDiv.querySelector('img');
        
        if (!imagemExistente) {
            // Se nao tiver imagem vai continuar com o placeholder original (imagem SVG)
        }
    }
}

function trocarAvatar(input) {
    const file = input.files[0];
    if (!file) return;
    const leitor = new FileReader();
    leitor.onload = function (e) {
        const avatarDiv = document.getElementById('avatarVisual');
        if (avatarDiv) {
            avatarDiv.innerHTML = `<img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        }
        localStorage.setItem('avatar', e.target.result);
        mostrarToast('Avatar atualizado!', 'sucesso');
    };
    leitor.readAsDataURL(file);
}

function carregarAvatarSalvo() {
    const avatarSalvo = localStorage.getItem('avatar');
    if (avatarSalvo) {
        const avatarDiv = document.getElementById('avatarVisual');
        if (avatarDiv) {
            avatarDiv.innerHTML = `<img src="${avatarSalvo}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        }
    }
}

function mostrarSecao(id, elemento) {
    document.querySelectorAll('.secao').forEach(secao => secao.classList.remove('ativa'));
    document.getElementById(id).classList.add('ativa');
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('ativo'));
    elemento.classList.add('ativo');
}

// ==================== CONFIRMAÇÃO DE SAÍDA (substitui o confirm nativo) ====================
function confirmarSair() {
    mostrarConfirmacao(
        'Tem certeza que deseja sair?',
        () => {
            localStorage.removeItem('token');
            localStorage.removeItem('utilizador');
            localStorage.removeItem('avatar');
            localStorage.removeItem('creditos');
            window.location.href = '../TelaLogin/tela_login.html';
        },
        () => {
            mostrarToast('Operação cancelada', 'info');
        }
    );
}

function irPara(pagina) {
    const rotas = {
        'home': '../TelaPrincipal/index.html',
        'produtos': '../TelaPrincipal/index.html',
        'perfil': 'perfil.html'
    };
    window.location.href = rotas[pagina] || '../TelaPrincipal/index.html';
}

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'MZN' }).format(valor);
}