// ==================== CONFIGURAÇÃO ====================
const API = `${window.location.protocol}//${window.location.hostname}:3000/api`;

// ==================== TOAST SYSTEM ====================
function mostrarToast(mensagem, tipo = 'info', duracao = 3000) {
    // Verificar se já existe container de toast
    let container = document.querySelector('.toast-container-recibo');
    
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container-recibo';
        container.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast-recibo toast-recibo-${tipo}`;
    toast.style.cssText = `
        background: rgba(20, 24, 30, 0.95);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 12px;
        padding: 12px 20px;
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 280px;
        animation: slideInRight 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        color: white;
    `;
    
    let iconeHtml = '';
    switch(tipo) {
        case 'sucesso':
            toast.style.borderLeft = '4px solid #22c55e';
            iconeHtml = '<i class="bx bx-check-circle" style="font-size: 20px; color: #22c55e;"></i>';
            break;
        case 'erro':
            toast.style.borderLeft = '4px solid #ef4444';
            iconeHtml = '<i class="bx bx-x-circle" style="font-size: 20px; color: #ef4444;"></i>';
            break;
        default:
            toast.style.borderLeft = '4px solid #3b82f6';
            iconeHtml = '<i class="bx bx-info-circle" style="font-size: 20px; color: #3b82f6;"></i>';
    }
    
    toast.innerHTML = `
        <div class="toast-icon">${iconeHtml}</div>
        <div class="toast-mensagem" style="flex: 1; font-size: 14px;">${mensagem}</div>
        <button class="toast-fechar" style="background: none; border: none; color: #6b7280; cursor: pointer; font-size: 18px;" onclick="this.parentElement.remove()">✕</button>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        if (toast && toast.parentElement) {
            toast.style.animation = 'fadeOutRight 0.2s forwards';
            setTimeout(() => toast.remove(), 200);
        }
    }, duracao);
}

// Adicionar estilos dinâmicos para toast
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes fadeOutRight {
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// ==================== SKELETON LOADING ====================
function mostrarSkeleton(mostrar) {
    const skeleton = document.getElementById('skeletonLoading');
    const conteudo = document.getElementById('conteudoRecibo');
    const btnImprimir = document.getElementById('btnImprimir');
    
    if (skeleton && conteudo) {
        if (mostrar) {
            skeleton.style.display = 'block';
            conteudo.style.display = 'none';
            if (btnImprimir) btnImprimir.disabled = true;
        } else {
            skeleton.style.display = 'none';
            conteudo.style.display = 'block';
            if (btnImprimir) btnImprimir.disabled = false;
        }
    }
}

// ==================== LOADING STATE NOS BOTÕES ====================
function mostrarLoadingBotao(mostrar) {
    const btn = document.getElementById('btnImprimir');
    if (btn) {
        if (mostrar) {
            btn.classList.add('loading');
            btn.disabled = true;
        } else {
            btn.classList.remove('loading');
            btn.disabled = false;
        }
    }
}

// ==================== VALIDAÇÃO DE TOKEN ====================
function isTokenValido(token) {
    if (!token) return false;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const expiracao = payload.exp * 1000;
        return Date.now() < expiracao;
    } catch {
        return false;
    }
}

// ==================== MAIN ====================
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    
    // Verificar token
    if (!token || !isTokenValido(token)) {
        mostrarToast('Sessão expirada. Faça login novamente.', 'erro');
        setTimeout(() => {
            window.location.href = '../TelaLogin/tela_login.html';
        }, 2000);
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const pedidoId = urlParams.get('id');
    
    if (!pedidoId) {
        mostrarSkeleton(false);
        document.getElementById('idPedido').textContent = 'ID não informado';
        document.getElementById('listaProdutos').innerHTML = '<div class="produto-item" style="color: #ef4444;"><span>❌ Nenhum pedido especificado</span></div>';
        mostrarToast('Nenhum pedido especificado na URL', 'erro');
        return;
    }

    await carregarPedido(pedidoId);
});

// ==================== CARREGAR PEDIDO ====================
async function carregarPedido(pedidoId) {
    mostrarSkeleton(true);
    
    try {
        const token = localStorage.getItem('token');
        let utilizador = JSON.parse(localStorage.getItem('utilizador') || '{}');
        
        // Se não tiver utilizador no localStorage ou faltar email, buscar do backend
        if (!utilizador.id || !utilizador.email) {
            try {
                const userResponse = await fetch(`${API}/auth/perfil`, {
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (userResponse.ok) {
                    const userData = await userResponse.json();
                    utilizador = userData.utilizador || userData;
                    localStorage.setItem('utilizador', JSON.stringify(utilizador));
                }
            } catch (err) {
                console.warn('Não foi possível buscar dados do utilizador:', err);
            }
        }
        
        // Buscar pedido
        const response = await fetch(`${API}/pedidos/${pedidoId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Pedido não encontrado');
            } else if (response.status === 401) {
                throw new Error('Sessão expirada. Faça login novamente.');
            } else {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.erro || 'Erro ao carregar pedido');
            }
        }
        
        const data = await response.json();
        preencherRecibo(data, utilizador);
        mostrarToast('Recibo carregado com sucesso!', 'sucesso');
        
    } catch (err) {
        console.error('Erro detalhado:', err);
        mostrarToast(err.message || 'Erro ao carregar o pedido', 'erro');
        
        mostrarSkeleton(false);
        
        // Mostrar erro no conteúdo
        document.getElementById('idPedido').textContent = 'Erro';
        document.getElementById('listaProdutos').innerHTML = `
            <div class="produto-item" style="color: #ef4444; flex-direction: column; gap: 8px;">
                <span><i class='bx bx-error-circle'></i> ${escapeHtml(err.message)}</span>
                <button onclick="window.location.reload()" style="background: var(--azul); color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; margin-top: 8px;">
                    <i class='bx bx-refresh'></i> Tentar novamente
                </button>
            </div>
        `;
        
        // Limpar outros campos
        document.getElementById('idFatura').textContent = '---';
        document.getElementById('dataPedido').textContent = '---';
        document.getElementById('clienteNome').textContent = '---';
        document.getElementById('clienteEmail').textContent = '---';
        document.getElementById('totalCompra').textContent = formatarMoeda(0);
    } finally {
        mostrarLoadingBotao(false);
    }
}

// ==================== PREENCHER RECIBO ====================
function preencherRecibo(pedido, utilizador) {
    // Extrair dados do pedido (suporta diferentes estruturas de resposta)
    const idPedido = pedido.pedido?.id || pedido.id;
    const dataPedido = pedido.pedido?.criado_em || pedido.criado_em || new Date().toISOString();
    const total = pedido.pedido?.total || pedido.total || 0;
    const itens = pedido.itens || [];
    
    // Preencher ID do pedido
    document.getElementById('idPedido').textContent = idPedido || '----';
    
    // Gerar número da fatura formatado
    const numeroFatura = 'FAT-' + String(idPedido).padStart(6, '0');
    document.getElementById('idFatura').textContent = numeroFatura;
    
    // Formatar data de forma legível
    let dataFormatada = '---';
    try {
        dataFormatada = new Date(dataPedido).toLocaleString('pt-PT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        console.warn('Erro ao formatar data:', e);
    }
    document.getElementById('dataPedido').textContent = dataFormatada;
    
    // Preencher dados do cliente
    const nomeCliente = utilizador.username || utilizador.nome || 'Cliente';
    const emailCliente = utilizador.email || '---';
    document.getElementById('clienteNome').textContent = nomeCliente;
    document.getElementById('clienteEmail').textContent = emailCliente;
    
    // Preencher lista de produtos
    const listaContainer = document.getElementById('listaProdutos');
    listaContainer.innerHTML = '';
    
    if (!itens || itens.length === 0) {
        listaContainer.innerHTML = '<div class="produto-item">Nenhum item encontrado neste pedido</div>';
    } else {
        itens.forEach((item, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'produto-item';
            if (index === itens.length - 1) {
                itemDiv.style.borderBottom = 'none';
            }
            
            const nome = item.nome || item.produto_nome || 'Produto';
            const quantidade = item.quantidade || 1;
            const precoUnit = item.preco_unit || item.preco || 0;
            const subtotal = precoUnit * quantidade;
            
            itemDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
                    <div>
                        <span class="produto-nome">${escapeHtml(nome)}</span>
                        <span style="font-size: 0.75rem; color: var(--muted, #6b7280); margin-left: 8px;">x${quantidade}</span>
                    </div>
                    <span class="produto-preco">${formatarMoeda(subtotal)}</span>
                </div>
            `;
            listaContainer.appendChild(itemDiv);
        });
    }
    
    // Preencher total
    document.getElementById('totalCompra').textContent = formatarMoeda(total);
    
    // Esconder skeleton e mostrar conteúdo
    mostrarSkeleton(false);
}

// ==================== UTILITÁRIOS ====================
function formatarMoeda(valor) {
    const num = typeof valor === 'number' ? valor : parseFloat(valor);
    if (isNaN(num)) return '0,00 MZN';
    
    return new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'MZN',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/`/g, '&#96;');
}

// ==================== EXPORT (para debug) ====================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { formatarMoeda, escapeHtml, mostrarToast };
}