document.addEventListener('DOMContentLoaded', () => {

    const playButton     = document.getElementById('play-button');
    const playIcon       = document.getElementById('play-icon');
    const audioPlayer    = document.getElementById('audio-player');
    const progressBar    = document.getElementById('progress-bar');
    const currentTimeEl  = document.getElementById('current-time');
    const durationEl     = document.getElementById('duration');
    const playerTitle    = document.getElementById('player-title');
    const playerCover    = document.getElementById('player-cover');
    const player         = document.getElementById('player');
    const playlist       = document.getElementById('playlist');

    // Elementos de la Modal
    const purchaseModal  = document.getElementById('purchase-modal');
    const closeModalBtn  = document.getElementById('close-modal');
    const modalImg       = document.getElementById('modal-img');
    const modalBeatTitle = document.getElementById('modal-beat-title');

    let currentItem = null;
    let modalItem   = null;   // Beat que abrió la modal actual
    let isSkipping  = false;

    const ICON_PLAY  = '<polygon points="5,3 19,12 5,21" fill="#ffffff" />';
    const ICON_PAUSE = '<rect x="6" y="4" width="4" height="16" fill="#ffffff" />' +
                       '<rect x="14" y="4" width="4" height="16" fill="#ffffff" />';

    /* ---------- Utilidades ---------- */

    function formatTime(seconds) {
        if (!isFinite(seconds) || seconds < 0) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const secs    = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    }

    function updateProgress(percent) {
        const value = Math.min(100, Math.max(0, percent));
        progressBar.style.setProperty('--progress', `${value}%`);
        progressBar.setAttribute('aria-valuenow', Math.round(value));
    }

    function updateIcon(playing) {
        playIcon.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
        playIcon.style.marginLeft = playing ? '0' : '3px';
        playButton.setAttribute('aria-label', playing ? 'Pausar' : 'Reproducir');
    }

    function getAllItems() {
        return Array.from(playlist.querySelectorAll('.playlist-item'));
    }

    /* ---------- Mezclar aleatoriamente la lista ---------- */

    function shufflePlaylist() {
        const items = getAllItems();
        for (let i = items.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [items[i], items[j]] = [items[j], items[i]];
        }
        items.forEach(item => playlist.appendChild(item));
    }

    /* ---------- Cargar un ítem en el reproductor ---------- */

    function loadItem(item, autoplay = true) {
        if (!item) return;

        const src   = item.dataset.src;
        const cover = item.dataset.cover;
        const title = item.dataset.title ||
                      item.querySelector('.item-title')?.textContent.trim() || '';

        if (!src) {
            console.warn('Ítem sin data-src:', item);
            handleLoadError(item);
            return;
        }

        getAllItems().forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        currentItem = item;
        playerCover.src = cover || '';
        playerTitle.textContent = title;
        player.classList.add('active');

        audioPlayer.src = src;
        audioPlayer.currentTime = 0;
        updateProgress(0);
        currentTimeEl.textContent = '0:00';
        durationEl.textContent = '0:00';

        if (autoplay) {
            audioPlayer.play().catch(err => {
                console.warn('No se pudo iniciar automáticamente:', err);
            });
        }
    }

    /* ---------- Manejo de errores de carga ---------- */

    function handleLoadError(failedItem) {
        if (isSkipping) return;
        isSkipping = true;

        console.warn('Pista no reproducible:', failedItem?.dataset?.title || failedItem);

        updateIcon(false);
        updateProgress(0);
        currentTimeEl.textContent = '0:00';
        durationEl.textContent = '0:00';

        setTimeout(() => {
            isSkipping = false;
            playRandomItem();
        }, 300);
    }

    audioPlayer.addEventListener('error', () => {
        handleLoadError(currentItem);
    });

    /* ---------- Elegir un ítem aleatorio ---------- */

    function playRandomItem() {
        const items = getAllItems();
        if (items.length === 0) return;

        let candidates = items;
        if (items.length > 1 && currentItem) {
            candidates = items.filter(i => i !== currentItem);
        }
        const randomItem = candidates[Math.floor(Math.random() * candidates.length)];
        loadItem(randomItem, true);
    }

    /* ---------- Inicialización ---------- */

    shufflePlaylist();

    /* ---------- Botón de play ---------- */

    playButton.addEventListener('click', () => {
        if (!currentItem) return;
        if (audioPlayer.paused) {
            audioPlayer.play().catch(err => console.error('Error al reproducir:', err));
        } else {
            audioPlayer.pause();
        }
    });

    /* ---------- Eventos del audio ---------- */

    audioPlayer.addEventListener('play',  () => updateIcon(true));
    audioPlayer.addEventListener('pause', () => updateIcon(false));

    audioPlayer.addEventListener('loadedmetadata', () => {
        durationEl.textContent = formatTime(audioPlayer.duration);
    });

    audioPlayer.addEventListener('timeupdate', () => {
        currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
        if (audioPlayer.duration > 0) {
            updateProgress((audioPlayer.currentTime / audioPlayer.duration) * 100);
        }
    });

    audioPlayer.addEventListener('ended', () => {
        updateIcon(false);
        updateProgress(0);
        currentTimeEl.textContent = '0:00';
        playRandomItem();
    });

    /* ---------- Buscar en la barra de progreso ---------- */

    progressBar.addEventListener('click', (e) => {
        if (!audioPlayer.duration) return;
        const rect  = progressBar.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        audioPlayer.currentTime = Math.min(1, Math.max(0, ratio)) * audioPlayer.duration;
    });

    /* ---------- Clic en la lista de reproducción y botón COMPRAR ---------- */

    playlist.addEventListener('click', (e) => {
        // Si se hace clic en el botón de comprar
        if (e.target.closest('.buy-button')) {
            const item = e.target.closest('.playlist-item');
            if (!item) return;

            const title = item.dataset.title || item.querySelector('.item-title')?.textContent.trim() || 'Titulo';
            const cover = item.dataset.cover || '';

            // Rellenar la modal
            modalBeatTitle.textContent = title;
            modalImg.src = cover;

            // Guardar el beat que abrió la modal
            modalItem = item;

            // Mostrar la modal
            purchaseModal.classList.add('visible');

            e.stopPropagation(); // Detiene la propagación para que no se active el reproductor
            return;
        }

        // Si se hace clic en cualquier otra parte del ítem, se reproduce
        const item = e.target.closest('.playlist-item');
        if (!item) return;
        loadItem(item, true);
    });

    /* ---------- Eventos de la Modal ---------- */

    // Cerrar modal con el botón X
    closeModalBtn.addEventListener('click', () => {
        purchaseModal.classList.remove('visible');
    });

    // Cerrar modal al hacer clic fuera del contenido (en el overlay)
    purchaseModal.addEventListener('click', (e) => {
        if (e.target === purchaseModal) {
            purchaseModal.classList.remove('visible');
        }
    });

    /* ---------- Compra: abrir Telegram con mensaje dinámico ---------- */

    const TELEGRAM_USER = 'https://t.me/Soporte95';

    const LICENSE_INFO = {
        mp3:       { nombre: 'MP3',       precio: '$300 MXN' },
        wav:       { nombre: 'WAV',       precio: '$600 MXN' },
        exclusivo: { nombre: 'EXCLUSIVA', precio: '$600 MXN' }
    };

    function buildTelegramUrl(beatTitle, beatInfo, licencia) {
        const mensaje =
            'Hola, quiero comprar este beat.\n\n' +
            `Beat: ${beatTitle}\n` +
            `Licencia: ${licencia.nombre}\n` +
            `Precio: ${licencia.precio}\n\n` +
            'Información del beat:\n' +
            `${beatInfo}`;

        return `${TELEGRAM_USER}?text=${encodeURIComponent(mensaje)}`;
    }

    // Manejar clic en los botones de precios (MP3, WAV, Exclusivo)
    document.querySelectorAll('.price-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const type = e.target.dataset.type;
            const licencia = LICENSE_INFO[type];
            if (!licencia) return;

            // Obtener la info dinámica del beat que abrió la modal
            const source = modalItem || currentItem;
            const beatTitle =
                (source?.dataset?.title) ||
                source?.querySelector('.item-title')?.textContent.trim() ||
                modalBeatTitle.textContent ||
                'Sin título';

            const subtitle =
                source?.querySelector('.item-subtitle')?.textContent.trim() || '';

            const beatInfo = subtitle || 'No disponible';

            const url = buildTelegramUrl(beatTitle, beatInfo, licencia);

            // Abre Telegram con el mensaje preparado en el campo de escritura
            window.open(url, '_blank');

            purchaseModal.classList.remove('visible');
        });
    });

});
