// Supabase Configuration
// Note: These will be replaced with actual values once the user provides/selects a project
const SUPABASE_URL = 'https://fruwdnbysjpaccregbnj.supabase.co'; // Using existing Centralux OT as placeholder
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';
const supabase = window.supabase?.createClient ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// State
let inventory = [
    { name: 'Caixa Master A', barcode: '123456789', expected: 10, confirmed: 0 },
    { name: 'Caixa Master B', barcode: '987654321', expected: 5, confirmed: 0 }
];

let extraItems = [];

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
    
    // Global scan listener
    document.addEventListener('keydown', (e) => {
        barcodeInput.focus();
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
    
    const item = inventory.find(i => i.barcode === barcode);
    
    if (item) {
        item.confirmed++;
        showToast(`Sucesso: ${item.name} confirmado!`, 'success');
        scanStatusEl.innerText = `Lido: ${item.name}`;
    } else {
        const extra = extraItems.find(i => i.barcode === barcode);
        if (extra) {
            extra.confirmed++;
        } else {
            extraItems.push({ name: 'Produto Extra', barcode: barcode, confirmed: 1 });
        }
        showToast(`Atenção: Produto extra detectado!`, 'warning');
        scanStatusEl.innerText = `Extra: ${barcode}`;
    }

    renderTable();
    updateStats();
    triggerAnimation();
}

function renderTable() {
    inventoryTable.innerHTML = '';

    // Render expected items
    inventory.forEach(item => {
        const row = document.createElement('tr');
        const status = item.confirmed >= item.expected ? 'status-ok' : 'status-pending';
        const label = item.confirmed >= item.expected ? 'Completo' : 'Pendente';
        
        row.innerHTML = `
            <td>${item.name}</td>
            <td><code>${item.barcode}</code></td>
            <td>${item.expected}</td>
            <td>${item.confirmed}</td>
            <td><span class="status-tag ${status}">${label}</span></td>
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
        `;
        inventoryTable.appendChild(row);
    });
}

function updateStats() {
    const totalScanned = inventory.reduce((acc, curr) => acc + curr.confirmed, 0) + 
                         extraItems.reduce((acc, curr) => acc + curr.confirmed, 0);
    const totalExpected = inventory.reduce((acc, curr) => acc + curr.expected, 0);
    const remaining = Math.max(0, totalExpected - inventory.reduce((acc, curr) => acc + curr.confirmed, 0));
    const extras = extraItems.reduce((acc, curr) => acc + curr.confirmed, 0);

    totalScannedEl.innerText = totalScanned;
    remainingItemsEl.innerText = remaining;
    extraItemsEl.innerText = extras;
}

function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerText = message;
    document.getElementById('toast-container').appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function triggerAnimation() {
    const card = document.querySelector('.scanner-card');
    card.classList.add('pulse-active');
    setTimeout(() => card.classList.remove('pulse-active'), 500);
}

init();
