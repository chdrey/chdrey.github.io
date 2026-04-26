(() => {
    'use strict';

    const CONFIG = {
        adminEmail: 'chdrey@gmail.com',
        adminUsername: 'PenPaleto',
        supabaseUrl: 'https://lypndarukqjtkyhxygwe.supabase.co',
        supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5cG5kYXJ1a3FqdGt5aHh5Z3dlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3Nzc2NzAsImV4cCI6MjA3OTM1MzY3MH0.NE5Q1BFVsBDyKSUxHO--aR-jbSHSLW8klha7C7_VbUA',
        youtubeSrc: 'https://www.youtube.com/embed/hVFaaUEIpzE?start=103&autoplay=1&mute=1&playsinline=1&controls=1&rel=0&enablejsapi=1&origin=' + encodeURIComponent(window.location.origin || window.location.href.split('/').slice(0,3).join('/')),
        draftKey: 'story-nook:draft:v2',
        guestNameKey: 'story-nook:guest-name:v2',
        prompts: [
            'A traveler finds a floating library where every unwritten story is waiting on a shelf.',
            'At midnight, the fireplace starts whispering memories that do not belong to anyone in the room.',
            'A tiny green door appears under an old desk, and only tired writers can see it.',
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
        initialized: false
    };

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

    document.addEventListener('DOMContentLoaded', boot);

    function boot() {
        document.body.classList.remove('focus-mode', 'candle-lit', 'quiet-room');
        wireStaticEvents();
        restoreDraft();
        updateCharCounter();
        setWeeklyPrompt(CONFIG.prompts[0]);
        loadYouTubePlayer();
        playBackgroundVideo();
        initializeSupabase();
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
        window.addEventListener('scroll', () => nav?.classList.toggle('scrolled', window.scrollY > 40), { passive: true });

        $('#navLogo')?.addEventListener('click', scrollToTop);
        $('#enterBtn')?.addEventListener('click', () => enterNook());
        $('#browseBtn')?.addEventListener('click', () => enterNook('storyFeed'));
        $('#navLoginBtn')?.addEventListener('click', () => openAuth('login'));
        $('#bookmarkMenuBtn')?.addEventListener('click', toggleRibbonPanel);
        $('#navProfileBtn')?.addEventListener('click', () => {
            openModal('profileModal');
            resetProfileModalToMyView();
        });
        $('#footerFeedbackBtn')?.addEventListener('click', openFeedback);
        $$('[data-open]').forEach((button) => button.addEventListener('click', () => openModal(button.dataset.open)));
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
        $('#deleteAccountBtn')?.addEventListener('click', deleteProfileData);

        $('#mainStoryInput')?.addEventListener('input', () => {
            updateCharCounter();
            saveDraft();
        });
        $('#mainStoryInput')?.addEventListener('focus', enterFocusMode);
        $('#mainStoryInput')?.addEventListener('click', enterFocusMode);
        $('#guestPenName')?.addEventListener('input', saveGuestName);
        $('#publishBtn')?.addEventListener('click', publishStory);
        $('#clearDraftBtn')?.addEventListener('click', clearDraft);
        $('#copyPromptBtn')?.addEventListener('click', copyPrompt);
        $('#candleBtn')?.addEventListener('click', toggleCandleMode);
        $('#exitFocusBtn')?.addEventListener('click', exitFocusMode);
        $('#saveStoryEditBtn')?.addEventListener('click', saveStoryEdit);
        $('#saveSiteSettingsBtn')?.addEventListener('click', saveSiteSettings);

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

        $('#profileAvatar')?.addEventListener('click', () => {
            if (!state.currentUser) return openAuth('login');
            if (!$('#profileModal')?.classList.contains('admin-view')) $('#avatarUploadInput')?.click();
        });
        $('#avatarUploadInput')?.addEventListener('change', uploadAvatar);
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
        const payload = { id: user.id, username };

        const { data, error } = await state.db
            .from('profiles')
            .insert(payload)
            .select('*, flairs(css_class)')
            .maybeSingle();

        if (error) {
            console.warn('Profile auto-create failed. Using temporary profile display.', error);
            return { id: user.id, username, avatar_url: null, selected_flair_id: null, flairs: null };
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

        if (state.currentUser && state.currentProfile) {
            loggedOut?.classList.add('hidden');
            loggedIn?.classList.remove('hidden');
            guestInput?.classList.add('hidden');
            commentGuestInput?.classList.add('hidden');
            setText('#navUsername', state.currentProfile.username || 'Writer');
            setText('#profileNameDisplay', state.currentProfile.username || 'Writer');
            updateAvatars(state.currentProfile);
        } else {
            loggedOut?.classList.remove('hidden');
            loggedIn?.classList.add('hidden');
            guestInput?.classList.remove('hidden');
            commentGuestInput?.classList.remove('hidden');
            updateAvatars(null);
        }

        adminButton?.classList.toggle('hidden', !state.isAdmin);
        $('#feedbackEmail')?.classList.toggle('hidden', !!state.currentUser);
    }

    function updateAvatars(profile) {
        const fallback = createAvatarDataUrl(profile?.username || 'Nook');
        const avatarUrl = profile?.avatar_url || fallback;
        const flairClass = profile?.flairs?.css_class || '';

        const navAvatar = $('#navAvatar');
        if (navAvatar) {
            navAvatar.src = avatarUrl;
            navAvatar.className = 'avatar-small';
            if (flairClass) navAvatar.classList.add(flairClass);
        }

        const profileAvatar = $('#profileAvatar');
        if (profileAvatar && !$('#profileModal')?.classList.contains('admin-view')) {
            profileAvatar.src = avatarUrl;
            profileAvatar.className = 'avatar-large profile-trigger-action';
        }
    }

    function createAvatarDataUrl(seed) {
        const letter = encodeURIComponent(String(seed || 'N').charAt(0).toUpperCase());
        const bg = '%239caf88';
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
            const storySelect = '*, profiles(username, avatar_url, selected_flair_id), comments(count)';

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
        textArea.value = '';
        localStorage.removeItem(CONFIG.draftKey);
        updateCharCounter();
        setText('#draftStatus', 'Published and draft cleared');
        toast('Story published. The shelf just got warmer.');
        await fetchStories({ resetLimit: true });
    }

    async function voteStory(storyId, currentVotes = 0) {
        if (!state.db) return toast('Voting needs Supabase to be connected.', 'error');
        if (!state.currentUser) {
            openAuth('login');
            return toast('Log in to vote on stories.', 'error');
        }
        const newVotes = (currentVotes || 0) + 1;
        const { error } = await state.db.from('stories').update({ votes: newVotes }).eq('id', storyId);
        if (error) return toast(`Could not vote: ${error.message}`, 'error');
        toast('Heart added.');
        if (state.activeStoryId === storyId && state.activeStory) state.activeStory.votes = newVotes;
        await fetchStories();
        if (state.activeStoryId === storyId) renderReadActions(state.activeStory);
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
            .select('*, profiles(username, avatar_url)')
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
            .select('*, profiles(username, avatar_url)')
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
        const avatar = comment.profiles?.avatar_url || createAvatarDataUrl(author);
        return `
            <div class="comment-item" data-comment-id="${comment.id}">
                <img src="${escapeAttr(avatar)}" class="feed-avatar-img" alt="">
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
        if (tabName === 'settings') populateSiteSettingsForm();
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
        setText('#profileNameDisplay', targetUser.username || 'Unnamed');
        $('#profileAvatar').src = targetUser.avatar_url || createAvatarDataUrl(targetUser.username);
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
        setText('#profileNameDisplay', state.currentProfile.username || 'Writer');
        $('#profileAvatar').src = state.currentProfile.avatar_url || createAvatarDataUrl(state.currentProfile.username);
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
            const { error: uploadError } = await state.db.storage.from('avatars').upload(fileName, file, { cacheControl: '3600', upsert: true });
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = state.db.storage.from('avatars').getPublicUrl(fileName);
            const { error: dbError } = await state.db.from('profiles').update({ avatar_url: publicUrl }).eq('id', state.currentUser.id);
            if (dbError) throw dbError;
            state.currentProfile = await getProfileById(state.currentUser.id);
            updateUI();
            toast('Avatar updated.');
        } catch (error) {
            console.error('Avatar upload failed:', error);
            toast('Upload failed. Make sure the avatars bucket exists and allows uploads.', 'error');
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

    function restoreDraft() {
        const draft = localStorage.getItem(CONFIG.draftKey);
        const guestName = localStorage.getItem(CONFIG.guestNameKey);
        if (draft && $('#mainStoryInput')) $('#mainStoryInput').value = draft;
        if (guestName && $('#guestPenName')) $('#guestPenName').value = guestName;
    }

    function saveDraft() {
        const value = $('#mainStoryInput')?.value || '';
        localStorage.setItem(CONFIG.draftKey, value);
        setText('#draftStatus', value ? 'Draft saved locally' : 'Draft is empty');
    }

    function saveGuestName() {
        localStorage.setItem(CONFIG.guestNameKey, $('#guestPenName')?.value || '');
    }

    function clearDraft() {
        if (!$('#mainStoryInput')?.value && !localStorage.getItem(CONFIG.draftKey)) return;
        if (!window.confirm('Clear your local draft?')) return;
        $('#mainStoryInput').value = '';
        localStorage.removeItem(CONFIG.draftKey);
        updateCharCounter();
        setText('#draftStatus', 'Draft cleared');
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
                return `${url}${joiner}autoplay=1&mute=1&playsinline=1&controls=1&rel=0&enablejsapi=1`;
            }
            const parsed = new URL(url);
            const id = parsed.searchParams.get('v') || parsed.pathname.split('/').filter(Boolean).pop();
            if (!id) return fallback;
            const start = parsed.searchParams.get('t') || parsed.searchParams.get('start') || '0';
            const seconds = String(start).replace('s', '');
            return `https://www.youtube.com/embed/${encodeURIComponent(id)}?start=${encodeURIComponent(seconds)}&autoplay=1&mute=1&playsinline=1&controls=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin || '')}`;
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

    function enterFocusMode() {
        if (!document.body.classList.contains('focus-mode')) {
            document.body.classList.add('focus-mode');
            $('#writingZoneSection')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function exitFocusMode() {
        document.body.classList.remove('focus-mode', 'candle-lit');
        $('#candleBtn')?.setAttribute('aria-pressed', 'false');
        setText('#candleBtn', '🕯️ Light candle');
    }

    function toggleCandleMode() {
        const lit = !document.body.classList.contains('candle-lit');
        document.body.classList.toggle('candle-lit', lit);
        $('#candleBtn')?.setAttribute('aria-pressed', String(lit));
        setText('#candleBtn', lit ? '🕯️ Put out candle' : '🕯️ Light candle');
    }

    function toggleRibbonPanel(event) {
        event?.stopPropagation();
        const panel = $('#nookRibbonPanel');
        const button = $('#bookmarkMenuBtn');
        if (!panel || !button) return;
        const isOpen = panel.classList.toggle('hidden') === false;
        button.setAttribute('aria-expanded', String(isOpen));
    }

    function closeRibbonPanel() {
        $('#nookRibbonPanel')?.classList.add('hidden');
        $('#bookmarkMenuBtn')?.setAttribute('aria-expanded', 'false');
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
        const avatar = story?.profiles?.avatar_url;
        if (avatar) return `<img src="${escapeAttr(avatar)}" class="feed-avatar-img" alt="${escapeAttr(authorName)} avatar">`;
        return `<div class="feed-avatar-placeholder" aria-hidden="true">${escapeHtml(authorName.charAt(0).toUpperCase() || 'A')}</div>`;
    }

    function getCommentCount(story) {
        const raw = story?.comments;
        if (Array.isArray(raw) && raw[0] && typeof raw[0].count !== 'undefined') return Number(raw[0].count || 0);
        if (typeof raw === 'number') return raw;
        return 0;
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
