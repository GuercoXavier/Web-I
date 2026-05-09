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
    preencherDadosPerfil();
    atualizarStats();
    carregarAvatarSalvo();
});

function getAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
    };
}

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

async function carregarPedidos() {
    try {
        const response = await fetch(`${API}/pedidos`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Erro ao carregar pedidos');
        }
        
        pedidosUsuario = await response.json();
        renderizarPedidos();
        
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
                <div class="icone">📦</div>
                <p>Nenhum pedido ainda.</p>
                <button class="btn-ir-comprar" onclick="irPara('produtos')">
                    Ir às Compras
                </button>
            </div>
        `;
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
                    <div class="pedido-status ${statusClasse}">
                        ${statusTexto}
                    </div>
                </div>
                <div class="pedido-body">
                    <div class="pedido-total">
                        <span>Total:</span>
                        <strong>${formatarMoeda(pedido.total)}</strong>
                    </div>
                </div>
                <div class="pedido-footer">
                    <button class="btn-detalhe" onclick="event.stopPropagation(); verDetalhePedido(${pedido.id})">
                        Ver Detalhes →
                    </button>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

function getStatusClasse(estado) {
    const estados = {
        'pendente': 'status-pendente',
        'pago': 'status-pago',
        'enviado': 'status-enviado',
        'entregue': 'status-entregue',
        'cancelado': 'status-cancelado'
    };
    return estados[estado] || 'status-pendente';
}

function getStatusTexto(estado) {
    const textos = {
        'pendente': 'Pendente',
        'pago': 'Pago',
        'enviado': 'Enviado',
        'entregue': 'Entregue',
        'cancelado': 'Cancelado'
    };
    return textos[estado] || estado;
}

async function verDetalhePedido(pedidoId) {
    try {
        const response = await fetch(`${API}/pedidos/${pedidoId}`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Erro ao carregar detalhes');
        }
        
        const data = await response.json();
        mostrarModalDetalhe(data);
        
    } catch (err) {
        console.error('Erro:', err);
        mostrarToast('Erro ao carregar detalhes do pedido');
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
                <div class="modal-item-nome">${item.nome || 'Produto'}</div>
                <div class="modal-item-qtd">x${quantidade}</div>
                <div class="modal-item-preco">${formatarMoeda(precoUnit)}</div>
                <div class="modal-item-subtotal">${formatarMoeda(subtotal)}</div>
            </div>
        `;
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
                    <div class="modal-info-linha">
                        <span>Data:</span>
                        <strong>${new Date(pedidoInfo.criado_em).toLocaleString('pt-PT')}</strong>
                    </div>
                    <div class="modal-info-linha">
                        <span>Estado:</span>
                        <strong class="${getStatusClasse(pedidoInfo.estado)}">${getStatusTexto(pedidoInfo.estado)}</strong>
                    </div>
                </div>
                
                <div class="modal-itens-header">
                    <div>Produto</div>
                    <div>Qtd</div>
                    <div>Preço Unit</div>
                    <div>Subtotal</div>
                </div>
                <div class="modal-itens">
                    ${itensHtml}
                </div>
                
                <div class="modal-total">
                    <span>Total do Pedido:</span>
                    <strong>${formatarMoeda(pedidoInfo.total)}</strong>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-modal-fechar" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
                <button class="btn-modal-imprimir" onclick="window.print()">Imprimir Recibo</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

async function atualizarStats() {
    try {
        const response = await fetch(`${API}/pedidos`, {
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            const pedidos = await response.json();
            const totalPedidos = pedidos.length;
            
            const statPedidos = document.getElementById('stat-pedidos');
            if (statPedidos) statPedidos.textContent = totalPedidos;
        }
        
        const creditosSalvos = localStorage.getItem('creditos');
        const creditos = creditosSalvos ? parseInt(creditosSalvos) : 0;
        
        const statCreditos = document.getElementById('stat-creditos');
        if (statCreditos) statCreditos.textContent = creditos;
        
    } catch (err) {
        console.error('Erro ao atualizar stats:', err);
    }
}

function adicionarCredito() {
    const input = document.getElementById('inp-credito');
    const valor = parseInt(input.value);
    
    if (!valor || valor <= 0) {
        input.style.borderColor = 'var(--vermelho)';
        setTimeout(() => {
            input.style.borderColor = '';
        }, 1500);
        mostrarToast('Valor inválido');
        return;
    }
    
    const statCreditos = document.getElementById('stat-creditos');
    const creditosAtuais = parseInt(statCreditos.textContent) || 0;
    const novoTotal = creditosAtuais + valor;
    
    statCreditos.textContent = novoTotal;
    localStorage.setItem('creditos', novoTotal);
    
    input.value = '';
    mostrarToast(`${formatarMoeda(valor)} adicionado com sucesso`);
}

function preencherDadosPerfil() {
    const nomeSpan = document.getElementById('sidebar-nome');
    const avatarDiv = document.getElementById('avatarVisual');
    
    if (utilizadorAtual) {
        const nome = utilizadorAtual.username || 'Utilizador';
        if (nomeSpan) nomeSpan.textContent = nome;
        
        const inicial = nome.charAt(0).toUpperCase();
        if (avatarDiv) {
            avatarDiv.innerHTML = inicial;
            avatarDiv.style.display = 'flex';
            avatarDiv.style.alignItems = 'center';
            avatarDiv.style.justifyContent = 'center';
            avatarDiv.style.fontSize = '2rem';
            avatarDiv.style.fontWeight = 'bold';
            avatarDiv.style.color = 'white';
            avatarDiv.style.backgroundColor = 'var(--azul)';
        }
    }
}

function trocarAvatar(input) {
    const file = input.files[0];
    if (!file) return;
    
    const leitor = new FileReader();
    leitor.onload = function(e) {
        const avatarDiv = document.getElementById('avatarVisual');
        if (avatarDiv) {
            avatarDiv.innerHTML = `<img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        }
        localStorage.setItem('avatar', e.target.result);
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
    document.querySelectorAll('.secao').forEach(secao => {
        secao.classList.remove('ativa');
    });
    document.getElementById(id).classList.add('ativa');
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('ativo');
    });
    elemento.classList.add('ativo');
}

function mostrarToast(msg) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = '✓ ' + msg;
        toast.classList.add('visivel');
        setTimeout(() => {
            toast.classList.remove('visivel');
        }, 2400);
    }
}

function confirmarSair() {
    if (confirm('Tem certeza que deseja sair?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('utilizador');
        window.location.href = '../TelaLogin/tela_login.html';
    }
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
    return new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'MZN'
    }).format(valor);
}