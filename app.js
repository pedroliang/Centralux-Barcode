// ============================================
// Centralux Barcode — Lógica Principal
// Gerencia navegação, CRUD, scanner e histórico
// ============================================

// ============================================
// Estado da Aplicação
// ============================================
const appState = {
    user: null,
    currentSection: 'sectionDashboard',
    scanner: null,
    modalScanner: null,
    sessionScanCount: 0,
    pendingBarcodes: [],      // Barcodes pendentes para vincular ao item no formulário
    editingItemId: null,      // Item sendo editado
    historyPage: 1,
    historyPerPage: 15,
    historyTotal: 0,
    pendingScanBarcode: null,  // Barcode lido aguardando confirmação
    pendingScanItem: null,     // Item encontrado para o barcode lido
    pendingScanBarcodeId: null // ID do barcode encontrado
};

// ============================================
// Feedback Visual
// ============================================
function flashScannerViewport() {
    const viewport = document.getElementById('scannerViewport');
    if (!viewport) return;

    const flash = document.createElement('div');
    flash.style.position = 'absolute';
    flash.style.top = '0';
    flash.style.left = '0';
    flash.style.width = '100%';
    flash.style.height = '100%';
    flash.style.backgroundColor = 'rgba(34, 197, 94, 0.4)';
    flash.style.zIndex = '5';
    flash.style.transition = 'opacity 0.2s ease-out';
    flash.style.pointerEvents = 'none';

    viewport.appendChild(flash);

    setTimeout(() => {
        flash.style.opacity = '0';
        setTimeout(() => flash.remove(), 200);
    }, 50);
}

// ============================================
// Utilidades
// ============================================
// ============================================
// Inicialização
// ============================================
(async () => {
    // Modo Uso Pessoal (Sem Login)
    // Inicializar UI diretamente
    initUI();
    await loadDashboard();
    
    // Identificar usuário local (opcional)
    appState.user = { id: null, email: 'Uso Pessoal' };
})();

// Remover ouvintes de autenticação desnecessários
// supabaseClient.auth.onAuthStateChange...

// ============================================
// Inicializar UI
// ============================================
function initUI() {
    // Exibir dados do usuário (se os elementos existirem)
    const email = appState.user?.email || '';
    const userEmailEl = document.getElementById('userEmail');
    const userAvatarEl = document.getElementById('userAvatar');

    if (userEmailEl) userEmailEl.textContent = email;
    if (userAvatarEl) userAvatarEl.textContent = email.charAt(0).toUpperCase();

    // Navegação
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(btn.dataset.section);
        });
    });

    // Logout (se existir)
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            window.location.href = 'index.html';
        });
    }

    // Configurar leitor Bluetooth (HID)
    setupBluetoothScanner();

    // Scanner
    document.getElementById('btnStartScanner').addEventListener('click', startMainScanner);
    document.getElementById('btnStopScanner').addEventListener('click', stopMainScanner);
    document.getElementById('btnManualInput').addEventListener('click', () => openModal('modalManualInput'));
    document.getElementById('btnSubmitManualBarcode').addEventListener('click', handleManualBarcode);

    // Enter para input manual
    document.getElementById('manualBarcodeInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleManualBarcode();
    });

    // Cadastro
    document.getElementById('btnNewItem').addEventListener('click', openNewItemForm);
    document.getElementById('btnCloseForm').addEventListener('click', closeItemForm);
    document.getElementById('btnCancelForm').addEventListener('click', closeItemForm);
    document.getElementById('itemForm').addEventListener('submit', handleItemSubmit);
    document.getElementById('btnAddBarcode').addEventListener('click', addBarcodeToList);
    document.getElementById('btnScanBarcode').addEventListener('click', openBarcodeScanModal);
    document.getElementById('searchItems').addEventListener('input', debounce(loadItems, 300));

    // Enter para input de barcode
    document.getElementById('barcodeInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addBarcodeToList(); }
    });

    // Histórico
    document.getElementById('btnApplyFilters').addEventListener('click', () => { appState.historyPage = 1; loadHistory(); });
    document.getElementById('btnClearFilters').addEventListener('click', clearFilters);
    document.getElementById('btnExportCSV').addEventListener('click', exportCSV);

    // Confirmação de leitura
    document.getElementById('btnConfirmScan').addEventListener('click', confirmScan);

    // Cadastro rápido
    document.getElementById('btnQuickRegister').addEventListener('click', handleQuickRegister);
}

// ============================================
// Suporte a Leitor Bluetooth / USB (HID Keyboard)
// ============================================
function setupBluetoothScanner() {
    let buffer = '';
    let lastKeyTime = Date.now();

    window.addEventListener('keydown', (e) => {
        // Ignorar se o foco estiver em um input de texto real
        const tagName = document.activeElement.tagName.toLowerCase();
        const type = document.activeElement.type?.toLowerCase();
        
        // Exceções: Permitir capturar se estiver no input de busca ou barcode do formulário
        // mas o leitor físico enviará um 'Enter' no final, o que já tratamos nos inputs.
        // O caso principal aqui é o Dashboard ou quando nenhuma entrada está focada.
        if (tagName === 'input' || tagName === 'textarea') {
            return;
        }

        const currentTime = Date.now();
        
        // Se o tempo entre as teclas for > 50ms, provavelmente não é um scanner físico
        if (currentTime - lastKeyTime > 50) {
            buffer = '';
        }

        if (e.key === 'Enter') {
            if (buffer.length > 2) { // Evitar disparar com apenas 1 ou 2 caracteres
                console.log('📡 Código capturado via Bluetooth HID:', buffer);
                handleBarcodeDetected(buffer, 'HID');
                buffer = '';
            }
        } else if (e.key.length === 1) { // Apenas caracteres simples
            buffer += e.key;
        }

        lastKeyTime = currentTime;
    });
}
function navigateTo(sectionId) {
    // Parar scanner se sair da aba
    if (appState.currentSection === 'sectionScanner' && sectionId !== 'sectionScanner') {
        stopMainScanner();
    }

    // Esconder todas as seções
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));

    // Mostrar seção selecionada
    document.getElementById(sectionId).classList.add('active');

    // Atualizar navegação
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === sectionId);
    });

    appState.currentSection = sectionId;

    // Carregar dados da seção
    switch (sectionId) {
        case 'sectionDashboard':
            loadDashboard();
            break;
        case 'sectionCadastro':
            loadItems();
            break;
        case 'sectionHistorico':
            loadHistory();
            break;
    }
}

// ============================================
// DASHBOARD
// ============================================
async function loadDashboard() {
    try {
        // Contar itens
        const { count: itemCount } = await supabaseClient
            .from('items')
            .select('*', { count: 'exact', head: true });

        // Contar barcodes
        const { count: barcodeCount } = await supabaseClient
            .from('barcodes')
            .select('*', { count: 'exact', head: true });

        // Leituras de hoje
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { count: todayCount } = await supabaseClient
            .from('scan_logs')
            .select('*', { count: 'exact', head: true })
            .gte('scanned_at', today.toISOString());

        // Total de leituras
        const { count: totalCount } = await supabaseClient
            .from('scan_logs')
            .select('*', { count: 'exact', head: true });

        // Atualizar UI
        document.getElementById('statItems').textContent = itemCount || 0;
        document.getElementById('statBarcodes').textContent = barcodeCount || 0;
        document.getElementById('statScansToday').textContent = todayCount || 0;
        document.getElementById('statScansTotal').textContent = totalCount || 0;

        // Carregar últimas leituras
        await loadRecentScans();
    } catch (err) {
        console.error('Erro ao carregar dashboard:', err);
    }
}

async function loadRecentScans() {
    const container = document.getElementById('recentScans');

    const { data, error } = await supabaseClient
        .from('scan_logs')
        .select(`
            id,
            scanned_at,
            notes,
            items ( name, code ),
            barcodes ( barcode_value )
        `)
        .order('scanned_at', { ascending: false })
        .limit(5);

    if (error || !data || data.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📷</div>
                <h3>Nenhuma leitura ainda</h3>
                <p>Use o scanner para registrar suas primeiras leituras</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '<div class="items-list">' + data.map(scan => `
        <div class="item-card">
            <div class="item-card-info">
                <h4>${escapeHtml(scan.items?.name || 'Item removido')}</h4>
                <div class="item-code">${escapeHtml(scan.items?.code || '—')}</div>
                <div style="margin-top:4px;">
                    <span class="badge badge-blue">${escapeHtml(scan.barcodes?.barcode_value || '—')}</span>
                    ${scan.notes ? `<span class="badge badge-orange" title="${escapeHtml(scan.notes)}">💬</span>` : ''}
                </div>
            </div>
            <div style="text-align:right; font-size:var(--font-xs); color:var(--text-secondary);">
                ${formatDateTime(scan.scanned_at)}
            </div>
        </div>
    `).join('') + '</div>';
}

// ============================================
// SCANNER
// ============================================
async function startMainScanner() {
    const video = document.getElementById('scannerVideo');
    const status = document.getElementById('scannerStatus');
    const btnStart = document.getElementById('btnStartScanner');
    const btnStop = document.getElementById('btnStopScanner');

    try {
        status.textContent = 'Inicializando câmera...';
        status.className = 'scanner-status';

        appState.scanner = new BarcodeScanner();
        await appState.scanner.init(video, handleBarcodeDetected);
        await appState.scanner.start();

        btnStart.classList.add('hidden');
        btnStop.classList.remove('hidden');
        status.textContent = 'Scanner ativo — aponte para um código de barras';
    } catch (err) {
        status.textContent = `Erro: ${err.message}`;
        status.className = 'scanner-status not-found';
        showToast('Erro', err.message, 'error');
    }
}

function stopMainScanner() {
    if (appState.scanner) {
        appState.scanner.stop();
        appState.scanner = null;
    }

    const btnStart = document.getElementById('btnStartScanner');
    const btnStop = document.getElementById('btnStopScanner');
    const status = document.getElementById('scannerStatus');

    btnStart.classList.remove('hidden');
    btnStop.classList.add('hidden');
    status.textContent = 'Scanner parado';
    status.className = 'scanner-status';
}

async function handleBarcodeDetected(code, format) {
    console.log(`📊 Barcode detectado: ${code} (formato: ${format})`);
    const status = document.getElementById('scannerStatus');

    status.textContent = `Verificando código: ${code}...`;
    status.className = 'scanner-status';

    try {
        // Buscar barcode no banco
        const { data: barcodeData, error } = await supabaseClient
            .from('barcodes')
            .select(`
                id,
                barcode_value,
                items ( id, name, code )
            `)
            .eq('barcode_value', code)
            .maybeSingle();

        if (error) throw error;

        if (barcodeData && barcodeData.items) {
            // Barcode encontrado! Registro Automático (Modo Rápido)
            status.textContent = `✅ Registrado: ${barcodeData.items.name}`;
            status.className = 'scanner-status found';

            // Piscar a tela como feedback visual
            flashScannerViewport();

            // Registrar no banco imediatamente
            const { error: insertError } = await supabaseClient
                .from('scan_logs')
                .insert({
                    barcode_id: barcodeData.id,
                    item_id: barcodeData.items.id,
                    user_id: null
                });

            if (insertError) throw insertError;

            // Atualizar contadores
            appState.sessionScanCount++;
            const sessionEl = document.getElementById('sessionCount');
            if (sessionEl) sessionEl.textContent = appState.sessionScanCount;
            
            showToast('Sucesso', `${barcodeData.items.name} registrado!`, 'success', 1000);
            
            // Recarregar dashboard se estiver visível
            if (appState.currentSection === 'sectionDashboard') loadDashboard();

        } else {
            // Barcode não encontrado — Manter modal para cadastro
            status.textContent = `⚠️ Código não cadastrado: ${code}`;
            status.className = 'scanner-status not-found';

            appState.pendingScanBarcode = code;
            appState.pendingScanItem = null;
            appState.pendingScanBarcodeId = null;

            showNotFoundModal(code);
        }
    } catch (err) {
        console.error('Erro ao verificar barcode:', err);
        status.textContent = 'Erro ao verificar código';
        status.className = 'scanner-status not-found';
        showToast('Erro', 'Não foi possível verificar o código', 'error');
    }
}

function showScanConfirmModal(item, barcodeValue, found) {
    const title = document.getElementById('scanConfirmTitle');
    const content = document.getElementById('scanConfirmContent');
    const notes = document.getElementById('scanNotes');

    title.textContent = '✅ Item Encontrado';
    content.innerHTML = `
        <div class="scan-result found">
            <div class="scan-result-header">
                <div class="scan-result-icon">✅</div>
                <div class="scan-result-info">
                    <h3>${escapeHtml(item.name)}</h3>
                    <p>Código: ${escapeHtml(item.code)}</p>
                </div>
            </div>
            <div style="margin-top: var(--space-3);">
                <span class="badge badge-blue">📊 ${escapeHtml(barcodeValue)}</span>
            </div>
        </div>
    `;
    notes.value = '';
    openModal('modalScanConfirm');
}

function showNotFoundModal(code) {
    document.getElementById('quickBarcodeValue').textContent = code;
    document.getElementById('quickItemName').value = '';
    document.getElementById('quickItemCode').value = '';
    openModal('modalQuickRegister');
}

async function confirmScan() {
    const notes = document.getElementById('scanNotes').value.trim();
    const btn = document.getElementById('btnConfirmScan');

    if (!appState.pendingScanBarcodeId || !appState.pendingScanItem) {
        showToast('Erro', 'Dados de leitura inválidos', 'error');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Registrando...';

    try {
        const { error } = await supabaseClient
            .from('scan_logs')
            .insert({
                barcode_id: appState.pendingScanBarcodeId,
                item_id: appState.pendingScanItem.id,
                user_id: null,
                notes: notes || null
            });

        if (error) throw error;

        appState.sessionScanCount++;
        document.getElementById('sessionCount').textContent = appState.sessionScanCount;

        closeModal('modalScanConfirm');
        showToast('Leitura registrada!', `${appState.pendingScanItem.name} — ${appState.pendingScanItem.code}`, 'success');

        // Limpar estado
        appState.pendingScanBarcode = null;
        appState.pendingScanItem = null;
        appState.pendingScanBarcodeId = null;
    } catch (err) {
        console.error('Erro ao registrar leitura:', err);
        showToast('Erro', 'Não foi possível registrar a leitura', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '✅ Registrar Leitura';
    }
}

async function handleQuickRegister() {
    const name = document.getElementById('quickItemName').value.trim();
    const code = document.getElementById('quickItemCode').value.trim();
    const barcodeValue = appState.pendingScanBarcode;
    const btn = document.getElementById('btnQuickRegister');

    if (!name || !code) {
        showToast('Atenção', 'Preencha o nome e o código do item', 'warning');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Cadastrando...';

    try {
        // Criar item
        const { data: item, error: itemError } = await supabaseClient
            .from('items')
            .insert({ name, code, user_id: null })
            .select()
            .single();

        if (itemError) throw itemError;

        // Vincular barcode
        const { data: barcode, error: barcodeError } = await supabaseClient
            .from('barcodes')
            .insert({
                item_id: item.id,
                barcode_value: barcodeValue,
                user_id: null
            })
            .select()
            .single();

        if (barcodeError) throw barcodeError;

        // Registrar a leitura
        const { error: scanError } = await supabaseClient
            .from('scan_logs')
            .insert({
                barcode_id: barcode.id,
                item_id: item.id,
                user_id: null
            });

        if (scanError) throw scanError;

        appState.sessionScanCount++;
        document.getElementById('sessionCount').textContent = appState.sessionScanCount;

        closeModal('modalQuickRegister');
        showToast('Item cadastrado e leitura registrada!', `${name} — ${code}`, 'success');

        // Limpar estado
        appState.pendingScanBarcode = null;
    } catch (err) {
        console.error('Erro no cadastro rápido:', err);
        showToast('Erro', err.message || 'Não foi possível cadastrar', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '💾 Cadastrar e Registrar';
    }
}

function handleManualBarcode() {
    const input = document.getElementById('manualBarcodeInput');
    const code = input.value.trim();

    if (!code) {
        showToast('Atenção', 'Digite um código de barras', 'warning');
        return;
    }

    closeModal('modalManualInput');
    input.value = '';
    handleBarcodeDetected(code, 'MANUAL');
}

// ============================================
// CADASTRO DE ITENS
// ============================================
function openNewItemForm() {
    appState.editingItemId = null;
    appState.pendingBarcodes = [];

    document.getElementById('formTitle').textContent = 'Novo Item';
    document.getElementById('editItemId').value = '';
    document.getElementById('itemName').value = '';
    document.getElementById('itemCode').value = '';
    document.getElementById('barcodeInput').value = '';
    renderBarcodesList();

    document.getElementById('itemFormCard').classList.remove('hidden');
    document.getElementById('itemName').focus();
}

function closeItemForm() {
    document.getElementById('itemFormCard').classList.add('hidden');
    appState.editingItemId = null;
    appState.pendingBarcodes = [];
}

function addBarcodeToList() {
    const input = document.getElementById('barcodeInput');
    const value = input.value.trim();

    if (!value) return;

    // Verificar duplicata
    if (appState.pendingBarcodes.includes(value)) {
        showToast('Atenção', 'Este código já foi adicionado', 'warning');
        return;
    }

    appState.pendingBarcodes.push(value);
    renderBarcodesList();
    input.value = '';
    input.focus();
}

function removeBarcodeFromList(index) {
    appState.pendingBarcodes.splice(index, 1);
    renderBarcodesList();
}

function renderBarcodesList() {
    const container = document.getElementById('barcodesList');
    container.innerHTML = appState.pendingBarcodes.map((bc, i) => `
        <div class="barcode-tag">
            📊 ${escapeHtml(bc)}
            <button class="remove-barcode" onclick="removeBarcodeFromList(${i})" title="Remover">✕</button>
        </div>
    `).join('');
}

async function handleItemSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('itemName').value.trim();
    const code = document.getElementById('itemCode').value.trim();
    const isEditing = !!appState.editingItemId;

    if (!name || !code) {
        showToast('Atenção', 'Preencha o nome e o código do item', 'warning');
        return;
    }

    try {
        let itemId;

        if (isEditing) {
            // Atualizar item existente
            const { error } = await supabaseClient
                .from('items')
                .update({ name, code })
                .eq('id', appState.editingItemId);

            if (error) throw error;
            itemId = appState.editingItemId;
            showToast('Item atualizado!', `${name} — ${code}`, 'success');
        } else {
            // Criar novo item
            const { data, error } = await supabaseClient
                .from('items')
                .insert({ name, code, user_id: null })
                .select()
                .single();

            if (error) throw error;
            itemId = data.id;
            showToast('Item criado!', `${name} — ${code}`, 'success');
        }

        // Vincular barcodes pendentes
        if (appState.pendingBarcodes.length > 0) {
            const barcodesToInsert = appState.pendingBarcodes.map(bc => ({
                item_id: itemId,
                barcode_value: bc,
                user_id: null
            }));

            const { error: bcError } = await supabaseClient
                .from('barcodes')
                .insert(barcodesToInsert);

            if (bcError) {
                console.error('Erro ao vincular barcodes:', bcError);
                showToast('Aviso', 'Item salvo, mas alguns barcodes podem estar duplicados', 'warning');
            }
        }

        closeItemForm();
        await loadItems();
    } catch (err) {
        console.error('Erro ao salvar item:', err);
        showToast('Erro', err.message || 'Não foi possível salvar o item', 'error');
    }
}

async function loadItems() {
    const container = document.getElementById('itemsList');
    const countEl = document.getElementById('itemsCount');
    const search = document.getElementById('searchItems')?.value?.trim()?.toLowerCase() || '';

    try {
        let query = supabaseClient
            .from('items')
            .select(`
                id, name, code, created_at,
                barcodes ( id, barcode_value )
            `)
            .order('created_at', { ascending: false });

        const { data, error } = await query;

        if (error) throw error;

        // Filtrar localmente por busca
        let items = data || [];
        if (search) {
            items = items.filter(item =>
                item.name.toLowerCase().includes(search) ||
                item.code.toLowerCase().includes(search) ||
                (item.barcodes || []).some(bc => bc.barcode_value.toLowerCase().includes(search))
            );
        }

        countEl.textContent = `${items.length} item(ns) encontrado(s)`;

        if (items.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📦</div>
                    <h3>${search ? 'Nenhum resultado' : 'Nenhum item cadastrado'}</h3>
                    <p>${search ? 'Tente uma busca diferente' : 'Clique em "Novo Item" para começar'}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = items.map(item => `
            <div class="item-card">
                <div class="item-card-info">
                    <h4>${escapeHtml(item.name)}</h4>
                    <div class="item-code">${escapeHtml(item.code)}</div>
                    <div class="item-card-barcodes">
                        ${(item.barcodes || []).map(bc => `
                            <span class="barcode-tag">📊 ${escapeHtml(bc.barcode_value)}</span>
                        `).join('')}
                        ${(item.barcodes || []).length === 0 ? '<span style="font-size:var(--font-xs);color:var(--text-tertiary);">Nenhum barcode vinculado</span>' : ''}
                    </div>
                </div>
                <div class="item-card-actions">
                    <button class="btn btn-ghost btn-icon btn-sm" onclick="editItem('${item.id}')" title="Editar">✏️</button>
                    <button class="btn btn-ghost btn-icon btn-sm" onclick="deleteItem('${item.id}', '${escapeHtml(item.name)}')" title="Excluir">🗑️</button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Erro ao carregar itens:', err);
        container.innerHTML = '<p style="color:var(--danger-400);text-align:center;padding:var(--space-4);">Erro ao carregar itens</p>';
    }
}

async function editItem(itemId) {
    try {
        const { data: item, error } = await supabaseClient
            .from('items')
            .select(`
                id, name, code,
                barcodes ( id, barcode_value )
            `)
            .eq('id', itemId)
            .single();

        if (error) throw error;

        appState.editingItemId = itemId;
        appState.pendingBarcodes = []; // Barcodes existentes não ficam nas pendentes

        document.getElementById('formTitle').textContent = 'Editar Item';
        document.getElementById('editItemId').value = itemId;
        document.getElementById('itemName').value = item.name;
        document.getElementById('itemCode').value = item.code;
        document.getElementById('barcodeInput').value = '';

        // Mostrar barcodes existentes como tags (sem remoção neste contexto simples)
        const barcodeContainer = document.getElementById('barcodesList');
        barcodeContainer.innerHTML = (item.barcodes || []).map(bc => `
            <div class="barcode-tag">
                📊 ${escapeHtml(bc.barcode_value)}
                <button class="remove-barcode" onclick="deleteBarcode('${bc.id}', '${itemId}')" title="Remover barcode">✕</button>
            </div>
        `).join('');

        document.getElementById('itemFormCard').classList.remove('hidden');
        document.getElementById('itemName').focus();

        // Scroll para o formulário
        document.getElementById('itemFormCard').scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
        console.error('Erro ao carregar item:', err);
        showToast('Erro', 'Não foi possível carregar o item', 'error');
    }
}

async function deleteItem(itemId, itemName) {
    if (!confirm(`Excluir o item "${itemName}" e todos os seus barcodes e registros de leitura?`)) {
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('items')
            .delete()
            .eq('id', itemId);

        if (error) throw error;

        showToast('Item excluído', itemName, 'success');
        await loadItems();
    } catch (err) {
        console.error('Erro ao excluir item:', err);
        showToast('Erro', 'Não foi possível excluir o item', 'error');
    }
}

async function deleteBarcode(barcodeId, itemId) {
    if (!confirm('Remover este código de barras?')) return;

    try {
        const { error } = await supabaseClient
            .from('barcodes')
            .delete()
            .eq('id', barcodeId);

        if (error) throw error;

        showToast('Barcode removido', '', 'success');
        // Recarregar o formulário de edição
        await editItem(itemId);
    } catch (err) {
        console.error('Erro ao remover barcode:', err);
        showToast('Erro', 'Não foi possível remover o barcode', 'error');
    }
}

// ============================================
// SCANNER - Modal para cadastro
// ============================================
async function openBarcodeScanModal() {
    openModal('modalBarcodeScanner');

    const video = document.getElementById('modalScannerVideo');
    const status = document.getElementById('modalScannerStatus');

    try {
        status.textContent = 'Inicializando câmera...';
        appState.modalScanner = new BarcodeScanner();
        await appState.modalScanner.init(video, (code) => {
            // Adicionar barcode ao formulário
            const input = document.getElementById('barcodeInput');
            input.value = code;
            addBarcodeToList();
            closeBarcodeModal();
            showToast('Código capturado', code, 'success');
        });
        await appState.modalScanner.start();
        status.textContent = 'Aponte a câmera para o código de barras';
    } catch (err) {
        status.textContent = `Erro: ${err.message}`;
        showToast('Erro', err.message, 'error');
    }
}

function closeBarcodeModal() {
    if (appState.modalScanner) {
        appState.modalScanner.stop();
        appState.modalScanner = null;
    }
    closeModal('modalBarcodeScanner');
}

// ============================================
// HISTÓRICO
// ============================================
async function loadHistory() {
    const tbody = document.getElementById('historyBody');
    const pagination = document.getElementById('historyPagination');

    // Obter filtros
    const dateStart = document.getElementById('filterDateStart').value;
    const dateEnd = document.getElementById('filterDateEnd').value;
    const search = document.getElementById('filterSearch').value.trim().toLowerCase();

    const from = (appState.historyPage - 1) * appState.historyPerPage;
    const to = from + appState.historyPerPage - 1;

    try {
        let query = supabaseClient
            .from('scan_logs')
            .select(`
                id,
                scanned_at,
                notes,
                items ( name, code ),
                barcodes ( barcode_value )
            `, { count: 'exact' })
            .order('scanned_at', { ascending: false })
            .range(from, to);

        // Aplicar filtros de data
        if (dateStart) {
            query = query.gte('scanned_at', new Date(dateStart).toISOString());
        }
        if (dateEnd) {
            const endDate = new Date(dateEnd);
            endDate.setDate(endDate.getDate() + 1);
            query = query.lt('scanned_at', endDate.toISOString());
        }

        const { data, error, count } = await query;

        if (error) throw error;

        appState.historyTotal = count || 0;

        // Filtrar por busca textual localmente
        let rows = data || [];
        if (search) {
            rows = rows.filter(r =>
                (r.items?.name || '').toLowerCase().includes(search) ||
                (r.items?.code || '').toLowerCase().includes(search) ||
                (r.barcodes?.barcode_value || '').toLowerCase().includes(search) ||
                (r.notes || '').toLowerCase().includes(search)
            );
        }

        if (rows.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center; padding:var(--space-8); color:var(--text-secondary);">
                        Nenhum registro encontrado
                    </td>
                </tr>
            `;
            pagination.innerHTML = '';
            return;
        }

        tbody.innerHTML = rows.map(scan => `
            <tr>
                <td>${formatDateTime(scan.scanned_at)}</td>
                <td>${escapeHtml(scan.items?.name || 'Item removido')}</td>
                <td><span class="badge badge-blue">${escapeHtml(scan.items?.code || '—')}</span></td>
                <td><span class="barcode-tag" style="display:inline-flex;">${escapeHtml(scan.barcodes?.barcode_value || '—')}</span></td>
                <td>${scan.notes ? escapeHtml(scan.notes) : '<span style="color:var(--text-tertiary);">—</span>'}</td>
            </tr>
        `).join('');

        // Renderizar paginação
        renderPagination(count);
    } catch (err) {
        console.error('Erro ao carregar histórico:', err);
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; color:var(--danger-400);">Erro ao carregar dados</td>
            </tr>
        `;
    }
}

function renderPagination(total) {
    const pagination = document.getElementById('historyPagination');
    const totalPages = Math.ceil(total / appState.historyPerPage);

    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let html = '';

    // Botão anterior
    html += `<button ${appState.historyPage <= 1 ? 'disabled' : ''} onclick="goToPage(${appState.historyPage - 1})">◀</button>`;

    // Páginas
    const maxVisible = 5;
    let start = Math.max(1, appState.historyPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);

    if (start > 1) {
        html += `<button onclick="goToPage(1)">1</button>`;
        if (start > 2) html += '<span class="page-info">...</span>';
    }

    for (let i = start; i <= end; i++) {
        html += `<button class="${i === appState.historyPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }

    if (end < totalPages) {
        if (end < totalPages - 1) html += '<span class="page-info">...</span>';
        html += `<button onclick="goToPage(${totalPages})">${totalPages}</button>`;
    }

    // Botão próximo
    html += `<button ${appState.historyPage >= totalPages ? 'disabled' : ''} onclick="goToPage(${appState.historyPage + 1})">▶</button>`;

    pagination.innerHTML = html;
}

function goToPage(page) {
    appState.historyPage = page;
    loadHistory();
}

function clearFilters() {
    document.getElementById('filterDateStart').value = '';
    document.getElementById('filterDateEnd').value = '';
    document.getElementById('filterSearch').value = '';
    appState.historyPage = 1;
    loadHistory();
}

async function exportCSV() {
    try {
        showToast('Exportando...', 'Gerando arquivo CSV', 'info');

        // Buscar todos os dados (sem paginação)
        const { data, error } = await supabaseClient
            .from('scan_logs')
            .select(`
                id,
                scanned_at,
                notes,
                items ( name, code ),
                barcodes ( barcode_value )
            `)
            .order('scanned_at', { ascending: false });

        if (error) throw error;
        if (!data || data.length === 0) {
            showToast('Aviso', 'Nenhum dado para exportar', 'warning');
            return;
        }

        // Aplicar filtros de data se houver
        const dateStart = document.getElementById('filterDateStart').value;
        const dateEnd = document.getElementById('filterDateEnd').value;
        const search = document.getElementById('filterSearch').value.trim().toLowerCase();

        let rows = data;

        if (dateStart) {
            const startDate = new Date(dateStart);
            rows = rows.filter(r => new Date(r.scanned_at) >= startDate);
        }
        if (dateEnd) {
            const endDate = new Date(dateEnd);
            endDate.setDate(endDate.getDate() + 1);
            rows = rows.filter(r => new Date(r.scanned_at) < endDate);
        }
        if (search) {
            rows = rows.filter(r =>
                (r.items?.name || '').toLowerCase().includes(search) ||
                (r.items?.code || '').toLowerCase().includes(search) ||
                (r.barcodes?.barcode_value || '').toLowerCase().includes(search)
            );
        }

        // Gerar CSV
        const header = 'Data/Hora,Item,Código,Barcode,Observação\n';
        const csvRows = rows.map(r =>
            `"${formatDateTime(r.scanned_at)}","${r.items?.name || ''}","${r.items?.code || ''}","${r.barcodes?.barcode_value || ''}","${(r.notes || '').replace(/"/g, '""')}"`
        ).join('\n');

        const csv = '\uFEFF' + header + csvRows; // BOM para UTF-8 no Excel
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `centralux-barcode-historico-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();

        URL.revokeObjectURL(url);
        showToast('Exportação concluída!', `${rows.length} registros exportados`, 'success');
    } catch (err) {
        console.error('Erro ao exportar CSV:', err);
        showToast('Erro', 'Não foi possível exportar os dados', 'error');
    }
}

// ============================================
// MODAIS
// ============================================
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('active');

    // Fechar ao clicar fora
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modalId);
    });

    // Fechar com ESC
    document.addEventListener('keydown', function handler(e) {
        if (e.key === 'Escape') {
            closeModal(modalId);
            document.removeEventListener('keydown', handler);
        }
    });
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('active');

    // Se for o modal do scanner, parar o scanner
    if (modalId === 'modalBarcodeScanner') {
        closeBarcodeModal();
    }
}

// ============================================
// UTILIDADES
// ============================================
function showToast(title, message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <div class="toast-content">
            <div class="toast-title">${escapeHtml(title)}</div>
            <div class="toast-message">${escapeHtml(message)}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        if (toast.parentElement) toast.remove();
    }, 5000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function debounce(fn, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}
