const API_URL = 'http://localhost:3000/api';
const token = localStorage.getItem('token');

if (!token) {
    alert('Faça login primeiro!');
    window.location.href = '../TelaLogin/tela_login.html';
}

async function carregarRelatorio() {
    const dataInicio = document.getElementById('dataInicio').value;
    const dataFim = document.getElementById('dataFim').value;

    let url = `${API_URL}/pedidos/admin/relatorio?`;
    if (dataInicio) url += `&data_inicio=${dataInicio}`;
    if (dataFim) url += `&data_fim=${dataFim}`;

    try {
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        // Resumo
        document.getElementById('totalVendas').textContent = data.resumo?.total_vendas || 0;
        document.getElementById('faturacaoTotal').textContent = formatarMoeda(data.resumo?.faturacao_total || 0);
        document.getElementById('totalClientes').textContent = data.resumo?.total_clientes || 0;

        // Tabela de pedidos
        const tbody = document.getElementById('tabelaBody');
        if (!data.pedidos || !data.pedidos.length) {
            tbody.innerHTML = '<tr><td colspan="5">Nenhum pedido encontrado</td></tr>';
        } else {
            tbody.innerHTML = data.pedidos.map(p => `
                        <tr>
                            <td>#${p.pedido_id}</td>
                            <td>${new Date(p.criado_em).toLocaleDateString('pt-PT')}</td>
                            <td>${p.username || 'Anónimo'}</td>
                            <td>${formatarMoeda(p.total)}</td>
                            <td><span style="color:${p.estado === 'pendente' ? '#eab308' : '#22c55e'}">${p.estado}</span></td>
                        </tr>
                    `).join('');
        }

        // Top produtos
        const topDiv = document.getElementById('topProdutos');
        if (!data.top_produtos || !data.top_produtos.length) {
            topDiv.innerHTML = '<p>Nenhum produto vendido ainda.</p>';
        } else {
            topDiv.innerHTML = data.top_produtos.map(p => `
                        <div class="produto-item">
                            <span>${p.nome}</span>
                            <span><strong>${p.vendidos}</strong> vendidos | ${formatarMoeda(p.receita)}</span>
                        </div>
                    `).join('');
        }

    } catch (err) {
        console.error(err);
        document.getElementById('tabelaBody').innerHTML = '<tr><td colspan="5">Erro ao carregar</td></tr>';
    }
}

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'MZN'
    }).format(valor);
}

carregarRelatorio();



