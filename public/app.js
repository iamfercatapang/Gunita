// --- Filename generator (thin wrapper around window.PB.capture.makeFilename) ---
function makeFilename(ext = 'png') {
    return window.PB.capture.makeFilename(appConfig.eventName, ext);
}


$(document).ready(function() {

    // The admin dashboard and the welcome screen are React
    // (src/screens/admin, src/screens/welcome), reading the settings store
    // that window.appConfig is part of. What's left here is kiosk mode and
    // the capture screens; React reaches it through window.PB.kiosk below.

    // --- Disclaimer ---
    function _renderDisclaimerText(text, org) {
        return text.replace(/\{Name of Organization\}/g, org || 'the Organisation');
    }

    // Opens the disclaimer (a React dialog); resolves true if accepted.
    function showDisclaimerDialog(header, text, org) {
        return window.PB.ui.askDisclaimer({
            header: header,
            text: _renderDisclaimerText(text, org),
        });
    }

    // --- Launch Kiosk ---
    // Called by the admin dashboard's Launch button. Rejects with the camera
    // error if the camera can't be opened; the dashboard shows it.
    async function launchKiosk() {
        window.PB.devices.stopAllCameraTests(); // release any preview streams before launching
        window.PB.ui.preload(); // load the PIN pad and disclaimer before a guest needs them

        // Video Guestbook uses a lower resolution (1080p max) to prevent encoder
        // lag and stuttering; PhotoBooth uses the highest available for still quality.
        const isVgMode = appConfig.captureMode === 'videoguestbook';

        if (isVgMode) {
            // ── Video Guestbook: defer stream acquisition to per-session start ──
            // Camera and mic will be opened inside triggerVgSequence() only when
            // a guest actually begins recording, and released when they return to
            // the welcome screen.  This keeps the OS indicator light off while idle.
            $('#admin-dashboard').hide();
            $('#kiosk-mode').fadeIn(400);
            window.PB.security.requestFullscreen();
            window.PB.audio.setupSinkBeep(appConfig.vgSelectedSpeakerId);
            resetToWelcomeScreen();
        } else {
            // ── Photo Booth: acquire stream now for the live welcome viewfinder ──
            const videoConstraints = _pbPhotoConstraints();
            if (appConfig.selectedCameraId) {
                videoConstraints.deviceId = { exact: appConfig.selectedCameraId };
            }
            currentStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
            window.PB.capture.logTrackSize('[PB] Photo camera', currentStream);
            $('#camera-feed')[0].srcObject = currentStream;
            applyKioskViewfinderSize();

            $('#admin-dashboard').hide();
            $('#kiosk-mode').fadeIn(400);
            window.PB.security.requestFullscreen();
            window.PB.audio.setupSinkBeep(appConfig.vgSelectedSpeakerId);
            resetToWelcomeScreen();

            // Camera-lost watchdog for photo booth
            currentStream.getVideoTracks().forEach(function(track) {
                track.onended = function() {
                    console.warn('[PB] Camera track ended unexpectedly.');
                    stopVgRecordingIfActive();
                    _showCameraLost();
                };
            });
        }
    }

    // --- PIN modal logic ---
    // The PIN pad is a React dialog (src/screens/dialogs). verifyPin handles
    // both PBKDF2 and legacy SHA-256, and returns an upgraded hash on a legacy
    // match so we can transparently migrate the storage.
    async function _checkPin(pin) {
        const result = await window.PB.security.verifyPin(pin, appConfig.kioskPin);
        if (result.ok && result.upgradedHash) {
            appConfig.kioskPin = result.upgradedHash;
            saveConfig();
            console.info('[Security] PIN hash migrated from SHA-256 to PBKDF2');
        }
        return result.ok;
    }

    async function _showPinModal() {
        const unlocked = await window.PB.ui.askPin({
            length: appConfig.kioskPinLen,
            check: _checkPin,
        });
        if (unlocked) _doExitKiosk();
    }

    // (Fullscreen helpers live in window.PB.security.)

    function _doExitKiosk() {
        window.PB.ui.closeAll();
        stopVgRecordingIfActive();
        if (currentStream) { currentStream.getTracks().forEach(track => track.stop()); currentStream = null; }
        window.PB.audio.teardownSinkBeep();
        window.PB.security.exitFullscreen();
        $('#kiosk-mode').hide();
        $('#vg-booth').hide();
        $('#live-booth').hide();
        $('#admin-dashboard').fadeIn(400);
    }

    // The hidden Exit Kiosk button on the welcome screen.
    function requestExit() {
        if (appConfig.kioskPin && appConfig.kioskPinLen > 0) {
            _showPinModal();
        } else {
            _doExitKiosk();
        }
    }

    // --- Starting a session ---
    // A guest tapped "Leave a Message" (or anywhere on the welcome screen).
    let _starting = false;
    async function startSession() {
        if (_starting) return;
        _starting = true;
        try {
            if (appConfig.disclaimerEnabled) {
                const accepted = await showDisclaimerDialog(
                    appConfig.disclaimerHeader,
                    appConfig.disclaimerText,
                    appConfig.disclaimerOrg
                );
                if (!accepted) return; // session forfeited — do nothing, no saves
            }
            window.PB.ui.hideWelcome();
            const isVg = appConfig.captureMode === 'videoguestbook';
            setTimeout(isVg ? triggerVgSequence : triggerCaptureSequence, 500);
        } finally {
            _starting = false;
        }
    }

    window.PB.kiosk = {
        launch: launchKiosk,
        startSession: startSession,
        requestExit: requestExit,
    };

    // Lock scroll/pinch-zoom inside kiosk (prevents accidental browser gestures)
    document.getElementById('kiosk-mode').addEventListener('touchmove', function(e) {
        e.preventDefault();
    }, { passive: false });

    // If fullscreen is exited while kiosk is active (e.g. Escape key), treat it as Exit button press
    document.addEventListener('fullscreenchange', function() {
        if (!document.fullscreenElement && $('#kiosk-mode').is(':visible')) {
            requestExit();
        }
    });

    // Re-fit the viewfinder when the screen rotates or the window resizes, so
    // a phone or iPad turned mid-session keeps the slot's shape on screen.
    let _vfResizeTimer = null;
    window.addEventListener('resize', function() {
        clearTimeout(_vfResizeTimer);
        _vfResizeTimer = setTimeout(function() {
            if ($('#kiosk-mode').is(':visible')) applyKioskViewfinderSize();
        }, 150);
    });

    function applyKioskViewfinderSize() {
        // Derive slot AR from the chosen layout so the viewfinder shows
        // exactly what drawPhoto() will capture for each photo slot.
        const { photoSlots } = computeLayout(1920, 1080);
        const slot   = photoSlots[0];
        const slotAR = slot.w / slot.h;

        const viewfinder = document.querySelector('.viewfinder');
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let w, h;
        if (vw / vh > slotAR) {
            // Screen wider than slot — fit by height
            h = vh;
            w = Math.round(vh * slotAR);
        } else {
            // Screen taller than slot — fit by width
            w = vw;
            h = Math.round(vw / slotAR);
        }
        viewfinder.style.width  = w + 'px';
        viewfinder.style.height = h + 'px';
    }

    function resetToWelcomeScreen() {
        // Hide capture screens
        $('#photo-canvas').hide();
        // Show the camera feed element
        $('#camera-feed').show();
        $('#processing-overlay').hide();
        $('#pb-shot-counter, #pb-review-badge').hide();
        $('#live-booth').hide();
        $('#vg-booth').hide();

        // The welcome screen itself is React (src/screens/welcome).
        const isVg = appConfig.captureMode === 'videoguestbook';
        window.PB.ui.showWelcome();

        // Release camera + mic for VG mode so the OS indicator light goes off
        // while the kiosk is idle.  The stream is re-acquired per session inside
        // triggerVgSequence().
        if (isVg) {
            _releaseVgStream();
        }
    }

    // (DRIVE: making session folders public is handled by window.PB.drive.)

    // ===============================================================

    async function triggerCaptureSequence(opts = {}) {
        try {
            // Start a new guest session (skip when continuing from a VG session to share the folder)
            if (!opts.continueSession) startNewSession();

            $('#live-booth').show();

            // Show photo booth splash screen if enabled
            if (appConfig.pbSplashEnabled) {
                const def = LAYOUT_DEFS[appConfig.layout] || LAYOUT_DEFS['4x6-1'];
                const photoCount = def.cols * def.rows;
                const subMsg = photoCount === 1
                    ? 'You\'ve got <strong>1 shot</strong>. Strike your best pose and have fun!'
                    : 'You\'ll take <strong>' + photoCount + ' photos</strong>. Warm up, get creative, and show us your best side!';
                document.getElementById('pb-splash-sub').innerHTML = subMsg;
                const pbSplashEl = document.getElementById('pb-splash');
                pbSplashEl.classList.remove('splash-fade-out');
                pbSplashEl.style.display = 'flex';
                await new Promise(r => setTimeout(r, appConfig.pbSplashDuration * 1000));
                pbSplashEl.classList.add('splash-fade-out');
                await new Promise(r => setTimeout(r, SPLASH_FADE_OUT_DURATION_MS));
                pbSplashEl.style.display = 'none';
                pbSplashEl.classList.remove('splash-fade-out');
            }

            const video = $('#camera-feed')[0];
            const previewCanvas = $('#photo-canvas')[0];
            const previewCtx = previewCanvas.getContext('2d');

            const fW = video.videoWidth  || video.naturalWidth  || video.width;
            const fH = video.videoHeight || video.naturalHeight || video.height;

            const { cWidth, cHeight, photoSlots } = computeLayout(fW, fH);

            const stripCanvas = document.createElement('canvas');
            stripCanvas.width = cWidth;
            stripCanvas.height = cHeight;
            const stripCtx = stripCanvas.getContext('2d');

            // Background: custom uploaded image or white fill
            if (appConfig.templateBg) {
                stripCtx.drawImage(appConfig.templateBg, 0, 0, cWidth, cHeight);
            } else {
                stripCtx.fillStyle = '#FFFFFF';
                stripCtx.fillRect(0, 0, cWidth, cHeight);
            }

            // --- DYNAMIC SEQUENCE LOOP ---
            // Multi-photo layouts show "Photo N of M" so guests know where they are.
            const shotCounter = document.getElementById('pb-shot-counter');
            for (let i = 0; i < photoSlots.length; i++) {
                if (photoSlots.length > 1) {
                    shotCounter.textContent = 'Photo ' + (i + 1) + ' of ' + photoSlots.length;
                    shotCounter.style.display = '';
                }
                let waitTime = (i === 0) ? appConfig.countdownFirst : appConfig.countdownOthers;
                await runCountdown(waitTime);
                triggerFlash();
                await new Promise(r => setTimeout(r, 150)); // let flash peak before capture
                const slot = photoSlots[i];
                await drawPhoto(stripCtx, video, slot.x, slot.y, slot.w, slot.h);
            }
            shotCounter.style.display = 'none';

            previewCanvas.width = cWidth;
            previewCanvas.height = cHeight;
            previewCtx.drawImage(stripCanvas, 0, 0);

            $(video).hide();
            $(previewCanvas).show();

            await processAndSaveImage(stripCanvas, opts);
        } catch (err) {
            console.error('[Capture] Fatal error in capture sequence:', err);
            resetToWelcomeScreen();
        }
    }

    // (computeLayout + drawPhoto live in window.PB.capture; see src/lib/capture.)
    function computeLayout() {
        const def = LAYOUT_DEFS[appConfig.layout] || LAYOUT_DEFS['4x6-1'];
        return window.PB.capture.computeLayout(def);
    }

    // Camera constraints for photo-booth stills, matched to the chosen
    // layout's slot shape: 4:3 for portrait/square slots, 16:9 for wide ones,
    // at the largest size the camera offers. Less of the frame is cropped.
    function _pbPhotoConstraints() {
        const slot = computeLayout().photoSlots[0];
        return window.PB.capture.photoConstraintsForSlot(slot.w, slot.h);
    }

    // ==================== VIDEO GUESTBOOK ====================
    let _vgMediaRecorder = null;
    let _vgChunks = [];
    let _vgTimerInterval = null;
    let _vgMaxTimer = null;
    let _vgElapsed = 0;

    let _vgFrameAnimId = null;      // rAF id for canvas compositing loop
    let _vgCurrentSessionToken = 0; // incremented each attempt; stale onstop events check against this
    let _vgRecordStartTime = 0;     // wall-clock ms at which .start() was called
    let _vgActivePromptText = null; // prompt from current/last recording, preserved for redo

    // (Mic monitor state + functions live in window.PB.audio.)

    // ── VG stream lifecycle ────────────────────────────────────────────────────
    // Acquire / release / re-acquire all live in window.PB.capture.camera. These
    // thin shims preserve the legacy function names so call sites in trigger
    // sequences read unchanged.
    function _vgStreamConstraints() {
        return { cameraId: appConfig.vgSelectedCameraId || '', micId: appConfig.vgSelectedMicId || '' };
    }
    async function _acquireVgStream() {
        await window.PB.capture.camera.acquire(_vgStreamConstraints());
    }
    function _releaseVgStream() {
        window.PB.capture.camera.release();
    }
    // ─────────────────────────────────────────────────────────────────────────

    function stopVgRecordingIfActive() {
        // Null out immediately so a second call (e.g. max-timer + user tap race)
        // cannot call .stop() on the same recorder again.
        const recorder = _vgMediaRecorder;
        _vgMediaRecorder = null;
        if (recorder && recorder.state !== 'inactive') {
            try {
                // Flush the final partial chunk before stopping so no audio/video
                // data is lost if the last timeslice hasn't fired yet.
                if (recorder.state === 'recording') {
                    try { recorder.requestData(); } catch (_) {}
                }
                recorder.stop();
            } catch (e) {
                // If stop() throws (e.g. InvalidStateError), restore the reference
                // so cleanup can still be attempted later.
                _vgMediaRecorder = recorder;
                console.warn('[VG] recorder.stop() threw:', e.message);
            }
        }
        clearInterval(_vgTimerInterval);
        clearTimeout(_vgMaxTimer);
        if (_vgFrameAnimId) { cancelAnimationFrame(_vgFrameAnimId); _vgFrameAnimId = null; }
        window.PB.audio.stopMicMonitor();
        _vgRecordStartTime = 0;
        const ol = document.getElementById('vg-overlay-live');
        if (ol) { ol.style.display = 'none'; }
    }

    // ── VG Error-recovery helpers ─────────────────────────────────────────────

    function _showCameraLost() {
        const ol = document.getElementById('kiosk-camera-lost');
        if (ol) ol.style.display = 'flex';
    }
    function _hideCameraLost() {
        const ol = document.getElementById('kiosk-camera-lost');
        if (ol) ol.style.display = 'none';
        const statusEl = document.getElementById('camera-lost-status');
        if (statusEl) statusEl.textContent = '';
        const btn = document.getElementById('btn-camera-lost-reconnect');
        if (btn) btn.disabled = false;
    }
    async function _tryReacquireCameraForVg() {
        const btnReconnect = document.getElementById('btn-camera-lost-reconnect');
        const statusEl     = document.getElementById('camera-lost-status');
        if (btnReconnect) btnReconnect.disabled = true;
        if (statusEl) statusEl.textContent = 'Reconnecting\u2026';
        try {
            const stream = await window.PB.capture.camera.reacquire(_vgStreamConstraints());
            const vgFeedEl = document.getElementById('vg-camera-feed');
            if (vgFeedEl) vgFeedEl.srcObject = stream;
            _hideCameraLost();
            resetToWelcomeScreen();
        } catch (err) {
            if (statusEl) statusEl.textContent = 'Could not reconnect: ' + (err.message || err.name) + '. Check the cable and try again.';
            if (btnReconnect) btnReconnect.disabled = false;
        }
    }

    // Bridge the camera-manager's track-ended watchdog to the legacy DOM
    // overlay + recording cleanup.
    window.addEventListener('pb:vg-camera-lost', function() {
        stopVgRecordingIfActive();
        _showCameraLost();
    });

    function _showVgRecordError(err) {
        // Re-purpose the processing overlay to surface the error inline so the
        // guest can choose to try again or return to the welcome screen.
        const ol = document.getElementById('vg-processing-overlay');
        if (!ol) { resetToWelcomeScreen(); return; }
        ol.innerHTML =
            '<i class="fa-solid fa-triangle-exclamation" style="font-size:3rem;color:#fca5a5;margin-bottom:0.75rem;"></i>'
            + '<h2 style="color:#fff;margin:0 0 0.5rem;">Recording Error</h2>'
            + '<p style="color:#9ca3af;font-size:0.95rem;max-width:300px;text-align:center;">'
            + ((err && (err.message || err.name)) || 'An unexpected error occurred.')
            + '</p>'
            + '<div style="display:flex;gap:1rem;margin-top:1.25rem;flex-wrap:wrap;justify-content:center;">'
            + '<button id="btn-vg-record-error-retry" style="padding:0.8rem 1.75rem;background:#1d4ed8;'
            + 'color:#fff;border:none;border-radius:999px;font-size:1rem;font-weight:700;cursor:pointer;">'
            + '<i class="fa-solid fa-rotate-right"></i> Try Again</button>'
            + '<button id="btn-vg-record-error-ok" style="padding:0.8rem 1.75rem;background:#374151;'
            + 'color:#fff;border:none;border-radius:999px;font-size:1rem;font-weight:700;cursor:pointer;">'
            + 'Return to Start</button>'
            + '</div>';
        ol.style.display = 'flex';

        var _resetOl = function() {
            ol.style.display = 'none';
            ol.innerHTML = '<div class="spinner"></div><h2>Saving video\u2026</h2>';
        };
        document.getElementById('btn-vg-record-error-retry').addEventListener('click', function() {
            _resetOl();
            triggerVgSequence({ continueSession: true, promptText: _vgActivePromptText });
        }, { once: true });
        document.getElementById('btn-vg-record-error-ok').addEventListener('click', function() {
            _resetOl();
            resetToWelcomeScreen();
        }, { once: true });
    }

    let _vgSaveErrBlob = null;
    let _vgSaveErrExt  = '';

    function _showVgSaveError(blob, ext, errMsg) {
        _vgSaveErrBlob = blob;
        _vgSaveErrExt  = ext;
        const overlay = document.getElementById('vg-save-error-overlay');
        if (!overlay) { console.error('[VG] Save error:', errMsg); return Promise.resolve(); }
        const msgEl = document.getElementById('vg-save-error-msg');
        if (msgEl) msgEl.textContent = errMsg || 'The recording could not be written to disk.';
        overlay.style.display = 'flex';
        return new Promise(function(resolve) {
            document.getElementById('btn-vg-save-error-continue').addEventListener('click', function() {
                overlay.style.display = 'none';
                _vgSaveErrBlob = null;
                resolve();
            }, { once: true });
        });
    }

    // Wire recovery-overlay buttons (DOM is ready — we're inside document.ready)
    (function() {
        var dlBtn = document.getElementById('btn-vg-save-error-download');
        if (dlBtn) {
            dlBtn.addEventListener('click', function() {
                if (!_vgSaveErrBlob) return;
                const url = URL.createObjectURL(_vgSaveErrBlob);
                const a   = document.createElement('a');
                a.href     = url;
                a.download = 'recording_recovery.' + (_vgSaveErrExt || 'webm');
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(function() { URL.revokeObjectURL(url); }, 8000);
            });
        }
        var reconnectBtn = document.getElementById('btn-camera-lost-reconnect');
        if (reconnectBtn) reconnectBtn.addEventListener('click', function() { _tryReacquireCameraForVg(); });
        var exitBtn = document.getElementById('btn-camera-lost-exit');
        if (exitBtn) {
            exitBtn.addEventListener('click', function() {
                _hideCameraLost();
                if (currentStream) {
                    currentStream.getTracks().forEach(function(t) { try { t.stop(); } catch (_) {} });
                    currentStream = null;
                }
                window.PB.audio.teardownSinkBeep();
                window.PB.security.exitFullscreen();
                document.getElementById('kiosk-mode').style.display = 'none';
                document.getElementById('admin-dashboard').style.removeProperty('display');
            });
        }
    })();

    const SPLASH_FADE_OUT_DURATION_MS = 400;  // must match CSS @keyframes splash-fade-out duration

    async function triggerVgSequence(opts = {}) {
      const myToken = ++_vgCurrentSessionToken; // unique per attempt; stale onstop events are discarded
      let _stage = 'init';
      try {
        _stage = 'session-start';
        // Start a new guest session (skip on redo to preserve session folder and prompt)
        if (!opts.continueSession) startNewSession();

        // ── Acquire camera + mic (no-op if stream is already live during redo) ──
        _stage = 'stream-acquire';
        await _acquireVgStream();

        // Show booth and wire the live viewfinder
        $('#vg-booth').show();
        const videoEl = $('#vg-camera-feed')[0];
        videoEl.srcObject = currentStream;
        // Route audio output to the configured speaker
        if (appConfig.vgSelectedSpeakerId && typeof videoEl.setSinkId === 'function') {
            try { await videoEl.setSinkId(appConfig.vgSelectedSpeakerId); } catch (_) {}
        }
        try { await videoEl.play(); } catch (_) {}

        // Camera-lost watchdog — re-registered each time a fresh stream is acquired
        currentStream.getVideoTracks().forEach(function(track) {
            track.onended = function() {
                console.warn('[VG] Camera track ended unexpectedly.');
                stopVgRecordingIfActive();
                _showCameraLost();
            };
        });

        // Show live overlay image on viewfinder during recording
        const overlayLive = document.getElementById('vg-overlay-live');
        if (appConfig.vgOverlay) {
            overlayLive.src = appConfig.vgOverlay.objectUrl;
            overlayLive.style.display = '';
        } else {
            overlayLive.style.display = 'none';
            overlayLive.src = '';
        }

        // Show question prompt if enabled
        let _activePromptText = null;
        if (appConfig.vgPromptsEnabled) {
            const _prompts = window.PB.prompts.enabled();
            if (_prompts.length > 0) {
                // On redo reuse the same prompt; otherwise pick randomly
                _activePromptText = opts.promptText || _prompts[Math.floor(Math.random() * _prompts.length)];
                _vgActivePromptText = _activePromptText;

                // Show splash screen first
                const _splashEl = document.getElementById('vg-prompt-splash');
                _splashEl.classList.remove('splash-fade-out');
                _splashEl.style.display = 'flex';
                await new Promise(r => setTimeout(r, appConfig.vgSplashDuration * 1000));
                _splashEl.classList.add('splash-fade-out');
                await new Promise(r => setTimeout(r, SPLASH_FADE_OUT_DURATION_MS)); // match fade-out duration
                _splashEl.style.display = 'none';
                _splashEl.classList.remove('splash-fade-out');

                // Prompt card — guest taps "Let's Go!" to proceed; "Try another" re-rolls (max 3)
                const VG_MAX_REROLLS = 3;
                const _qEl    = document.getElementById('vg-question-overlay');
                const _qTxt   = document.getElementById('vg-question-text');
                const _dots   = _qEl.querySelectorAll('.vg-reroll-dot');
                let _rerolls  = 0;

                function _updateRerollState() {
                    _dots.forEach(function(d, i) { d.classList.toggle('used', i >= (VG_MAX_REROLLS - _rerolls)); });
                    const freshBtn = document.getElementById('btn-vg-reroll');
                    if (freshBtn) freshBtn.disabled = (_rerolls >= VG_MAX_REROLLS);
                }

                _qTxt.textContent = _activePromptText;
                _updateRerollState();
                _qEl.style.display = 'flex';

                await new Promise(function(resolve) {
                    // Clone buttons to clear any stale listeners from a previous redo
                    const oldReroll = document.getElementById('btn-vg-reroll');
                    const newReroll = oldReroll.cloneNode(true);
                    oldReroll.replaceWith(newReroll);

                    const oldGo = document.getElementById('btn-vg-letsgo');
                    const newGo = oldGo.cloneNode(true);
                    oldGo.replaceWith(newGo);

                    newReroll.addEventListener('click', function() {
                        if (_rerolls >= VG_MAX_REROLLS) return;
                        _rerolls++;
                        _activePromptText = _prompts[Math.floor(Math.random() * _prompts.length)];
                        _vgActivePromptText = _activePromptText;
                        _qTxt.textContent = _activePromptText;
                        _updateRerollState();
                    });

                    newGo.addEventListener('click', function() { resolve(); }, { once: true });
                });

                _qEl.style.display = 'none';
            }
        }

        // Show prompt sidebar during countdown (so guest can still read it)
        const _sidebarEl = document.getElementById('vg-prompt-sidebar');
        const _sidebarTxt = document.getElementById('vg-prompt-sidebar-text');
        if (_activePromptText && _sidebarEl) {
            _sidebarTxt.textContent = _activePromptText;
            _sidebarEl.classList.remove('collapsed'); // always start expanded
            _sidebarEl.style.display = 'flex';
        }

        // Pre-record countdown
        const cdEl = document.getElementById('vg-countdown-overlay');
        cdEl.style.display = 'flex';
        for (let i = appConfig.vgCountdown; i >= 1; i--) {
            cdEl.textContent = i;
            cdEl.classList.remove('cd-pop');
            void cdEl.offsetWidth; // reflow to restart animation
            cdEl.classList.add('cd-pop');
            window.PB.audio.beep(i === 1 ? 880 : 660, 0.12); // countdown beep
            await new Promise(r => setTimeout(r, 1000));
        }
        cdEl.style.display = 'none';
        // Sidebar stays visible during recording (it's an HTML overlay — not burned into the video stream)

        // Build the stream to record.
        // If an overlay is configured, composite camera + overlay on a canvas
        // and record the canvas stream (video) + audio from currentStream.
        let recordStream = currentStream;
        if (appConfig.vgOverlay) {
            const canvas = document.getElementById('vg-record-canvas');
            canvas.width  = 1920;
            canvas.height = 1080;
            const ctx = canvas.getContext('2d');
            const overlayImg = appConfig.vgOverlay.img;

            // rAF loop: draw camera frame (cover-fit + mirrored) then overlay.
            // Using drawCoverFrame from window.PB.capture so non-16:9 cameras
            // (4:3 webcams, vertical phone cams) don't get stretched.
            function compositeFrame() {
                const fW = videoEl.videoWidth  || 1920;
                const fH = videoEl.videoHeight || 1080;
                window.PB.capture.drawCoverFrame(ctx, videoEl, fW, fH, 0, 0, 1920, 1080, { mirror: true });
                ctx.drawImage(overlayImg, 0, 0, 1920, 1080);
                _vgFrameAnimId = requestAnimationFrame(compositeFrame);
            }
            compositeFrame();

            const canvasVideoStream = canvas.captureStream(30);
            const audioTracks = currentStream.getAudioTracks();
            const combinedStream = new MediaStream([
                ...canvasVideoStream.getVideoTracks(),
                ...audioTracks
            ]);
            recordStream = combinedStream;
        }

        // Verify the camera track is still live — the stream is opened once at kiosk
        // launch, so it can go stale if the camera disconnects during the prompt or
        // countdown phases.
        _stage = 'liveness-check';
        const _camTracks = currentStream ? currentStream.getVideoTracks() : [];
        if (_camTracks.length === 0 || _camTracks[0].readyState !== 'live') {
            throw new Error('Camera is no longer available (readyState: '
                + (_camTracks[0] ? _camTracks[0].readyState : 'none') + ')');
        }

        // Start recording
        _stage = 'recorder-setup';
        _vgChunks = [];
        _vgElapsed = 0;
        // Prefer mp4 (H.264+AAC) — widest compatibility for saved files.
        // Fall back to webm on browsers that don't support mp4 recording.
        const mimeType = MediaRecorder.isTypeSupported('video/mp4')
            ? 'video/mp4'
            : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
            ? 'video/webm;codecs=vp8,opus'
            : MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
            ? 'video/webm;codecs=vp9,opus'
            : 'video/webm';

        // Explicit bitrate caps prevent the encoder from saturating the CPU.
        // 2.5 Mbps video + 128 kbps audio is more than enough for a guestbook clip.
        const VG_VIDEO_BITRATE = 2500000; // 2.5 Mbps
        const VG_AUDIO_BITRATE = 128000;  // 128 kbps
        const recorderOptions = { mimeType, videoBitsPerSecond: VG_VIDEO_BITRATE, audioBitsPerSecond: VG_AUDIO_BITRATE };
        try {
            _vgMediaRecorder = new MediaRecorder(recordStream, recorderOptions);
        } catch (e) {
            console.warn('[VG] MediaRecorder with bitrate options failed, retrying with mimeType only:', e.message);
            try {
                _vgMediaRecorder = new MediaRecorder(recordStream, { mimeType });
            } catch (e2) {
                console.warn('[VG] MediaRecorder with mimeType failed, using browser defaults:', e2.message);
                _vgMediaRecorder = new MediaRecorder(recordStream);
            }
        }

        _vgMediaRecorder.ondataavailable = function(e) {
            if (e.data && e.data.size > 0) _vgChunks.push(e.data);
        };

        // Per-recording save guard — closure-scoped so a stale onstop from a previous
        // recorder (e.g. triggered by redo) cannot save into the new session.
        let _saved = false;
        _vgMediaRecorder.onstop = function() {
            // Token check: if redo started a new triggerVgSequence since this recorder
            // was created, discard (onstop fires asynchronously after .stop()).
            if (myToken !== _vgCurrentSessionToken) return;
            // Guard against onstop firing more than once (mobile browser quirk).
            if (_saved) return;
            _saved = true;
            clearInterval(_vgTimerInterval);
            clearTimeout(_vgMaxTimer);
            if (_vgFrameAnimId) { cancelAnimationFrame(_vgFrameAnimId); _vgFrameAnimId = null; }
            overlayLive.style.display = 'none';
            $('#vg-prompt-sidebar').hide();
            $('#vg-hud').hide();
            $('#vg-controls').hide();
            $('#vg-processing-overlay').fadeIn(200);
            const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
            const blob = new Blob(_vgChunks, { type: mimeType });

            // Guard against a silent encoder failure that produces an empty file.
            // A real recording is always larger than a few KB; anything smaller
            // means no data was captured and the file would be unplayable.
            const VG_MIN_BLOB_BYTES = 10240; // 10 KB
            if (blob.size < VG_MIN_BLOB_BYTES) {
                $('#vg-processing-overlay').css('display', 'none');
                _showVgRecordError(new Error(
                    'No video data was captured (the encoder may have stalled). Please try again.'
                ));
                return;
            }

            saveVgVideo(blob, ext);
        };

        // Bail out gracefully if the encoder signals an unrecoverable error.
        _vgMediaRecorder.onerror = function(recErr) {
            console.error('[VG] MediaRecorder error:', recErr.error || recErr);
            stopVgRecordingIfActive();
            _showVgRecordError(recErr.error || new Error('Encoder error'));
        };

        _vgMediaRecorder.start(500); // collect chunks every 500ms
        window.PB.audio.startMicMonitor(recordStream); // begin mic activity + silence monitoring
        _stage = 'recording';
        $('#vg-hud').show();
        $('#vg-controls').show();
        // Re-assert prompt sidebar visibility during recording (DOM overlay — not in the recorded stream)
        if (_activePromptText) {
            const _sEl = document.getElementById('vg-prompt-sidebar');
            if (_sEl) _sEl.style.display = 'flex';
        }

        // Update HUD timer — wall-clock anchored to avoid drift on backgrounded tabs.
        _vgRecordStartTime = Date.now();
        window.PB.audio.beep(880, 0.08, 0.35); // recording-start cue (distinct from countdown beeps)
        _vgTimerInterval = setInterval(function() {
            const elapsed = Math.floor((Date.now() - _vgRecordStartTime) / 1000);
            const mins = Math.floor(elapsed / 60);
            const secs = elapsed % 60;
            $('#vg-timer').text(mins + ':' + String(secs).padStart(2, '0'));
            const left = appConfig.vgMaxDuration - elapsed;
            const mLeft = Math.floor(left / 60);
            const sLeft = left % 60;
            const leftTxt = mLeft > 0 ? mLeft + ':' + String(sLeft).padStart(2, '0') + ' left' : left + 's left';
            $('#vg-time-left').text(leftTxt).css('color', left <= 10 ? '#fca5a5' : '#fff');
        }, 500); // 500 ms tick for better wall-clock fidelity

        // Auto-stop at max duration, wall-clock anchored to survive tab suspension.
        const _maxMs = appConfig.vgMaxDuration * 1000;
        _vgMaxTimer = setTimeout(function() {
            // Verify wall-clock elapsed to guard against premature fires on browsers
            // that resume suspended timers early.
            if (_vgRecordStartTime && (Date.now() - _vgRecordStartTime) < _maxMs - 500) return;
            stopVgRecordingIfActive();
        }, _maxMs);
      } catch (err) {
        console.error('[VG] Fatal error in VG sequence [stage: ' + _stage + ']:', err);
        stopVgRecordingIfActive();
        if (err && err.message && err.message.startsWith('Camera is no longer available')) {
            _showCameraLost();
        } else if (_stage === 'stream-acquire') {
            // Camera or mic could not be opened — surface a clear error so the
            // guest (or operator) knows what went wrong.
            _showVgRecordError(new Error(
                (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
                    ? 'Camera permission was denied. Please grant access in browser settings.'
                    : (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError')
                    ? 'Camera not found. Check the connection and try again.'
                    : (err.name === 'NotReadableError' || err.name === 'TrackStartError')
                    ? 'Camera is in use by another app. Close it and try again.'
                    : (err.message || err.name || 'Could not open camera.')
            ));
        } else if (_stage === 'recorder-setup' || _stage === 'recording') {
            _showVgRecordError(err);
        } else {
            resetToWelcomeScreen();
        }
      }
    }

    $('#btn-vg-stop').on('click', function() {
        const VG_MIN_DURATION_WARN_S = 3;
        const elapsed = _vgRecordStartTime
            ? Math.floor((Date.now() - _vgRecordStartTime) / 1000)
            : 0;

        if (elapsed > 0 && elapsed < VG_MIN_DURATION_WARN_S) {
            // Recording is very short — ask the guest before discarding.
            const ol = document.getElementById('vg-processing-overlay');
            ol.innerHTML =
                '<i class="fa-solid fa-clock" style="font-size:3rem;color:#fca5a5;margin-bottom:0.75rem;"></i>'
                + '<h2 style="color:#fff;margin:0 0 0.5rem;">Short Message</h2>'
                + '<p style="color:#9ca3af;font-size:0.95rem;max-width:300px;text-align:center;">'
                + 'Your recording is only ' + elapsed + ' second' + (elapsed === 1 ? '' : 's') + ' long.'
                + ' Would you like to keep recording?</p>'
                + '<div style="display:flex;gap:1rem;margin-top:1.25rem;">'
                + '<button id="btn-vg-short-keep" style="padding:0.8rem 1.5rem;background:#374151;color:#fff;'
                + 'border:none;border-radius:999px;font-size:1rem;font-weight:700;cursor:pointer;">Keep Recording</button>'
                + '<button id="btn-vg-short-stop" style="padding:0.8rem 1.5rem;background:#297aa0;color:#fff;'
                + 'border:none;border-radius:999px;font-size:1rem;font-weight:700;cursor:pointer;">Stop Anyway</button>'
                + '</div>';
            ol.style.display = 'flex';

            var _resetOl = function() {
                ol.style.display = 'none';
                ol.innerHTML = '<div class="spinner"></div><h2>Saving video\u2026</h2>';
            };
            document.getElementById('btn-vg-short-keep').addEventListener('click', function() {
                _resetOl();
            }, { once: true });
            document.getElementById('btn-vg-short-stop').addEventListener('click', function() {
                _resetOl();
                stopVgRecordingIfActive();
            }, { once: true });
            return;
        }

        stopVgRecordingIfActive();
    });

    // Collapse / expand the prompt reminder card during recording
    $(document).on('click', '#btn-vg-prompt-collapse', function() {
        const sidebar = document.getElementById('vg-prompt-sidebar');
        if (sidebar) sidebar.classList.toggle('collapsed');
    });

    $('#btn-vg-redo').on('click', function() {
        // Discard the current recording without saving
        const recorder = _vgMediaRecorder;
        _vgMediaRecorder = null;
        if (recorder && recorder.state !== 'inactive') {
            recorder.onstop = null;         // prevent the save handler from firing
            recorder.ondataavailable = null; // prevent stale chunks from leaking into the next session
            try { recorder.stop(); } catch(e) {}
        }
        clearInterval(_vgTimerInterval);
        clearTimeout(_vgMaxTimer);
        if (_vgFrameAnimId) { cancelAnimationFrame(_vgFrameAnimId); _vgFrameAnimId = null; }
        window.PB.audio.stopMicMonitor();

        // Reset recording state
        _vgChunks = [];
        _vgElapsed = 0;

        // Reset UI back to pre-recording state
        $('#vg-hud').hide();
        $('#vg-controls').hide();
        $('#vg-timer').text('0:00');
        $('#vg-time-left').text('').css('color', '#fff');
        $('#vg-prompt-sidebar').hide();
        const ol = document.getElementById('vg-overlay-live');
        if (ol) ol.style.display = 'none';

        // Restart with the same session and same prompt so the guest doesn't get a new question
        triggerVgSequence({ continueSession: true, promptText: _vgActivePromptText });
    });

    /**
     * Close the camera and microphone as soon as a recording is finished,
     * before the preview plays.
     *
     * Mic: while a Bluetooth headset mic (e.g. a DJI Mic paired over
     * Bluetooth) is open, iPadOS and Android keep audio in "call" mode and
     * send playback to the headset, so the guest hears nothing from the
     * iPad's speaker or a Bluetooth speaker.
     * Camera: nothing needs it during the preview, the photo booth offer or
     * the Done screen, and the recording light goes off as soon as the guest
     * is done. If they accept the photo booth offer, the camera is re-opened
     * (video only) for it.
     *
     * The photo booth offer's frozen-frame backdrop is painted from the live
     * camera first, since the feed is blank once the camera is closed.
     */
    function _releaseVgCapture() {
        window.PB.ui.freezeOfferBackdrop(document.getElementById('vg-camera-feed'));
        window.PB.audio.stopMicMonitor();
        window.PB.capture.camera.release();
    }

    async function saveVgVideo(blob, ext) {
        // Stop canvas compositing if it was active
        if (_vgFrameAnimId) { cancelAnimationFrame(_vgFrameAnimId); _vgFrameAnimId = null; }

        // The recorder has finished (we're called from its onstop), so the
        // camera and mic are no longer needed. Release them now so the preview
        // plays through the speaker rather than a Bluetooth mic.
        _releaseVgCapture();

        // Same generator as the photo path, with a guestbook-flavoured prefix
        // when no event name is configured.
        const prefix = appConfig.eventName || 'guestbook';
        const filename = window.PB.capture.makeFilename(prefix, ext);

        // Keep a blob URL in memory for gallery playback (intentionally not revoked)
        const galleryBlobUrl = URL.createObjectURL(blob);
        const captureId = window.PB.captures.add('video', galleryBlobUrl);
        // Broadcast thumbnail to Live Viewer peers (fire-and-forget)
        window.PB.liveViewer.host.broadcastVideo(galleryBlobUrl, filename);

        // Save locally (folder or download)
        if (appConfig.vgSaveLocal) {
            try {
                await window.PB.capture.saveBlobLocally(blob, filename, {
                    directoryHandle: directoryHandle,
                    sessionId: currentSessionId,
                });
            } catch (err) {
                await _showVgSaveError(blob, ext, err.message || 'Could not write file: ' + err.name);
            }
        }

        // Upload to Google Drive (queues offline if the network drops).
        if (appConfig.vgSaveDrive && window.PB.drive.isSignedIn()) {
            window.PB.drive.upload('video-guestbook', blob, filename).then(() => {
                if (currentSessionFolderLink) {
                    window.PB.captures.setDriveUrl(captureId, currentSessionFolderLink);
                    window.PB.liveViewer.host.broadcastDriveUpdate(filename, currentSessionFolderLink);
                }
            }).catch(e => console.warn('[Drive] VG upload failed:', e.message));
        }

        // Reset HUD state
        $('#vg-time-left').hide().text('');
        $('#vg-timer').text('0:00');
        $('#vg-processing-overlay').fadeOut(200);

        // Show preview with autoplay × 3, then close button
        if (appConfig.vgCaptureReviewEnabled) {
            await showVgPreview(galleryBlobUrl);
        }

        // Offer the guest a photo strip if the feature is enabled
        if (appConfig.vgOfferPb) {
            const wantsPb = await showVgPbOffer();
            if (wantsPb) {
                $('#vg-booth').hide();
                // The camera was released when the recording stopped
                // (_releaseVgCapture); re-open it, video only, on the same
                // camera the guest just used.
                try {
                    await window.PB.capture.camera.acquirePhotoCamera(
                        appConfig.vgSelectedCameraId || '',
                        _pbPhotoConstraints()
                    );
                } catch (err) {
                    console.error('[VG→PB] Could not re-open the camera for the photo booth:', err);
                    _showCameraLost();
                    return;
                }
                const pbFeedEl = $('#camera-feed')[0];
                if (pbFeedEl && currentStream) {
                    pbFeedEl.srcObject = currentStream;
                    try {
                        await pbFeedEl.play();
                    } catch (e) {
                        // Playback can be momentarily blocked while transitioning overlays.
                    }
                }
                $('#photo-canvas').hide();
                $('#camera-feed').show();
                applyKioskViewfinderSize();
                await triggerCaptureSequence({ continueSession: true }); // reuse same session folder so photo lands alongside the video
                return; // triggerCaptureSequence handles its own thank-you and resetToWelcomeScreen
            }
        }

        // Consolidated Done screen — shows the QR card (when Drive is on) and
        // the Fraunces thank-you headline (when vgThankYouEnabled). Skipped
        // entirely if neither applies, preserving the legacy fast-path back
        // to welcome.
        const wantsDoneScreen = !!appConfig.vgThankYouEnabled
            || (!!appConfig.vgSaveDrive && window.PB.drive.isSignedIn());
        if (wantsDoneScreen) {
            await showVgDoneScreen();
        }

        $('#vg-booth').hide();
        resetToWelcomeScreen();
    }

    // "Take a photo too?" offer (a React screen: src/screens/guest-flow).
    // Resolves true if the guest wants a photo strip. Its backdrop is the
    // frame frozen in _releaseVgCapture.
    function showVgPbOffer() {
        return window.PB.ui.offerPhotoBooth();
    }

    // Post-capture Done screen (a React screen: src/screens/guest-flow).
    // With Drive on it first shows the session's QR code, then a thank-you
    // countdown back to welcome. Resolves when the guest is done.
    function showVgDoneScreen() {
        return window.PB.ui.showDone({
            showQr: !!appConfig.vgSaveDrive && window.PB.drive.isSignedIn(),
            thankYouSecs: appConfig.vgThankYouDuration,
            backgroundUrl: appConfig.vgThankYouImage ? appConfig.vgThankYouImage.objectUrl : null,
            getDriveLink: function() { return currentSessionFolderLink; },
        });
    }
    function showVgPreview(blobUrl) {
        return new Promise(resolve => {
            const overlay      = document.getElementById('vg-preview-overlay');
            const video        = document.getElementById('vg-preview-video');
            const closeBtn     = document.getElementById('btn-vg-preview-close');
            const msg          = document.getElementById('vg-preview-msg');
            const seekBar      = document.getElementById('vg-seek-bar');
            const playPauseBtn = document.getElementById('btn-vg-play-pause');
            const muteBtn      = document.getElementById('btn-vg-mute');
            const timeDisplay  = document.getElementById('vg-time-display');
            let loopCount = 0;

            // Helper: format seconds as M:SS
            function fmtTime(s) {
                if (!isFinite(s)) return '0:00';
                const m = Math.floor(s / 60);
                return m + ':' + String(Math.floor(s % 60)).padStart(2, '0');
            }

            video.src = blobUrl;
            video.loop = false;
            video.muted = false;
            seekBar.value = 0;
            timeDisplay.textContent = '0:00 / 0:00';
            playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            muteBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
            msg.style.display = '';
            msg.textContent = 'Playing back your message…';
            // Clear the inline display:none so the stylesheet picks the layout
            // (a column normally, video beside controls on short landscape).
            overlay.style.display = '';

            // Control bar event handlers
            function onTimeUpdate() {
                if (video.duration) {
                    seekBar.value = (video.currentTime / video.duration) * 100;
                    timeDisplay.textContent = fmtTime(video.currentTime) + ' / ' + fmtTime(video.duration);
                }
            }
            function onLoadedMetadata() {
                seekBar.value = 0;
                timeDisplay.textContent = '0:00 / ' + fmtTime(video.duration);
            }
            function onSeek() {
                if (video.duration) video.currentTime = (seekBar.value / 100) * video.duration;
            }
            function onPlayPause() {
                if (video.paused) { video.play().catch(() => {}); } else { video.pause(); }
            }
            function onPlay()  { playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>'; }
            function onPause() { playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>'; }
            function onMute() {
                video.muted = !video.muted;
                muteBtn.innerHTML = video.muted ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>';
            }

            video.addEventListener('timeupdate', onTimeUpdate);
            video.addEventListener('loadedmetadata', onLoadedMetadata);
            video.addEventListener('play', onPlay);
            video.addEventListener('pause', onPause);
            seekBar.addEventListener('input', onSeek);
            playPauseBtn.addEventListener('click', onPlayPause);
            muteBtn.addEventListener('click', onMute);

            function onEnded() {
                loopCount++;
                if (loopCount < 3) {
                    video.currentTime = 0;
                    video.play().catch(() => {});
                } else {
                    msg.style.display = 'none';
                    playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
                }
            }
            video.onended = onEnded;

            function doClose() {
                // Remove all control bar listeners
                video.removeEventListener('timeupdate', onTimeUpdate);
                video.removeEventListener('loadedmetadata', onLoadedMetadata);
                video.removeEventListener('play', onPlay);
                video.removeEventListener('pause', onPause);
                seekBar.removeEventListener('input', onSeek);
                playPauseBtn.removeEventListener('click', onPlayPause);
                muteBtn.removeEventListener('click', onMute);
                video.onended = null;
                video.pause();
                video.src = '';
                overlay.style.display = 'none';
                closeBtn.removeEventListener('click', doClose);
                resolve();
            }

            closeBtn.addEventListener('click', doClose);

            const _startPreviewPlay = () => {
                video.play().catch(() => {
                    msg.textContent = 'Tap play to preview your message.';
                    playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
                });
            };
            // Prefer AudioContext routing (already wired at kiosk launch via
            // window.PB.audio.setupSinkBeep — no extra audiooutput permission
            // required). Fall back to setSinkId for cases where the speaker
            // was configured but AudioContext routing failed.
            if (window.PB.audio.hasPreviewRouting()) {
                _startPreviewPlay();
            } else if (appConfig.vgSelectedSpeakerId && typeof video.setSinkId === 'function') {
                video.setSinkId(appConfig.vgSelectedSpeakerId).then(_startPreviewPlay).catch(_startPreviewPlay);
            } else {
                _startPreviewPlay();
            }
        });
    }

    // =========================================================

    /**
     * Capture one photo into the layout slot.
     * Tries ImageCapture.takePhoto() first (full camera sensor resolution — Chrome/Android).
     * Falls back to drawing the current video frame (Safari, Firefox, older browsers).
     */
    async function drawPhoto(ctx, video, x, y, slotW, slotH) {
        return window.PB.capture.drawPhoto(ctx, currentStream, video, x, y, slotW, slotH);
    }

    // (The in-memory gallery and its size cap live in window.PB.captures.)

    async function processAndSaveImage(canvas, opts = {}) {
        $('#processing-overlay').fadeIn(200);

        const filename = makeFilename();

        // --- Save to local folder (or browser download as fallback) ---
        if (appConfig.saveLocal) {
            try {
                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1.0));
                await window.PB.capture.saveBlobLocally(blob, filename, {
                    directoryHandle: directoryHandle,
                    sessionId: currentSessionId,
                });
            } catch (err) { console.error('Save error:', err); }
        }

        // SAVE IMAGE TO ADMIN DASHBOARD GALLERY
        const photoDataUrl = canvas.toDataURL('image/png', 0.8);
        const captureId = window.PB.captures.add('photo', photoDataUrl);
        // Broadcast to Live Viewer peers (fire-and-forget)
        window.PB.liveViewer.host.broadcastPhoto(photoDataUrl, filename);

        // --- Upload to Google Drive (fire-and-forget; queues offline if needed) ---
        if (appConfig.saveDrive && window.PB.drive.isSignedIn()) {
            canvas.toBlob(async function(blob) {
                try {
                    await window.PB.drive.upload('photo-booth', blob, filename);
                    console.log('[Drive] Uploaded:', filename);
                    if (currentSessionFolderLink) {
                        window.PB.captures.setDriveUrl(captureId, currentSessionFolderLink);
                        window.PB.liveViewer.host.broadcastDriveUpdate(filename, currentSessionFolderLink);
                    }
                } catch (e) {
                    console.warn('[Drive] Upload failed:', e.message);
                }
            }, 'image/jpeg', 0.92);
        }

        $('#processing-overlay').fadeOut(200);
        $('#pb-review-badge').css('display', '');

        const previewMs = Math.max(appConfig.reviewTime * 1000, 1000);
        setTimeout(async () => {
            // Show consolidated Done screen for VG→PB chained sessions when
            // either ThankYou or Drive (signed-in) is configured.
            const wantsDoneScreen = (opts.continueSession
                && !!appConfig.vgSaveDrive
                && window.PB.drive.isSignedIn())
                || !!appConfig.vgThankYouEnabled;
            if (wantsDoneScreen) {
                await showVgDoneScreen();
            }
            $('#processing-overlay h2').text('Saving your photos…');
            $('.spinner').show();
            resetToWelcomeScreen();
        }, previewMs);
    }

    // =========================================================

    function runCountdown(seconds) {
        return new Promise(resolve => {
            let count = seconds;
            const overlay = $('#countdown-overlay');
            // Reset state before starting so previous transition doesn't linger
            overlay.removeClass('active').hide();
            void overlay[0].offsetWidth;
            overlay.text(count).show();
            window.PB.audio.beep(count === 1 ? 880 : 660, 0.12); // beep on initial display
            requestAnimationFrame(() => overlay.addClass('active'));
            
            const interval = setInterval(() => {
                count--;
                if (count > 0) {
                    overlay.removeClass('active');
                    void overlay[0].offsetWidth; 
                    overlay.text(count).addClass('active');
                    window.PB.audio.beep(count === 1 ? 880 : 660, 0.12); // beep on each number
                } else {
                    clearInterval(interval);
                    overlay.removeClass('active');
                    window.PB.audio.beep(1100, 0.08); // shutter beep
                    // Resolve only AFTER hide so next countdown never races with this one
                    setTimeout(() => { overlay.hide(); resolve(); }, 250);
                }
            }, 1000);
        });
    }

    function triggerFlash() {
        const flash = $('#flash-overlay');
        flash.show().css('opacity', '1').animate({ opacity: 0 }, 300, 'linear', function() {
            $(this).hide();
        });
    }

    // (Dashboard gallery, "View all" and the lightbox are React: src/screens/galleries.)


});
