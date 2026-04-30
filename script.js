(() => {
    'use strict';

    const CONFIG = {
        adminEmail: 'chdrey@gmail.com',
        adminUsername: 'PenPaleto',
        supabaseUrl: 'https://pflgpjywwovlrvtpwgfi.supabase.co',
        supabaseKey: 'sb_publishable_yij9AdnvenadfIts9zvj_A_FPNUAVf2',
        youtubeSrc: 'https://www.youtube.com/embed/XDvLE7TZBmk?start=699&autoplay=0&mute=0&playsinline=1&controls=1&rel=0&enablejsapi=1&origin=' + encodeURIComponent(window.location.origin || window.location.href.split('/').slice(0,3).join('/')),
        draftKey: 'story-nook:draft:v2',
        guestNameKey: 'story-nook:guest-name:v2',
        avatarBucket: 'avatars',
        placeholderAvatarPath: 'assets/placeholders/',
        placeholderAvatarManifest: 'assets/placeholders/placeholders.json',
        placeholderAvatars: [
            'placeholder-crow.png',
            'placeholder-dogo.png',
            'placeholder-kitty.png',
            'placeholder-owl.png',
            'placeholder-squirrel.png'
        ],
        prizeAvatarPath: 'assets/prizes/avatars/',
        prizeAvatarManifest: 'assets/prizes/avatars/prize-avatars.json',
        prompts: [
            'A knight stands at a distance, gazing toward the entrance of a citadel he has finally returned to. Something has happened before this moment—something the reader does not yet know. Write the story of what led him here, what he has lost or gained, and why he hesitates before entering.',
            'At midnight, the fireplace starts whispering memories that do not belong to anyone in the room.',
            'A narrow hidden door appears under an old desk, and only tired writers can see it.',
            'Someone mails a letter to the moon and receives a reply written in pressed leaves.',
            'The last train of the evening stops at a station that was erased from every map.',
            'A character wakes up with a glowing bookmark tucked behind their ear.',
            'Every time the kettle sings, a forgotten fairy tale changes its ending.'
        ],
        badges: [
            { id: 1, name: 'The Bard', css: 'frame-wood' },
            { id: 2, name: 'Talk of the Nook', css: 'frame-copper' },
            { id: 3, name: 'The Ink Scribble', css: 'frame-stone' },
            { id: 4, name: 'The Cliffhanger', css: 'frame-iron' },
            { id: 5, name: 'The Golden Quill', css: 'frame-gold' },
            { id: 6, name: 'The Trilogy Master', css: 'frame-diamond' }
        ]
    };

    const LEGACY_PLACEHOLDER_AVATARS = [
        'ChatGPT Image Apr 29, 2026, 12_06_50 AM.png',
        'ChatGPT Image Apr 29, 2026, 12_22_16 AM.png',
        'ChatGPT Image Apr 29, 2026, 12_26_34 AM.png',
        'subscriber-placeholder-01.png',
        'subscriber-placeholder-02.png'
    ];

    const enableMenuSound = true;
    const enableRibbonMenu = false;
    const writingStyleKey = 'story-nook:writing-style:v1';
    const typingSoundKey = 'story-nook:typing-sound:v1';


    const state = {
        db: null,
        currentUser: null,
        currentProfile: null,
        isAdmin: false,
        activeStoryId: null,
        activeStory: null,
        editingStoryId: null,
        currentPrompt: '',
        currentVideoUrl: '',
        isSignUp: false,
        feedLimit: 30,
        feedStories: [],
        topStories: [],
        archiveStories: [],
        initialized: false,
        ambient: {
            ctx: null,
            master: null,
            activeSounds: new Map(),
            effectsEnabled: true,
            audioMuted: false,
            audioVolume: 0.5,
            activeLighting: null
        },
        writingTap: {
            startX: 0,
            startY: 0,
            startTime: 0,
            moved: false,
            intentionalUntil: 0
        },
        placeholderAvatars: CONFIG.placeholderAvatars.map((file) => `${CONFIG.placeholderAvatarPath}${file}`),
        prizeAvatars: [],
        avatarRewardState: {
            badges: new Set(),
            stats: { stories: 0, hearts: 0, words: 0 }
        },
        avatarPositionSaveTimer: null
    };

    const LIGHTING_CLASSES = [
        'light-fireplace-glow',
        'light-rain-ambience',
        'light-wind',
        'light-thunder-flashes',
        'light-summer-daylight',
        'light-twilight',
        'light-lamplight',
        'light-moonlit-desk'
    ];

    const AUDIO_SOURCES = {
        'relaxing-rain': 'assets/audio/relaxing-rain.mp3',
        'fireplace': 'assets/audio/fireplace.mp3',
        'ocean-waves': 'assets/audio/ocean-waves.mp3',
        'morning-birds': 'assets/audio/morning-birds.mp3',
        'relaxing-storm': 'assets/audio/relaxing-storm.mp3',
        'day-at-the-park': 'assets/audio/day-at-the-park.mp3',
        'far-away-thunder': 'assets/audio/far-away-thunder.mp3',
        'humming': 'assets/audio/humming.mp3',
        'brown-noise': 'assets/audio/brown-noise.mp3'
    };


    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

    document.addEventListener('DOMContentLoaded', boot);

    function boot() {
        document.body.classList.remove('focus-mode', 'candle-lit', 'candle-brightness-active', 'quiet-room', 'effects-off', ...LIGHTING_CLASSES);
        wireStaticEvents();
        restoreDraft();
        restoreWritingStyle();
        restoreTypingSoundToggle();
        loadPlaceholderAvatars();
        loadPrizeAvatars();
        updateWritingMoodState();
        updateCharCounter();
        setWeeklyPrompt(CONFIG.prompts[0]);
        loadYouTubePlayer();
        playBackgroundVideo();
        updateFocusMuteButton();
        updateFocusVisibility();
        updateCandleBrightness();
        updateFocusToggleButton();
        applyDefaultLightingEffect();
        updateAmbientTriggerStates();
        primeYouTubeAudio();
        initializeSupabase();
    }

    function inviteWritingDeskOnLoad() {
        // Kept as a no-op so older references do not reintroduce the load-time desk motion.
    }

    function initializeSupabase() {
        try {
            if (!window.supabase) {
                setOfflineMode('Supabase did not load. The page still works visually, but login and publishing need the Supabase CDN.');
                return;
            }
            state.db = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
            initApp().catch((error) => {
                console.error('App init failed:', error);
                setOfflineMode('Could not connect to the story database. Check your Supabase project settings and RLS rules.');
            });
        } catch (error) {
            console.error('Supabase init error:', error);
            setOfflineMode('Supabase setup failed. Please check the project URL and anon key.');
        }
    }

    async function initApp() {
        const { data: { session } } = await state.db.auth.getSession();
        await handleUserSession(session, { skipFetch: true });
        state.db.auth.onAuthStateChange(async (_event, session) => {
            await handleUserSession(session);
        });
        await loadSiteSettings();
        await fetchStories();
        state.initialized = true;
    }

    function wireStaticEvents() {
        const nav = $('#mainNav');
        nav?.classList.remove('scrolled');
        window.addEventListener('scroll', () => {
            // Header is intentionally steady now: no shrink/contract effect while scrolling.
            nav?.classList.remove('scrolled');
        }, { passive: true });

        $('#navLogo')?.addEventListener('click', scrollToTop);
        $('#enterBtn')?.addEventListener('click', () => enterNook());
        $('#browseBtn')?.addEventListener('click', () => enterNook('storyFeed'));
        $('#navLoginBtn')?.addEventListener('click', () => openAuth('login'));
        restoreMessagesButtonState();
        wireLogoBackToTop();
        closeRibbonPanel();
        wireArchiveMenu();
        if (enableRibbonMenu) wireRibbonPullMenu();
        $('#nookRibbonPanel')?.addEventListener('click', handleRibbonPanelClick);
        $('#navMonthlyTopBtn')?.addEventListener('click', handleMonthlyTopButtonClick);
        $('#navMailBtn')?.addEventListener('click', handleMailButtonClick);
        $('#navMessagesBtn')?.addEventListener('click', handleMessagesButtonClick);
        $('#archiveStoriesList')?.addEventListener('click', handleArchiveStoryClick);
        $('#navProfileBtn')?.addEventListener('click', () => {
            openModal('profileModal');
            resetProfileModalToMyView();
        });
        $('#footerFeedbackBtn')?.addEventListener('click', () => {
            playOwlWingSound();
            openFeedback();
        });
        $$('[data-open]').forEach((button) => button.addEventListener('click', () => openModal(button.dataset.open)));
        $$('[data-scroll-target]').forEach((button) => {
            button.addEventListener('click', () => {
                const targetId = button.dataset.scrollTarget;

                if (targetId === 'mainNav' || targetId === 'top') {
                    if (typeof window.scrollToTop === 'function') {
                        window.scrollToTop();
                    } else {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                    return;
                }

                const target = document.getElementById(targetId);
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });
        $$('[data-close]').forEach((button) => button.addEventListener('click', () => closeModal(button.dataset.close)));

        $$('.modal').forEach((modal) => {
            modal.addEventListener('click', (event) => {
                if (event.target === modal) closeModal(modal.id);
            });
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                const openModalElement = $$('.modal:not(.hidden)').at(-1);
                if (openModalElement) closeModal(openModalElement.id);
            }
        });

        $('#loginTab')?.addEventListener('click', () => setAuthMode('login'));
        $('#signupTab')?.addEventListener('click', () => setAuthMode('signup'));
        $('#authSwitchBtn')?.addEventListener('click', () => setAuthMode(state.isSignUp ? 'login' : 'signup'));
        $('#authForm')?.addEventListener('submit', handleAuthSubmit);
        $('#forgotPasswordBtn')?.addEventListener('click', sendPasswordReset);
        $('#logoutBtn')?.addEventListener('click', logout);
        $('#changePasswordBtn')?.addEventListener('click', changePassword);
        $('#saveProfileBtn')?.addEventListener('click', saveProfileSettings);
        $('#deleteAccountBtn')?.addEventListener('click', deleteProfileData);

        $('#mainStoryInput')?.addEventListener('input', () => {
            updateCharCounter();
            saveDraft();
            updateWritingMoodState();
            playTypingInputSound();
        });
        $('#writingFontSelect')?.addEventListener('change', updateWritingStyleFromTools);
        $('#writingSizeSelect')?.addEventListener('change', updateWritingStyleFromTools);
        $('#writingBoldBtn')?.addEventListener('click', toggleWritingBold);
        $('#writingItalicBtn')?.addEventListener('click', toggleWritingItalic);
        $('#typingSoundToggleBtn')?.addEventListener('click', toggleTypingSound);
        $('#mainStoryInput')?.addEventListener('keydown', playTypingKeySound);
        wireIntentionalWritingFocus();
        $('#guestPenName')?.addEventListener('input', saveGuestName);
        $('#publishBtn')?.addEventListener('click', publishStory);
        $('#clearDraftBtn')?.addEventListener('click', clearDraft);
        $('#eraseStoryBtn')?.addEventListener('click', openClearStoryConfirm);
        $('#confirmEraseStoryBtn')?.addEventListener('click', eraseStoryDraft);
        $('#copyPromptBtn')?.addEventListener('click', startWritingFromPrompt);
        $('#toggleVideoBtn')?.addEventListener('click', toggleWeeklyVideo);
        $('#candleBrightnessSlider')?.addEventListener('input', updateCandleBrightness);
        $('#candleBrightnessSlider')?.addEventListener('change', updateCandleBrightness);
        $('#exitFocusBtn')?.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            exitFocusMode();
        });
        $('#siteVolumeSlider')?.addEventListener('input', updateSiteVolumeFromSlider);
        $('#soundEffectsBtn')?.addEventListener('click', (event) => toggleAmbientMenu('soundEffectsMenu', 'soundEffectsBtn', event));
        $('#lightingEffectsBtn')?.addEventListener('click', (event) => toggleAmbientMenu('lightingEffectsMenu', 'lightingEffectsBtn', event));
        $('#focusModeToggleBtn')?.addEventListener('click', toggleFocusModeFromButton);
        $('#soundEffectsMenu')?.addEventListener('click', handleSoundMenuClick);
        $('#soundEffectsMenu')?.addEventListener('input', handleSoundVolumeInput);
        $('#soundEffectsMenu')?.addEventListener('change', handleSoundVolumeInput);
        $('#soundEffectsMenu')?.addEventListener('keydown', handleSoundMenuKeydown);
        $('#lightingEffectsMenu')?.addEventListener('click', handleLightingMenuClick);

        // Mobile Safari/Chrome can create ghost taps while Focus Mode is resizing.
        // Keep ambient popups from swallowing the next tap, and close them on viewport shifts.
        ['soundEffectsBtn', 'lightingEffectsBtn', 'soundEffectsMenu', 'lightingEffectsMenu'].forEach((id) => {
            const element = document.getElementById(id);
            element?.addEventListener('pointerdown', (event) => event.stopPropagation());
            element?.addEventListener('touchstart', (event) => event.stopPropagation(), { passive: true });
        });
        window.visualViewport?.addEventListener('resize', closeAmbientMenus, { passive: true });
        window.addEventListener('orientationchange', () => setTimeout(closeAmbientMenus, 80), { passive: true });

        $('#focusVisibilitySlider')?.addEventListener('input', updateFocusVisibility);
        $('#saveStoryEditBtn')?.addEventListener('click', saveStoryEdit);

        $('#storySearch')?.addEventListener('input', renderFeed);
        $('#feedSort')?.addEventListener('change', () => fetchStories({ resetLimit: true }));
        $('#refreshFeedBtn')?.addEventListener('click', () => fetchStories());
        $('#loadMoreBtn')?.addEventListener('click', () => {
            state.feedLimit += 30;
            fetchStories();
        });

        $('#storyFeed')?.addEventListener('click', handleStoryAreaClick);
        $('#topStories')?.addEventListener('click', handleStoryAreaClick);
        $('#modalActionsRow')?.addEventListener('click', handleStoryActionClick);
        $('#modalCommentsList')?.addEventListener('click', handleCommentActionClick);
        $('#postCommentBtn')?.addEventListener('click', postComment);
        $('#newCommentInput')?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') postComment();
        });

        $('.avatar-wrapper')?.addEventListener('click', openProfileAvatarPicker);
        $('.avatar-wrapper')?.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            openProfileAvatarPicker();
        });
        $('#avatarUploadBtn')?.addEventListener('click', () => $('#avatarUploadInput')?.click());
        $('#avatarUploadInput')?.addEventListener('change', uploadAvatar);
        $('#avatarPlaceholderGrid')?.addEventListener('click', handlePlaceholderAvatarClick);
        $('#avatarPositionX')?.addEventListener('input', handleAvatarPositionInput);
        $('#avatarPositionY')?.addEventListener('input', handleAvatarPositionInput);
        $('#saveAvatarPositionBtn')?.addEventListener('click', () => saveAvatarPosition({ notify: true }));
        $('#passportInfoBtn')?.addEventListener('click', () => openModal('passportInfoModal'));
        $('#adminDashboardBtn')?.addEventListener('click', () => {
            openModal('adminModal');
            loadAllUsers();
        });
        $('#adminUserSearch')?.addEventListener('input', debounce(loadAllUsers, 250));
        $('#adminModal')?.addEventListener('click', handleAdminClick);

        $('#submitFeedbackBtn')?.addEventListener('click', submitFeedback);

        window.addEventListener('click', (event) => {
            if (!event.target.closest('.action-column')) {
                closeAllMenus();
            }
            if (!event.target.closest('#nookRibbonPanel') && !event.target.closest('#bookmarkMenuBtn')) {
                closeRibbonPanel();
            }
            if (!event.target.closest('.focus-ambient-controls') && !event.target.closest('.ambient-menu') && !event.target.closest('#focusEffectsMasterBtn')) {
                closeAmbientMenus();
            }
            if (document.body.classList.contains('focus-mode') &&
                !event.target.closest('#writingZoneSection') &&
                !event.target.closest('.modal') &&
                !event.target.closest('.toast-region')) {
                exitFocusMode();
            }
        });
    }

    async function handleUserSession(session, options = {}) {
        if (session?.user) {
            state.currentUser = session.user;
            state.currentProfile = await fetchOrCreateProfile(session.user);
            state.isAdmin = checkAdminStatus();
        } else {
            state.currentUser = null;
            state.currentProfile = null;
            state.isAdmin = false;
        }
        updateUI();
        if (!options.skipFetch) await fetchStories();
    }

    async function fetchOrCreateProfile(user) {
        if (!state.db || !user) return null;
        const existing = await getProfileById(user.id);
        if (existing) return existing;

        const preferredUsername = cleanUsername(user.user_metadata?.username || user.email?.split('@')[0] || 'Writer');
        const username = await getAvailableUsername(preferredUsername);
        const payload = { id: user.id, username, avatar_url: getDefaultAvatarUrl(user.id || username) };

        const { data, error } = await state.db
            .from('profiles')
            .insert(payload)
            .select('*, flairs(css_class)')
            .maybeSingle();

        if (error) {
            console.warn('Profile auto-create failed. Using temporary profile display.', error);
            return { id: user.id, username, avatar_url: payload.avatar_url, selected_flair_id: null, flairs: null };
        }
        return data;
    }

    async function getProfileById(userId) {
        const { data, error } = await state.db
            .from('profiles')
            .select('*, flairs(css_class)')
            .eq('id', userId)
            .maybeSingle();
        if (error) console.warn('Profile fetch warning:', error);
        return data || null;
    }

    async function getAvailableUsername(base) {
        const safeBase = cleanUsername(base) || 'Writer';
        for (let attempt = 0; attempt < 8; attempt += 1) {
            const candidate = attempt === 0 ? safeBase : `${safeBase}${Math.floor(100 + Math.random() * 900)}`;
            const { data } = await state.db.from('profiles').select('id').eq('username', candidate).maybeSingle();
            if (!data) return candidate;
        }
        return `Writer${Date.now().toString().slice(-5)}`;
    }

    function cleanUsername(value) {
        return String(value || '')
            .trim()
            .replace(/[^a-zA-Z0-9_ -]/g, '')
            .replace(/\s+/g, ' ')
            .slice(0, 24);
    }

    function checkAdminStatus() {
        const email = state.currentUser?.email?.toLowerCase() || '';
        const username = state.currentProfile?.username || '';
        return email === CONFIG.adminEmail.toLowerCase() || username === CONFIG.adminUsername;
    }

    function updateUI() {
        const loggedOut = $('#loggedOutNav');
        const loggedIn = $('#loggedInNav');
        const guestInput = $('#guestPenName');
        const commentGuestInput = $('#commentGuestName');
        const adminButton = $('#adminDashboardBtn');
        const archiveMenu = $('.bookmark-menu-shell');

        if (state.currentUser && state.currentProfile) {
            loggedOut?.classList.add('hidden');
            loggedIn?.classList.remove('hidden');
            archiveMenu?.classList.remove('hidden');
            guestInput?.classList.add('hidden');
            commentGuestInput?.classList.add('hidden');
            setText('#navUsername', state.currentProfile.username || 'Writer');
            setText('#profileNameDisplay', state.currentProfile.username || 'Writer');
            updateAvatars(state.currentProfile);
        } else {
            loggedOut?.classList.remove('hidden');
            loggedIn?.classList.add('hidden');
            archiveMenu?.classList.add('hidden');
            closeRibbonPanel();
            guestInput?.classList.remove('hidden');
            commentGuestInput?.classList.remove('hidden');
            updateAvatars(null);
        }

        adminButton?.classList.toggle('hidden', !state.isAdmin);
        setText('#journeyNote', 'The Archive');
        $('#feedbackEmail')?.classList.toggle('hidden', !!state.currentUser);
        $$('.logged-in-only').forEach((item) => item.classList.toggle('hidden', !state.currentUser));
    }

    function updateAvatars(profile) {
        const fallback = getDefaultAvatarUrl(profile?.id || profile?.username || 'Nook');
        const avatarUrl = resolveAvatarUrl(profile?.avatar_url, profile?.id || profile?.username || 'Nook');
        const flairClass = profile?.flairs?.css_class || '';

        const navAvatar = $('#navAvatar');
        if (navAvatar) {
            navAvatar.src = avatarUrl;
            navAvatar.className = 'avatar-small';
            applyAvatarPosition(navAvatar, profile);
            if (flairClass) navAvatar.classList.add(flairClass);
        }

        const profileAvatar = $('#profileAvatar');
        if (profileAvatar && !$('#profileModal')?.classList.contains('admin-view')) {
            profileAvatar.src = avatarUrl;
            profileAvatar.className = 'avatar-large profile-trigger-action';
            applyAvatarPosition(profileAvatar, profile);
        }
        renderPlaceholderAvatarGrid(profile);
        syncAvatarPositionControls(profile);
    }

    async function loadPlaceholderAvatars() {
        try {
            const response = await fetch(CONFIG.placeholderAvatarManifest, { cache: 'no-store' });
            if (!response.ok) throw new Error(`Manifest unavailable: ${response.status}`);
            const manifest = await response.json();
            const files = Array.isArray(manifest) ? manifest : manifest?.avatars;
            const next = normalizePlaceholderAvatars(files);
            if (next.length) state.placeholderAvatars = next;
        } catch (error) {
            console.warn('Using built-in placeholder avatar list:', error);
        } finally {
            renderPlaceholderAvatarGrid(state.currentProfile);
            updateAvatars(state.currentProfile);
        }
    }

    async function loadPrizeAvatars() {
        try {
            const response = await fetch(CONFIG.prizeAvatarManifest, { cache: 'no-store' });
            if (!response.ok) throw new Error(`Prize manifest unavailable: ${response.status}`);
            const manifest = await response.json();
            state.prizeAvatars = normalizePrizeAvatars(manifest?.avatars || []);
        } catch (error) {
            console.warn('Prize avatar list unavailable:', error);
            state.prizeAvatars = [];
        } finally {
            renderPlaceholderAvatarGrid(state.currentProfile);
        }
    }

    function normalizePlaceholderAvatars(files = []) {
        const list = Array.isArray(files) ? files : [files];
        return list
            .filter(Boolean)
            .map((file) => String(file).trim())
            .filter((file) => /\.(png|jpe?g|webp|gif|svg)$/i.test(file))
            .map((file) => file.includes('/') ? file : `${CONFIG.placeholderAvatarPath}${file}`);
    }

    function normalizePrizeAvatars(items = []) {
        return (Array.isArray(items) ? items : [items])
            .filter(Boolean)
            .map((item, index) => {
                const file = String(item.file || item.src || '').trim();
                if (!file || !/\.(png|jpe?g|webp|gif|svg)$/i.test(file)) return null;
                const src = file.includes('/') ? `${CONFIG.prizeAvatarPath}${file}` : `${CONFIG.prizeAvatarPath}${file}`;
                return {
                    id: item.id || `prize-${index}`,
                    src,
                    name: item.name || `Prize picture ${index + 1}`,
                    unlock: item.unlock || { type: 'badge_count', count: 1, label: 'Earn a badge' }
                };
            })
            .filter(Boolean);
    }

    function getDefaultAvatarUrl(seed) {
        const placeholders = state.placeholderAvatars || [];
        if (!placeholders.length) return createAvatarDataUrl(seed);
        const index = Math.abs(hashString(seed || 'Nook')) % placeholders.length;
        return placeholders[index];
    }

    function hashString(value) {
        return String(value || '').split('').reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
    }

    function isPlaceholderAvatar(url) {
        return !!url && state.placeholderAvatars.some((avatar) => normalizeAssetUrl(avatar) === normalizeAssetUrl(url));
    }

    function isPrizeAvatar(url) {
        if (!url) return false;
        const normalized = normalizeAssetUrl(url);
        return (state.prizeAvatars || []).some((avatar) => normalizeAssetUrl(avatar.src) === normalized);
    }

    function isLegacyPlaceholderAvatar(url) {
        if (!url) return false;
        const normalized = normalizeAssetUrl(url);
        return LEGACY_PLACEHOLDER_AVATARS.some((file) => normalized === normalizeAssetUrl(`${CONFIG.placeholderAvatarPath}${file}`));
    }

    function resolveAvatarUrl(url, seed = 'Nook') {
        if (!url || isLegacyPlaceholderAvatar(url)) return getDefaultAvatarUrl(seed);
        return url;
    }

    function isCustomUploadedAvatar(url) {
        if (!url) return false;
        return !isPlaceholderAvatar(url) && !isPrizeAvatar(url) && !isLegacyPlaceholderAvatar(url) && !String(url).startsWith('data:image/svg+xml');
    }

    function clampPercent(value, fallback = 50) {
        const number = Number(value);
        if (!Number.isFinite(number)) return fallback;
        return Math.min(100, Math.max(0, Math.round(number)));
    }

    function getAvatarPosition(profile) {
        return {
            x: clampPercent(profile?.avatar_position_x, 50),
            y: clampPercent(profile?.avatar_position_y, 50)
        };
    }

    function getAvatarObjectPosition(profile) {
        if (!isCustomUploadedAvatar(profile?.avatar_url)) return 'center center';
        const position = getAvatarPosition(profile);
        return `${position.x}% ${position.y}%`;
    }

    function avatarStyleAttr(profile) {
        if (!isCustomUploadedAvatar(profile?.avatar_url)) return '';
        return ` style="object-position: ${escapeAttr(getAvatarObjectPosition(profile))};"`;
    }

    function applyAvatarPosition(element, profile) {
        if (!element) return;
        element.style.objectPosition = getAvatarObjectPosition(profile);
    }

    function normalizeAssetUrl(url) {
        try {
            return new URL(url, window.location.href).href;
        } catch (_error) {
            return String(url || '');
        }
    }

    function renderPlaceholderAvatarGrid(profile = state.currentProfile) {
        const grid = $('#avatarPlaceholderGrid');
        if (!grid) return;
        grid.innerHTML = '';
        const avatars = getAvailableAvatarChoices(profile);
        if (!avatars.length) {
            grid.innerHTML = '<p class="placeholder-avatar-empty">Add images to assets/placeholders and list them in placeholders.json.</p>';
            return;
        }

        const current = normalizeAssetUrl(resolveAvatarUrl(profile?.avatar_url, profile?.id || profile?.username || 'Nook'));
        avatars.forEach((avatar, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `avatar-placeholder-choice ${avatar.locked ? 'is-locked' : ''} ${avatar.prize ? 'is-prize' : ''} ${avatar.custom ? 'is-custom-upload' : ''}`;
            button.dataset.avatarSrc = avatar.src;
            button.dataset.avatarKind = avatar.custom ? 'custom' : avatar.prize ? 'prize' : 'placeholder';
            button.disabled = !!avatar.locked;
            button.setAttribute('aria-label', avatar.locked ? `${avatar.name} locked: ${avatar.reason}` : `Choose ${avatar.name}`);
            button.setAttribute('aria-pressed', String(normalizeAssetUrl(avatar.src) === current));
            button.innerHTML = `
                <img src="${escapeAttr(avatar.src)}" alt=""${avatar.custom ? avatarStyleAttr(profile) : ''}>
                ${avatar.locked ? `<span class="avatar-lock-label">${escapeHtml(avatar.reason || 'Locked')}</span>` : ''}
                ${avatar.custom ? '<span class="avatar-prize-label">Upload</span>' : ''}
                ${avatar.prize && !avatar.locked ? '<span class="avatar-prize-label">Prize</span>' : ''}`;
            grid.appendChild(button);
        });
        syncAvatarPositionControls(profile);
    }

    function getAvailableAvatarChoices(profile = state.currentProfile) {
        const customAvatarUrl = resolveAvatarUrl(profile?.avatar_url, profile?.id || profile?.username || 'Nook');
        const customAvatars = isCustomUploadedAvatar(customAvatarUrl)
            ? [{
                src: customAvatarUrl,
                name: 'Uploaded picture',
                locked: false,
                prize: false,
                custom: true
            }]
            : [];
        const publicAvatars = (state.placeholderAvatars || []).map((src, index) => ({
            src,
            name: `Profile picture ${index + 1}`,
            locked: false,
            prize: false
        }));
        const prizeAvatars = (state.prizeAvatars || []).map((avatar) => {
            const unlock = getAvatarUnlockStatus(avatar);
            return {
                ...avatar,
                locked: !unlock.unlocked,
                reason: unlock.reason,
                prize: true
            };
        });
        return [...customAvatars, ...publicAvatars, ...prizeAvatars];
    }

    function getAvatarUnlockStatus(avatar) {
        const unlock = avatar.unlock || {};
        const badges = state.avatarRewardState.badges || new Set();
        const stats = state.avatarRewardState.stats || {};
        const count = Number(unlock.count || 1);

        if (unlock.type === 'badge') {
            const badge = CONFIG.badges.find((item) => Number(item.id) === Number(unlock.id));
            return {
                unlocked: badges.has(Number(unlock.id)),
                reason: unlock.label || `Earn ${badge?.name || `badge ${unlock.id}`}`
            };
        }
        if (unlock.type === 'badge_count') {
            return { unlocked: badges.size >= count, reason: unlock.label || `Earn ${count} badge(s)` };
        }
        if (unlock.type === 'stories') {
            return { unlocked: Number(stats.stories || 0) >= count, reason: unlock.label || `Post ${count} story/stories` };
        }
        if (unlock.type === 'hearts') {
            return { unlocked: Number(stats.hearts || 0) >= count, reason: unlock.label || `Earn ${count} hearts` };
        }
        if (unlock.type === 'words') {
            return { unlocked: Number(stats.words || 0) >= count, reason: unlock.label || `Write ${count} words` };
        }
        return { unlocked: false, reason: unlock.label || 'Locked' };
    }

    async function openAvatarPicker() {
        if (!state.currentUser) return openAuth('login');
        await refreshAvatarRewardState();
        renderPlaceholderAvatarGrid(state.currentProfile);
        syncAvatarPositionControls(state.currentProfile);
        openModal('avatarPickerModal');
    }

    async function refreshAvatarRewardState() {
        if (!state.db || !state.currentUser) return;
        const userId = state.currentUser.id;
        try {
            const [{ data: userFlairs }, { data: stories }] = await Promise.all([
                state.db.from('user_flairs').select('flair_id').eq('user_id', userId),
                state.db.from('stories').select('id, content, votes').eq('user_id', userId).is('deleted_at', null)
            ]);
            state.avatarRewardState.badges = new Set((userFlairs || []).map((flair) => Number(flair.flair_id)));
            state.avatarRewardState.stats = {
                stories: stories?.length || 0,
                hearts: (stories || []).reduce((sum, story) => sum + Number(story.votes || 0), 0),
                words: (stories || []).reduce((sum, story) => sum + countWords(story.content || ''), 0)
            };
        } catch (error) {
            console.warn('Avatar rewards unavailable:', error);
        }
    }

    async function handlePlaceholderAvatarClick(event) {
        const button = event.target.closest('[data-avatar-src]');
        if (!button) return;
        if (!state.db || !state.currentUser) return openAuth('login');
        if (button.disabled || button.classList.contains('is-locked')) return;
        const avatarUrl = button.dataset.avatarSrc;
        if (!avatarUrl) return;
        const isCustom = button.dataset.avatarKind === 'custom';
        const position = getAvatarPosition(state.currentProfile);

        button.classList.add('is-saving');
        try {
            const payload = {
                avatar_url: avatarUrl,
                avatar_position_x: isCustom ? position.x : 50,
                avatar_position_y: isCustom ? position.y : 50
            };
            const { error } = await state.db.from('profiles').update(payload).eq('id', state.currentUser.id);
            if (error) throw error;
            state.currentProfile = await getProfileById(state.currentUser.id);
            updateUI();
            await fetchStories();
            closeModal('avatarPickerModal');
            toast('Profile picture updated.');
        } catch (error) {
            console.error('Placeholder avatar update failed:', error);
            toast(`Could not update profile picture: ${error.message}`, 'error');
        } finally {
            button.classList.remove('is-saving');
        }
    }

    function syncAvatarPositionControls(profile = state.currentProfile) {
        const tools = $('#customAvatarTools');
        const preview = $('#customAvatarPreview');
        const sliderX = $('#avatarPositionX');
        const sliderY = $('#avatarPositionY');
        if (!tools || !preview || !sliderX || !sliderY) return;

        const avatarUrl = resolveAvatarUrl(profile?.avatar_url, profile?.id || profile?.username || 'Nook');
        const canAdjust = !!state.currentUser && profile?.id === state.currentUser.id && isCustomUploadedAvatar(avatarUrl);
        tools.classList.toggle('hidden', !canAdjust);
        if (!canAdjust) return;

        const position = getAvatarPosition(profile);
        preview.src = avatarUrl;
        preview.style.objectPosition = `${position.x}% ${position.y}%`;
        sliderX.value = String(position.x);
        sliderY.value = String(position.y);
    }

    function handleAvatarPositionInput() {
        if (!state.currentProfile || !isCustomUploadedAvatar(state.currentProfile.avatar_url)) return;
        const x = clampPercent($('#avatarPositionX')?.value, 50);
        const y = clampPercent($('#avatarPositionY')?.value, 50);
        state.currentProfile = {
            ...state.currentProfile,
            avatar_position_x: x,
            avatar_position_y: y
        };

        ['#navAvatar', '#profileAvatar', '#customAvatarPreview'].forEach((selector) => {
            applyAvatarPosition($(selector), state.currentProfile);
        });
        $$('#avatarPlaceholderGrid .avatar-placeholder-choice.is-custom-upload img').forEach((image) => {
            applyAvatarPosition(image, state.currentProfile);
        });

        window.clearTimeout(state.avatarPositionSaveTimer);
        state.avatarPositionSaveTimer = window.setTimeout(() => saveAvatarPosition({ notify: false }), 650);
    }

    async function saveAvatarPosition({ notify = false } = {}) {
        if (!state.db || !state.currentUser || !state.currentProfile) return;
        if (!isCustomUploadedAvatar(state.currentProfile.avatar_url)) return;
        const position = getAvatarPosition(state.currentProfile);
        const button = $('#saveAvatarPositionBtn');
        if (button) button.textContent = 'Saving...';

        try {
            const { error } = await state.db
                .from('profiles')
                .update({
                    avatar_position_x: position.x,
                    avatar_position_y: position.y
                })
                .eq('id', state.currentUser.id);
            if (error) throw error;
            if (notify) toast('Profile picture center saved.');
        } catch (error) {
            console.error('Avatar position save failed:', error);
            if (notify) toast(`Could not save picture center: ${error.message}`, 'error');
        } finally {
            if (button) button.textContent = 'Save Center';
        }
    }

    function createAvatarDataUrl(seed) {
        const letter = encodeURIComponent(String(seed || 'N').charAt(0).toUpperCase());
        const bg = '%23d8b989';
        const ink = '%2320150f';
        return `data:image/svg+xml;charset=UTF-8,<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><rect width='96' height='96' rx='48' fill='${bg}'/><text x='50%' y='55%' text-anchor='middle' font-family='Arial' font-size='42' font-weight='700' fill='${ink}'>${letter}</text></svg>`;
    }

    function setOfflineMode(message) {
        toast(message, 'error', 7000);
        $('#storyFeed').innerHTML = '<div class="empty-state">Stories are unavailable until Supabase loads.</div>';
        $('#topStories').innerHTML = '<div class="empty-state">Top stories will appear here once the database connects.</div>';
        setText('#statStories', '—');
        setText('#statVotes', '—');
        setText('#statWriters', '—');
    }

    function openModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.remove('hidden');
    }

    function closeModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.add('hidden');
        if (id === 'profileModal') {
            window.setTimeout(resetProfileModalToMyView, 200);
        }
    }

    function scrollToTop() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function enterNook(targetId = 'writingZoneSection') {
        const overlay = $('#welcomeOverlay');
        overlay?.classList.add('is-leaving');
        window.setTimeout(() => overlay?.classList.add('hidden'), 650);

        const bgVideo = $('#bgVideo');
        if (bgVideo) {
            bgVideo.muted = true;
            bgVideo.play().catch(() => undefined);
        }
        const player = $('#youtubePlayer');
        if (player && !player.src) player.src = CONFIG.youtubeSrc;

        window.setTimeout(() => document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250);
    }

    function setAuthMode(mode) {
        state.isSignUp = mode === 'signup';
        $('#loginTab')?.classList.toggle('active', !state.isSignUp);
        $('#signupTab')?.classList.toggle('active', state.isSignUp);
        $('#usernameInput')?.classList.toggle('hidden', !state.isSignUp);
        $('#usernameInput')?.toggleAttribute('required', state.isSignUp);
        $('#passwordInput')?.setAttribute('autocomplete', state.isSignUp ? 'new-password' : 'current-password');
        setText('#authTitle', state.isSignUp ? 'Create your pen name' : 'Welcome back');
        setText('#authActionBtn', state.isSignUp ? 'Create Account' : 'Log In');
        setText('#authSwitchBtn', state.isSignUp ? 'Already have an account?' : 'Need an account?');
        setText('#authError', '');
    }

    function openAuth(mode = 'login') {
        setAuthMode(mode);
        openModal('authModal');
        window.setTimeout(() => $('#emailInput')?.focus(), 50);
    }

    async function handleAuthSubmit(event) {
        event.preventDefault();
        if (!state.db) return setAuthError('Supabase is not available yet.');

        const email = $('#emailInput')?.value.trim();
        const password = $('#passwordInput')?.value;
        const username = cleanUsername($('#usernameInput')?.value);

        setAuthError('');
        if (!email || !password) return setAuthError('Email and password are required.');
        if (state.isSignUp && username.length < 3) return setAuthError('Pen Name must be at least 3 characters.');

        setButtonLoading('#authActionBtn', true, state.isSignUp ? 'Creating...' : 'Logging in...');
        try {
            if (state.isSignUp) {
                const { data: existing } = await state.db.from('profiles').select('id').eq('username', username).maybeSingle();
                if (existing) throw new Error('This Pen Name is already taken. Try a small twist.');

                const { data, error } = await state.db.auth.signUp({
                    email,
                    password,
                    options: { data: { username } }
                });
                if (error) throw error;

                if (data.session) {
                    await handleUserSession(data.session);
                    closeModal('authModal');
                    toast(`Welcome to the Nook, ${username}.`);
                } else {
                    closeModal('authModal');
                    toast('Account created. Check your email to confirm your login.');
                }
            } else {
                const { data, error } = await state.db.auth.signInWithPassword({ email, password });
                if (error) throw error;
                await handleUserSession(data.session);
                closeModal('authModal');
                toast('You are logged in. Your writing chair is warm.');
            }
            $('#authForm')?.reset();
            setAuthMode('login');
        } catch (error) {
            console.error('Auth error:', error);
            setAuthError(friendlyAuthError(error));
        } finally {
            setButtonLoading('#authActionBtn', false);
        }
    }

    async function sendPasswordReset() {
        if (!state.db) return setAuthError('Supabase is not available yet.');
        const email = $('#emailInput')?.value.trim();
        if (!email) return setAuthError('Enter your email first, then tap forgot password.');

        try {
            const { error } = await state.db.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.href.split('#')[0]
            });
            if (error) throw error;
            toast('Password reset email sent.');
        } catch (error) {
            setAuthError(friendlyAuthError(error));
        }
    }

    function friendlyAuthError(error) {
        const message = error?.message || String(error);
        if (/invalid login/i.test(message)) return 'That email or password does not match. Try again.';
        if (/email not confirmed/i.test(message)) return 'Please confirm your email before logging in.';
        if (/password/i.test(message) && /six|6/i.test(message)) return 'Password should be at least 6 characters.';
        return message;
    }

    function setAuthError(message) {
        setText('#authError', message || '');
    }

    async function logout() {
        if (!state.db) return;
        await state.db.auth.signOut();
        state.currentUser = null;
        state.currentProfile = null;
        state.isAdmin = false;
        updateUI();
        closeModal('profileModal');
        toast('Logged out. See you by the fire soon.');
        await fetchStories();
    }

    function setProfileDetails(profile = {}, options = {}) {
        const username = profile?.username || 'Writer';
        const bio = (profile?.bio || '').trim();
        setText('#profileNameDisplay', username);
        setText('#profileBioDisplay', bio || (options.readOnly ? 'This writer has not added an author note yet.' : 'Tell readers a little about your writing voice.'));

        const usernameInput = $('#profileUsernameInput');
        const bioInput = $('#profileBioInput');
        if (usernameInput) usernameInput.value = username;
        if (bioInput) bioInput.value = bio;
    }

    async function saveProfileSettings() {
        if (!state.db || !state.currentUser) return openAuth('login');
        const username = cleanUsername($('#profileUsernameInput')?.value || state.currentProfile?.username || 'Writer');
        const bio = String($('#profileBioInput')?.value || '').trim().slice(0, 220);
        if (!username) return toast('Choose a pen name first.', 'error');

        if (username !== state.currentProfile?.username) {
            const { data: existing, error: nameError } = await state.db
                .from('profiles')
                .select('id')
                .eq('username', username)
                .neq('id', state.currentUser.id)
                .maybeSingle();
            if (nameError) return toast(`Could not check that pen name: ${nameError.message}`, 'error');
            if (existing) return toast('That pen name is already taken.', 'error');
        }

        setButtonLoading('#saveProfileBtn', true, 'Saving...');
        const { error } = await state.db
            .from('profiles')
            .update({ username, bio })
            .eq('id', state.currentUser.id);
        setButtonLoading('#saveProfileBtn', false);

        if (error) return toast(`Profile update failed: ${error.message}. If this mentions bio, run the Supabase setup SQL first.`, 'error');
        state.currentProfile = await getProfileById(state.currentUser.id);
        setProfileDetails(state.currentProfile);
        updateUI();
        await fetchStories();
        toast('Profile saved.');
    }

    async function loadProfileStatsForUser(targetId) {
        const grid = $('#profileStatsGrid');
        if (!grid || !state.db || !targetId) return;
        grid.innerHTML = `
            <div class="profile-stat-card"><strong>…</strong><span>Stories</span></div>
            <div class="profile-stat-card"><strong>…</strong><span>Hearts</span></div>
            <div class="profile-stat-card"><strong>…</strong><span>Comments</span></div>
            <div class="profile-stat-card"><strong>…</strong><span>Words</span></div>`;

        try {
            const { data: stories, error } = await state.db
                .from('stories')
                .select('id, content, votes')
                .eq('user_id', targetId)
                .is('deleted_at', null);
            if (error) throw error;

            const storyIds = (stories || []).map((story) => story.id);
            const storyCount = stories?.length || 0;
            const heartCount = (stories || []).reduce((sum, story) => sum + Number(story.votes || 0), 0);
            const wordCount = (stories || []).reduce((sum, story) => sum + countWords(story.content || ''), 0);
            let commentCount = 0;

            if (storyIds.length) {
                const { count, error: commentError } = await state.db
                    .from('comments')
                    .select('id', { count: 'exact', head: true })
                    .in('story_id', storyIds)
                    .is('deleted_at', null);
                if (commentError) throw commentError;
                commentCount = count || 0;
            }

            grid.innerHTML = `
                <div class="profile-stat-card"><strong>${storyCount}</strong><span>Stories</span></div>
                <div class="profile-stat-card"><strong>${heartCount}</strong><span>Hearts</span></div>
                <div class="profile-stat-card"><strong>${commentCount}</strong><span>Comments</span></div>
                <div class="profile-stat-card"><strong>${wordCount}</strong><span>Words</span></div>`;
            if (targetId === state.currentUser?.id) {
                state.avatarRewardState.stats = { stories: storyCount, hearts: heartCount, words: wordCount };
                renderPlaceholderAvatarGrid(state.currentProfile);
            }
        } catch (error) {
            console.warn('Profile stats unavailable:', error);
            grid.innerHTML = '<div class="empty-state profile-stats-error">Stats will appear once the Supabase setup is complete.</div>';
        }
    }

    function countWords(value) {
        return String(value || '').trim().split(/\s+/).filter(Boolean).length;
    }

    async function changePassword() {
        if (!state.db || !state.currentUser) return openAuth('login');
        const newPassword = $('#newPasswordInput')?.value;
        if (!newPassword || newPassword.length < 6) return toast('Password needs at least 6 characters.', 'error');
        const { error } = await state.db.auth.updateUser({ password: newPassword });
        if (error) return toast(friendlyAuthError(error), 'error');
        $('#newPasswordInput').value = '';
        toast('Password updated.');
    }

    async function deleteProfileData() {
        if (!state.db || !state.currentUser) return openAuth('login');
        const confirmed = window.confirm('Delete your profile row and hide your account details from the Nook? Your Supabase Auth user may still exist unless removed server-side.');
        if (!confirmed) return;
        const { error } = await state.db.from('profiles').delete().eq('id', state.currentUser.id);
        if (error) return toast(`Could not delete profile: ${error.message}`, 'error');
        await logout();
        toast('Profile data deleted.');
    }

    async function fetchStories(options = {}) {
        if (!state.db) return;
        if (options.resetLimit) state.feedLimit = 30;

        const feed = $('#storyFeed');
        const top = $('#topStories');
        if (feed) feed.innerHTML = '<div class="loading-state">Gathering fresh pages...</div>';
        if (top) top.innerHTML = '<div class="loading-state">Counting hearts...</div>';

        try {
            const storySelect = '*, profiles!stories_user_id_fkey(id, username, avatar_url, avatar_position_x, avatar_position_y, selected_flair_id), comments(count)';

            const [{ data: topStories, error: topError }, { data: feedStories, error: feedError }] = await Promise.all([
                state.db
                    .from('stories')
                    .select(storySelect)
                    .is('deleted_at', null)
                    .gt('votes', 0)
                    .order('votes', { ascending: false })
                    .limit(3),
                state.db
                    .from('stories')
                    .select(storySelect)
                    .is('deleted_at', null)
                    .order($('#feedSort')?.value === 'votes' ? 'votes' : 'created_at', { ascending: false })
                    .limit(state.feedLimit)
            ]);

            if (topError) throw topError;
            if (feedError) throw feedError;

            state.topStories = topStories || [];
            state.feedStories = feedStories || [];
            renderTopStories();
            renderFeed();
            updateStats();
        } catch (error) {
            console.error('Story fetch error:', error);
            if (feed) feed.innerHTML = '<div class="empty-state">The ink has dried up for a moment. Check Supabase policies or try again.</div>';
            if (top) top.innerHTML = '<div class="empty-state">Top stories are unavailable right now.</div>';
            toast(error.message || 'Error loading stories.', 'error');
        }
    }

    function renderTopStories() {
        const container = $('#topStories');
        if (!container) return;
        container.innerHTML = '';
        if (!state.topStories.length) {
            container.innerHTML = '<div class="empty-state">No top stories yet. Heart a favorite to light this shelf.</div>';
            return;
        }
        state.topStories.forEach((story, index) => container.insertAdjacentHTML('beforeend', storyCardHTML(story, { mini: true, rank: index + 1 })));
    }

    function renderFeed() {
        const container = $('#storyFeed');
        if (!container) return;
        const query = ($('#storySearch')?.value || '').trim().toLowerCase();
        const stories = state.feedStories.filter((story) => {
            if (!query) return true;
            return story.content?.toLowerCase().includes(query) || getAuthorName(story).toLowerCase().includes(query);
        });

        container.innerHTML = '';
        if (!stories.length) {
            container.innerHTML = '<div class="empty-state">No matching stories yet. Maybe the next one is yours?</div>';
            return;
        }
        stories.forEach((story) => container.insertAdjacentHTML('beforeend', storyCardHTML(story)));
    }

    function storyCardHTML(story, options = {}) {
        const authorName = getAuthorName(story);
        const avatarHTML = getAvatarHTML(story, authorName);
        const commentCount = getCommentCount(story);
        const preview = truncate(story.content || '', options.mini ? 260 : 320);
        const rank = options.rank ? `<span class="btn-tiny">#${options.rank}</span>` : '';
        const actions = options.mini ? '' : `
            <div class="story-actions-row">
                <div class="actions-left">
                    <button class="btn-action-icon" type="button" data-action="like" data-story-id="${story.id}" data-votes="${story.votes || 0}">❤️ ${story.votes || 0}</button>
                    <button class="btn-action-icon" type="button" data-action="comment" data-story-id="${story.id}">💬 ${commentCount}</button>
                    <button class="btn-action-icon" type="button" data-action="copy" data-story-id="${story.id}">📋 Copy</button>
                </div>
                <div class="action-column">
                    <button class="menu-trigger" type="button" data-action="menu" aria-label="Story menu">⋮</button>
                    <div class="menu-dropdown">
                        <button type="button" data-action="report" data-story-id="${story.id}">⚠️ Report</button>
                        ${canEditStory(story) ? `<button type="button" data-action="edit" data-story-id="${story.id}">✎ Edit</button><button type="button" class="text-red" data-action="delete" data-story-id="${story.id}">🗑️ Delete</button>` : ''}
                    </div>
                </div>
            </div>`;

        return `
            <article class="story-card clickable ${options.mini ? 'is-mini' : ''}" data-story-id="${story.id}">
                <div class="story-header-row">
                    ${avatarHTML}
                    <div>
                        <div class="story-author">${rank} @${escapeHtml(authorName)}</div>
                        <div class="story-date">${formatDate(story.created_at)}</div>
                    </div>
                </div>
                <p class="story-preview">${escapeHtml(preview)}</p>
                ${actions}
            </article>`;
    }

    function handleStoryAreaClick(event) {
        const actionButton = event.target.closest('[data-action]');
        if (actionButton) {
            event.stopPropagation();
            handleStoryAction(actionButton);
            return;
        }
        const card = event.target.closest('.story-card[data-story-id]');
        if (card) openReadModal(Number(card.dataset.storyId));
    }

    function handleStoryActionClick(event) {
        const actionButton = event.target.closest('[data-action]');
        if (!actionButton) return;
        event.stopPropagation();
        handleStoryAction(actionButton);
    }

    function handleStoryAction(button) {
        const action = button.dataset.action;
        const storyId = Number(button.dataset.storyId || state.activeStoryId);
        if (action === 'menu') return toggleMenu(button);
        if (action === 'like') return voteStory(storyId, Number(button.dataset.votes || 0));
        if (action === 'comment') return openReadModal(storyId);
        if (action === 'copy') return copyStory(storyId);
        if (action === 'report') return reportContent('story', storyId);
        if (action === 'edit') return editStory(storyId);
        if (action === 'delete') return deleteStory(storyId);
    }

    async function publishStory() {
        if (!state.db) return toast('Publishing needs Supabase to be connected.', 'error');
        const textArea = $('#mainStoryInput');
        const content = textArea?.value.trim();
        if (!content) return toast('Write a story first.', 'error');

        const payload = { content, votes: 0 };
        if (state.currentUser) {
            payload.user_id = state.currentUser.id;
        } else {
            const penName = cleanUsername($('#guestPenName')?.value);
            if (!penName) return toast('Add a guest pen name, or log in to publish.', 'error');
            payload.guest_name = penName;
        }

        setButtonLoading('#publishBtn', true, 'Publishing...');
        const { error } = await state.db.from('stories').insert(payload);
        setButtonLoading('#publishBtn', false);

        if (error) return toast(`Error publishing: ${error.message}`, 'error');
        playPublishSound();
        textArea.value = '';
        localStorage.removeItem(CONFIG.draftKey);
        updateCharCounter();
        syncPromptPlaceholder();
        setText('#draftStatus', 'Published and draft cleared');
        updateWritingMoodState();
        showPublishMoment();
        toast('Your story now lives in the Nook ✨');
        await fetchStories({ resetLimit: true });
        if (state.currentUser) loadProfileStatsForUser(state.currentUser.id);
    }

    async function voteStory(storyId, currentVotes = 0) {
        if (!state.db) return toast('Voting needs Supabase to be connected.', 'error');
        if (!state.currentUser) {
            openAuth('login');
            return toast('Log in to vote on stories.', 'error');
        }

        let newVotes = (currentVotes || 0) + 1;
        const { data, error } = await state.db.rpc('like_story', { p_story_id: storyId });

        if (error) {
            console.warn('like_story RPC unavailable or blocked. Falling back to legacy vote update.', error);
            const fallback = await state.db.from('stories').update({ votes: newVotes }).eq('id', storyId);
            if (fallback.error) return toast(`Could not vote: ${fallback.error.message}`, 'error');
        } else {
            newVotes = Number(data ?? newVotes);
        }

        toast('Heart added.');
        if (state.activeStoryId === storyId && state.activeStory) state.activeStory.votes = newVotes;
        await fetchStories();
        if (state.activeStoryId === storyId) renderReadActions(state.activeStory);
        if (state.currentUser) loadProfileStatsForUser(state.currentUser.id);
    }

    async function deleteStory(storyId) {
        if (!state.db) return;
        const story = getCachedStory(storyId) || state.activeStory;
        if (story && !canEditStory(story)) return toast('Only the author or admin can delete this story.', 'error');
        if (!window.confirm('Delete this story from the public feed?')) return;
        closeAllMenus();
        const { error } = await state.db.from('stories').update({ deleted_at: new Date().toISOString() }).eq('id', storyId);
        if (error) return toast(`Could not delete story: ${error.message}`, 'error');
        if (state.activeStoryId === storyId) closeModal('readModal');
        toast('Story deleted.');
        await fetchStories();
        if (state.currentUser) loadStoriesForUser(state.currentUser.id);
    }

    async function editStory(storyId) {
        const story = getCachedStory(storyId) || state.activeStory;
        if (!story || !canEditStory(story)) return toast('Only the author or admin can edit this story.', 'error');
        state.editingStoryId = storyId;
        const input = $('#editStoryInput');
        if (input) input.value = story.content || '';
        closeAllMenus();
        openModal('editStoryModal');
        window.setTimeout(() => input?.focus(), 50);
    }

    async function saveStoryEdit() {
        if (!state.db) return toast('Editing needs Supabase to be connected.', 'error');
        const storyId = state.editingStoryId;
        const input = $('#editStoryInput');
        const content = input?.value.trim();
        if (!storyId) return toast('No story selected.', 'error');
        if (!content) return toast('The story cannot be empty.', 'error');

        const story = getCachedStory(storyId) || state.activeStory;
        if (story && !canEditStory(story)) return toast('Only the author or admin can edit this story.', 'error');

        setButtonLoading('#saveStoryEditBtn', true, 'Saving...');
        try {
            const { error } = await state.db
                .from('stories')
                .update({ content, updated_at: new Date().toISOString() })
                .eq('id', storyId);
            if (error) return toast(`Could not save edit: ${friendlyDbError(error)}`, 'error', 7000);

            closeModal('editStoryModal');
            if (state.activeStoryId === storyId) {
                state.activeStory = { ...(state.activeStory || {}), content };
                setText('#readModalText', content);
            }
            toast('Story updated.');
            await fetchStories();
            if (state.currentUser) loadStoriesForUser(state.currentUser.id);
        } catch (error) {
            console.error('Edit failed:', error);
            toast(`Could not save edit: ${friendlyDbError(error)}`, 'error', 7000);
        } finally {
            setButtonLoading('#saveStoryEditBtn', false);
        }
    }

    async function openReadModal(storyId) {
        if (!state.db) return toast('Reading stories needs Supabase to be connected.', 'error');
        const { data: story, error } = await state.db
            .from('stories')
            .select('*, profiles!stories_user_id_fkey(id, username, avatar_url, avatar_position_x, avatar_position_y)')
            .eq('id', storyId)
            .maybeSingle();
        if (error || !story) return toast('Could not open that story.', 'error');

        state.activeStoryId = story.id;
        state.activeStory = story;
        setText('#readModalAuthor', `By @${getAuthorName(story)}`);
        setText('#readModalText', story.content || '');
        renderReadActions(story);
        openModal('readModal');
        await fetchComments(story.id);
    }

    function renderReadActions(story) {
        const row = $('#modalActionsRow');
        if (!row || !story) return;
        row.innerHTML = `
            <div class="actions-left">
                <button class="btn-action-icon" type="button" data-action="like" data-story-id="${story.id}" data-votes="${story.votes || 0}">❤️ Like (${story.votes || 0})</button>
                <button class="btn-action-icon" type="button" data-action="copy" data-story-id="${story.id}">📋 Copy story</button>
                <button class="btn-action-icon" type="button" data-action="report" data-story-id="${story.id}">⚠️ Report</button>
            </div>
            ${canEditStory(story) ? `<div class="actions-right"><button class="btn-secondary small" type="button" data-action="edit" data-story-id="${story.id}">Edit</button><button class="btn-delete" type="button" data-action="delete" data-story-id="${story.id}">Delete</button></div>` : ''}`;
    }

    async function fetchComments(storyId) {
        const list = $('#modalCommentsList');
        if (!list) return;
        list.innerHTML = '<div class="loading-state">Listening for whispers...</div>';
        const { data: comments, error } = await state.db
            .from('comments')
            .select('*, profiles!comments_user_id_fkey(id, username, avatar_url, avatar_position_x, avatar_position_y)')
            .eq('story_id', storyId)
            .is('deleted_at', null)
            .order('created_at', { ascending: true });

        if (error) {
            list.innerHTML = '<div class="empty-state">Comments could not be loaded.</div>';
            return;
        }
        list.innerHTML = '';
        if (!comments?.length) {
            list.innerHTML = '<div class="empty-state">No comments yet. Leave the first little lantern.</div>';
            return;
        }
        comments.forEach((comment) => list.insertAdjacentHTML('beforeend', commentHTML(comment)));
    }

    function commentHTML(comment) {
        const author = comment.profiles?.username || comment.guest_name || 'Guest';
        const avatar = resolveAvatarUrl(comment.profiles?.avatar_url, comment.profiles?.id || author);
        return `
            <div class="comment-item" data-comment-id="${comment.id}">
                <img src="${escapeAttr(avatar)}" class="feed-avatar-img" alt=""${avatarStyleAttr(comment.profiles)}>
                <div class="comment-copy">
                    <strong>@${escapeHtml(author)}</strong>
                    <p>${escapeHtml(comment.content || '')}</p>
                </div>
                <div class="action-column">
                    <button class="menu-trigger" type="button" data-comment-action="menu" aria-label="Comment menu">⋮</button>
                    <div class="menu-dropdown">
                        <button type="button" data-comment-action="report" data-comment-id="${comment.id}">⚠️ Report</button>
                        ${canEditComment(comment) ? `<button type="button" class="text-red" data-comment-action="delete" data-comment-id="${comment.id}">🗑️ Delete</button>` : ''}
                    </div>
                </div>
            </div>`;
    }

    function handleCommentActionClick(event) {
        const button = event.target.closest('[data-comment-action]');
        if (!button) return;
        event.stopPropagation();
        const action = button.dataset.commentAction;
        const commentId = Number(button.dataset.commentId || button.closest('[data-comment-id]')?.dataset.commentId);
        if (action === 'menu') return toggleMenu(button);
        if (action === 'report') return reportContent('comment', commentId);
        if (action === 'delete') return deleteComment(commentId);
    }

    async function postComment() {
        if (!state.db) return toast('Commenting needs Supabase to be connected.', 'error');
        if (!state.activeStoryId) return;
        const input = $('#newCommentInput');
        const content = input?.value.trim();
        if (!content) return;

        const payload = { story_id: state.activeStoryId, content };
        if (state.currentUser) {
            payload.user_id = state.currentUser.id;
        } else {
            const guestName = cleanUsername($('#commentGuestName')?.value);
            if (!guestName) return toast('Add your name to comment as a guest.', 'error');
            payload.guest_name = guestName;
        }

        const { error } = await state.db.from('comments').insert(payload);
        if (error) return toast(`Could not post comment: ${error.message}`, 'error');
        input.value = '';
        toast('Comment posted.');
        await fetchComments(state.activeStoryId);
        await fetchStories();
    }

    async function deleteComment(commentId) {
        if (!state.db || !window.confirm('Delete this comment?')) return;
        closeAllMenus();
        const { error } = await state.db.from('comments').update({ deleted_at: new Date().toISOString() }).eq('id', commentId);
        if (error) return toast(`Could not delete comment: ${error.message}`, 'error');
        toast('Comment deleted.');
        await fetchComments(state.activeStoryId);
        await fetchStories();
    }

    function reportContent(type, id) {
        closeAllMenus();
        console.info(`Reported ${type}:`, id);
        toast(`Thanks for reporting this ${type}. An admin can review it.`);
    }

    async function copyStory(storyId) {
        const story = getCachedStory(storyId) || (state.activeStoryId === storyId ? state.activeStory : null);
        if (!story) return;
        try {
            await navigator.clipboard.writeText(story.content || '');
            toast('Story copied to clipboard.');
        } catch {
            toast('Could not access clipboard in this browser.', 'error');
        }
    }

    function updateStats() {
        const stories = state.feedStories;
        const uniqueWriters = new Set(stories.map((story) => story.user_id || story.guest_name || getAuthorName(story))).size;
        const votes = stories.reduce((sum, story) => sum + Number(story.votes || 0), 0);
        setText('#statStories', stories.length.toString());
        setText('#statVotes', votes.toString());
        setText('#statWriters', uniqueWriters.toString());
    }

    async function loadAllUsers() {
        if (!state.db || !state.isAdmin) return;
        const list = $('#adminUserList');
        if (!list) return;
        list.innerHTML = '<div class="loading-state">Loading users...</div>';

        const term = ($('#adminUserSearch')?.value || '').trim();
        let query = state.db.from('profiles').select('*, user_flairs(flair_id)').order('username').limit(60);
        if (term) query = query.ilike('username', `%${term}%`);
        const { data: users, error } = await query;

        if (error) {
            list.innerHTML = '<div class="empty-state">Could not load users.</div>';
            return;
        }
        list.innerHTML = '';
        if (!users?.length) {
            list.innerHTML = '<div class="empty-state">No users found.</div>';
            return;
        }
        users.forEach((user) => list.insertAdjacentHTML('beforeend', adminUserCardHTML(user)));
    }

    function adminUserCardHTML(user) {
        const earned = new Set((user.user_flairs || []).map((flair) => flair.flair_id));
        const badgeButtons = CONFIG.badges.map((badge) => {
            const has = earned.has(badge.id);
            return `<button type="button" class="admin-badge-btn ${badge.css} ${has ? 'owned' : ''}" title="Toggle ${badge.name}" data-toggle-badge="${badge.id}" data-user-id="${user.id}" data-has-badge="${has}"></button>`;
        }).join('');
        return `
            <div class="admin-user-card">
                <div class="admin-user-header">
                    <button class="text-link" type="button" data-view-user="${user.id}">@${escapeHtml(user.username || 'Unnamed')}</button>
                    <button class="btn-delete small" type="button" data-ban-user="${user.id}">BAN</button>
                </div>
                <div class="admin-badge-controls">${badgeButtons}</div>
            </div>`;
    }

    function handleAdminClick(event) {
        const tab = event.target.closest('[data-admin-tab]');
        if (tab) return switchAdminTab(tab.dataset.adminTab);

        const award = event.target.closest('[data-award]');
        if (award) return adminAwardBadge(Number(award.dataset.award));

        const revoke = event.target.closest('[data-revoke]');
        if (revoke) return adminRevokeBadge(Number(revoke.dataset.revoke));

        const view = event.target.closest('[data-view-user]');
        if (view) return viewUserProfile(view.dataset.viewUser);

        const ban = event.target.closest('[data-ban-user]');
        if (ban) return adminBanUser(ban.dataset.banUser);

        const toggle = event.target.closest('[data-toggle-badge]');
        if (toggle) return toggleUserBadge(toggle.dataset.userId, Number(toggle.dataset.toggleBadge), toggle.dataset.hasBadge === 'true', toggle);
    }

    function switchAdminTab(tabName) {
        $$('.admin-tab-content').forEach((panel) => panel.classList.add('hidden'));
        $$('.tab-btn').forEach((button) => button.classList.toggle('active', button.dataset.adminTab === tabName));
        $(`#adminTab${capitalize(tabName)}`)?.classList.remove('hidden');
    }

    async function viewUserProfile(userId) {
        if (!state.db || !state.isAdmin) return;
        const modal = $('#profileModal');
        modal?.classList.add('admin-view');
        $('.avatar-wrapper')?.classList.add('no-click');
        $('#settingsSection')?.classList.add('hidden');
        $('#deleteSection')?.classList.add('hidden');
        $('#adminDashboardBtn')?.classList.add('hidden');
        openModal('profileModal');

        const { data: targetUser, error } = await state.db.from('profiles').select('*').eq('id', userId).maybeSingle();
        if (error || !targetUser) return toast('User data missing.', 'error');
        setProfileDetails(targetUser, { readOnly: true });
        const targetAvatar = $('#profileAvatar');
        if (targetAvatar) {
            targetAvatar.src = resolveAvatarUrl(targetUser.avatar_url, targetUser.id || targetUser.username);
            applyAvatarPosition(targetAvatar, targetUser);
        }
        renderPlaceholderAvatarGrid(targetUser);
        await loadProfileStatsForUser(userId);
        await loadPassportForUser(userId);
        await loadStoriesForUser(userId);
    }

    function resetProfileModalToMyView() {
        const modal = $('#profileModal');
        modal?.classList.remove('admin-view');
        $('.avatar-wrapper')?.classList.remove('no-click');
        $('#settingsSection')?.classList.remove('hidden');
        $('#deleteSection')?.classList.remove('hidden');
        $('#adminDashboardBtn')?.classList.toggle('hidden', !state.isAdmin);

        if (!state.currentUser || !state.currentProfile) return;
        setProfileDetails(state.currentProfile);
        const profileAvatar = $('#profileAvatar');
        if (profileAvatar) {
            profileAvatar.src = resolveAvatarUrl(state.currentProfile.avatar_url, state.currentProfile.id || state.currentProfile.username);
            applyAvatarPosition(profileAvatar, state.currentProfile);
        }
        renderPlaceholderAvatarGrid(state.currentProfile);
        loadProfileStatsForUser(state.currentUser.id);
        loadPassportForUser(state.currentUser.id);
        loadStoriesForUser(state.currentUser.id);
    }

    async function toggleUserBadge(userId, badgeId, hasBadge, button) {
        if (!state.db || !state.isAdmin) return;
        const confirmed = window.confirm(hasBadge ? 'Remove this badge?' : 'Award this badge?');
        if (!confirmed) return;
        const query = state.db.from('user_flairs');
        const { error } = hasBadge
            ? await query.delete().eq('user_id', userId).eq('flair_id', badgeId)
            : await query.insert({ user_id: userId, flair_id: badgeId });
        if (error) return toast(`Badge update failed: ${error.message}`, 'error');
        button.classList.toggle('owned', !hasBadge);
        button.dataset.hasBadge = String(!hasBadge);
        toast(hasBadge ? 'Badge removed.' : 'Badge awarded.');
    }

    async function adminBanUser(userId) {
        if (!state.db || !state.isAdmin) return;
        if (!window.confirm('Remove this user profile row? Supabase Auth deletion still requires a server/admin function.')) return;
        const { error } = await state.db.from('profiles').delete().eq('id', userId);
        if (error) return toast(`Could not remove user: ${error.message}`, 'error');
        toast('User profile removed.');
        loadAllUsers();
    }

    async function adminAwardBadge(badgeId) {
        await setManualBadge(badgeId, 'award');
    }

    async function adminRevokeBadge(badgeId) {
        await setManualBadge(badgeId, 'revoke');
    }

    async function setManualBadge(badgeId, mode) {
        if (!state.db || !state.isAdmin) return;
        const input = $(`#badgeInput_${badgeId}`);
        const username = input?.value.trim();
        if (!username) return toast('Enter a username first.', 'error');
        const { data: user, error: userError } = await state.db.from('profiles').select('id').eq('username', username).maybeSingle();
        if (userError || !user) return toast('User not found.', 'error');

        const { error } = mode === 'award'
            ? await state.db.from('user_flairs').insert({ user_id: user.id, flair_id: badgeId })
            : await state.db.from('user_flairs').delete().eq('user_id', user.id).eq('flair_id', badgeId);
        if (error) return toast(`Badge ${mode} failed: ${error.message}`, 'error');
        input.value = '';
        toast(mode === 'award' ? 'Badge awarded.' : 'Badge revoked.');
        loadAllUsers();
    }

    async function loadPassportForUser(targetId) {
        if (!state.db) return;
        const grid = $('#flairGrid');
        if (!grid) return;
        grid.innerHTML = '<div class="loading-state">Loading badges...</div>';

        const [{ data: userFlairs, error }, { data: targetProfile }] = await Promise.all([
            state.db.from('user_flairs').select('flair_id').eq('user_id', targetId),
            state.db.from('profiles').select('selected_flair_id').eq('id', targetId).maybeSingle()
        ]);
        if (error) {
            grid.innerHTML = '<div class="empty-state">Error loading badges.</div>';
            return;
        }

        const counts = {};
        (userFlairs || []).forEach((flair) => { counts[flair.flair_id] = (counts[flair.flair_id] || 0) + 1; });
        const earnedIds = new Set((userFlairs || []).map((flair) => flair.flair_id));
        if (targetId === state.currentUser?.id) {
            state.avatarRewardState.badges = new Set((userFlairs || []).map((flair) => Number(flair.flair_id)));
            renderPlaceholderAvatarGrid(state.currentProfile);
        }
        const selectedId = targetProfile?.selected_flair_id || null;
        grid.innerHTML = '';

        CONFIG.badges.forEach((badge) => {
            const isUnlocked = earnedIds.has(badge.id);
            const item = document.createElement('button');
            item.type = 'button';
            item.className = `flair-item ${isUnlocked ? 'unlocked' : 'locked'} ${selectedId === badge.id ? 'selected' : ''}`;
            item.disabled = !(isUnlocked && targetId === state.currentUser?.id);
            item.innerHTML = `
                <div class="flair-preview ${isUnlocked ? badge.css : 'frame-locked'}"></div>
                <span>${escapeHtml(badge.name)}</span>
                <div class="my-badge-tooltip">Times earned: ${counts[badge.id] || 0}</div>`;
            if (isUnlocked && targetId === state.currentUser?.id) item.addEventListener('click', () => equipFlair(badge.id));
            grid.appendChild(item);
        });
    }

    async function equipFlair(badgeId) {
        if (!state.db || !state.currentUser) return;
        const { error } = await state.db.from('profiles').update({ selected_flair_id: badgeId }).eq('id', state.currentUser.id);
        if (error) return toast(`Could not equip badge: ${error.message}`, 'error');
        state.currentProfile = await getProfileById(state.currentUser.id);
        updateUI();
        loadPassportForUser(state.currentUser.id);
        toast('Profile frame equipped.');
    }

    async function loadStoriesForUser(targetId) {
        if (!state.db) return;
        const list = $('#myStoriesList');
        if (!list) return;
        list.innerHTML = '<div class="loading-state">Loading stories...</div>';
        const { data: stories, error } = await state.db
            .from('stories')
            .select('*')
            .eq('user_id', targetId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (error) {
            list.innerHTML = '<div class="empty-state">Could not load stories.</div>';
            return;
        }
        list.innerHTML = '';
        if (!stories?.length) {
            list.innerHTML = '<p class="subtext" style="text-align:center; padding:1rem;">No stories yet.</p>';
            return;
        }
        stories.forEach((story) => {
            const details = document.createElement('details');
            details.className = 'story-accordion';
            const summary = document.createElement('summary');
            summary.className = 'story-summary';
            const text = document.createElement('span');
            text.textContent = truncate(story.content || '', 56);
            summary.appendChild(text);

            if (targetId === state.currentUser?.id || state.isAdmin) {
                const del = document.createElement('button');
                del.type = 'button';
                del.textContent = '×';
                del.className = 'btn-delete-small';
                del.title = 'Delete story';
                del.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    deleteStory(story.id);
                });
                summary.appendChild(del);
            }

            const content = document.createElement('div');
            content.className = 'story-content-preview';
            content.textContent = story.content || '';
            details.append(summary, content);
            list.appendChild(details);
        });
    }

    async function uploadAvatar(event) {
        if (!state.db || !state.currentUser) return openAuth('login');
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.size > 2_000_000) return toast('Avatar is too large. Please use an image under 2MB.', 'error');
        if (!file.type.startsWith('image/')) return toast('Please choose an image file.', 'error');

        const overlay = $('#avatarEditOverlay');
        if (overlay) overlay.textContent = '⏳';
        const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
        const fileName = `${state.currentUser.id}/${Date.now()}.${extension}`;

        try {
            const { error: uploadError } = await state.db.storage.from(CONFIG.avatarBucket).upload(fileName, file, { cacheControl: '3600', upsert: true });
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = state.db.storage.from(CONFIG.avatarBucket).getPublicUrl(fileName);
            const { error: dbError } = await state.db
                .from('profiles')
                .update({
                    avatar_url: publicUrl,
                    avatar_position_x: 50,
                    avatar_position_y: 50
                })
                .eq('id', state.currentUser.id);
            if (dbError) throw dbError;
            state.currentProfile = await getProfileById(state.currentUser.id);
            updateUI();
            await fetchStories();
            renderPlaceholderAvatarGrid(state.currentProfile);
            syncAvatarPositionControls(state.currentProfile);
            toast('Uploaded picture added. Use the sliders to center it.');
        } catch (error) {
            console.error('Avatar upload failed:', error);
            toast('Upload failed. Make sure the avatars bucket exists and allows uploads.', 'error', 7000);
        } finally {
            if (overlay) overlay.textContent = '📷';
            event.target.value = '';
        }
    }

    function submitFeedback() {
        const text = $('#feedbackText')?.value.trim();
        if (!text) return toast('Write a little note first.', 'error');
        $('#feedbackText').value = '';
        closeModal('feedbackModal');
        toast('🦉 Owl dispatched. Hook this up to a feedback table when ready.');
    }

    function openFeedback() {
        $('#feedbackEmail')?.classList.toggle('hidden', !!state.currentUser);
        openModal('feedbackModal');
    }

    function getPromptPlaceholder() {
        const prompt = (state.currentPrompt || $('#weeklyPromptText')?.textContent || CONFIG.prompts?.[0] || '').trim();
        const defaultPlaceholder = 'Begin writing your story here...';
        if (document.body.classList.contains('focus-mode')) {
            return prompt || defaultPlaceholder;
        }
        return defaultPlaceholder;
    }

    function syncPromptPlaceholder() {
        const input = $('#mainStoryInput');
        if (!input) return;
        input.placeholder = getPromptPlaceholder();
    }

    function openClearStoryConfirm(event) {
        event?.preventDefault();
        event?.stopPropagation();

        const input = $('#mainStoryInput');
        const hasDraft = !!input?.value || !!localStorage.getItem(CONFIG.draftKey);

        if (!hasDraft) {
            syncPromptPlaceholder();
            toast('The writing area is already clear.');
            return;
        }

        openModal('clearStoryModal');
    }

    function eraseStoryDraft() {
        const input = $('#mainStoryInput');
        if (input) input.value = '';
        localStorage.removeItem(CONFIG.draftKey);
        updateCharCounter();
        syncPromptPlaceholder();
        setText('#draftStatus', 'Draft cleared');
        updateWritingMoodState();
        closeModal('clearStoryModal');
        toast('Writing area cleared.');
        requestAnimationFrame(() => input?.focus({ preventScroll: true }));
    }

    function getDefaultWritingStyle() {
        return {
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: '1.42rem',
            bold: false,
            italic: false
        };
    }

    function getSavedWritingStyle() {
        try {
            const saved = JSON.parse(localStorage.getItem(writingStyleKey) || 'null');
            return { ...getDefaultWritingStyle(), ...(saved || {}) };
        } catch (_error) {
            return getDefaultWritingStyle();
        }
    }

    function restoreWritingStyle() {
        applyWritingStyle(getSavedWritingStyle(), { syncControls: true, persist: false });
    }

    function updateWritingStyleFromTools() {
        const current = getSavedWritingStyle();
        const next = {
            ...current,
            fontFamily: $('#writingFontSelect')?.value || current.fontFamily,
            fontSize: $('#writingSizeSelect')?.value || current.fontSize
        };
        applyWritingStyle(next);
        $('#mainStoryInput')?.focus({ preventScroll: true });
    }

    function toggleWritingBold() {
        const current = getSavedWritingStyle();
        const next = { ...current, bold: !current.bold };
        applyWritingStyle(next);
        $('#mainStoryInput')?.focus({ preventScroll: true });
    }

    function toggleWritingItalic() {
        const current = getSavedWritingStyle();
        const next = { ...current, italic: !current.italic };
        applyWritingStyle(next);
        $('#mainStoryInput')?.focus({ preventScroll: true });
    }

    function applyWritingStyle(style, options = {}) {
        const normalized = { ...getDefaultWritingStyle(), ...(style || {}) };
        document.documentElement.style.setProperty('--writing-user-font-family', normalized.fontFamily);
        document.documentElement.style.setProperty('--writing-user-font-size', normalized.fontSize);
        document.documentElement.style.setProperty('--writing-user-font-weight', normalized.bold ? '700' : '500');
        document.documentElement.style.setProperty('--writing-user-font-style', normalized.italic ? 'italic' : 'normal');
        document.body.classList.toggle('writing-style-bold', !!normalized.bold);
        document.body.classList.toggle('writing-style-italic', !!normalized.italic);

        if (options.syncControls !== false) {
            const fontSelect = $('#writingFontSelect');
            const sizeSelect = $('#writingSizeSelect');
            const boldBtn = $('#writingBoldBtn');
            const italicBtn = $('#writingItalicBtn');
            if (fontSelect) fontSelect.value = normalized.fontFamily;
            if (sizeSelect) sizeSelect.value = normalized.fontSize;
            boldBtn?.setAttribute('aria-pressed', String(!!normalized.bold));
            italicBtn?.setAttribute('aria-pressed', String(!!normalized.italic));
        }

        if (options.persist !== false) {
            localStorage.setItem(writingStyleKey, JSON.stringify(normalized));
        }
    }

    function restoreDraft() {
        const draft = localStorage.getItem(CONFIG.draftKey);
        const input = $('#mainStoryInput');
        const guestName = localStorage.getItem(CONFIG.guestNameKey);
        if (draft && input) {
            input.value = draft;
            setText('#draftStatus', 'Draft restored from this browser');
        }
        if (guestName && $('#guestPenName')) $('#guestPenName').value = guestName;
        syncPromptPlaceholder();
        updateWritingMoodState();
    }

    function saveDraft() {
        const value = $('#mainStoryInput')?.value || '';
        localStorage.setItem(CONFIG.draftKey, value);
        setText('#draftStatus', value ? 'Draft saved locally' : 'Draft is empty');
        updateWritingMoodState();
    }

    function saveGuestName() {
        localStorage.setItem(CONFIG.guestNameKey, $('#guestPenName')?.value || '');
    }

    function clearDraft() {
        if (!$('#mainStoryInput')?.value && !localStorage.getItem(CONFIG.draftKey)) return;
        openClearStoryConfirm();
    }

    function updateCharCounter() {
        const value = $('#mainStoryInput')?.value || '';
        const count = value.length;
        setText('#charCount', String(count));
        const percent = Math.min(100, (count / 2000) * 100);
        const bar = $('#charBar');
        if (bar) bar.style.width = `${percent}%`;
    }

    async function loadSiteSettings() {
        if (!state.db) return;
        try {
            const { data, error } = await state.db.from('site_settings').select('key,value').in('key', ['weekly_prompt', 'youtube_url']);
            if (error || !Array.isArray(data)) return;
            const settings = Object.fromEntries(data.map((row) => [row.key, row.value]));
            if (settings.weekly_prompt) setWeeklyPrompt(settings.weekly_prompt);
            if (settings.youtube_url) loadYouTubePlayer(toYouTubeEmbedUrl(settings.youtube_url));
        } catch (error) {
            // Optional table: ignore when it has not been created yet.
            console.info('Site settings table is optional and not currently available.');
        }
    }

    function populateSiteSettingsForm() {
        const promptInput = $('#adminPromptInput');
        const videoInput = $('#adminVideoInput');
        if (promptInput) promptInput.value = state.currentPrompt || CONFIG.prompts[0];
        if (videoInput) videoInput.value = state.currentVideoUrl || CONFIG.youtubeSrc;
    }

    async function saveSiteSettings() {
        if (!state.db || !state.isAdmin) return toast('Only the admin account can save site settings.', 'error');
        const prompt = $('#adminPromptInput')?.value.trim();
        const videoUrl = $('#adminVideoInput')?.value.trim();
        if (!prompt) return toast('Add a prompt before saving.', 'error');

        const rows = [
            { key: 'weekly_prompt', value: prompt },
            { key: 'youtube_url', value: videoUrl || CONFIG.youtubeSrc }
        ];

        setButtonLoading('#saveSiteSettingsBtn', true, 'Saving...');
        try {
            const { error } = await state.db.from('site_settings').upsert(rows, { onConflict: 'key' });
            if (error) return toast(`Could not save settings: ${friendlyDbError(error)}`, 'error', 8000);
            setWeeklyPrompt(prompt);
            loadYouTubePlayer(toYouTubeEmbedUrl(videoUrl || CONFIG.youtubeSrc));
            toast('Site settings saved.');
        } catch (error) {
            console.error('Settings save failed:', error);
            toast(`Could not save settings: ${friendlyDbError(error)}`, 'error', 8000);
        } finally {
            setButtonLoading('#saveSiteSettingsBtn', false);
        }
    }

    function toYouTubeEmbedUrl(url) {
        const fallback = CONFIG.youtubeSrc;
        if (!url) return fallback;
        try {
            if (url.includes('/embed/')) {
                const joiner = url.includes('?') ? '&' : '?';
                return `${url}${joiner}autoplay=0&mute=0&playsinline=1&controls=1&rel=0&enablejsapi=1`;
            }
            const parsed = new URL(url);
            const id = parsed.searchParams.get('v') || parsed.pathname.split('/').filter(Boolean).pop();
            if (!id) return fallback;
            const start = parsed.searchParams.get('t') || parsed.searchParams.get('start') || '0';
            const seconds = String(start).replace('s', '');
            return `https://www.youtube.com/embed/${encodeURIComponent(id)}?start=${encodeURIComponent(seconds)}&autoplay=0&mute=1&playsinline=1&controls=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin || '')}`;
        } catch {
            return fallback;
        }
    }

    function useRandomPrompt() {
        const prompt = CONFIG.prompts[Math.floor(Math.random() * CONFIG.prompts.length)];
        setWeeklyPrompt(prompt);
        const textArea = $('#mainStoryInput');
        if (!textArea) return;
        const prefix = `Prompt: ${prompt}\n\n`;
        if (!textArea.value.trim()) {
            textArea.value = prefix;
        } else {
            textArea.value = `${textArea.value.trim()}\n\n${prefix}`;
        }
        textArea.focus();
        updateCharCounter();
        saveDraft();
    }

    function setWeeklyPrompt(prompt) {
        state.currentPrompt = prompt || '';
        setText('#weeklyPromptText', state.currentPrompt);
        syncPromptPlaceholder();
    }


    function toggleWeeklyVideo() {
        const button = $('#toggleVideoBtn');
        const dropdown = $('#videoDropdown');
        if (!button || !dropdown) return;

        const opening = !dropdown.classList.contains('open');
        dropdown.classList.toggle('open', opening);
        dropdown.setAttribute('aria-hidden', String(!opening));
        button.setAttribute('aria-expanded', String(opening));
        setText('.video-toggle-text', opening ? 'Hide video inspiration' : 'Tap for video inspiration');

        if (opening && !$('#youtubePlayer')?.src) loadYouTubePlayer();
    }

    function loadYouTubePlayer(src = CONFIG.youtubeSrc) {
        const player = $('#youtubePlayer');
        if (!player) return;
        if (player.src !== src) player.src = src;
        state.currentVideoUrl = src;
    }

    function playBackgroundVideo() {
        const bgVideo = $('#bgVideo');
        if (!bgVideo) return;
        bgVideo.muted = true;
        bgVideo.play().catch(() => {
            const retry = () => {
                bgVideo.play().catch(() => undefined);
                window.removeEventListener('pointerdown', retry);
            };
            window.addEventListener('pointerdown', retry, { once: true });
        });
    }

    async function copyPrompt() {
        try {
            await navigator.clipboard.writeText($('#weeklyPromptText')?.textContent || '');
            toast('Prompt copied.');
        } catch {
            toast('Could not access clipboard in this browser.', 'error');
        }
    }

    function startWritingFromPrompt(event) {
        event?.preventDefault();
        event?.stopPropagation();

        const input = $('#mainStoryInput');
        const promptText = ($('#weeklyPromptText')?.textContent || '').trim();

        if (!input || !promptText) return;

        // Use the prompt as example text only once Focus Mode opens.
        // The main page keeps a simpler, cleaner writing placeholder.
        input.placeholder = promptText;

        // The mobile Writing Desk normally requires an intentional tap before
        // focus mode opens. The feather button is already intentional, so let it
        // bypass that guard and enter Focus Mode immediately.
        state.writingTap.intentionalUntil = Date.now() + 1600;
        enterFocusMode({ allowYouTubeResume: false });

        const focusAndPlace = () => {
            input.focus({ preventScroll: true });
            input.scrollIntoView({
                behavior: isMobileWritingViewport() ? 'auto' : 'smooth',
                block: isMobileWritingViewport() ? 'nearest' : 'center'
            });
        };

        requestAnimationFrame(() => {
            focusAndPlace();
            if (isMobileWritingViewport()) {
                setTimeout(focusAndPlace, 180);
            }
        });
    }

    function getYouTubePlayer() {
        return $('#youtubePlayer');
    }

    function postYouTubeCommand(func, args = []) {
        const player = getYouTubePlayer();
        if (!player?.contentWindow) return;
        try {
            player.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
        } catch (error) {
            console.info('YouTube command skipped:', error);
        }
    }

    function getSiteVolume() {
        const raw = Number(state.ambient.audioVolume);
        if (!Number.isFinite(raw)) return 0.5;
        return Math.max(0, Math.min(1, raw));
    }

    function quietYouTubePlayer({ pause = true } = {}) {
        postYouTubeCommand('mute');
        if (pause) postYouTubeCommand('pauseVideo');
    }

    function resumeYouTubePlayer() {
        const player = getYouTubePlayer();
        if (!player) return;
        if (!player.src) loadYouTubePlayer();

        const volume = getSiteVolume();

        if (volume <= 0) {
            quietYouTubePlayer();
            return;
        }

        postYouTubeCommand('setVolume', [Math.round(volume * 100)]);
        postYouTubeCommand('unMute');
        postYouTubeCommand('playVideo');
    }

    function primeYouTubeAudio() {
        // YouTube autoplay is intentionally disabled. The embedded player should
        // not start itself after focus-mode clicks, X close, outside clicks,
        // volume changes, or ambient sound changes. Playback stays user-controlled.
        updateFocusMuteButton();
    }

    function updateFocusMuteButton() {
        // Backward-compatible name: this now syncs the site-wide volume slider.
        const slider = $('#siteVolumeSlider');
        const volume = getSiteVolume();

        state.ambient.audioMuted = volume <= 0;

        if (slider && document.activeElement !== slider) {
            slider.value = String(Math.round(volume * 100));
        }

        slider?.setAttribute('aria-valuetext', volume <= 0 ? 'Muted' : `${Math.round(volume * 100)} percent`);
    }

    function updateSiteVolumeFromSlider() {
        const slider = $('#siteVolumeSlider');
        const value = Math.max(0, Math.min(100, Number(slider?.value) || 0));

        state.ambient.audioVolume = value / 100;
        state.ambient.audioMuted = value <= 0;

        updateFocusMuteButton();
        syncFocusAudio({ allowYouTubeResume: false });
    }

    function setAmbientMasterAudible() {
        const volume = getSiteVolume();
        const audible = volume > 0 && state.ambient.effectsEnabled;

        if (state.ambient.master && state.ambient.ctx) {
            state.ambient.master.gain.setTargetAtTime(audible ? 0.92 * volume : 0, state.ambient.ctx.currentTime, 0.05);
        }

        updateActiveSoundVolumes();
    }

    function syncFocusAudio(options = {}) {
        const { allowYouTubeResume = false } = options;

        updateFocusMuteButton();
        setAmbientMasterAudible();

        if (getSiteVolume() <= 0) {
            quietYouTubePlayer();
            return;
        }

        if (state.ambient.activeSounds.size > 0) {
            quietYouTubePlayer();
            return;
        }

        if (allowYouTubeResume) {
            resumeYouTubePlayer();
        }
    }

    function toggleFocusMute() {
        // Kept as a safety fallback for older cached markup.
        state.ambient.audioVolume = getSiteVolume() > 0 ? 0 : 0.5;
        state.ambient.audioMuted = state.ambient.audioVolume <= 0;
        updateFocusMuteButton();
        syncFocusAudio({ allowYouTubeResume: false });
    }

    function wireIntentionalWritingFocus() {
        const input = $('#mainStoryInput');
        if (!input || input.dataset.intentionalFocusReady === 'true') return;
        input.dataset.intentionalFocusReady = 'true';

        // The writing desk is now fully usable on the main page.
        // Focus Mode opens only from the dedicated circular expand/retract button
        // or from the feather inspiration button.
        input.addEventListener('focus', () => {
            $('#writingZoneSection')?.classList.add('is-writing-active');
        });

        input.addEventListener('blur', () => {
            $('#writingZoneSection')?.classList.remove('is-writing-active');
        });
    }

    function isMobileWritingViewport() {
        return window.matchMedia('(max-width: 760px), (pointer: coarse)').matches;
    }

    function toggleFocusModeFromButton(event) {
        event?.preventDefault();
        event?.stopPropagation();

        if (document.body.classList.contains('focus-mode')) {
            exitFocusMode();
        } else {
            state.writingTap.intentionalUntil = Date.now() + 1200;
            enterFocusMode({ allowYouTubeResume: false });
            requestAnimationFrame(() => $('#mainStoryInput')?.focus({ preventScroll: true }));
        }
    }

    function updateFocusToggleButton() {
        const button = $('#focusModeToggleBtn');
        if (!button) return;
        const isFocus = document.body.classList.contains('focus-mode');
        const icon = $('.focus-mode-toggle-icon', button);
        const label = $('.focus-mode-toggle-label', button);
        const text = isFocus ? 'Exit focus mode' : 'Enter focus mode';

        button.setAttribute('aria-label', text);
        button.setAttribute('title', text);
        button.setAttribute('aria-pressed', String(isFocus));
        if (icon) icon.textContent = isFocus ? '↙' : '⛶';
        if (label) label.textContent = text;
    }

    function enterFocusMode(options = {}) {
        const writingZone = $('#writingZoneSection');
        const storyInput = $('#mainStoryInput');
        const isMobile = isMobileWritingViewport();
        const allowYouTubeResume = options.allowYouTubeResume ?? false;

        if (!document.body.classList.contains('focus-mode')) {
            closeRibbonPanel();
            closeAmbientMenus();
            document.body.classList.add('focus-mode');
            closeAmbientMenus();
            updateFocusToggleButton();
            syncPromptPlaceholder();
            syncFocusAudio({ allowYouTubeResume });
        }

        if (isMobile) {
            requestAnimationFrame(() => {
                writingZone?.scrollIntoView({ behavior: 'auto', block: 'start' });
                setTimeout(() => {
                    storyInput?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 120);
            });
        } else {
            writingZone?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function exitFocusMode() {
        document.body.classList.remove('focus-mode');
        updateFocusToggleButton();
        syncPromptPlaceholder();
        closeAmbientMenus();
        syncFocusAudio({ allowYouTubeResume: false });
    }

    function setCandleIcon() {
        const candle = $('#candleBtn');
        if (!candle) return;
        candle.innerHTML = '<span class="candle-glyph" aria-hidden="true">🕯️</span>';
    }

    function toggleCandleMode() {
        const slider = $('#candleBrightnessSlider');
        if (slider) {
            slider.value = getCandleBrightnessLevel() > 0.01 ? '0' : '100';
            updateCandleBrightness();
            return;
        }

        const lit = !document.body.classList.contains('candle-lit');
        const candle = $('#candleBtn');
        document.body.classList.toggle('candle-lit', lit);
        candle?.setAttribute('aria-pressed', String(lit));
        candle?.setAttribute('aria-label', lit ? 'Put out candle' : 'Light candle');
        candle?.setAttribute('title', lit ? 'Put out candle' : 'Light candle');
        setCandleIcon();
        updateAmbientTriggerStates();
    }

    function getCandleBrightnessLevel() {
        const slider = $('#candleBrightnessSlider');
        if (!slider) return 0;
        return clamp01((Number(slider.value) || 0) / 100);
    }

    function mixColor(start, end, amount) {
        const t = clamp01(amount);
        const channel = (index) => Math.round(start[index] + (end[index] - start[index]) * t);
        return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
    }

    function getFocusVisibilityLevel() {
        const slider = $('#focusVisibilitySlider');
        if (!slider) return 0.88;
        return Math.max(48, Math.min(96, Number(slider.value) || 88)) / 100;
    }

    function getFocusInkFactor() {
        return clamp01((getFocusVisibilityLevel() - 0.48) / 0.48);
    }

    function updateCandleBrightness() {
        const slider = $('#candleBrightnessSlider');
        if (!slider) return;

        // The candle slider now uses 50% as the neutral/default page mood.
        // Sliding down makes the room darker; sliding up brightens panels and
        // pushes the writing paper toward clean white.
        const rawLevel = clamp01((Number(slider.value) || 0) / 100, 0.5);
        const dim = clamp01((0.5 - rawLevel) / 0.5, 0);
        const bright = clamp01((rawLevel - 0.5) / 0.5, 0);
        const eased = bright <= 0 ? 0 : 1 - Math.pow(1 - bright, 1.35);
        const active = Math.abs(rawLevel - 0.5) > 0.01;
        const inkFactor = getFocusInkFactor();
        const surfaceStrength = 0.42 + (0.58 * inkFactor);
        const inputStrength = 0.48 + (0.52 * inkFactor);

        document.body.classList.remove('candle-lit');
        document.body.classList.toggle('candle-brightness-active', active);

        const dimText = mixColor([246, 234, 212], [178, 164, 132], dim);
        const brightText = mixColor([246, 234, 212], [39, 31, 24], eased);
        const finalText = bright > 0 ? brightText : dimText;
        const finalMuted = bright > 0
            ? mixColor([200, 195, 165], [61, 48, 36], eased)
            : mixColor([200, 195, 165], [150, 138, 110], dim);

        document.body.style.setProperty('--candle-level', rawLevel.toFixed(3));
        document.body.style.setProperty('--candle-bright', bright.toFixed(3));
        document.body.style.setProperty('--candle-dim', dim.toFixed(3));
        document.body.style.setProperty('--candle-ease', eased.toFixed(3));
        document.body.style.setProperty('--focus-ink-factor', inkFactor.toFixed(3));
        document.body.style.setProperty('--candle-page-alpha', eased.toFixed(3));
        document.body.style.setProperty('--candle-glow-alpha', (0.42 * eased).toFixed(3));
        document.body.style.setProperty('--candle-overlay-alpha', (0.42 + (0.22 * dim) - (0.12 * eased)).toFixed(3));
        document.body.style.setProperty('--candle-panel-alpha-1', ((0.08 + (0.86 * eased)) * surfaceStrength).toFixed(3));
        document.body.style.setProperty('--candle-panel-alpha-2', ((0.07 + (0.82 * eased)) * surfaceStrength).toFixed(3));
        document.body.style.setProperty('--candle-border-alpha', (0.10 + (0.20 * eased * inputStrength) + (0.04 * dim)).toFixed(3));
        document.body.style.setProperty('--candle-input-alpha', ((0.08 + (0.64 * eased)) * inputStrength).toFixed(3));
        document.body.style.setProperty('--candle-control-alpha', (0.05 + (0.51 * eased) + (0.08 * dim)).toFixed(3));
        document.body.style.setProperty('--candle-text-color', finalText);
        document.body.style.setProperty('--candle-muted-color', finalMuted);
        document.body.style.setProperty('--candle-track-alpha', (0.08 + (0.10 * eased) + (0.08 * dim)).toFixed(3));
        document.body.style.setProperty('--candle-range-progress-alpha', (0.42 + (0.18 * eased)).toFixed(3));
        document.body.style.setProperty('--candle-control-hover-alpha', Math.min(0.78, 0.13 + (0.51 * eased) + (0.08 * dim)).toFixed(3));
        document.body.style.setProperty('--candle-focus-inset-alpha', (0.22 * eased).toFixed(3));
        document.body.style.setProperty('--candle-focus-shadow-alpha', (0.26 + (0.10 * (1 - inkFactor)) + (0.18 * dim)).toFixed(3));
        document.body.style.setProperty('--candle-char-track-alpha', (0.14 + (0.08 * eased) + (0.08 * dim)).toFixed(3));
        document.body.style.setProperty('--candle-char-border-alpha', (0.12 + (0.10 * eased) + (0.08 * dim)).toFixed(3));
        document.body.style.setProperty('--candle-char-glow-alpha', (0.16 + (0.12 * eased)).toFixed(3));
        document.body.style.setProperty('--candle-room-overlay-alpha', (0.40 + (0.24 * dim) - (0.12 * eased)).toFixed(3));
        document.body.style.setProperty('--candle-room-overlay-saturation', (0.96 - (0.08 * dim) + (0.10 * eased)).toFixed(3));
        document.body.style.setProperty('--story-room-candle-brightness', (0.72 - (0.22 * dim) + (0.18 * eased)).toFixed(3));
        document.body.style.setProperty('--story-room-candle-saturation', (0.92 - (0.10 * dim) + (0.12 * eased)).toFixed(3));
        document.body.style.setProperty('--story-room-candle-blur', `${(3.8 + (1.0 * dim) - (0.8 * eased)).toFixed(2)}px`);
        document.body.style.setProperty('--candle-paper-alpha', (0.92 * eased).toFixed(3));
        document.body.style.setProperty('--candle-writing-dim-alpha', (0.34 * dim).toFixed(3));
        document.body.style.setProperty('--candle-panel-dim-alpha', (0.22 * dim).toFixed(3));

        slider.setAttribute('aria-valuetext', `${Math.round(rawLevel * 100)}% candle brightness`);
        updateAmbientTriggerStates();
    }

    function updateFocusVisibility() {
        const slider = $('#focusVisibilitySlider');
        if (!slider) return;

        const level = getFocusVisibilityLevel();
        const secondary = Math.min(0.98, level + 0.05);
        const textareaAlpha = Math.max(0.10, Math.min(0.42, level - 0.58));
        const blur = Math.round(5 + level * 10);

        // Feather / Ink now affects the writing paper itself, not only the
        // surrounding writing window. Feather makes the paper translucent so
        // the room shows through; Ink restores the opaque old-page surface.
        const min = Number(slider.min) || 48;
        const max = Number(slider.max) || 96;
        const value = Number(slider.value) || 88;
        const inkFactor = clamp01((value - min) / Math.max(1, max - min));
        const featherFactor = 1 - inkFactor;
        const paperAlpha = level;
        const highlightAlpha = 0.10 + (0.82 * level);
        const glowAlpha = 0.06 + (0.30 * inkFactor);
        const borderAlpha = 0.18 + (0.22 * inkFactor);
        const shadowAlpha = 0.08 + (0.14 * inkFactor);
        const paperBlur = 0.15 + (1.35 * featherFactor);

        document.body.style.setProperty('--focus-zone-alpha', level.toFixed(2));
        document.body.style.setProperty('--focus-zone-alpha-2', secondary.toFixed(2));
        document.body.style.setProperty('--focus-textarea-alpha', textareaAlpha.toFixed(2));
        document.body.style.setProperty('--focus-zone-blur', `${blur}px`);
        document.body.style.setProperty('--nook-writing-ink-factor', inkFactor.toFixed(3));
        document.body.style.setProperty('--nook-writing-feather-factor', featherFactor.toFixed(3));
        document.body.style.setProperty('--nook-writing-paper-alpha', paperAlpha.toFixed(3));
        document.body.style.setProperty('--nook-writing-highlight-alpha', highlightAlpha.toFixed(3));
        document.body.style.setProperty('--nook-writing-glow-alpha', glowAlpha.toFixed(3));
        document.body.style.setProperty('--nook-writing-border-alpha', borderAlpha.toFixed(3));
        document.body.style.setProperty('--nook-writing-shadow-alpha', shadowAlpha.toFixed(3));
        document.body.style.setProperty('--nook-writing-paper-blur', `${paperBlur.toFixed(2)}px`);
        document.body.style.setProperty('--nook-writing-text-color', '#2c1d12');
        document.body.style.setProperty('--nook-writing-placeholder-color', 'rgba(62, 43, 27, 0.52)');
        document.body.style.setProperty('--nook-writing-caret-color', '#2c1d12');
        document.body.style.setProperty('--nook-writing-text-shadow', 'none');
        document.body.classList.toggle('writing-paper-feathered', featherFactor > 0.5);

        updateCandleBrightness();
    }

    function toggleAmbientMenu(menuId, buttonId, event) {
        event?.preventDefault?.();
        event?.stopPropagation?.();

        const menu = document.getElementById(menuId);
        const button = document.getElementById(buttonId);
        if (!menu || !button) return;

        const willOpen = menu.classList.contains('hidden');
        closeAmbientMenus();

        if (willOpen) {
            menu.classList.remove('hidden');
            menu.removeAttribute('inert');
            menu.setAttribute('aria-hidden', 'false');
            button.setAttribute('aria-expanded', 'true');
        } else {
            menu.classList.add('hidden');
            menu.setAttribute('inert', '');
            menu.setAttribute('aria-hidden', 'true');
            button.setAttribute('aria-expanded', 'false');
        }

        updateFocusVisibility();
        updateCandleBrightness();
        updateFocusToggleButton();
        updateAmbientTriggerStates();
    }

    function closeAmbientMenus() {
        ['soundEffectsMenu', 'lightingEffectsMenu'].forEach((id) => {
            const menu = document.getElementById(id);
            if (!menu) return;
            menu.classList.add('hidden');
            menu.setAttribute('aria-hidden', 'true');
            menu.setAttribute('inert', '');
            menu.style.display = '';
            menu.style.visibility = '';
            menu.style.pointerEvents = '';
        });

        $('#soundEffectsBtn')?.setAttribute('aria-expanded', 'false');
        $('#lightingEffectsBtn')?.setAttribute('aria-expanded', 'false');
        updateAmbientTriggerStates();
    }

    function clamp01(value, fallback = 0.7) {
        const number = Number(value);
        if (!Number.isFinite(number)) return fallback;
        return Math.max(0, Math.min(1, number));
    }

    function getSoundTile(soundId) {
        return document.querySelector(`[data-sound="${soundId}"]`);
    }

    function getSoundVolumeFromControl(soundId) {
        const slider = document.querySelector(`[data-sound-volume="${soundId}"]`);
        return clamp01((Number(slider?.value) || 0) / 100, 0.7);
    }

    function getEffectiveSoundVolume(entry) {
        if (!entry) return 0;
        const globalVolume = getSiteVolume();
        const localVolume = clamp01(entry.volume, 0.7);
        return globalVolume > 0 && state.ambient.effectsEnabled ? globalVolume * localVolume : 0;
    }

    function updateSoundVolumeUi(soundId, volume) {
        const tile = getSoundTile(soundId);
        if (!tile) return;
        const percent = Math.round(clamp01(volume, 0.7) * 100);
        const slider = tile.querySelector('[data-sound-volume]');
        const value = tile.querySelector('.sound-mix-volume-value');
        if (slider && document.activeElement !== slider) slider.value = String(percent);
        if (value) value.textContent = `${percent}%`;
    }

    function updateActiveSoundVolumes() {
        state.ambient.activeSounds.forEach((entry, soundId) => {
            if (!entry?.audio) return;
            entry.audio.volume = getEffectiveSoundVolume(entry);
            updateSoundVolumeUi(soundId, entry.volume);
        });
    }

    function handleSoundVolumeInput(event) {
        const slider = event.target.closest('[data-sound-volume]');
        if (!slider) return;

        event.stopPropagation();

        const soundId = slider.dataset.soundVolume;
        const entry = state.ambient.activeSounds.get(soundId);
        const volume = clamp01((Number(slider.value) || 0) / 100, 0.7);

        updateSoundVolumeUi(soundId, volume);

        if (entry?.audio) {
            entry.volume = volume;
            entry.audio.volume = getEffectiveSoundVolume(entry);
        }
    }

    function updateAmbientTriggerStates() {
        const soundActive = state.ambient.activeSounds.size > 0;
        const lightActive = !!state.ambient.activeLighting || document.body.classList.contains('candle-lit') || document.body.classList.contains('candle-brightness-active');

        $('#soundEffectsBtn')?.classList.toggle('has-active-effect', soundActive);
        $('#soundEffectsBtn')?.setAttribute('aria-pressed', String(soundActive));

        $('#lightingEffectsBtn')?.classList.toggle('has-active-effect', lightActive);
        $('#lightingEffectsBtn')?.setAttribute('aria-pressed', String(lightActive));
    }

    function toggleFocusEffectsMaster() {
        state.ambient.effectsEnabled = !state.ambient.effectsEnabled;
        const enabled = state.ambient.effectsEnabled;
        document.body.classList.toggle('effects-off', !enabled);
        $('#focusEffectsMasterBtn')?.setAttribute('aria-pressed', String(enabled));
        setText('#focusEffectsMasterBtn', enabled ? 'Effects' : 'Effects off');
        setAmbientMasterAudible();
        syncFocusAudio({ allowYouTubeResume: false });
    }

    function handleSoundMenuKeydown(event) {
        if (event.target.closest('[data-sound-volume]')) return;
        const tile = event.target.closest('[data-sound]');
        if (!tile) return;

        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            tile.click();
        }
    }

    async function handleSoundMenuClick(event) {
        if (event.target.closest('[data-sound-volume]') || event.target.closest('.sound-mix-slider-wrap')) {
            event.stopPropagation();
            return;
        }

        const tile = event.target.closest('[data-sound]');
        if (!tile) return;

        event.preventDefault();
        event.stopPropagation();

        const soundId = tile.dataset.sound;
        const isActive = state.ambient.activeSounds.has(soundId);

        if (isActive) {
            stopAmbientSound(soundId);
            tile.setAttribute('aria-pressed', 'false');
            updateAmbientTriggerStates();
            return;
        }

        // New mixer behavior: do not stop other active sounds.
        // Users can layer any combination and tune each volume individually.
        tile.setAttribute('aria-pressed', 'true');
        const started = await startAmbientSound(soundId, {
            volume: getSoundVolumeFromControl(soundId)
        });

        if (!started) {
            tile.setAttribute('aria-pressed', 'false');
        } else {
            syncFocusAudio({ allowYouTubeResume: false });
        }
        updateAmbientTriggerStates();
    }

    function handleLightingMenuClick(event) {
        const button = event.target.closest('[data-lighting]');
        if (!button) return;

        event.preventDefault();
        event.stopPropagation();

        const lighting = button.dataset.lighting;
        const activeClass = `light-${lighting}`;
        const isAlreadyActive = state.ambient.activeLighting === activeClass;

        // One lower lighting effect at a time. Candle stays independent and
        // can remain layered with the selected lighting effect.
        clearLightingEffect();

        if (!isAlreadyActive) {
            document.body.classList.add(activeClass);
            state.ambient.activeLighting = activeClass;
            button.setAttribute('aria-pressed', 'true');
        }
        updateAmbientTriggerStates();
    }

    function applyDefaultLightingEffect() {
        const defaultLighting = 'summer-daylight';
        const activeClass = `light-${defaultLighting}`;
        clearLightingEffect();
        document.body.classList.add(activeClass);
        state.ambient.activeLighting = activeClass;
        $(`[data-lighting="${defaultLighting}"]`)?.setAttribute('aria-pressed', 'true');
    }

    function clearLightingEffect() {
        LIGHTING_CLASSES.forEach((className) => document.body.classList.remove(className));
        state.ambient.activeLighting = null;
        $$('[data-lighting]').forEach((button) => button.setAttribute('aria-pressed', 'false'));
        updateAmbientTriggerStates();
    }


    function repairAmbientMasterForSharedContext() {
        if (!state.ambient.ctx) return;
        if (!state.ambient.master || state.ambient.master.context !== state.ambient.ctx) {
            state.ambient.master = state.ambient.ctx.createGain();
            state.ambient.master.gain.value = state.ambient.effectsEnabled ? 0.92 * getSiteVolume() : 0;
            state.ambient.master.connect(state.ambient.ctx.destination);
        }
    }

    async function ensureAudioContext() {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
            toast('This browser does not support generated ambient audio.', 'error');
            return null;
        }

        if (!state.ambient.ctx) {
            state.ambient.ctx = new AudioContextClass();
        }

        // UI sounds like the paper flip can create state.ambient.ctx before
        // ambient sound effects are started. In that case the context exists,
        // but the ambient master gain does not. Create/repair it here every time.
        if (!state.ambient.master || state.ambient.master.context !== state.ambient.ctx) {
            state.ambient.master = state.ambient.ctx.createGain();
            state.ambient.master.gain.value = state.ambient.effectsEnabled ? 0.92 * getSiteVolume() : 0;
            state.ambient.master.connect(state.ambient.ctx.destination);
        }

        if (state.ambient.ctx.state === 'suspended') {
            try {
                await state.ambient.ctx.resume();
            } catch (error) {
                console.warn('Audio resume blocked:', error);
                toast('Tap once more to start sound in this browser.', 'error');
                return null;
            }
        }

        return state.ambient.ctx;
    }

    function createNoiseSource(ctx, seconds = 2) {
        const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * seconds));
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i += 1) {
            data[i] = Math.random() * 2 - 1;
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        return source;
    }

    function connectNoiseVoice(ctx, destination, { gain = 0.08, type = 'lowpass', frequency = 900, q = 0.5, seconds = 2 }) {
        const source = createNoiseSource(ctx, seconds);
        const filter = ctx.createBiquadFilter();
        const gainNode = ctx.createGain();
        filter.type = type;
        filter.frequency.value = frequency;
        filter.Q.value = q;
        gainNode.gain.value = gain;
        source.connect(filter).connect(gainNode).connect(destination);
        source.start();
        return [source, filter, gainNode];
    }

    function connectToneVoice(ctx, destination, { gain = 0.03, frequency = 220, type = 'sine' }) {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.type = type;
        oscillator.frequency.value = frequency;
        gainNode.gain.value = gain;
        oscillator.connect(gainNode).connect(destination);
        oscillator.start();
        return [oscillator, gainNode];
    }

    async function startAmbientSound(soundId, options = {}) {
        if (state.ambient.activeSounds.has(soundId)) return true;

        const source = AUDIO_SOURCES[soundId];
        if (!source) {
            toast('Sound file is missing for this option.', 'error');
            return false;
        }

        quietYouTubePlayer();

        const volume = clamp01(options.volume ?? getSoundVolumeFromControl(soundId), 0.7);
        updateSoundVolumeUi(soundId, volume);

        const audio = new Audio(source);
        audio.loop = true;
        audio.preload = 'auto';
        audio.volume = 0;

        const entry = {
            audio,
            fadeFrame: null,
            volume
        };

        state.ambient.activeSounds.set(soundId, entry);

        try {
            await audio.play();
        } catch (error) {
            console.warn('Audio playback blocked:', error);
            state.ambient.activeSounds.delete(soundId);
            toast('Tap once more to start sound in this browser.', 'error');
            return false;
        }

        const fadeTo = getEffectiveSoundVolume(entry);
        const startedAt = performance.now();
        const duration = 220;

        const fadeIn = (now) => {
            const progress = Math.min(1, (now - startedAt) / duration);
            audio.volume = fadeTo * progress;
            if (progress < 1 && state.ambient.activeSounds.get(soundId) === entry) {
                entry.fadeFrame = requestAnimationFrame(fadeIn);
            }
        };

        entry.fadeFrame = requestAnimationFrame(fadeIn);
        setAmbientMasterAudible();
        return true;
    }

    function stopAmbientSound(soundId) {
        const entry = state.ambient.activeSounds.get(soundId);
        if (!entry) return;

        const audio = entry.audio;
        if (entry.fadeFrame) cancelAnimationFrame(entry.fadeFrame);

        if (audio) {
            const startVolume = audio.volume || 0;
            const startedAt = performance.now();
            const duration = 180;

            const fadeOut = (now) => {
                const progress = Math.min(1, (now - startedAt) / duration);
                audio.volume = Math.max(0, startVolume * (1 - progress));

                if (progress < 1) {
                    entry.fadeFrame = requestAnimationFrame(fadeOut);
                    return;
                }

                try {
                    audio.pause();
                    audio.currentTime = 0;
                    audio.src = '';
                    audio.load?.();
                } catch {
                    // Already stopped.
                }
            };

            entry.fadeFrame = requestAnimationFrame(fadeOut);
        }

        state.ambient.activeSounds.delete(soundId);
        getSoundTile(soundId)?.setAttribute('aria-pressed', 'false');

        if (state.ambient.activeSounds.size === 0) {
            syncFocusAudio({ allowYouTubeResume: false });
        }
        updateAmbientTriggerStates();
    }

    function stopAllAmbientSounds() {
        Array.from(state.ambient.activeSounds.keys()).forEach(stopAmbientSound);
        syncFocusAudio({ allowYouTubeResume: false });
        updateAmbientTriggerStates();
    }


    function wireLogoBackToTop() {
        const logo = document.getElementById('navLogo');
        if (!logo || logo.dataset.scrollTopReady === 'true') return;
        logo.dataset.scrollTopReady = 'true';
        logo.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (typeof window.scrollToTop === 'function') {
                window.scrollToTop();
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }

    function wireRibbonPullMenu() {
        if (!enableRibbonMenu) return;
        const button = $('#bookmarkMenuBtn');
        if (!button) return;

        let startY = 0;
        let startX = 0;
        let isDragging = false;
        let handledAsDrag = false;

        const resetRibbonDrag = () => {
            button.style.removeProperty('--pull-distance');
            button.classList.remove('is-dragging');
            isDragging = false;
            window.setTimeout(() => { handledAsDrag = false; }, 120);
        };

        button.addEventListener('click', (event) => {
            event.stopPropagation();
            if (handledAsDrag) return;
            setRibbonPanelOpen(!isRibbonPanelOpen(), { pulled: true });
        });

        button.addEventListener('pointerdown', (event) => {
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            startY = event.clientY;
            startX = event.clientX;
            isDragging = true;
            handledAsDrag = false;
            button.classList.add('is-dragging');
            button.setPointerCapture?.(event.pointerId);
        });

        button.addEventListener('pointermove', (event) => {
            if (!isDragging) return;
            const deltaY = Math.max(-10, Math.min(74, event.clientY - startY));
            const deltaX = Math.abs(event.clientX - startX);
            if (Math.abs(deltaY) > 4 || deltaX > 8) {
                handledAsDrag = true;
                event.preventDefault();
                button.style.setProperty('--pull-distance', `${Math.max(0, deltaY)}px`);
            }
        });

        button.addEventListener('pointerup', (event) => {
            if (!isDragging) return;
            const deltaY = event.clientY - startY;
            const deltaX = Math.abs(event.clientX - startX);
            if (deltaY > 24 && deltaX < 90) {
                handledAsDrag = true;
                setRibbonPanelOpen(true, { pulled: true });
            } else if (deltaY < -16) {
                handledAsDrag = true;
                setRibbonPanelOpen(false);
            }
            resetRibbonDrag();
        });

        button.addEventListener('pointercancel', resetRibbonDrag);
    }


    function syncStoryRibbonLength() {
        const panel = $('#nookRibbonPanel');
        const button = $('#bookmarkMenuBtn');
        const shell = button?.closest('.bookmark-menu-shell');
        if (!panel || !shell) return;

        const styles = window.getComputedStyle(shell);
        const tipTop = parseFloat(styles.getPropertyValue('--story-ribbon-tip-top')) || 124;

        // The panel is shown before measuring. The ribbon body extends to the
        // panel bottom; the pointed tip is the only part that hangs below it.
        const panelBottom = panel.offsetTop + panel.offsetHeight;
        const openDistance = Math.max(88, Math.round(panelBottom - tipTop));

        shell.style.setProperty('--story-ribbon-open', `${openDistance}px`);
    }

    function isRibbonPanelOpen() {
        return $('#bookmarkMenuBtn')?.getAttribute('aria-expanded') === 'true';
    }

    function setRibbonPanelOpen(open, options = {}) {
        const panel = $('#nookRibbonPanel');
        const button = $('#bookmarkMenuBtn');
        const shell = button?.closest('.bookmark-menu-shell');
        if (!panel || !button) return;
        if (open && !enableRibbonMenu && !options.allowDormantMenu) return;

        const wasOpen = button.getAttribute('aria-expanded') === 'true';

        if (open) {
            panel.classList.remove('hidden');
            syncStoryRibbonLength();
            panel.classList.remove('is-closing');
            panel.classList.add('is-open');
            button.setAttribute('aria-expanded', 'true');
            shell?.classList.add('is-open');

            if (!wasOpen && enableMenuSound) {
                playMenuPageSound();
            }

            if (options.pulled) {
                button.classList.remove('pulled-once');
                void button.offsetWidth;
                button.classList.add('pulled-once');
            }
        } else {
            if (panel.classList.contains('hidden')) {
                button.setAttribute('aria-expanded', 'false');
                shell?.classList.remove('is-open');
                return;
            }
            panel.classList.remove('is-open');
            panel.classList.add('is-closing');
            button.setAttribute('aria-expanded', 'false');
            shell?.classList.remove('is-open');
            window.setTimeout(() => {
                if (button.getAttribute('aria-expanded') === 'false') {
                    panel.classList.add('hidden');
                    panel.classList.remove('is-closing');
                }
            }, 760);
        }
    }

    function playMenuPageSound() {
        try {
            const volume = getSiteVolume();
            if (volume <= 0) return;

            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;

            const ctx = state.ambient.ctx || new AudioContext();
            state.ambient.ctx = ctx;
            repairAmbientMasterForSharedContext();
            if (ctx.state === 'suspended') ctx.resume();

            const duration = 0.16;
            const now = ctx.currentTime;
            const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);

            for (let i = 0; i < bufferSize; i += 1) {
                const t = i / bufferSize;
                const softFade = Math.sin(Math.PI * t);
                data[i] = (Math.random() * 2 - 1) * softFade * (1 - t * 0.45);
            }

            const noise = ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(850, now);
            filter.frequency.exponentialRampToValueAtTime(1450, now + duration);
            filter.Q.setValueAtTime(0.72, now);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.linearRampToValueAtTime(0.032 * volume, now + 0.025);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            noise.start(now);
            noise.stop(now + duration + 0.02);
        } catch (error) {
            console.warn('Menu page sound skipped:', error);
        }
    }


    function updateWritingMoodState() {
        const input = $('#mainStoryInput');
        const hasContent = !!input?.value?.trim();
        document.body.classList.toggle('writing-has-content', hasContent);
        input?.classList.toggle('has-writing', hasContent);
    }

    function restoreTypingSoundToggle() {
        const enabled = localStorage.getItem(typingSoundKey) === 'on';
        const button = $('#typingSoundToggleBtn');
        button?.setAttribute('aria-pressed', String(enabled));
        button?.classList.toggle('active', enabled);
        if (button) button.title = enabled ? 'Typing sound on' : 'Typing sound off';
    }

    function toggleTypingSound(event) {
        event?.preventDefault();
        const enabled = localStorage.getItem(typingSoundKey) === 'on';
        localStorage.setItem(typingSoundKey, enabled ? 'off' : 'on');
        restoreTypingSoundToggle();
        if (localStorage.getItem(typingSoundKey) === 'on') playTypingClickSound(0.8);
        $('#mainStoryInput')?.focus({ preventScroll: true });
    }

    function playTypingKeySound(event) {
        if (localStorage.getItem(typingSoundKey) !== 'on') return;
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        const allowed = event.key.length === 1 || ['Backspace', 'Enter', 'Space', 'Delete'].includes(event.key);
        if (!allowed) return;
        const now = performance.now();
        if (playTypingKeySound.lastAt && now - playTypingKeySound.lastAt < 38) return;
        playTypingKeySound.lastAt = now;
        playTypingClickSound(event.key === 'Backspace' || event.key === 'Delete' ? 0.72 : 1);
    }

    function playTypingInputSound() {
        if (localStorage.getItem(typingSoundKey) !== 'on') return;
        const now = performance.now();

        // Mobile keyboards do not always fire keydown reliably. This input fallback
        // keeps the typing toggle audible on phones without double-playing on desktop.
        if (playTypingKeySound.lastAt && now - playTypingKeySound.lastAt < 95) return;
        if (playTypingInputSound.lastAt && now - playTypingInputSound.lastAt < 62) return;

        playTypingInputSound.lastAt = now;
        playTypingClickSound(0.9);
    }

    function playTypingClickSound(intensity = 1) {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;

            const ctx = state.ambient.ctx || new AudioContext();
            state.ambient.ctx = ctx;
            repairAmbientMasterForSharedContext();
            if (ctx.state === 'suspended') {
                ctx.resume().catch(() => {});
            }

            // Keep this independent enough from the ambient mixer that the keyboard
            // toggle is actually audible, while still staying soft and cozy.
            const siteVolume = Number.isFinite(getSiteVolume()) ? getSiteVolume() : 0.5;
            const volume = Math.max(0.16, siteVolume) * 0.42 * intensity;
            if (volume <= 0) return;

            const now = ctx.currentTime;
            const master = ctx.createGain();
            master.gain.setValueAtTime(0.0001, now);
            master.gain.linearRampToValueAtTime(0.11 * volume, now + 0.006);
            master.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
            master.connect(ctx.destination);

            const osc = ctx.createOscillator();
            const oscFilter = ctx.createBiquadFilter();
            const oscGain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(210 + Math.random() * 65, now);
            oscFilter.type = 'lowpass';
            oscFilter.frequency.setValueAtTime(1450, now);
            oscFilter.Q.setValueAtTime(0.55, now);
            oscGain.gain.setValueAtTime(0.0001, now);
            oscGain.gain.linearRampToValueAtTime(0.42, now + 0.005);
            oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
            osc.connect(oscFilter).connect(oscGain).connect(master);
            osc.start(now);
            osc.stop(now + 0.06);

            // A tiny paper/key texture makes it easier to hear than the old pure tone.
            const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * 0.045));
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i += 1) {
                data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
            }
            const noise = ctx.createBufferSource();
            const noiseFilter = ctx.createBiquadFilter();
            const noiseGain = ctx.createGain();
            noise.buffer = buffer;
            noiseFilter.type = 'bandpass';
            noiseFilter.frequency.setValueAtTime(1800 + Math.random() * 340, now);
            noiseFilter.Q.setValueAtTime(0.9, now);
            noiseGain.gain.setValueAtTime(0.0001, now);
            noiseGain.gain.linearRampToValueAtTime(0.32, now + 0.004);
            noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.038);
            noise.connect(noiseFilter).connect(noiseGain).connect(master);
            noise.start(now);
            noise.stop(now + 0.05);
        } catch (error) {
            console.warn('Typing sound skipped:', error);
        }
    }

    function showPublishMoment() {
        const modal = $('#publishMomentModal');
        if (!modal) return;
        openModal('publishMomentModal');
        window.clearTimeout(showPublishMoment.timer);
        showPublishMoment.timer = window.setTimeout(() => closeModal('publishMomentModal'), 2350);
    }

    function playPublishSound() {
        try {
            const volume = getSiteVolume();
            if (volume <= 0) return;

            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;

            const ctx = state.ambient.ctx || new AudioContext();
            state.ambient.ctx = ctx;
            repairAmbientMasterForSharedContext();
            if (ctx.state === 'suspended') ctx.resume();

            const now = ctx.currentTime;
            const master = ctx.createGain();
            master.gain.setValueAtTime(0.0001, now);
            master.gain.linearRampToValueAtTime(0.09 * volume, now + 0.018);
            master.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);
            master.connect(ctx.destination);

            const notes = [
                { frequency: 523.25, start: 0.00, duration: 0.18 },
                { frequency: 659.25, start: 0.075, duration: 0.20 },
                { frequency: 880.00, start: 0.15, duration: 0.26 }
            ];

            notes.forEach(({ frequency, start, duration }) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(frequency, now + start);
                gain.gain.setValueAtTime(0.0001, now + start);
                gain.gain.linearRampToValueAtTime(0.28, now + start + 0.018);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);

                osc.connect(gain).connect(master);
                osc.start(now + start);
                osc.stop(now + start + duration + 0.03);
            });
        } catch (error) {
            console.warn('Publish sound skipped:', error);
        }
    }

    function playOwlWingSound() {
        try {
            const volume = getSiteVolume();
            if (volume <= 0) return;

            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;

            const ctx = state.ambient.ctx || new AudioContext();
            state.ambient.ctx = ctx;
            repairAmbientMasterForSharedContext();
            if (ctx.state === 'suspended') ctx.resume();

            const now = ctx.currentTime;
            const master = ctx.createGain();
            master.gain.setValueAtTime(0.0001, now);
            master.gain.linearRampToValueAtTime(0.07 * volume, now + 0.025);
            master.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);
            master.connect(ctx.destination);

            const makeWing = (offset, panValue = 0) => {
                const duration = 0.22;
                const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
                const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                const data = buffer.getChannelData(0);

                for (let i = 0; i < bufferSize; i += 1) {
                    const t = i / bufferSize;
                    const envelope = Math.sin(Math.PI * t) * (1 - t * 0.18);
                    data[i] = (Math.random() * 2 - 1) * envelope;
                }

                const source = ctx.createBufferSource();
                source.buffer = buffer;

                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(520, now + offset);
                filter.frequency.exponentialRampToValueAtTime(950, now + offset + duration);
                filter.Q.setValueAtTime(0.62, now + offset);

                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.0001, now + offset);
                gain.gain.linearRampToValueAtTime(0.72, now + offset + 0.035);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + duration);

                const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
                if (pan) {
                    pan.pan.setValueAtTime(panValue, now + offset);
                    source.connect(filter).connect(gain).connect(pan).connect(master);
                } else {
                    source.connect(filter).connect(gain).connect(master);
                }

                source.start(now + offset);
                source.stop(now + offset + duration + 0.03);
            };

            makeWing(0.00, -0.22);
            makeWing(0.16, 0.20);

            const hoot = ctx.createOscillator();
            const hootGain = ctx.createGain();
            hoot.type = 'sine';
            hoot.frequency.setValueAtTime(310, now + 0.08);
            hoot.frequency.exponentialRampToValueAtTime(235, now + 0.44);
            hootGain.gain.setValueAtTime(0.0001, now + 0.08);
            hootGain.gain.linearRampToValueAtTime(0.18, now + 0.15);
            hootGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);
            hoot.connect(hootGain).connect(master);
            hoot.start(now + 0.08);
            hoot.stop(now + 0.52);
        } catch (error) {
            console.warn('Owl sound skipped:', error);
        }
    }

    function toggleRibbonPanel(event) {
        event?.stopPropagation();
        setRibbonPanelOpen(!isRibbonPanelOpen(), { pulled: true });
    }

    function closeRibbonPanel() {
        setRibbonPanelOpen(false);
    }

    function wireArchiveMenu() {
        const button = $('#bookmarkMenuBtn');
        if (!button) return;

        button.addEventListener('click', (event) => {
            event.stopPropagation();
            setRibbonPanelOpen(!isRibbonPanelOpen(), { allowDormantMenu: true });
        });
    }

    function handleMessagesButtonClick() {
        toast('Notifications are opening soon.');
    }

    function handleMonthlyTopButtonClick() {
        toast('Top stories of the month are opening soon.');
    }

    function handleMailButtonClick() {
        const button = $('#navMailBtn');
        button?.classList.remove('has-unread');
        button?.classList.add('is-seen');
        try {
            window.localStorage.setItem('story-nook:messages-seen:v1', 'true');
        } catch (error) {
            console.warn('Could not save mail seen state', error);
        }
        toast('Messages are opening soon.');
    }

    function restoreMessagesButtonState() {
        const button = $('#navMailBtn');
        if (!button) return;
        try {
            if (window.localStorage.getItem('story-nook:messages-seen:v1') === 'true') {
                button.classList.remove('has-unread');
                button.classList.add('is-seen');
            }
        } catch (error) {
            console.warn('Could not restore mail seen state', error);
        }
    }

    function openProfileAvatarPicker() {
        if (!state.currentUser) return openAuth('login');
        if (!$('#profileModal')?.classList.contains('admin-view')) openAvatarPicker();
    }


    function handleRibbonPanelClick(event) {
        const archiveButton = event.target.closest('[data-archive-action]');
        if (archiveButton) {
            event.stopPropagation();
            closeRibbonPanel();
            openArchiveModal(archiveButton.dataset.archiveAction || 'open');
            return;
        }

        const pollButton = event.target.closest('[data-poll-link]');
        if (pollButton) {
            event.stopPropagation();
            closeRibbonPanel();

            if (!state.currentUser) {
                openAuth('login');
                return;
            }

            window.open(pollButton.dataset.pollLink || 'https://strawpoll.com', '_blank', 'noopener,noreferrer');
            return;
        }

        const journeyButton = event.target.closest('[data-journey-action]');
        if (journeyButton) {
            event.stopPropagation();
            closeRibbonPanel();

            if (!state.currentUser) {
                openAuth('login');
                return;
            }

            openModal('profileModal');
            resetProfileModalToMyView();

            const action = journeyButton.dataset.journeyAction;
            window.setTimeout(() => {
                const profileModal = $('#profileModal .modal-content');
                if (!profileModal) return;

                const targetMap = {
                    collection: '#flairGrid',
                    milestones: '.passport-section',
                    flair: '#flairGrid',
                    stories: '#myStoriesList'
                };
                const target = $(targetMap[action] || '.passport-section', profileModal);
                target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 260);
            return;
        }

        const button = event.target.closest('[data-scroll-target]');
        if (!button) return;
        const target = document.getElementById(button.dataset.scrollTarget);
        closeRibbonPanel();
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function toggleMenu(button) {
        const dropdown = button.closest('.action-column')?.querySelector('.menu-dropdown');
        if (!dropdown) return;
        const shouldOpen = !dropdown.classList.contains('show');
        closeAllMenus();
        dropdown.classList.toggle('show', shouldOpen);
    }

    function closeAllMenus() {
        $$('.menu-dropdown.show').forEach((menu) => menu.classList.remove('show'));
    }

    function getCachedStory(storyId) {
        return [...state.feedStories, ...state.topStories].find((story) => Number(story.id) === Number(storyId));
    }

    function getAuthorName(story) {
        return story?.guest_name || story?.profiles?.username || 'Anonymous';
    }

    function getAvatarHTML(story, authorName) {
        const avatar = resolveAvatarUrl(story?.profiles?.avatar_url, story?.profiles?.id || story?.user_id || authorName);
        if (avatar) return `<img src="${escapeAttr(avatar)}" class="feed-avatar-img" alt="${escapeAttr(authorName)} avatar"${avatarStyleAttr(story?.profiles)}>`;
        return `<div class="feed-avatar-placeholder" aria-hidden="true">${escapeHtml(authorName.charAt(0).toUpperCase() || 'A')}</div>`;
    }

    function getCommentCount(story) {
        const raw = story?.comments;
        if (Array.isArray(raw) && raw[0] && typeof raw[0].count !== 'undefined') return Number(raw[0].count || 0);
        if (typeof raw === 'number') return raw;
        return 0;
    }

    async function openArchiveModal(mode = 'open') {
        if (!state.db) return toast('The archive needs Supabase to be connected.', 'error');
        const list = $('#archiveStoriesList');
        const stats = $('#archiveStats');
        if (list) list.innerHTML = '<div class="loading-state">Opening the archive...</div>';
        if (stats) stats.innerHTML = '';
        openModal('archiveModal');

        const { data: stories, error } = await state.db
            .from('stories')
            .select('*, profiles!stories_user_id_fkey(id, username, avatar_url, avatar_position_x, avatar_position_y), comments(count)')
            .is('deleted_at', null)
            .order('votes', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(60);

        if (error) {
            if (list) list.innerHTML = '<div class="empty-state">The archive could not be opened yet.</div>';
            return;
        }

        state.archiveStories = stories || [];
        renderArchive(mode);
    }

    function renderArchive(mode = 'open') {
        const list = $('#archiveStoriesList');
        const stats = $('#archiveStats');
        if (!list) return;

        const stories = state.archiveStories || [];
        const favorite = stories[0];
        const podium = stories.slice(0, 3);

        if (stats) {
            stats.innerHTML = `
                <div class="archive-stat">
                    <span>${stories.length}</span>
                    <small>ranked stories</small>
                </div>
                <div class="archive-stat">
                    <span>${favorite ? favorite.votes || 0 : 0}</span>
                    <small>top hearts</small>
                </div>
                <div class="archive-stat">
                    <span>${podium.length}</span>
                    <small>podium slots</small>
                </div>`;
        }

        if (!stories.length) {
            list.innerHTML = '<div class="empty-state">No stories have reached the archive yet.</div>';
            return;
        }

        const visibleStories = mode === 'favorite' && favorite ? [favorite] : stories;
        const intro = mode === 'podium'
            ? '<div class="archive-podium-note">Weekly podium history will live here once the backend starts saving each week&apos;s top three. For now, this shows the current all-time podium.</div>'
            : '';

        list.innerHTML = `
            ${intro}
            ${visibleStories.map((story, index) => archiveStoryHTML(story, index)).join('')}`;
    }

    function archiveStoryHTML(story, index) {
        const author = getAuthorName(story);
        const comments = getCommentCount(story);
        const rankLabel = index === 0 ? 'All-time favorite' : `Rank ${index + 1}`;
        const preview = truncateText(story.content || 'Untitled story', 190);
        return `
            <button class="archive-story-card" type="button" data-archive-story-id="${story.id}">
                <span class="archive-rank">${escapeHtml(rankLabel)}</span>
                <span class="archive-author">@${escapeHtml(author)}</span>
                <span class="archive-preview">${escapeHtml(preview)}</span>
                <span class="archive-meta">${story.votes || 0} likes · ${comments} comments</span>
            </button>`;
    }

    function handleArchiveStoryClick(event) {
        const card = event.target.closest('[data-archive-story-id]');
        if (!card) return;
        const storyId = Number(card.dataset.archiveStoryId);
        closeModal('archiveModal');
        openReadModal(storyId);
    }

    function canEditStory(story) {
        return !!(state.isAdmin || (state.currentUser && story?.user_id === state.currentUser.id));
    }

    function canEditComment(comment) {
        return !!(state.isAdmin || (state.currentUser && comment?.user_id === state.currentUser.id));
    }

    function formatDate(value) {
        if (!value) return '';
        try {
            return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
        } catch {
            return '';
        }
    }

    function truncate(text, length) {
        const clean = String(text || '').trim();
        return clean.length > length ? `${clean.slice(0, length).trim()}…` : clean;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function escapeAttr(value) {
        return escapeHtml(value).replace(/`/g, '&#096;');
    }

    function truncateText(value, limit = 160) {
        const text = String(value ?? '').replace(/\s+/g, ' ').trim();
        if (text.length <= limit) return text;
        return `${text.slice(0, Math.max(0, limit - 1)).trim()}...`;
    }

    function setText(selector, value) {
        const element = $(selector);
        if (element) element.textContent = value;
    }

    function setButtonLoading(selector, isLoading, loadingLabel = 'Working...') {
        const button = $(selector);
        if (!button) return;
        if (isLoading) {
            button.dataset.originalText = button.textContent;
            button.textContent = loadingLabel;
            button.disabled = true;
        } else {
            button.textContent = button.dataset.originalText || button.textContent;
            button.disabled = false;
            delete button.dataset.originalText;
        }
    }

    function toast(message, type = 'success', timeout = 4200) {
        const region = $('#toastRegion');
        if (!region) return;
        const note = document.createElement('div');
        note.className = `toast ${type === 'error' ? 'error' : ''}`;
        note.textContent = message;
        region.appendChild(note);
        window.setTimeout(() => {
            note.style.opacity = '0';
            note.style.transform = 'translateY(8px)';
            window.setTimeout(() => note.remove(), 180);
        }, timeout);
    }

    function debounce(fn, wait = 200) {
        let timer;
        return (...args) => {
            window.clearTimeout(timer);
            timer = window.setTimeout(() => fn(...args), wait);
        };
    }

    function capitalize(value) {
        return String(value || '').charAt(0).toUpperCase() + String(value || '').slice(1);
    }

    window.closeModal = closeModal;
    window.openFeedback = openFeedback;
    window.scrollToTop = scrollToTop;
    window.enterNook = enterNook;
    window.resetProfileModalToMyView = resetProfileModalToMyView;
    window.switchAdminTab = switchAdminTab;
    window.adminAwardBadge = adminAwardBadge;
    window.adminRevokeBadge = adminRevokeBadge;
})();
