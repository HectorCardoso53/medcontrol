import {
    db,
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    query,
    orderBy
} from "./firebase.js";



async function carregarDados() {
    state.atendimentos = [];
    state.medicamentos = [];
    state.saidas = [];

    const medsSnap = await getDocs(
        query(collection(db, "medicamentos"), orderBy("dataRecebimento", "desc"))
    );
    medsSnap.forEach(doc =>
        state.medicamentos.push({ id: doc.id, ...doc.data() })
    );

    const atendSnap = await getDocs(
        query(collection(db, "atendimentos"), orderBy("data", "desc"))
    );
    atendSnap.forEach(doc =>
        state.atendimentos.push({ id: doc.id, ...doc.data() })
    );

    const saidasSnap = await getDocs(
        query(collection(db, "saidas"), orderBy("data", "desc"))
    );
    saidasSnap.forEach(doc =>
        state.saidas.push({ id: doc.id, ...doc.data() })
    );

    console.log("🔥 Dados carregados do Firestore");
}


// Configurações Globais
const CONFIG = {
    ESTOQUE_BAIXO: 20,
    DIAS_VENCIMENTO: 90,
    FORMATO_DATA: 'pt-BR'
};

const LISTA_BAIRROS = [
    "Centro",
    "Fátima",
    "Santa Luzia",
    "Novo Horizonte",
    "São José",
    "São Pedro",
    "Penta",
    "São Lázaro",
    "Nossa Senhora das Graças",
    "Zona Rural",
    "Perpetuo Socorro",
    "Santíssimo",
    "São Francisco",
    "Jesus Misericordioso",
    "Paraisópolis",
    "Residencial Tia Ana",
    "Cidade Nova",
    "São Benedito",
    "São José",
    "Bela Vista",
    "Área Pastoral",
];


// Estado Global
let state = {
    atendimentos: [],
    medicamentos: [],
    saidas: [],
    charts: {}
};

let atendimentosFiltrados = []; // 🔥 ESSA LINHA FALTAVA

// ===================================
// FUNÇÕES DE UTILIDADE
// ===================================

function carregarSelectBairros() {
    const select = document.getElementById('bairro');
    if (!select) return;

    select.innerHTML = '<option value="">Selecione o bairro</option>';

    LISTA_BAIRROS
        .sort((a, b) => a.localeCompare(b))
        .forEach(bairro => {
            const option = document.createElement('option');
            option.value = bairro;
            option.textContent = bairro;
            select.appendChild(option);
        });
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
    switch (secao) {
        case 'relacao-atendimentos':
            carregarRelacaoAtendimentos();
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

    dataInput.value = new Date().toISOString().split('T')[0];

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const itens = [];
        let erroEstoque = false;

        const linhas = document.querySelectorAll('#listaMedicamentosReceita .form-grid');

        for (const linha of linhas) {

            const medicamento = linha.querySelector('.medicamento-select')?.value;
            const quantidade = parseInt(linha.querySelector('.quantidade-input')?.value);

            if (medicamento && quantidade > 0) {

                const estoque = calcularEstoqueMedicamento(medicamento);

                if (estoque < quantidade) {

                    mostrarToast(
                        `⚠ Estoque insuficiente para ${medicamento}.
Disponível: ${estoque}`,
                        'error'
                    );

                    // 🔥 destaca visualmente
                    linha.querySelector('.quantidade-input').style.border = "2px solid red";

                    erroEstoque = true;
                    break; // PARA TUDO
                }

                itens.push({ medicamento, quantidade });
            }
        }

        if (erroEstoque) return;

        if (itens.length === 0) {
            mostrarToast('Adicione pelo menos um medicamento!', 'error');
            return;
        }

        const atendimento = {
            data: dataInput.value,
            nomePaciente: document.getElementById('nomePaciente').value,
            rg: document.getElementById('rg').value || '',
            cartaoSus: document.getElementById('cartaoSus').value || '',
            contato: document.getElementById('contato').value || '',
            endereco: document.getElementById('endereco').value,
            bairro: document.getElementById('bairro').value,
            itens,
            criadoEm: new Date()
        };

        try {

            const ref = await addDoc(collection(db, 'atendimentos'), atendimento);
            state.atendimentos.push({ id: ref.id, ...atendimento });

            for (const item of itens) {
                await registrarSaida({
                    data: atendimento.data,
                    nomePaciente: atendimento.nomePaciente,
                    medicamento: item.medicamento,
                    quantidade: item.quantidade
                });
            }

            form.reset();
            dataInput.value = new Date().toISOString().split('T')[0];
            document.getElementById('listaMedicamentosReceita').innerHTML = '';

            carregarTabelaSaidas();
            carregarTabelaEstoque();
            atualizarCardsEstoque();

            mostrarToast('Atendimento salvo com sucesso!', 'success');

        } catch (err) {
            console.error(err);
            mostrarToast('Erro ao salvar atendimento', 'error');
        }
    });
}



async function registrarSaida({ data, nomePaciente, medicamento, quantidade }) {

    // 🔥 pega o lote mais antigo (FIFO por validade)
    const loteInfo = state.medicamentos
        .filter(m => m.descricao === medicamento && m.quantidade > 0)
        .sort((a, b) => new Date(a.dataValidade) - new Date(b.dataValidade))[0];

    const lote = loteInfo ? loteInfo.lote : "-";

    const saida = {
        data,
        medicamento,
        lote, // ✅ agora salva lote
        quantidade,
        referencia: `${nomePaciente}`
    };

    const ref = await addDoc(collection(db, "saidas"), saida);

    state.saidas.push({ id: ref.id, ...saida });
}

function carregarSelectMedicamentos() {
    const selects = document.querySelectorAll('.medicamento-select');

    selects.forEach(select => {
        select.innerHTML = `
            <option value="">Medicamento</option>
            ${gerarOpcoesMedicamentos()}
        `;
    });
}


function carregarFiltroAno() {
    const select = document.getElementById('filtroAno');
    if (!select) return;

    select.innerHTML = '<option value="">Todos</option>';

    const anoAtual = new Date().getFullYear();

    for (let ano = 2026; ano <= anoAtual + 5; ano++) {
        const option = document.createElement('option');
        option.value = String(ano);
        option.textContent = ano;
        select.appendChild(option);
    }
}





function carregarFiltroMedicamentos() {
    const select = document.getElementById('filtroMedicamento');
    if (!select) return;

    const meds = new Set();

    state.atendimentos.forEach(a => {
        a.itens.forEach(i => meds.add(i.medicamento));
    });

    select.innerHTML = '<option value="">Todos</option>';

    [...meds].sort().forEach(med => {
        const option = document.createElement('option');
        option.value = med;
        option.textContent = med;
        select.appendChild(option);
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

    dataInput.value = new Date().toISOString().split('T')[0];

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const quantidade = parseInt(document.getElementById('quantidadeRecebida').value);

        if (quantidade <= 0) {
            mostrarToast('Quantidade deve ser maior que zero!', 'error');
            return;
        }

        const medicamento = {
            codigo: document.getElementById('codigoMed').value,
            descricao: document.getElementById('descricaoMed').value,
            dataRecebimento: document.getElementById('dataRecebimento').value,
            lote: document.getElementById('lote').value,
            dataValidade: document.getElementById('dataValidade').value,
            quantidade: quantidade,
            criadoEm: new Date()
        };

        try {
            // 🔥 SALVA NO FIRESTORE
            const ref = await addDoc(
                collection(db, 'medicamentos'),
                medicamento
            );

            // 🔥 SINCRONIZA STATE
            state.medicamentos.push({ id: ref.id, ...medicamento });

            form.reset();
            dataInput.value = new Date().toISOString().split('T')[0];

            carregarTabelaMedicamentos();
            carregarSelectMedicamentos();
            atualizarCardsEstoque();

            mostrarToast('Medicamento salvo no Firestore!', 'success');

        } catch (error) {
            console.error(error);
            mostrarToast('Erro ao salvar no banco', 'error');
        }
    });
}


function carregarTabelaMedicamentos() {
    const tbody = document.getElementById('tabelaMedicamentos');
    if (!tbody) return; // ⛔ proteção TOTAL

    tbody.innerHTML = '';

    if (state.medicamentos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum medicamento cadastrado</td></tr>';
        return;
    }

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
                    🗑️ Excluir
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function excluirMedicamento(id) {
    if (confirm('Deseja realmente excluir este medicamento?')) {
        state.medicamentos = state.medicamentos.filter(m => m.id !== id);

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
    <td>
        <button class="btn btn-danger" onclick="excluirSaida('${saida.id}')">
            <span class="icon">🗑️</span>
        </button>
    </td>
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

    if (state.medicamentos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    Nenhum medicamento em estoque
                </td>
            </tr>
        `;
        return;
    }

    // 🔥 Ordena por medicamento e validade
    const medicamentosOrdenados = [...state.medicamentos].sort((a, b) => {
        if (a.descricao === b.descricao) {
            return new Date(a.dataValidade) - new Date(b.dataValidade);
        }
        return a.descricao.localeCompare(b.descricao);
    });

    medicamentosOrdenados.forEach(med => {

        const totalDistribuidoLote = state.saidas
            .filter(s => s.medicamento === med.descricao && s.lote === med.lote)
            .reduce((sum, s) => sum + s.quantidade, 0);

        const saldo = med.quantidade - totalDistribuidoLote;
        const diasVencer = diasAteVencimento(med.dataValidade);

        let statusBadge = '';

        if (saldo <= 0) {
            statusBadge = '<span class="badge badge-danger">SEM ESTOQUE</span>';
        } else if (saldo < CONFIG.ESTOQUE_BAIXO) {
            statusBadge = '<span class="badge badge-warning">ESTOQUE BAIXO</span>';
        } else if (diasVencer < CONFIG.DIAS_VENCIMENTO) {
            statusBadge = '<span class="badge badge-warning">PRÓX. VENCIMENTO</span>';
        } else {
            statusBadge = '<span class="badge badge-success">OK</span>';
        }

        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td><strong>${med.descricao}</strong></td>
            <td>${med.lote}</td>
            <td>${formatarData(med.dataValidade)}</td>
            <td>${med.quantidade}</td>
            <td>${totalDistribuidoLote}</td>
            <td><strong>${saldo}</strong></td>
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

    setTimeout(() => {

        if (document.getElementById('relatorios')?.classList.contains('active')) {
            criarGraficoBairros();
            criarGraficoMedicamentos();
        }

    }, 200);
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

async function excluirMedicamentoEstoque(descricao) {
    if (!confirm(`Deseja excluir TODO o estoque do medicamento:\n${descricao}?`)) {
        return;
    }

    try {
        // 🔥 remove TODAS as entradas desse medicamento
        const meds = state.medicamentos.filter(m => m.descricao === descricao);

        for (const med of meds) {
            await deleteDoc(doc(db, 'medicamentos', med.id));
        }

        // 🔥 remove saídas relacionadas
        const saidas = state.saidas.filter(s => s.medicamento === descricao);

        for (const saida of saidas) {
            await deleteDoc(doc(db, 'saidas', saida.id));
        }

        // 🔥 atualiza state
        state.medicamentos = state.medicamentos.filter(m => m.descricao !== descricao);
        state.saidas = state.saidas.filter(s => s.medicamento !== descricao);

        carregarTabelaEstoque();
        carregarTabelaMedicamentos();
        carregarTabelaSaidas();
        atualizarCardsEstoque();

        mostrarToast('Medicamento excluído do estoque com sucesso!', 'success');

    } catch (err) {
        console.error(err);
        mostrarToast('Erro ao excluir medicamento do estoque', 'error');
    }
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
    const canvas = document.getElementById('chartBairros');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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
                        label: function (context) {
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

function gerarRelatorioDiario() {
    const ano = document.getElementById('relatorioAno')?.value;
    const tbody = document.getElementById('tabelaRelatorioDiario');
    if (!tbody) return;

    tbody.innerHTML = '';

    let atendimentos = [...state.atendimentos];

    // 🔎 filtra por ano (opcional)
    if (ano) {
        atendimentos = atendimentos.filter(a => a.data.startsWith(ano));
    }

    // 📅 agrupa por dia
    const porDia = {};

    atendimentos.forEach(at => {
        porDia[at.data] = (porDia[at.data] || 0) + 1;
    });

    const diasOrdenados = Object.entries(porDia)
        .sort((a, b) => new Date(b[0]) - new Date(a[0]));

    if (diasOrdenados.length === 0) {
        tbody.innerHTML = `
      <tr>
        <td colspan="2" class="empty-state">
          Nenhum atendimento encontrado
        </td>
      </tr>
    `;
        return;
    }

    diasOrdenados.forEach(([data, total]) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
      <td>${formatarData(data)}</td>
      <td><strong>${total}</strong></td>
    `;
        tbody.appendChild(tr);
    });
}

function criarGraficoMedicamentos() {
    const canvas = document.getElementById('chartMedicamentos');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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

document.addEventListener('DOMContentLoaded', async () => {
    await carregarDados(); // ⬅️ agora espera Firestore

    inicializarNavegacao();
    inicializarFormAtendimento();
    inicializarFormMedicamentos();
    carregarSelectMedicamentosCadastro();
    ativarBuscaSelectMedicamento();

    carregarSelectBairros();

    ativarBuscaSelectBairro(); // 🔥 AQUI
    carregarFiltroAno();           // ✅ agora funciona
    atualizarSecao('atendimento');

    console.log('✅ Sistema MedControl inicializado com sucesso!');
});

;


// =========================
// MENU HAMBÚRGUER
// =========================

const menuToggle = document.getElementById('menuToggle');
const navMenu = document.querySelector('.nav-menu');

menuToggle.addEventListener('click', () => {
    navMenu.classList.toggle('active');
});

// Fecha o menu ao clicar em um botão
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        navMenu.classList.remove('active');
    });
});


function carregarRelacaoAtendimentos(lista = state.atendimentos) {
    const tbody = document.getElementById('tabelaRelacaoAtendimentos');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (lista.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    Nenhum atendimento encontrado
                </td>
            </tr>
        `;
        return;
    }

    lista
        .sort((a, b) => new Date(b.data) - new Date(a.data))
        .forEach(atend => {

            // 🔥 Junta medicamentos e quantidades
            const medicamentos = atend.itens
                .map(i => i.medicamento)
                .join('<br>');

            const quantidades = atend.itens
                .map(i => i.quantidade)
                .join('<br>');

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatarData(atend.data)}</td>
                <td><strong>${atend.nomePaciente}</strong></td>
                <td>${atend.bairro}</td>
                <td>${medicamentos}</td>
                <td>${quantidades}</td>
            `;
            tbody.appendChild(tr);
        });
}


function filtrarRelacaoAtendimentos() {
    const ano = document.getElementById('filtroAno')?.value;
    const mes = document.getElementById('filtroMes')?.value;
    const paciente = document.getElementById('filtroPaciente')?.value.toLowerCase();
    const medicamento = document.getElementById('filtroMedicamento')?.value.toLowerCase();

    let filtrados = [...state.atendimentos];

    // 📅 Ano
    if (ano) {
        filtrados = filtrados.filter(a => a.data.startsWith(ano));
    }

    // 📅 Mês
    if (mes) {
        filtrados = filtrados.filter(a => a.data.split('-')[1] === mes);
    }

    // 👤 Paciente
    if (paciente) {
        filtrados = filtrados.filter(a =>
            a.nomePaciente.toLowerCase().includes(paciente)
        );
    }

    // 💊 Medicamento (INPUT 🔥)
    if (medicamento) {
        filtrados = filtrados.filter(a =>
            a.itens.some(i =>
                i.medicamento.toLowerCase().includes(medicamento)
            )
        );
    }

    atendimentosFiltrados = filtrados;
    carregarRelacaoAtendimentos(filtrados);

    // 🔥 mostra botão PDF
    document.getElementById('btnPdf').style.display =
        filtrados.length ? 'inline-flex' : 'none';

}


function baixarPdfAtendimentos() {

    if (!atendimentosFiltrados.length) {
        mostrarToast('Nenhum dado para exportar', 'error');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    const logo = document.getElementById("logoPrefeitura");

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    let currentY = 10;

    // ================================
    // 🏛 CABEÇALHO
    // ================================

    if (logo && logo.complete) {
        doc.addImage(logo, "PNG", pageWidth / 2 - 15, currentY, 30, 30);
    }

    currentY += 35;

    doc.setFont(undefined, 'bold');
    doc.setFontSize(14);
    doc.text("PREFEITURA MUNICIPAL DE ORIXIMINÁ", pageWidth / 2, currentY, { align: "center" });

    currentY += 7;

    doc.setFontSize(12);
    doc.text("SECRETARIA MUNICIPAL DE SAÚDE", pageWidth / 2, currentY, { align: "center" });

    currentY += 7;

    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    doc.text("Relatório Oficial de Atendimentos", pageWidth / 2, currentY, { align: "center" });

    currentY += 5;

    doc.line(15, currentY, pageWidth - 15, currentY);

    // ================================
    // 📄 INFORMAÇÕES DO RELATÓRIO
    // ================================

    currentY += 10;

    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.text("Relação de Atendimentos", 15, currentY);

    currentY += 6;

    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);

    const dataGeracao = new Date().toLocaleString('pt-BR', {
        dateStyle: 'full',
        timeStyle: 'short'
    });

    doc.text(`Documento gerado em: ${dataGeracao}`, 15, currentY);

    currentY += 6;

    doc.line(15, currentY, pageWidth - 15, currentY);

    // ================================
    // 🔢 DADOS
    // ================================

    const rows = [];

    atendimentosFiltrados.forEach(at => {
        at.itens.forEach(item => {
            rows.push([
                formatarData(at.data),
                at.nomePaciente,
                at.bairro,
                item.medicamento,
                item.quantidade
            ]);
        });
    });

    doc.autoTable({
        startY: currentY + 5,
        head: [['Data', 'Paciente', 'Bairro', 'Medicamento', 'Qtd']],
        body: rows,
        styles: {
            fontSize: 8,
            cellPadding: 3
        },
        headStyles: {
            fillColor: [14, 165, 233],
            textColor: 255,
            halign: 'center'
        },
        columnStyles: {
            0: { cellWidth: 22 },
            1: { cellWidth: 35 },
            2: { cellWidth: 30 },
            3: { cellWidth: 65 },
            4: { cellWidth: 15, halign: 'center' }
        },
        alternateRowStyles: {
            fillColor: [245, 247, 250]
        },

        didDrawPage: function (data) {

            doc.line(15, pageHeight - 25, pageWidth - 15, pageHeight - 25);

            doc.setFontSize(9);
            doc.text(
                "____________________________________________",
                15,
                pageHeight - 18
            );

            doc.text(
                "Secretaria Municipal de Saúde",
                15,
                pageHeight - 13
            );

            doc.setFontSize(8);
            doc.text(
                "Documento oficial emitido pelo Sistema MedControl",
                15,
                pageHeight - 8
            );

            doc.text(
                `Página ${doc.internal.getCurrentPageInfo().pageNumber} de ${doc.internal.getNumberOfPages()}`,
                pageWidth - 15,
                pageHeight - 10,
                { align: "right" }
            );
        }
    });

    window.open(doc.output('bloburl'), '_blank');
}




const LISTA_MEDICAMENTOS = [

    "AMBROXOL XAROPE 15MG/ML 100ML - PEDIÁTRICO",
    "AMBROXOL XAROPE 50MGML",
    "ACETILCISTEÍNA 40MG/ML ADULTO",
    "ACETILCISTEÍNA 20MG/ML PEDIÁTRICO",
    "ACEBROFILINA 50 MG/ML",
    "ACEBROFILINA 25MG/5ML",
    "ÁCIDO FÓLICO 5MG",
    "ÁCIDO ACESTILSALICÍLICO 100MG CP",
    "ÁCIDO ASCÓRBICO 500mg CP",
    "ÁCIDO ASCÓRBICO 100MG/ML – AMPOLA 5ML",
    "ÁCIDO ASCÓRBICO 200MG/ML",
    "ÁCIDO TRANEXÂMICO 250MG/5ML - AMPOLA",
    "ÁCIDO TRANEXÂMICO 250MG",
    "ACICLOVIR 50MG/G POMADA",
    "ACICLOVIR 200MG",
    "ALBENDAZOL SUSPENSÃO 40MG/ML – 10ML FR",
    "ALBENDAZOL 400MG CP",
    "ANITA – NITAZOXANIDA LÍQUIDO 20MG/ML FR",
    "ANITA – NITAZOXANIDA COMPRIMIDO 500MG CP",
    "ÁGUA PARA INJEÇÃO 10ML FRASCO/AMPOLA",
    "ÁGUA DESTILADA 1000ML FRASCO",
    "ALENDRONATO DE SÓDIO 70MG CP",
    "ALOPURINOL 100MGCP",
    "ALOPURINOL 300MG CP",
    "ANLODIPINO 5MG CP",
    "ANLODIPINO 10MG CP",
    "AMOXICILINA 500MG CP",
    "AMOXICILINA 250MG/5ML PÓ/FR",
    "AMOXICILINA + CLAVULANATO DE POTÁSSIO 400MG+57ML PÓ/FR",
    "AMOXICILINA + CLAVULANATO DE POTÁSSIO 875MG/125MG CP",
    "AMOXICILINA + CLAVULANATO DE POTÁSSIO 500 + 125 MG CP",
    "AMPICILINA 500MG CP",
    "ATENOLOL 25MG CP",
    "ATENOLOL 50MG CP",
    "ATENOLOL 100MG CP",
    "AZITROMICINA 500MG CP",
    "AZITROMICINA DI-HIDRATADA 200MG/15ML PÓ/FR",
    "BENZILPELICILINA BENZATINA 1.200,00UI FR/AMP",
    "BENZILPELICILINA BENZATINA 600,00UI FR/AMP",
    "BUSCOPAM COMPOSTO - GOTAS 6,67MG/ML + 333,4MG/ML FR",
    "BUSCOPAM COMPOSTO 10MG + 250MG CP",
    "BUSCOPAM SIMPLES (BUTILBROMETO DE ESCOPOLAMINA 20MG/ML) AMPOLA",
    "BUSCOPAM COMPOSTO (BUTILBROMETO DE ESCOPOLAMINA + DIPIRONA 4MG/ML + 500MG/ML) AMPOLA",
    "BENZOATO DE BENZILA 100MG/G SABONETE",
    "BENZOATO DE BENZILA LOÇÃO 250MG/ML",
    "BENZOIMENTRONIDAZOL 40MG/ML FR",
    "BROMETO DE IPATRÓPICO 0,250MG/ML FR",
    "BROMOPRIDA 4MG/ML – SOLUÇÃO ORAL",
    "BROMOPRIDA 10MG CP",
    "BROMOPRIDA 5MG/ML AMPOLA",
    "CAPTOPRIL 25MG",
    "CARBONATO DE CÁLCIO + COLECALCIFEROL 1250MG + 400UI/COM CP",
    "CARBIDOPA + LEVODOPA 250MG/25MG CP",
    "CARVEDILOL 12,5MG",
    "CARVEDILOL 25MG",
    "CARVEDILOL 3,125MG",
    "CARVEDILOL 6,25MG",
    "CEFTRIAXONA DISSÓDICA 500G (PÓ) – USO INTRAVENOSO AMP",
    "CEFTRIAXONA DISSÓDICA 1G (PÓ) – INTRAVENOSO AMP",
    "CETOCONAZOL ANTICASPA SHAMPOO FR",
    "CETOCONAZOL 200MG CP",
    "CETOCONAZOL 20MG/G 2% - CREME DERMATOLÓGICO TUBO",
    "CEFALEXINA 500MG CP",
    "CEFALEXINA 250MG/ML FR",
    "CETOPROFENO 150MG",
    "CETOPROFENO 100MG/ML INTRAVENOSO AMP",
    "CETOPROFENO 50MG/ML INTRAMUSCULAR AMP",
    "CICLO 21 - LEVONORGESTREL 0,15MG ETINILESTRADIOL 0,03MG CP",
    "CIPROFLOXACINO 500MG CP",
    "CLARITROMICINA 500MG CP",
    "COMPLEXO B INJETÁVEL 2ML IV OU IM",
    "COMPLEXO B POLIVITAMÍNICO",
    "COMPLEXO B POLIVITAMÍNICO SOLUÇÃO GOTAS",
    "CONTRACEP - 150MG/ML ANTICONCEPCIONAL AMP",
    "CLORIDRATO DE LIDOCAÍNA 20MG/ML INJETÁVEL SEM VASO",
    "CLORIDRATO DE LIDOCAÍNA 20MG/ML (2%) EPINEFRINA 0,005MG/ML INJETÁVEL COM VASOCONSTRITOR",
    "CLORETO DE SÓDIO 10ML – SOLUÇÃO NASAL (PEDIÁTRICO) FR",
    "CLOPIDOGREL 75MG CP",
    "CLOMIPRAMINA 25MG CP",
    "CLOTRIMAZOL 10MG/G CREME DERMATOLÓGICO TUBO",
    "CURATEC - HIDROGEL COM ALGINATO",
    "DEXAMETASONA DISSÓDICA FOSFATO 4MG/ML – AMPOLA 2,5",
    "DEXAMETASONA 4MG CP",
    "DEXAMETASONA ELIXIR 0,5MG/5ML SUSPENSÃO",
    "DEXAMETASONA 1MG/G CREME DERMATOLÓGICO",
    "DEXCLORFENIRAMINA 0,4MG/ML FR",
    "DEXCLORFENIRAMINA 2MG",
    "DIPIRONA 1G CP",
    "DIPIRONA SÓDICA 500MG CP",
    "DIPIRONA SÓDICA GOTAS 500MG/ML FR",
    "DIPIRONA SÓDICA 500MG/ML – AMPOLA 2ML",
    "DICLOFENACO DE SÓDIO 25MG/ML",
    "DICLOFENACO DE SÓDIO 50MG",
    "DIGOXINA 2,5MG",
    "DOXASOZINA 2MG",
    "DOXICICLINA 100MG",
    "DULFLAN (DIPROPIONATO DE BETAMETASONA + FOSFATO DISSÓDICO DE BETAMETASONA) AMP 5MG/ML + 2MG/ML",
    "ELOTIM SOLUÇÃO OTOLÓGICA",
    "ENALAPRIL 10MG",
    "ENALAPRIL 5MG",
    "ENALAPRIL 20MG",
    "ENOXAPARINA SÓDICA 40MG/0,4ML AMP",
    "ESPIRONOLACTONA 25MG",
    "ESPIRONOLACTONA 50MG",
    "ESPIRONOLACTONA 100MG",
    "FUROSEMIDA 40MG CP",
    "FUROSEMIDA 10MG/ML AMP",
    "FLORAX PEDIÁTRICO 50 MILHÕES INFANTIL",
    "FLORAX ADULTO 100 MILHÕES ADULTO",
    "FLUCONAZOL 150MG",
    "GLIBENCLAMIDA 5MG CP",
    "GLICASIDA 30MG",
    "GLICASIDA 60MG",
    "GLICOSE 25% FRASCO/AMPOLA",
    "GLICOSE 50% FRASCO/AMPOLA",
    "HIDROCLOROTIAZIDA 25MG CP",
    "HIDROCORTISONA 500MG – PÓ P/ SOLUÇÃO INJETÁVEL",
    "HIDROCORTISONA 100MG AMP",
    "HIDROCORTISONA CREME",
    "HIDRÓXIDO DE ALUMÍNIO - SUSPENSÃO",
    "IBUPROFENO 50MG/ML - GOTAS",
    "IBUPROFENO 600MG",
    "IBUPROFENO 300MG",
    "ISOSSORBIDA 20MG",
    "ISOSSORBIDA 40MG",
    "ITRACONAZOL 100MG",
    "IVERMECTINA 6MG",
    "KOID-D (MALEATO DE DEXCLORFENIRAMINA + BETAMETASONA) FR",
    "KOLLAGENASE POMADA",
    "LACTULOSE SUSPENSÃO",
    "LEVODOPA + CARDIODOPA 250MG + 25MG",
    "LEVOFLOXACINO 500MG",
    "LEVOFLOXACINO 750MG",
    "LEVOTIROXINA 25MCG",
    "LEVOTIROXINA 50MCG",
    "LEVONORGESTREL 0,75MG PÍLULA DIA SEGUINTE",
    "LIDOCAÍNA CLORIDRATO 2% GELÉIA 30G",
    "LOSARTANA 50MG CP",
    "LORATADINA 10MG CP",
    "LORATADINA 1MG/ML FR",
    "MEBENDAZOL SUSP. FR",
    "MEBENDAZOL 100MG",
    "MELOXICAM 15MG",
    "METFORMINA 500MG CP",
    "METFORMINA 850MG CP",
    "METOCLOPRAMIDA 10MG CP",
    "METOCLOPRAMIDA 10MG SOLUÇÃO INJETÁVEL 2ML",
    "METOPROLOL 25MG",
    "METOPROLOL 50MG",
    "METOPROLOL 100MG",
    "METILDOPA 250MG",
    "METILDOPA 500MG",
    "METRONIDAZOL + NISTATINA 100G/G 20.000UI",
    "METRONIDAZOL 100MG/G 10% CREME VAGINAL TUBO",
    "METRONIDAZOL 250MG CP",
    "METRONIDAZOL 400MG CP",
    "MICONAZOL 20MG/G CREME VAGINAL TUBO",
    "MICONAZOL 20MG/G CREME DERMATOLÓGICO TUBO",
    "MICONAZOL + TINIDAZOL 30MG/G + 20MG/G CREME VAGINAL TUBO",
    "NAPROXENO 500MG CP",
    "NEOMICINA CREME DERMATOLÓGICO",
    "NEOMICINA + BACITRACINA 5MG/ML + 250UI/G",
    "NIMESULIDA 100MG",
    "NIMESULIDA 50MG/ML GTS FR",
    "NIFEDIPINO 10MG CP",
    "NIFEDIPINO 20MG CP",
    "NISTATINA 100.000 UI/4G – CREME VAGINAL",
    "NISTATINA + ÓXIDO DE ZINCO",
    "NISTATINA SOLUÇÃO ORAL FR",
    "NITROFURATOÍNA 100MG CP",
    "NORETISTERONA 0,35MG CP",
    "NOREGYNA - ANTICONCEPCIONAL 1 MÊS (ENANTATO DE NORETISTERONA + VALERATO DE ESTRADIOL 50+5MG/ML)",
    "NUTRIVIT JÚNIOR FR - SUPLEMENTO LÍQUIDO DE VITAMINA E MINERAIS",
    "ÓLEO DE GIRASOL FR",
    "ÓLEO MINERAL FR",
    "OMEPRAZOL 40MG PÓ P/ SOLUÇÃO INJETÁVEL FRASCO + DILUENTE",
    "OMEPRAZOL 40MG CP",
    "OMEPRAZOL 20MG CP",
    "ONDASETRONA 4MG CP",
    "ONDASETRONA 8MG CP",
    "PARACETAMOL 750MG CP",
    "PARACETAMOL 500MG CP",
    "PARACETAMOL 200MG/ML – FRASCO 15ML - GOTAS",
    "PASTA D´ÁGUA 25% DE ÓXIDO DE ZINCO FR",
    "POLIVITAMINICO A-Z CP",
    "POLIVITAMINICO A-Z – SOLUÇÃO ORAL",
    "PERMETRINA 5% FR",
    "PERMETRINA 1% FR",
    "PREDNISOLONA 3MG/ML FR",
    "PREDNISOLONA 20MG",
    "PREDNISONA 5MG",
    "PREDNISONA 20MG CP",
    "PREGNOLAN - ANTICONCEPCIONAL - 1 MÊS (ALGESTONA ACETOFENIDA 150MG/ML + ENANTATO DE ESTRADIOL 10MG/ML)",
    "PROMETAZINA 25MG",
    "PROMETAZINA 25MG/ML AMP",
    "PROPRANOLOL 40MG CP",
    "PROLOPA 100/25MG CP",
    "PROLOPA 200/50MG CP",
    "PROPAFENONA 300MG CP",
    "SAIS PARA REIDRATAÇÃO ORAL",
    "SALBUTAMOL 100MCG – AEROSSOL BOMBINHA",
    "SALBUTAMOL SUSPENSÃO FR",
    "SECNIDAZOL 1G CP",
    "SINVASTATINA 20MG CP",
    "SINVASTATINA 40MG CP",
    "SIMETICONA GOTAS FR",
    "SULFAMETOXAZOL + TRIMETROPINA 400MG + 80MG",
    "SULFAMETOXAZOL + TRIMETROPINA 800MG + 160MG",
    "SULFAMETOXAZOL + TRIMETROPINA 200MG/5ML / 40MG/ML",
    "SULFATO FERROSO 40MG CP",
    "SULFATO FERROSO 125MG/ML – SOLUÇÃO ORAL",
    "SULFADIAZINA DE PRATA (CREME 1%) TUBO",
    "TADALAFILA 5MG",
    "TIABENDAZOL CREME",
    "VITAMINA A E D – GOTAS",
    "UNIZINCO",
    "UNIZINCO SUSPENSÃO"

];


function carregarListaMedicamentosCadastro() {
    const datalist = document.getElementById('listaMedicamentos');
    if (!datalist) return;

    datalist.innerHTML = '';

    LISTA_MEDICAMENTOS
        .sort((a, b) => a.localeCompare(b))
        .forEach(med => {
            const option = document.createElement('option');
            option.value = med;
            datalist.appendChild(option);
        });
}


function carregarSelectMedicamentosCadastro() {
    const select = document.getElementById('descricaoMed');
    if (!select) return;

    select.innerHTML = '<option value="">Selecione ou digite o medicamento</option>';

    LISTA_MEDICAMENTOS
        .sort((a, b) => a.localeCompare(b))
        .forEach(med => {
            const option = document.createElement('option');
            option.value = med;
            option.textContent = med;
            select.appendChild(option);
        });
}


function ativarBuscaSelectMedicamento() {
    new TomSelect("#descricaoMed", {
        create: true, // permite digitar novo medicamento
        sortField: {
            field: "text",
            direction: "asc"
        },
        placeholder: "Digite para pesquisar o medicamento..."
    });
}



function gerarOpcoesMedicamentos() {
    const meds = [...new Set(state.medicamentos.map(m => m.descricao))];

    return meds.map(med => {
        const estoque = calcularEstoqueMedicamento(med);
        const disabled = estoque <= 0 ? 'disabled' : '';
        return `<option value="${med}" ${disabled}>
            ${med} (Estoque: ${estoque})
        </option>`;
    }).join('');
}

function adicionarMedicamentoReceita() {
    const container = document.getElementById('listaMedicamentosReceita');

    const div = document.createElement('div');
    div.className = 'form-grid';

    div.innerHTML = `
        <div class="form-group">
            <select class="medicamento-select" required>
                <option value="">Medicamento</option>
                ${gerarOpcoesMedicamentos()}
            </select>
        </div>

        <div class="form-group">
            <input type="number" class="quantidade-input" min="1" placeholder="Qtd" required>
        </div>

        <div class="form-group">
            <button type="button" class="btn btn-danger"
                onclick="this.closest('.form-grid').remove()">
                🗑️
            </button>
        </div>
    `;

    container.appendChild(div);
}

function ativarBuscaSelectBairro() {
    new TomSelect("#bairro", {
        create: true,
        sortField: {
            field: "text",
            direction: "asc"
        },
        placeholder: "Digite para pesquisar o bairro..."
    });
}


function excluirSaida(id) {
    if (!confirm('Deseja realmente excluir esta saída?')) return;

    state.saidas = state.saidas.filter(s => s.id !== id);
    carregarTabelaSaidas();
    atualizarCardsEstoque();

    mostrarToast('Saída excluída com sucesso!', 'success');
}

// 🔓 expõe funções para o HTML (onclick)
window.adicionarMedicamentoReceita = adicionarMedicamentoReceita;
window.filtrarRelacaoAtendimentos = filtrarRelacaoAtendimentos;
window.excluirSaida = excluirSaida;
window.excluirMedicamento = excluirMedicamento;
window.excluirAtendimento = excluirAtendimento;
window.excluirMedicamentoEstoque = excluirMedicamentoEstoque;
window.gerarRelatorioDiario = gerarRelatorioDiario;
window.baixarPdfAtendimentos = baixarPdfAtendimentos;



