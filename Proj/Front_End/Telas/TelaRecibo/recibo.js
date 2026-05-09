const API = 'http://localhost:3000/api';

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    
    if (!token) {
        alert('Faça login primeiro');
        window.location.href = '../TelaLogin/tela_login.html';
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const pedidoId = urlParams.get('id');
    
    if (!pedidoId) {
        document.getElementById('idPedido').textContent = 'ID nao informado';
        document.getElementById('listaProdutos').innerHTML = '<div class="produto-item">Erro: Nenhum pedido especificado</div>';
        return;
    }

    await carregarPedido(pedidoId);
});

async function carregarPedido(pedidoId) {
    try {
        const token = localStorage.getItem('token');
        const utilizador = JSON.parse(localStorage.getItem('utilizador') || '{}');
        
        const response = await fetch(`${API}/pedidos/${pedidoId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Pedido nao encontrado');
        }
        
        const data = await response.json();
        preencherRecibo(data, utilizador);
        
    } catch (err) {
        console.error('Erro:', err);
        document.getElementById('idPedido').textContent = 'Erro ao carregar';
        document.getElementById('listaProdutos').innerHTML = `<div class="produto-item">Erro: ${err.message}</div>`;
    }
}

function preencherRecibo(pedido, utilizador) {
    const idPedido = pedido.pedido?.id || pedido.id;
    const dataPedido = pedido.pedido?.criado_em || pedido.criado_em || new Date().toISOString();
    const total = pedido.pedido?.total || pedido.total || 0;
    const itens = pedido.itens || [];
    
    document.getElementById('idPedido').textContent = idPedido || '----';
    
    const numeroFatura = 'FAT-' + String(idPedido).padStart(6, '0');
    document.getElementById('idFatura').textContent = numeroFatura;
    
    const dataFormatada = new Date(dataPedido).toLocaleString('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    document.getElementById('dataPedido').textContent = dataFormatada;
    
    document.getElementById('clienteNome').textContent = utilizador.username || 'Cliente';
    document.getElementById('clienteEmail').textContent = utilizador.email || '----';
    
    const listaContainer = document.getElementById('listaProdutos');
    listaContainer.innerHTML = '';
    
    if (itens.length === 0) {
        listaContainer.innerHTML = '<div class="produto-item">Nenhum item encontrado</div>';
    } else {
        itens.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'produto-item';
            
            const nome = item.nome || 'Produto';
            const quantidade = item.quantidade || 1;
            const precoUnit = item.preco_unit || item.preco || 0;
            const subtotal = precoUnit * quantidade;
            
            itemDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; width: 100%;">
                    <div>
                        <span class="produto-nome">${nome}</span>
                        <span style="font-size: 0.75rem; color: var(--muted); margin-left: 8px;">x${quantidade}</span>
                    </div>
                    <span class="produto-preco">${formatarMoeda(subtotal)}</span>
                </div>
            `;
            listaContainer.appendChild(itemDiv);
        });
    }
    
    document.getElementById('totalCompra').textContent = formatarMoeda(total);
}

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'MZN'
    }).format(valor);
}