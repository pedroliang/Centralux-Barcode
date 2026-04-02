// ============================================
// Centralux Barcode — Scanner de Código de Barras
// Utiliza ZXing-js para leitura em tempo real
// ============================================

class BarcodeScanner {
    constructor() {
        this.codeReader = null;
        this.videoElement = null;
        this.isRunning = false;
        this.onDetected = null; // Callback quando código é detectado
        this.lastCode = null;
        this.lastCodeTime = 0;
        this.debounceMs = 2000; // Evita leituras duplicadas em 2s
        this.selectedDeviceId = null;
    }

    /**
     * Inicializa o scanner com ZXing
     * @param {HTMLVideoElement} videoElement - Elemento de vídeo para exibir a câmera
     * @param {Function} onDetected - Callback chamado ao detectar um código
     */
    async init(videoElement, onDetected) {
        this.videoElement = videoElement;
        this.onDetected = onDetected;

        // Verificar se ZXing está disponível
        if (typeof ZXing === 'undefined') {
            throw new Error('Biblioteca ZXing não está carregada. Verifique a conexão com a internet.');
        }

        // Criar instância do leitor de múltiplos formatos
        this.codeReader = new ZXing.BrowserMultiFormatReader();

        // Obter lista de câmeras disponíveis
        try {
            const devices = await this.codeReader.listVideoInputDevices();
            console.log('📷 Câmeras encontradas:', devices.length);

            if (devices.length === 0) {
                throw new Error('Nenhuma câmera encontrada no dispositivo.');
            }

            // Preferir câmera traseira (back/rear/environment)
            const backCamera = devices.find(d =>
                /back|rear|traseira|environment/i.test(d.label)
            );

            this.selectedDeviceId = backCamera ? backCamera.deviceId : devices[devices.length - 1].deviceId;

            console.log('📷 Câmera selecionada:', backCamera ? 'Traseira' : 'Padrão');

            return devices;
        } catch (err) {
            console.error('❌ Erro ao acessar câmeras:', err);
            throw new Error('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
        }
    }

    /**
     * Inicia a leitura contínua de códigos de barras
     */
    async start() {
        if (!this.codeReader || !this.videoElement) {
            throw new Error('Scanner não inicializado. Chame init() primeiro.');
        }

        if (this.isRunning) {
            console.log('⚠️ Scanner já está em execução.');
            return;
        }

        try {
            this.isRunning = true;

            await this.codeReader.decodeFromVideoDevice(
                this.selectedDeviceId,
                this.videoElement,
                (result, err) => {
                    if (result) {
                        const code = result.getText();
                        const now = Date.now();

                        // Debounce: evitar leituras repetidas do mesmo código
                        if (code === this.lastCode && (now - this.lastCodeTime) < this.debounceMs) {
                            return;
                        }

                        this.lastCode = code;
                        this.lastCodeTime = now;

                        console.log('✅ Código detectado:', code);

                        // Feedback sonoro (beep)
                        this.playBeep();

                        // Feedback visual (vibração em dispositivos móveis)
                        if (navigator.vibrate) {
                            navigator.vibrate(100);
                        }

                        // Chamar callback
                        if (this.onDetected) {
                            this.onDetected(code, result.getBarcodeFormat());
                        }
                    }

                    if (err && !(err instanceof ZXing.NotFoundException)) {
                        console.error('Erro na leitura:', err);
                    }
                }
            );

            console.log('🎥 Scanner iniciado');
        } catch (err) {
            this.isRunning = false;
            console.error('❌ Erro ao iniciar scanner:', err);
            throw err;
        }
    }

    /**
     * Para a leitura de códigos
     */
    stop() {
        if (this.codeReader) {
            this.codeReader.reset();
            this.isRunning = false;
            this.lastCode = null;
            console.log('🛑 Scanner parado');
        }
    }

    /**
     * Troca a câmera ativa
     * @param {string} deviceId - ID do dispositivo de vídeo
     */
    async switchCamera(deviceId) {
        this.selectedDeviceId = deviceId;
        if (this.isRunning) {
            this.stop();
            await this.start();
        }
    }

    /**
     * Reproduz um som de "beep" usando Web Audio API
     */
    playBeep() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            oscillator.frequency.value = 1200; // Frequência do beep
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);

            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + 0.15);
        } catch (e) {
            // Ignorar erros de áudio silenciosamente
        }
    }

    /**
     * Verifica se a câmera está disponível
     * @returns {boolean}
     */
    get isActive() {
        return this.isRunning;
    }
}

// Exportar instância global
window.BarcodeScanner = BarcodeScanner;
