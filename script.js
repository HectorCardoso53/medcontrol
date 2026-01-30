// ===================================
// INICIALIZAÇÃO E CONFIGURAÇÃO
// ===================================

// LocalStorage Keys
const STORAGE_KEYS = {
    ATENDIMENTOS: 'medcontrol_atendimentos',
    MEDICAMENTOS: 'medcontrol_medicamentos',
    SAIDAS: 'medcontrol_saidas'
};

// Configurações Globais
const CONFIG = {
    ESTOQUE_BAIXO: 20,
    DIAS_VENCIMENTO: 90,
    FORMATO_DATA: 'pt-BR'
};

// Estado Global
let state = {
    atendimentos: [],
    medicamentos: [],
    saidas: [],
    charts: {}
};

// ===================================
// FUNÇÕES DE UTILIDADE
// ===================================

// Carrega dados do LocalStorage
function carregarDados() {
    state.atendimentos = JSON.parse(localStorage.getItem(STORAGE_KEYS.ATENDIMENTOS)) || [];
    state.medicamentos = JSON.parse(localStorage.getItem(STORAGE_KEYS.MEDICAMENTOS)) || [];
    state.saidas = JSON.parse(localStorage.getItem(STORAGE_KEYS.SAIDAS)) || [];
}

// Salva dados no LocalStorage
function salvarDados() {
    localStorage.setItem(STORAGE_KEYS.ATENDIMENTOS, JSON.stringify(state.atendimentos));
    localStorage.setItem(STORAGE_KEYS.MEDICAMENTOS, JSON.stringify(state.medicamentos));
    localStorage.setItem(STORAGE_KEYS.SAIDAS, JSON.stringify(state.saidas));
}

// Formata data para exibição
function formatarData(data) {
    if (!data) return '-';
    const d = new Date(data + 'T00:00:00');
    return d.toLocaleDateString(CONFIG.FORMATO_DATA);
}

// Gera ID único
function gerarId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Exibe toast de notificação
function mostrarToast(mensagem, tipo = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = mensagem;
    toast.className = `toast ${tipo}`;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Calcula dias até vencimento
function diasAteVencimento(dataValidade) {
    const hoje = new Date();
    const validade = new Date(dataValidade + 'T00:00:00');
    const diferenca = validade - hoje;
    return Math.ceil(diferenca / (1000 * 60 * 60 * 24));
}

// ===================================
// NAVEGAÇÃO ENTRE SEÇÕES
// ===================================

function inicializarNavegacao() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.section');
    
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetSection = btn.dataset.section;
            
            // Remove active de todos os botões e seções
            navButtons.forEach(b => b.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            
            // Adiciona active ao botão e seção clicados
            btn.classList.add('active');
            document.getElementById(targetSection).classList.add('active');
            
            // Atualiza dados da seção
            atualizarSecao(targetSection);
        });
    });
}

function atualizarSecao(secao) {
    switch(secao) {
        case 'atendimento':
            carregarTabelaAtendimentos();
            carregarSelectMedicamentos();
            break;
        case 'medicamentos':
            carregarTabelaMedicamentos();
            break;
        case 'saidas':
            carregarTabelaSaidas();
            break;
        case 'estoque':
            carregarTabelaEstoque();
            atualizarCardsEstoque();
            break;
        case 'relatorios':
            carregarRelatorios();
            break;
    }
}

// ===================================
// CADASTRO DE ATENDIMENTO
// ===================================

function inicializarFormAtendimento() {
    const form = document.getElementById('formAtendimento');
    const dataInput = document.getElementById('dataAtendimento');
    
    // Define data atual como padrão
    dataInput.value = new Date().toISOString().split('T')[0];
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const medicamentoSelecionado = document.getElementById('medicamentoAtend').value;
        const quantidade = parseInt(document.getElementById('quantidadeEntregue').value);
        
        // Valida quantidade
        if (quantidade <= 0) {
            mostrarToast('Quantidade deve ser maior que zero!', 'error');
            return;
        }
        
        // Verifica se há estoque suficiente
        const estoqueDisponivel = calcularEstoqueMedicamento(medicamentoSelecionado);
        if (estoqueDisponivel < quantidade) {
            mostrarToast(`Estoque insuficiente! Disponível: ${estoqueDisponivel}`, 'error');
            return;
        }
        
        // Cria atendimento
        const atendimento = {
            id: gerarId(),
            data: document.getElementById('dataAtendimento').value,
            nomePaciente: document.getElementById('nomePaciente').value,
            endereco: document.getElementById('endereco').value,
            bairro: document.getElementById('bairro').value,
            contato: document.getElementById('contato').value,
            medicamento: medicamentoSelecionado,
            quantidade: quantidade
        };
        
        // Adiciona atendimento
        state.atendimentos.push(atendimento);
        
        // Registra saída automaticamente
        registrarSaida(atendimento);
        
        // Salva e atualiza
        salvarDados();
        form.reset();
        dataInput.value = new Date().toISOString().split('T')[0];
        carregarTabelaAtendimentos();
        carregarSelectMedicamentos();
        
        mostrarToast('Atendimento registrado com sucesso!', 'success');
    });
}

function registrarSaida(atendimento) {
    // Busca o lote mais antigo do medicamento
    const lotes = state.medicamentos
        .filter(m => m.descricao === atendimento.medicamento)
        .sort((a, b) => new Date(a.dataValidade) - new Date(b.dataValidade));
    
    const lote = lotes.length > 0 ? lotes[0].lote : 'N/A';
    
    const saida = {
        id: gerarId(),
        data: atendimento.data,
        medicamento: atendimento.medicamento,
        lote: lote,
        quantidade: atendimento.quantidade,
        referencia: `${atendimento.nomePaciente} - ${formatarData(atendimento.data)}`
    };
    
    state.saidas.push(saida);
}

function carregarSelectMedicamentos() {
    const select = document.getElementById('medicamentoAtend');
    const medicamentosUnicos = [...new Set(state.medicamentos.map(m => m.descricao))];
    
    select.innerHTML = '<option value="">Selecione um medicamento</option>';
    
    medicamentosUnicos.forEach(med => {
        const estoque = calcularEstoqueMedicamento(med);
        const option = document.createElement('option');
        option.value = med;
        option.textContent = `${med} (Estoque: ${estoque})`;
        if (estoque === 0) {
            option.disabled = true;
            option.textContent += ' - SEM ESTOQUE';
        }
        select.appendChild(option);
    });
}

function carregarTabelaAtendimentos() {
    const tbody = document.getElementById('tabelaAtendimentos');
    tbody.innerHTML = '';
    
    if (state.atendimentos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum atendimento registrado</td></tr>';
        return;
    }
    
    // Ordena por data mais recente
    const atendimentosOrdenados = [...state.atendimentos].sort((a, b) => 
        new Date(b.data) - new Date(a.data)
    );
    
    atendimentosOrdenados.forEach(atend => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatarData(atend.data)}</td>
            <td><strong>${atend.nomePaciente}</strong></td>
            <td>${atend.bairro}</td>
            <td>${atend.medicamento}</td>
            <td>${atend.quantidade}</td>
            <td>
                <button class="btn btn-danger" onclick="excluirAtendimento('${atend.id}')">
                    <span class="icon">🗑️</span> Excluir
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function excluirAtendimento(id) {
    if (confirm('Deseja realmente excluir este atendimento?')) {
        // Remove atendimento
        state.atendimentos = state.atendimentos.filter(a => a.id !== id);
        
        // Remove saída relacionada (pela referência)
        const atendimento = state.atendimentos.find(a => a.id === id);
        if (atendimento) {
            const referencia = `${atendimento.nomePaciente} - ${formatarData(atendimento.data)}`;
            state.saidas = state.saidas.filter(s => s.referencia !== referencia);
        }
        
        salvarDados();
        carregarTabelaAtendimentos();
        mostrarToast('Atendimento excluído com sucesso!', 'success');
    }
}

// ===================================
// CADASTRO DE MEDICAMENTOS
// ===================================

function inicializarFormMedicamentos() {
    const form = document.getElementById('formMedicamentos');
    const dataInput = document.getElementById('dataRecebimento');
    
    // Define data atual como padrão
    dataInput.value = new Date().toISOString().split('T')[0];
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const quantidade = parseInt(document.getElementById('quantidadeRecebida').value);
        
        if (quantidade <= 0) {
            mostrarToast('Quantidade deve ser maior que zero!', 'error');
            return;
        }
        
        const medicamento = {
            id: gerarId(),
            codigo: document.getElementById('codigoMed').value,
            descricao: document.getElementById('descricaoMed').value,
            dataRecebimento: document.getElementById('dataRecebimento').value,
            lote: document.getElementById('lote').value,
            dataValidade: document.getElementById('dataValidade').value,
            quantidade: quantidade
        };
        
        state.medicamentos.push(medicamento);
        salvarDados();
        form.reset();
        dataInput.value = new Date().toISOString().split('T')[0];
        carregarTabelaMedicamentos();
        carregarSelectMedicamentos();
        
        mostrarToast('Medicamento cadastrado com sucesso!', 'success');
    });
}

function carregarTabelaMedicamentos() {
    const tbody = document.getElementById('tabelaMedicamentos');
    tbody.innerHTML = '';
    
    if (state.medicamentos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum medicamento cadastrado</td></tr>';
        return;
    }
    
    // Ordena por data de recebimento mais recente
    const medicamentosOrdenados = [...state.medicamentos].sort((a, b) => 
        new Date(b.dataRecebimento) - new Date(a.dataRecebimento)
    );
    
    medicamentosOrdenados.forEach(med => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><code>${med.codigo}</code></td>
            <td><strong>${med.descricao}</strong></td>
            <td>${med.lote}</td>
            <td>${formatarData(med.dataValidade)}</td>
            <td>${med.quantidade}</td>
            <td>
                <button class="btn btn-danger" onclick="excluirMedicamento('${med.id}')">
                    <span class="icon">🗑️</span> Excluir
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function excluirMedicamento(id) {
    if (confirm('Deseja realmente excluir este medicamento?')) {
        state.medicamentos = state.medicamentos.filter(m => m.id !== id);
        salvarDados();
        carregarTabelaMedicamentos();
        carregarSelectMedicamentos();
        mostrarToast('Medicamento excluído com sucesso!', 'success');
    }
}

// ===================================
// CONTROLE DE SAÍDAS
// ===================================

function carregarTabelaSaidas() {
    const tbody = document.getElementById('tabelaSaidas');
    tbody.innerHTML = '';
    
    if (state.saidas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhuma saída registrada</td></tr>';
        return;
    }
    
    // Ordena por data mais recente
    const saidasOrdenadas = [...state.saidas].sort((a, b) => 
        new Date(b.data) - new Date(a.data)
    );
    
    saidasOrdenadas.forEach(saida => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatarData(saida.data)}</td>
            <td><strong>${saida.medicamento}</strong></td>
            <td>${saida.lote}</td>
            <td>${saida.quantidade}</td>
            <td>${saida.referencia}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ===================================
// ESTOQUE DE MEDICAMENTOS
// ===================================

function calcularEstoqueMedicamento(descricao) {
    const totalRecebido = state.medicamentos
        .filter(m => m.descricao === descricao)
        .reduce((sum, m) => sum + m.quantidade, 0);
    
    const totalDistribuido = state.saidas
        .filter(s => s.medicamento === descricao)
        .reduce((sum, s) => sum + s.quantidade, 0);
    
    return totalRecebido - totalDistribuido;
}

function obterValidadeMaisProxima(descricao) {
    const medicamentos = state.medicamentos
        .filter(m => m.descricao === descricao)
        .sort((a, b) => new Date(a.dataValidade) - new Date(b.dataValidade));
    
    return medicamentos.length > 0 ? medicamentos[0].dataValidade : null;
}

function carregarTabelaEstoque() {
    const tbody = document.getElementById('tabelaEstoque');
    tbody.innerHTML = '';
    
    const medicamentosUnicos = [...new Set(state.medicamentos.map(m => m.descricao))];
    
    if (medicamentosUnicos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum medicamento em estoque</td></tr>';
        return;
    }
    
    medicamentosUnicos.forEach(med => {
        const totalRecebido = state.medicamentos
            .filter(m => m.descricao === med)
            .reduce((sum, m) => sum + m.quantidade, 0);
        
        const totalDistribuido = state.saidas
            .filter(s => s.medicamento === med)
            .reduce((sum, s) => sum + s.quantidade, 0);
        
        const saldo = totalRecebido - totalDistribuido;
        const validadeProxima = obterValidadeMaisProxima(med);
        const diasVencer = validadeProxima ? diasAteVencimento(validadeProxima) : null;
        
        // Define status
        let statusBadge = '';
        if (saldo === 0) {
            statusBadge = '<span class="badge badge-danger">SEM ESTOQUE</span>';
        } else if (saldo < CONFIG.ESTOQUE_BAIXO) {
            statusBadge = '<span class="badge badge-warning">ESTOQUE BAIXO</span>';
        } else if (diasVencer !== null && diasVencer < CONFIG.DIAS_VENCIMENTO) {
            statusBadge = '<span class="badge badge-warning">PRÓX. VENCIMENTO</span>';
        } else {
            statusBadge = '<span class="badge badge-success">OK</span>';
        }
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${med}</strong></td>
            <td>${totalRecebido}</td>
            <td>${totalDistribuido}</td>
            <td><strong>${saldo}</strong></td>
            <td>${formatarData(validadeProxima)}</td>
            <td>${statusBadge}</td>
        `;
        tbody.appendChild(tr);
    });
}

function atualizarCardsEstoque() {
    const medicamentosUnicos = [...new Set(state.medicamentos.map(m => m.descricao))];
    
    let totalEstoque = 0;
    let estoqueBaixo = 0;
    let proximosVencer = 0;
    
    medicamentosUnicos.forEach(med => {
        const saldo = calcularEstoqueMedicamento(med);
        totalEstoque += saldo;
        
        if (saldo > 0 && saldo < CONFIG.ESTOQUE_BAIXO) {
            estoqueBaixo++;
        }
        
        const validadeProxima = obterValidadeMaisProxima(med);
        if (validadeProxima) {
            const dias = diasAteVencimento(validadeProxima);
            if (dias < CONFIG.DIAS_VENCIMENTO && dias > 0) {
                proximosVencer++;
            }
        }
    });
    
    document.getElementById('totalEstoque').textContent = totalEstoque;
    document.getElementById('estoqueBaixo').textContent = estoqueBaixo;
    document.getElementById('proximosVencer').textContent = proximosVencer;
    document.getElementById('tiposMedicamentos').textContent = medicamentosUnicos.length;
}

// ===================================
// RELATÓRIOS E GRÁFICOS
// ===================================

function carregarRelatorios() {
    carregarTabelaBairros();
    carregarTabelaMedicamentosRelatorio();
    criarGraficoBairros();
    criarGraficoMedicamentos();
}

function carregarTabelaBairros() {
    const tbody = document.getElementById('tabelaBairros');
    tbody.innerHTML = '';
    
    // Conta atendimentos por bairro
    const bairrosConta = {};
    state.atendimentos.forEach(atend => {
        bairrosConta[atend.bairro] = (bairrosConta[atend.bairro] || 0) + 1;
    });
    
    const totalAtendimentos = state.atendimentos.length;
    
    if (totalAtendimentos === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="empty-state">Nenhum dado disponível</td></tr>';
        return;
    }
    
    // Ordena por quantidade
    const bairrosOrdenados = Object.entries(bairrosConta)
        .sort((a, b) => b[1] - a[1]);
    
    bairrosOrdenados.forEach(([bairro, total]) => {
        const percentual = ((total / totalAtendimentos) * 100).toFixed(1);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${bairro}</strong></td>
            <td>${total}</td>
            <td>${percentual}%</td>
        `;
        tbody.appendChild(tr);
    });
}

function carregarTabelaMedicamentosRelatorio() {
    const tbody = document.getElementById('tabelaMedicamentosRelatorio');
    tbody.innerHTML = '';
    
    // Conta medicamentos distribuídos
    const medicamentosConta = {};
    state.saidas.forEach(saida => {
        medicamentosConta[saida.medicamento] = (medicamentosConta[saida.medicamento] || 0) + saida.quantidade;
    });
    
    const totalDistribuido = Object.values(medicamentosConta).reduce((a, b) => a + b, 0);
    
    if (totalDistribuido === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="empty-state">Nenhum dado disponível</td></tr>';
        return;
    }
    
    // Ordena por quantidade
    const medicamentosOrdenados = Object.entries(medicamentosConta)
        .sort((a, b) => b[1] - a[1]);
    
    medicamentosOrdenados.forEach(([medicamento, total]) => {
        const percentual = ((total / totalDistribuido) * 100).toFixed(1);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${medicamento}</strong></td>
            <td>${total}</td>
            <td>${percentual}%</td>
        `;
        tbody.appendChild(tr);
    });
}

function criarGraficoBairros() {
    const ctx = document.getElementById('chartBairros');
    
    // Destrói gráfico anterior se existir
    if (state.charts.bairros) {
        state.charts.bairros.destroy();
    }
    
    // Prepara dados
    const bairrosConta = {};
    state.atendimentos.forEach(atend => {
        bairrosConta[atend.bairro] = (bairrosConta[atend.bairro] || 0) + 1;
    });
    
    const labels = Object.keys(bairrosConta);
    const data = Object.values(bairrosConta);
    
    if (labels.length === 0) {
        ctx.parentElement.innerHTML = '<p style="text-align: center; padding: 2rem; color: #94a3b8;">Nenhum dado disponível</p>';
        return;
    }
    
    // Cria gráfico
    state.charts.bairros = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#0ea5e9',
                    '#8b5cf6',
                    '#10b981',
                    '#f59e0b',
                    '#ef4444',
                    '#06b6d4',
                    '#6366f1',
                    '#f43f5e'
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            family: 'Poppins',
                            size: 12
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function criarGraficoMedicamentos() {
    const ctx = document.getElementById('chartMedicamentos');
    
    // Destrói gráfico anterior se existir
    if (state.charts.medicamentos) {
        state.charts.medicamentos.destroy();
    }
    
    // Prepara dados
    const medicamentosConta = {};
    state.saidas.forEach(saida => {
        medicamentosConta[saida.medicamento] = (medicamentosConta[saida.medicamento] || 0) + saida.quantidade;
    });
    
    const labels = Object.keys(medicamentosConta);
    const data = Object.values(medicamentosConta);
    
    if (labels.length === 0) {
        ctx.parentElement.innerHTML = '<p style="text-align: center; padding: 2rem; color: #94a3b8;">Nenhum dado disponível</p>';
        return;
    }
    
    // Cria gráfico
    state.charts.medicamentos = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Quantidade Distribuída',
                data: data,
                backgroundColor: 'rgba(14, 165, 233, 0.8)',
                borderColor: 'rgba(14, 165, 233, 1)',
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(30, 41, 59, 0.95)',
                    padding: 12,
                    titleFont: {
                        family: 'Poppins',
                        size: 14
                    },
                    bodyFont: {
                        family: 'Poppins',
                        size: 12
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        font: {
                            family: 'Poppins',
                            size: 11
                        }
                    },
                    grid: {
                        color: 'rgba(226, 232, 240, 0.5)'
                    }
                },
                x: {
                    ticks: {
                        font: {
                            family: 'Poppins',
                            size: 11
                        }
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// ===================================
// INICIALIZAÇÃO DO SISTEMA
// ===================================

document.addEventListener('DOMContentLoaded', () => {
    // Carrega dados do LocalStorage
    carregarDados();
    
    // Inicializa componentes
    inicializarNavegacao();
    inicializarFormAtendimento();
    inicializarFormMedicamentos();
    
    // Carrega dados iniciais da primeira seção
    atualizarSecao('atendimento');
    
    console.log('✅ Sistema MedControl inicializado com sucesso!');
});
