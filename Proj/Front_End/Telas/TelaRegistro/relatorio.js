// relatorio.js - Versão Final Corrigida
// Local: Front_End/Telas/TelaRegistro/relatorio.js

// ==================== CONFIGURAÇÃO ====================
const API_URL = `${window.location.protocol}//${window.location.hostname}:3000/api`;
const token = localStorage.getItem('token');

// ==================== TOAST ====================
function mostrarToast(mensagem, erro = false) {
    let toast = document.getElementById('toast-relatorio');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-relatorio';
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
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

if (!token) {
    mostrarToast('Faça login primeiro!', true);
    setTimeout(() => {
        window.location.href = '../TelaLogin/tela_login.html';
    }, 2000);
}

// ==================== CARREGAR RELATÓRIO ====================
async function carregarRelatorio() {
    const dataInicio = document.getElementById('dataInicio')?.value || '';
    const dataFim = document.getElementById('dataFim')?.value || '';
    
    let url = `${API_URL}/pedidos/admin/relatorio?`;
    if (dataInicio) url += `data_inicio=${dataInicio}&`;
    if (dataFim) url += `data_fim=${dataFim}&`;
    
    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                mostrarToast('Sessão expirada. Faça login novamente.', true);
                setTimeout(() => {
                    window.location.href = '../TelaLogin/tela_login.html';
                }, 2000);
                return;
            }
            if (response.status === 403) {
                mostrarToast('Acesso negado. Apenas administradores.', true);
                return;
            }
            throw new Error('Erro ao carregar relatório');
        }
        
        const data = await response.json();
        
        // Atualizar resumo
        const totalVendasEl = document.getElementById('totalVendas');
        const faturacaoTotalEl = document.getElementById('faturacaoTotal');
        const totalClientesEl = document.getElementById('totalClientes');
        
        if (totalVendasEl) totalVendasEl.textContent = data.resumo?.total_pedidos || 0;
        if (faturacaoTotalEl) faturacaoTotalEl.textContent = formatarMoeda(data.resumo?.faturacao_total || 0);
        if (totalClientesEl) totalClientesEl.textContent = data.resumo?.total_clientes || 0;
        
        // Preencher tabela de pedidos
        const tbody = document.getElementById('tabelaBody');
        if (!data.pedidos || !data.pedidos.length) {
            tbody.innerHTML = '<td><td colspan="5" class="text-center text-muted">Nenhum pedido encontrado</td></tr>';
        } else {
            tbody.innerHTML = data.pedidos.map(p => `
                <tr>
                    <td>#${p.pedido_id || p.id}</td>
                    <td>${new Date(p.criado_em).toLocaleDateString('pt-PT')}</td>
                    <td>${escapeHtml(p.username || 'Anónimo')}</td>
                    <td>${formatarMoeda(p.total)}</td>
                    <td><span style="color: ${getEstadoCor(p.estado)}">${getEstadoTexto(p.estado)}</span></td>
                </tr>
            `).join('');
        }
        
        // Preencher top produtos (com o campo correto: quantidade_vendida)
        const topDiv = document.getElementById('topProdutos');
        if (!data.top_produtos || !data.top_produtos.length) {
            topDiv.innerHTML = '<p class="text-muted">Nenhum produto vendido ainda.</p>';
        } else {
            topDiv.innerHTML = data.top_produtos.map(p => `
                <div class="produto-item">
                    <span><strong>${escapeHtml(p.nome)}</strong></span>
                    <span>${p.quantidade_vendida} vendidos | ${formatarMoeda(p.receita_total)}</span>
                </div>
            `).join('');
        }
        
    } catch (err) {
        console.error('Erro:', err);
        mostrarToast(err.message || 'Erro ao carregar relatório', true);
        const tbody = document.getElementById('tabelaBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Erro ao carregar dados</td></tr>';
        }
    }
}

function getEstadoCor(estado) {
    const cores = {
        'pendente': '#eab308',
        'pago': '#22c55e',
        'processando': '#3b82f6',
        'enviado': '#8b5cf6',
        'entregue': '#10b981',
        'cancelado': '#ef4444'
    };
    return cores[estado] || '#6b7280';
}

function getEstadoTexto(estado) {
    const textos = {
        'pendente': '⏳ Pendente',
        'pago': '💰 Pago',
        'processando': '⚙️ Processando',
        'enviado': '📦 Enviado',
        'entregue': '✅ Entregue',
        'cancelado': '❌ Cancelado'
    };
    return textos[estado] || estado;
}

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'MZN',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(valor);
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Carregar relatório ao iniciar
if (token) {
    carregarRelatorio();
}