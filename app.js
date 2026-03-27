// State
let items = JSON.parse(localStorage.getItem('centralux_items')) || [
    { name: 'Caixa Master A', barcode: '123456789', expected: 10, confirmed: 0 },
    { name: 'Caixa Master B', barcode: '987654321', expected: 5, confirmed: 0 }
];

let extraItems = JSON.parse(localStorage.getItem('centralux_extras')) || [];
let mode = localStorage.getItem('centralux_mode') || 'subtract'; // 'subtract' or 'sum'

// DOM Elements
const barcodeInput = document.getElementById('barcode-input');
const inventoryTable = document.querySelector('#inventory-table tbody');
const totalScannedEl = document.querySelector('#total-scanned .value');
const remainingItemsEl = document.querySelector('#remaining-items .value');
const extraItemsEl = document.querySelector('#extra-items .value');
const scanStatusEl = document.getElementById('scan-status');

// Initialize
function init() {
    renderTable();
    updateStats();
    updateModeUI();
    
    // Global scan listener
    document.addEventListener('keydown', (e) => {
        if (document.activeElement !== barcodeInput) {
            barcodeInput.focus();
        }
    });

    barcodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const barcode = barcodeInput.value.trim();
            if (barcode) {
                handleScan(barcode);
            }
            barcodeInput.value = '';
        }
    });
}

function handleScan(barcode) {
    console.log('Scanned:', barcode);
    
    const item = items.find(i => i.barcode === barcode);
    
    if (item) {
        if (mode === 'sum') {
            item.confirmed++;
            showToast(`Adicionado: ${item.name}`, 'success');
            scanStatusEl.innerText = `Lido: ${item.name}`;
        } else {
            if (item.confirmed < item.expected) {
                item.confirmed++;
                showToast(`Sucesso: ${item.name}`, 'success');
                scanStatusEl.innerText = `Lido: ${item.name}`;
            } else {
                item.confirmed++;
                showToast(`Atenção: Qtd excedida para ${item.name}`, 'warning');
                scanStatusEl.innerText = `Excesso: ${item.name}`;
            }
        }
    } else {
        const extra = extraItems.find(i => i.barcode === barcode);
        if (extra) {
            extra.confirmed++;
        } else {
            extraItems.push({ name: 'Produto Extra', barcode: barcode, confirmed: 1 });
        }
        showToast(`Atenção: Código não cadastrado!`, 'warning');
        scanStatusEl.innerText = `Desconhecido: ${barcode}`;
    }

    saveState();
    renderTable();
    updateStats();
    triggerAnimation();
}

function saveState() {
    localStorage.setItem('centralux_items', JSON.stringify(items));
    localStorage.setItem('centralux_extras', JSON.stringify(extraItems));
    localStorage.setItem('centralux_mode', mode);
}

function renderTable() {
    inventoryTable.innerHTML = '';

    // Render expected items
    items.forEach(item => {
        const row = document.createElement('tr');
        const isComplete = item.confirmed >= item.expected;
        const isOver = item.confirmed > item.expected;
        
        let statusClass = 'status-pending';
        let label = 'Pendente';
        
        if (isOver) {
            statusClass = 'status-extra';
            label = `Excesso (+${item.confirmed - item.expected})`;
        } else if (isComplete) {
            statusClass = 'status-ok';
            label = 'Concluído';
        }
        
        row.innerHTML = `
            <td>${item.name}</td>
            <td><code>${item.barcode}</code></td>
            <td>${item.expected}</td>
            <td>${item.confirmed}</td>
            <td><span class="status-tag ${statusClass}">${label}</span></td>
            <td>
                <button onclick="removeItem('${item.barcode}')" class="btn-remove">
                    <i data-lucide="x"></i>
                </button>
            </td>
        `;
        inventoryTable.appendChild(row);
    });

    // Render extra items
    extraItems.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="color: var(--accent)">${item.name}</td>
            <td><code>${item.barcode}</code></td>
            <td>0</td>
            <td>${item.confirmed}</td>
            <td><span class="status-tag status-extra">Extra</span></td>
            <td>
                <button onclick="removeExtra('${item.barcode}')" class="btn-remove">
                    <i data-lucide="x"></i>
                </button>
            </td>
        `;
        inventoryTable.appendChild(row);
    });
    
    if (window.lucide) lucide.createIcons();
}

function updateStats() {
    const totalScanned = items.reduce((acc, curr) => acc + curr.confirmed, 0) + 
                         extraItems.reduce((acc, curr) => acc + curr.confirmed, 0);
    const totalExpected = items.reduce((acc, curr) => acc + curr.expected, 0);
    const remaining = Math.max(0, totalExpected - items.reduce((acc, curr) => acc + curr.confirmed, 0));
    const extrasCount = extraItems.reduce((acc, curr) => acc + curr.confirmed, 0);

    totalScannedEl.innerText = totalScanned;
    remainingItemsEl.innerText = remaining;
    extraItemsEl.innerText = extrasCount;
}

function showToast(message, type) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerText = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function triggerAnimation() {
    const card = document.querySelector('.scanner-card');
    card.style.borderColor = 'var(--primary)';
    card.style.boxShadow = '0 0 20px rgba(0, 122, 255, 0.2)';
    setTimeout(() => {
        card.style.borderColor = 'var(--border)';
        card.style.boxShadow = 'none';
    }, 500);
}

// UI Interactions
window.toggleConfig = () => {
    document.getElementById('config-panel').classList.toggle('hidden');
};

window.setMode = (newMode) => {
    mode = newMode;
    saveState();
    updateModeUI();
    renderTable();
    updateStats();
};

function updateModeUI() {
    document.querySelectorAll('.btn-mode').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`mode-${mode}`).classList.add('active');
}

window.addItem = () => {
    const name = document.getElementById('new-name').value.trim();
    const barcode = document.getElementById('new-barcode').value.trim();
    const expected = parseInt(document.getElementById('new-expected').value);

    if (name && barcode && !isNaN(expected)) {
        if (items.some(i => i.barcode === barcode)) {
            alert('Este código de barras já existe na lista!');
            return;
        }
        items.push({ name, barcode, expected, confirmed: 0 });
        saveState();
        renderTable();
        updateStats();
        
        document.getElementById('new-name').value = '';
        document.getElementById('new-barcode').value = '';
        document.getElementById('new-expected').value = '';
        showToast('Produto adicionado com sucesso', 'success');
    } else {
        alert('Por favor, preencha todos os campos corretamente.');
    }
};

window.removeItem = (barcode) => {
    if (confirm('Remover este item da lista?')) {
        items = items.filter(i => i.barcode !== barcode);
        saveState();
        renderTable();
        updateStats();
    }
};

window.removeExtra = (barcode) => {
    extraItems = extraItems.filter(i => i.barcode !== barcode);
    saveState();
    renderTable();
    updateStats();
};

window.resetData = () => {
    if (confirm('Tem certeza que deseja limpar todos os dados?')) {
        localStorage.removeItem('centralux_items');
        localStorage.removeItem('centralux_extras');
        location.reload();
    }
};

init();

