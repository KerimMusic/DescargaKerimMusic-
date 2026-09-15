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
    let modalItem   = null;
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

    /* ---------- Título unificado: fuente única de verdad ---------- */
    function getItemTitle(item) {
        if (!item) return '';
        return (
            item.querySelector('.item-title')?.textContent.trim() ||
            item.dataset.title?.trim() ||
            ''
        );
    }

    /* ---------- Portada unificada: fuente única de verdad ---------- */
    function getItemCover(item) {
        if (!item) return '';
        const img = item.querySelector('.thumbnail img');
        if (img && img.getAttribute('src')) return img.src;
        return item.dataset.cover || '';
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
        const cover = getItemCover(item);
        const title = getItemTitle(item);

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

        console.warn('Pista no reproducible:', getItemTitle(failedItem) || failedItem);

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
        if (e.target.closest('.buy-button')) {
            const item = e.target.closest('.playlist-item');
            if (!item) return;

            const title = getItemTitle(item) || 'Titulo';
            const cover = getItemCover(item);

            modalBeatTitle.textContent = title;
            modalImg.src = cover;

            modalItem = item;

            purchaseModal.classList.add('visible');

            e.stopPropagation();
            return;
        }

        const item = e.target.closest('.playlist-item');
        if (!item) return;
        loadItem(item, true);
    });

    /* ---------- Eventos de la Modal ---------- */

    closeModalBtn.addEventListener('click', () => {
        purchaseModal.classList.remove('visible');
    });

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
        exclusivo: { nombre: 'EXCLUSIVA', precio: 'A convenir con el Beatmaker' }
    };

    function buildTelegramUrl(beatTitle, beatInfo, licencia) {
        const esExclusiva = licencia.nombre === 'EXCLUSIVA';

        const bloquePrecio = esExclusiva
            ? 'Precio: A convenir directamente con el Beatmaker\n'
            : `Precio: ${licencia.precio}\n`;

        const mensaje =
            'Hola, quiero comprar este beat.\n\n' +
            `Beat: ${beatTitle}\n` +
            `Licencia: ${licencia.nombre}\n` +
            bloquePrecio +
            '\nInformación del beat:\n' +
            `${beatInfo}`;

        return `${TELEGRAM_USER}?text=${encodeURIComponent(mensaje)}`;
    }

    document.querySelectorAll('.price-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const type = e.target.dataset.type;
            const licencia = LICENSE_INFO[type];
            if (!licencia) return;

            const source = modalItem || currentItem;
            const beatTitle =
                getItemTitle(source) ||
                modalBeatTitle.textContent.trim() ||
                'Sin título';

            const subtitle =
                source?.querySelector('.item-subtitle')?.textContent.trim() || '';

            const beatInfo = subtitle || 'No disponible';

            const url = buildTelegramUrl(beatTitle, beatInfo, licencia);

            window.open(url, '_blank');

            purchaseModal.classList.remove('visible');
        });
    });

    /* ---------- Sincronización EN VIVO de portadas ---------- */
    const coverObserver = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            const img  = mutation.target;
            const item = img.closest('.playlist-item');
            if (!item) return;

            const newSrc = img.getAttribute('src') || '';

            if (item === currentItem) {
                playerCover.src = newSrc;
            }
            if (item === modalItem && purchaseModal.classList.contains('visible')) {
                modalImg.src = newSrc;
            }
        });
    });

    getAllItems().forEach(item => {
        const img = item.querySelector('.thumbnail img');
        if (img) {
            coverObserver.observe(img, { attributes: true, attributeFilter: ['src'] });
        }
    });

    /* ---------- FUNCIÓN DE BÚSQUEDA CON EL CORAZÓN ---------- */
    const heartSearchBtn = document.getElementById('heart-search-btn');
    const searchContainer = document.getElementById('search-container');
    const searchInput = document.getElementById('search-input');

    if (heartSearchBtn && searchContainer && searchInput) {
        
        // Abrir/Cerrar la barra de búsqueda al hacer clic en el corazón
        heartSearchBtn.addEventListener('click', () => {
            searchContainer.classList.toggle('visible');
            
            if (searchContainer.classList.contains('visible')) {
                searchInput.focus();
            } else {
                searchInput.value = '';
                searchInput.dispatchEvent(new Event('input')); 
            }
        });

        // Filtrar los beats en tiempo real mientras se escribe
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            const items = document.querySelectorAll('.playlist-item');

            items.forEach(item => {
                const title = item.querySelector('.item-title')?.textContent.toLowerCase() || '';
                const subtitle = item.querySelector('.item-subtitle')?.textContent.toLowerCase() || '';
                
                if (title.includes(query) || subtitle.includes(query)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    }

    /* ---------- FUNCIÓN DE COMPARTIR (enlace de descarga APK) ---------- */
    const shareBtn = document.getElementById('share-btn');
    const SHARE_URL = 'https://apk.e-droid.net/apk/app4183393-bd2q7x.apk?v=2';
    
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            const currentTitle = currentItem ? getItemTitle(currentItem) : document.title;
            const shareData = {
                title: 'Omega Beats',
                text: currentTitle ? `Escucha este beat: ${currentTitle}` : 'Escucha Omega Beats',
                url: SHARE_URL
            };

            if (navigator.share) {
                navigator.share(shareData)
                    .then(() => console.log('Compartido con éxito'))
                    .catch((error) => console.log('Error al compartir:', error));
            } else {
                // Fallback para navegadores que no soportan Web Share API (como escritorio)
                const textToCopy = `${shareData.text}\n${SHARE_URL}`;
                navigator.clipboard.writeText(textToCopy).then(() => {
                    alert('¡Enlace y título copiados al portapapeles!');
                }).catch(err => {
                    console.error('Error al copiar:', err);
                    alert('No se pudo compartir automáticamente. Copia este enlace: ' + SHARE_URL);
                });
            }
        });
    }

});
