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

    /* ============================================================
       FEEL NATIVO: HAPTICS + RIPPLE
       ============================================================ */

    // Vibración suave (solo si el dispositivo la soporta)
    function haptic(ms = 12) {
        if (navigator.vibrate) {
            try { navigator.vibrate(ms); } catch (_) {}
        }
    }

    // Crea el efecto ripple en cualquier elemento pulsable
    function attachRipple(el, opts = {}) {
        if (!el || el.dataset.rippleReady === '1') return;
        el.dataset.rippleReady = '1';

        el.classList.add('ripple-host');

        el.addEventListener('pointerdown', (e) => {
            const rect = el.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = (e.clientX ?? rect.left + rect.width / 2) - rect.left;
            const y = (e.clientY ?? rect.top  + rect.height / 2) - rect.top;

            const ripple = document.createElement('span');
            ripple.className = 'ripple';
            ripple.style.width  = ripple.style.height = size + 'px';
            ripple.style.left   = (x - size / 2) + 'px';
            ripple.style.top    = (y - size / 2) + 'px';

            el.appendChild(ripple);

            ripple.addEventListener('animationend', () => ripple.remove());
        });

        // Haptic en el momento del toque real
        el.addEventListener('pointerdown', () => haptic(opts.haptic ?? 12), { passive: true });
    }

    // Aplicar ripple + haptics a TODOS los elementos pulsables
    const RIPPLE_TARGETS = [
        '.menu-btn',
        '.heart-search-btn',
        '.share-btn',
        '.close-submenu',
        '.submenu-link',
        '.close-modal',
        '.buy-button',
        '.price-button',
        '.play-button'
    ];

    RIPPLE_TARGETS.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => attachRipple(el));
    });

    // En las filas de la lista un ripple más tenue y sin vibrar
    document.querySelectorAll('.playlist-item').forEach(el => {
        attachRipple(el, { haptic: 0 });
        el.style.setProperty('--ripple-color', 'rgba(255, 255, 255, 0.10)');
    });

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

    function getItemTitle(item) {
        if (!item) return '';
        return (
            item.querySelector('.item-title')?.textContent.trim() ||
            item.dataset.title?.trim() ||
            ''
        );
    }

    function getItemCover(item) {
        if (!item) return '';
        const img = item.querySelector('.thumbnail img');
        if (img && img.getAttribute('src')) return img.src;
        return item.dataset.cover || '';
    }

    /* ---------- Mezclar ---------- */

    function shufflePlaylist() {
        const items = getAllItems();
        for (let i = items.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [items[i], items[j]] = [items[j], items[i]];
        }
        items.forEach(item => playlist.appendChild(item));
    }

    /* ---------- Cargar item ---------- */

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

    /* ---------- Init ---------- */

    shufflePlaylist();

    /* ---------- Play ---------- */

    playButton.addEventListener('click', () => {
        if (!currentItem) {
            playRandomItem();
            return;
        }
        if (audioPlayer.paused) {
            audioPlayer.play().catch(err => console.error('Error al reproducir:', err));
        } else {
            audioPlayer.pause();
        }
    });

    /* ---------- Eventos de audio ---------- */

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

    /* ---------- Buscar en barra de progreso ---------- */

    progressBar.addEventListener('click', (e) => {
        if (!audioPlayer.duration) return;
        const rect  = progressBar.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        audioPlayer.currentTime = Math.min(1, Math.max(0, ratio)) * audioPlayer.duration;
    });

    /* ---------- Lista + COMPRAR ---------- */

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

            // Ripple/haptic en el botón de comprar recién creado (por si es dinámico)
            attachRipple(e.target.closest('.buy-button'));

            e.stopPropagation();
            return;
        }

        const item = e.target.closest('.playlist-item');
        if (!item) return;
        loadItem(item, true);
    });

    /* ---------- Modal ---------- */

    closeModalBtn.addEventListener('click', () => {
        purchaseModal.classList.remove('visible');
    });

    purchaseModal.addEventListener('click', (e) => {
        if (e.target === purchaseModal) {
            purchaseModal.classList.remove('visible');
        }
    });

    /* ---------- Compra → Telegram ---------- */

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

    /* ---------- Sincronización de portadas ---------- */
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

    /* ---------- Buscar (corazón) ---------- */
    const heartSearchBtn  = document.getElementById('heart-search-btn');
    const searchContainer = document.getElementById('search-container');
    const searchInput     = document.getElementById('search-input');

    if (heartSearchBtn && searchContainer && searchInput) {

        heartSearchBtn.addEventListener('click', () => {
            searchContainer.classList.toggle('visible');

            if (searchContainer.classList.contains('visible')) {
                searchInput.focus();
            } else {
                searchInput.value = '';
                searchInput.dispatchEvent(new Event('input'));
            }
        });

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            const items = document.querySelectorAll('.playlist-item');

            items.forEach(item => {
                const title    = item.querySelector('.item-title')?.textContent.toLowerCase() || '';
                const subtitle = item.querySelector('.item-subtitle')?.textContent.toLowerCase() || '';

                if (title.includes(query) || subtitle.includes(query)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    }

    /* ---------- Compartir ---------- */
    const shareBtn = document.getElementById('share-btn');
    const SHARE_URL = 'https://kerimmusic.github.io/DescargarAppOmegaBeats/';

    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            const currentTitle = currentItem ? getItemTitle(currentItem) : document.title;
            const shareData = {
                title: 'Omega Beats',
                text:  currentTitle ? `Escucha este beat: ${currentTitle}` : 'Escucha Omega Beats',
                url:   SHARE_URL
            };

            if (navigator.share) {
                navigator.share(shareData)
                    .then(() => console.log('Compartido con éxito'))
                    .catch((error) => console.log('Error al compartir:', error));
            } else {
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

    /* ---------- Submenú ---------- */
    const menuBtn         = document.getElementById('menu-btn');
    const submenu         = document.getElementById('submenu');
    const submenuOverlay  = document.getElementById('submenu-overlay');
    const closeSubmenuBtn = document.getElementById('close-submenu');

    function openSubmenu() {
        if (!submenu || !submenuOverlay) return;
        submenu.classList.add('visible');
        submenuOverlay.classList.add('visible');
        submenu.setAttribute('aria-hidden', 'false');
    }

    function closeSubmenu() {
        if (!submenu || !submenuOverlay) return;
        submenu.classList.remove('visible');
        submenuOverlay.classList.remove('visible');
        submenu.setAttribute('aria-hidden', 'true');
    }

    if (menuBtn)         menuBtn.addEventListener('click', openSubmenu);
    if (closeSubmenuBtn) closeSubmenuBtn.addEventListener('click', closeSubmenu);
    if (submenuOverlay)  submenuOverlay.addEventListener('click', closeSubmenu);

    document.querySelectorAll('.submenu-link').forEach(link => {
        link.addEventListener('click', closeSubmenu);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeSubmenu();
    });

});
