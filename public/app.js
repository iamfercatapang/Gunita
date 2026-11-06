$(document).ready(function() {

    // Everything on screen is React now (src/screens): the admin dashboard,
    // the welcome screen, the capture screens and the dialogs. What's left
    // here is entering and leaving kiosk mode and the exit PIN (moving to
    // TypeScript in 4g). React reaches it through window.PB.kiosk below.

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
            // Camera and mic will be opened by the video session (src/screens/capture) only when
            // a guest actually begins recording, and released when they return to
            // the welcome screen.  This keeps the OS indicator light off while idle.
            $('#admin-dashboard').hide();
            $('#kiosk-mode').fadeIn(400);
            window.PB.security.requestFullscreen();
            window.PB.audio.setupSinkBeep(appConfig.vgSelectedSpeakerId);
            window.PB.ui.resetToWelcome();
        } else {
            // ── Photo Booth: open the camera now; the session shows it ──
            const def = LAYOUT_DEFS[appConfig.layout] || LAYOUT_DEFS['4x6-1'];
            const slot = window.PB.capture.computeLayout(def).photoSlots[0];
            const videoConstraints = window.PB.capture.photoConstraintsForSlot(slot.w, slot.h);
            if (appConfig.selectedCameraId) {
                videoConstraints.deviceId = { exact: appConfig.selectedCameraId };
            }
            currentStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
            window.PB.capture.logTrackSize('[PB] Photo camera', currentStream);

            $('#admin-dashboard').hide();
            $('#kiosk-mode').fadeIn(400);
            window.PB.security.requestFullscreen();
            window.PB.audio.setupSinkBeep(appConfig.vgSelectedSpeakerId);
            window.PB.ui.resetToWelcome();

            // Camera-lost watchdog; the capture screens show "Camera Disconnected".
            currentStream.getVideoTracks().forEach(function(track) {
                track.onended = function() {
                    console.warn('[PB] Camera track ended unexpectedly.');
                    window.dispatchEvent(new CustomEvent('pb:vg-camera-lost'));
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
        window.PB.ui.closeAll(); // also stops (and saves) a recording in progress
        if (currentStream) { currentStream.getTracks().forEach(track => track.stop()); currentStream = null; }
        window.PB.audio.teardownSinkBeep();
        window.PB.security.exitFullscreen();
        $('#kiosk-mode').hide();
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
            setTimeout(isVg ? window.PB.ui.startVideoSession : window.PB.ui.startPhotoSession, 500);
        } finally {
            _starting = false;
        }
    }

    window.PB.kiosk = {
        launch: launchKiosk,
        startSession: startSession,
        requestExit: requestExit,
        exit: _doExitKiosk,
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


});
