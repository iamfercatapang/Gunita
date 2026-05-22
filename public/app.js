// --- Filename generator (thin wrapper around window.PB.capture.makeFilename) ---
function makeFilename(ext = 'png') {
    return window.PB.capture.makeFilename(appConfig.eventName, ext);
}


$(document).ready(function() {

    updateDashboardGallery();

    // --- Tabs ---
    $('.nav-item').on('click', function(e) {
        e.preventDefault();
        $('.nav-item').removeClass('active');
        $(this).addClass('active');
        $('.admin-panel').hide();
        $('#' + $(this).data('target')).show();
    });

    // --- Dynamic Slider Syncing ---
    $('#setting-cd-1').on('input', function() {
        let val = $(this).val();
        $('#val-cd-1').text(val);
        appConfig.countdownFirst = parseInt(val);
    });
    
    $('#setting-cd-others').on('input', function() {
        let val = $(this).val();
        $('#val-cd-others').text(val);
        appConfig.countdownOthers = parseInt(val);
    });

    $('#setting-review').on('input', function() {
        let val = $(this).val();
        $('#val-review').text(val);
        appConfig.reviewTime = parseInt(val);
    });

    // --- Storage (Photo Booth) — checkbox toggles (both local + drive can be active) ---
    $('#chk-save-local').on('change', function() {
        appConfig.saveLocal = this.checked;
    });

    $('#chk-save-drive').on('change', function() {
        appConfig.saveDrive = this.checked;
        _updateEventNameWarnings();
    });

    // --- Welcome Screen Designer ---
    $('#edit-bg-color').on('input', function() {
        let col = $(this).val();
        appConfig.welcomeBg = col;
        $('#color-hex').text(col);
        // Only apply color when no media is active
        if (!appConfig.welcomeMedia) {
            $('#designer-preview').css('background-color', col);
            $('#guest-welcome').css('background-color', col);
        }
    });

    $('#edit-title').on('input', function() {
        let txt = $(this).val();
        appConfig.welcomeTitle = txt;
        $('#prev-title').text(txt);
        $('#live-ws-title').text(txt);
    });

    $('#edit-subtitle').on('input change', function() {
        let txt = $(this).val();
        appConfig.welcomeSubtitle = txt;
        $('#prev-subtitle').text(txt);
        $('#live-ws-subtitle').text(txt);
    });

    $('#edit-vg-panel-title').on('input', function() {
        appConfig.vgPanelTitle = $(this).val();
        const txt = appConfig.vgPanelTitle || 'Raise a Toast!';
        $('#prev-vg-title').text(txt);
        if (appConfig.captureMode === 'videoguestbook') {
            $('#live-ws-title-vg').text(txt);
        }
    });

    $('#edit-vg-couple-name').on('input', function() {
        const name = $(this).val();
        appConfig.vgCoupleName = name;
        $('#vg-couple-name-preview').text(name || 'Ken & Alexa');
        const sub = _getVgPanelSubtitle();
        $('#prev-vg-subtitle').text(sub);
        if (appConfig.captureMode === 'videoguestbook') {
            $('#live-ws-subtitle-vg').text(sub);
        }
    });

    // --- Welcome Screen Media Upload ---
    function applyWelcomeMedia(file) {
        if (appConfig.welcomeMedia) {
            URL.revokeObjectURL(appConfig.welcomeMedia.objectUrl);
        }
        const objectUrl = URL.createObjectURL(file);
        const type = file.type.startsWith('video/') ? 'video' : 'image';
        appConfig.welcomeMedia = { type, objectUrl };

        // Update upload zone thumb
        const thumbWrap = $('#ws-media-thumb-wrap').empty();
        if (type === 'video') {
            thumbWrap.html(`<video src="${objectUrl}" class="ws-thumb-media" autoplay loop muted playsinline></video>`);
        } else {
            thumbWrap.html(`<img src="${objectUrl}" class="ws-thumb-media">`);
        }
        $('#ws-media-empty').hide();
        $('#ws-media-filled').show();

        // Update designer preview frame
        if (type === 'video') {
            $('#prev-media-img').hide().attr('src', '');
            const pv = $('#prev-media-video').attr('src', objectUrl).show()[0];
            pv.load(); pv.play();
        } else {
            $('#prev-media-video').hide().attr('src', '')[0].load();
            $('#prev-media-img').attr('src', objectUrl).show();
        }
        $('#designer-preview').css('background-color', '');

        // Update kiosk welcome screen
        if (type === 'video') {
            $('#ws-image-bg').hide().attr('src', '');
            const kv = $('#ws-video-bg').attr('src', objectUrl).show()[0];
            kv.load(); kv.play();
        } else {
            $('#ws-video-bg').hide().attr('src', '')[0].load();
            $('#ws-image-bg').attr('src', objectUrl).show();
        }
        $('#guest-welcome').css('background-color', '');
    }

    function clearWelcomeMedia() {
        if (appConfig.welcomeMedia) {
            URL.revokeObjectURL(appConfig.welcomeMedia.objectUrl);
            appConfig.welcomeMedia = null;
        }
        // Reset preview
        $('#prev-media-img').hide().attr('src', '');
        const pv = $('#prev-media-video').hide().attr('src', '')[0];
        if (pv) { pv.load(); }
        $('#designer-preview').css('background-color', appConfig.welcomeBg);
        // Reset kiosk
        $('#ws-image-bg').hide().attr('src', '');
        const kv = $('#ws-video-bg').hide().attr('src', '')[0];
        if (kv) { kv.load(); }
        $('#guest-welcome').css('background-color', appConfig.welcomeBg);
        // Reset upload zone
        $('#ws-media-empty').show();
        $('#ws-media-filled').hide();
        $('#ws-media-thumb-wrap').empty();
        $('#ws-media-input').val('');
    }

    // Click on upload zone opens file picker
    $('#ws-media-drop').on('click', function(e) {
        if (!$(e.target).closest('#ws-media-remove, #btn-pick-ws-media').length) {
            document.getElementById('ws-media-input').click();
        }
    });
    // File selected via input
    $('#ws-media-input').on('change', function() {
        const file = this.files[0];
        if (file) applyWelcomeMedia(file);
    });

    // Drag and drop
    $('#ws-media-drop').on('dragover dragenter', function(e) {
        e.preventDefault(); e.stopPropagation();
        $(this).addClass('drag-over');
    }).on('dragleave drop', function(e) {
        e.preventDefault(); e.stopPropagation();
        $(this).removeClass('drag-over');
        if (e.type === 'drop') {
            const file = e.originalEvent.dataTransfer.files[0];
            if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
                applyWelcomeMedia(file);
            }
        }
    });

    // Remove media
    $('#ws-media-remove').on('click', function(e) {
        e.stopPropagation();
        clearWelcomeMedia();
    });

    // --- Photo Mode Toggle ---
    $('#toggle-photo-mode').on('change', function() {
        appConfig.photoMode = $(this).is(':checked');
        const label = appConfig.photoMode ? 'ON' : 'OFF';
        $('#toggle-photo-label').text(label);
        $(this).closest('.toggle-switch').toggleClass('is-on', appConfig.photoMode);
    });

    // --- Disclaimer — helpers ---
    const DEFAULT_DISCLAIMER_TEXT = appConfig.disclaimerText;

    function _renderDisclaimerText(text, org) {
        return text.replace(/\{Name of Organization\}/g, org || 'the Organisation');
    }

    // --- Disclaimer — shared admin settings ---
    (function initDisclaimer() {
        $('#disclaimer-header').val(appConfig.disclaimerHeader);
        $('#disclaimer-org').val(appConfig.disclaimerOrg);
        $('#disclaimer-text').val(appConfig.disclaimerText);

        function _sync() {
            const on = appConfig.disclaimerEnabled;
            $('#toggle-disclaimer').prop('checked', on).closest('.toggle-switch').toggleClass('is-on', on);
            $('#toggle-disclaimer-label').text(on ? 'ON' : 'OFF');
            $('#disclaimer-config').toggle(on);
        }
        _sync();

        $('#toggle-disclaimer').on('change', function() {
            appConfig.disclaimerEnabled = this.checked;
            $('#toggle-disclaimer-label').text(this.checked ? 'ON' : 'OFF');
            $(this).closest('.toggle-switch').toggleClass('is-on', this.checked);
            $('#disclaimer-config').toggle(this.checked);
        });
        $('#disclaimer-org').on('input', function() { appConfig.disclaimerOrg = this.value; });
        $('#disclaimer-header').on('input', function() { appConfig.disclaimerHeader = this.value || 'Media Release Agreement'; });
        $('#disclaimer-text').on('input', function() { appConfig.disclaimerText = this.value; });
    })();

    // --- Prompts — Video Guestbook admin settings ---
    (function initVgPrompts() {
        function _enabledCount() {
            const builtIn  = PROMPT_TEMPLATES[appConfig.vgPromptCategory] || [];
            const disabled = appConfig.vgDisabledTemplatePrompts;
            const tplEnabled = builtIn.filter(function(q) { return disabled.indexOf(q) === -1; }).length;
            const cusEnabled = appConfig.vgCustomPrompts.filter(function(p) { return p.enabled; }).length;
            return tplEnabled + cusEnabled;
        }

        function _toggle(checked) {
            return '<label class="vg-prompt-toggle-wrap">' +
                '<input type="checkbox" class="vg-prompt-toggle"' + (checked ? ' checked' : '') + '>' +
                '<span class="vg-prompt-toggle-pill"></span>' +
                '</label>';
        }

        function _renderPromptList() {
            const builtIn  = PROMPT_TEMPLATES[appConfig.vgPromptCategory] || [];
            const custom   = appConfig.vgCustomPrompts;
            const disabled = appConfig.vgDisabledTemplatePrompts;

            $('#vg-prompts-count').text('(' + _enabledCount() + ' enabled)');

            const $list = $('#vg-prompts-list').empty();
            builtIn.forEach(function(q) {
                const isEnabled = disabled.indexOf(q) === -1;
                $list.append(
                    '<li class="vg-prompt-item' + (isEnabled ? '' : ' is-disabled') + '" data-type="template" data-key="' + encodeURIComponent(q) + '">' +
                    _toggle(isEnabled) +
                    '<span class="vg-prompt-badge">Template</span>' +
                    '<span class="vg-prompt-text">' + $('<span>').text(q).html() + '</span>' +
                    '</li>'
                );
            });
            custom.forEach(function(p, i) {
                $list.append(
                    '<li class="vg-prompt-item' + (p.enabled ? '' : ' is-disabled') + '" data-type="custom" data-idx="' + i + '">' +
                    _toggle(p.enabled) +
                    '<span class="vg-prompt-badge vg-prompt-badge-custom">Custom</span>' +
                    '<span class="vg-prompt-text">' + $('<span>').text(p.text).html() + '</span>' +
                    '<button class="vg-prompt-del" data-idx="' + i + '" title="Remove">\u2715</button>' +
                    '</li>'
                );
            });

            $list.find('.vg-prompt-toggle').on('change', function() {
                const $li = $(this).closest('.vg-prompt-item');
                const on  = this.checked;
                $li.toggleClass('is-disabled', !on);
                if ($li.data('type') === 'template') {
                    const q   = decodeURIComponent($li.data('key'));
                    const idx = appConfig.vgDisabledTemplatePrompts.indexOf(q);
                    if (on  && idx !== -1) appConfig.vgDisabledTemplatePrompts.splice(idx, 1);
                    if (!on && idx === -1) appConfig.vgDisabledTemplatePrompts.push(q);
                } else {
                    appConfig.vgCustomPrompts[parseInt($li.data('idx'), 10)].enabled = on;
                }
                $('#vg-prompts-count').text('(' + _enabledCount() + ' enabled)');
                _scheduleSave();
            });

            $list.find('.vg-prompt-del').on('click', function() {
                appConfig.vgCustomPrompts.splice(parseInt($(this).data('idx'), 10), 1);
                _renderPromptList();
                _scheduleSave();
            });
        }

        function _syncToggle() {
            const on = appConfig.vgPromptsEnabled;
            $('#toggle-vg-prompts').prop('checked', on).closest('.toggle-switch').toggleClass('is-on', on);
            $('#toggle-vg-prompts-label').text(on ? 'ON' : 'OFF');
            $('#vg-prompts-config').toggle(on);
            $('#prev-vg-prompts-chip').toggle(on);
        }

        _syncToggle();
        _renderPromptList();

        // Splash screen duration slider
        $('#setting-vg-splash-duration').val(appConfig.vgSplashDuration).on('input', function() {
            appConfig.vgSplashDuration = parseInt(this.value, 10);
            $('#val-vg-splash-duration').text(this.value);
            _scheduleSave();
        });
        $('#val-vg-splash-duration').text(appConfig.vgSplashDuration);

        $('#toggle-vg-prompts').on('change', function() {
            appConfig.vgPromptsEnabled = this.checked;
            $('#toggle-vg-prompts-label').text(this.checked ? 'ON' : 'OFF');
            $(this).closest('.toggle-switch').toggleClass('is-on', this.checked);
            $('#vg-prompts-config').toggle(this.checked);
            $('#prev-vg-prompts-chip').toggle(this.checked);
        });

        $(document).on('click', '.prompt-cat-btn', function() {
            const cat = $(this).data('cat');
            appConfig.vgPromptCategory = cat;
            $('.prompt-cat-btn').removeClass('active');
            $(this).addClass('active');
            _renderPromptList();
            _scheduleSave();
        });

        function _addCustomPrompt() {
            const val = $('#vg-custom-prompt-input').val().trim();
            if (!val) return;
            appConfig.vgCustomPrompts.push({ text: val, enabled: true });
            $('#vg-custom-prompt-input').val('');
            _renderPromptList();
            _scheduleSave();
        }

        $('#btn-add-vg-prompt').on('click', _addCustomPrompt);
        $('#vg-custom-prompt-input').on('keydown', function(e) {
            if (e.key === 'Enter') _addCustomPrompt();
        });
    })();

    // --- Thank You Screen — Video Guestbook admin settings ---
    (function initVgThankYou() {
        function _syncToggle() {
            const on = appConfig.vgThankYouEnabled;
            $('#toggle-vg-thankyou').prop('checked', on).closest('.toggle-switch').toggleClass('is-on', on);
            $('#toggle-vg-thankyou-label').text(on ? 'ON' : 'OFF');
            $('#vg-thankyou-config').toggle(on);
            // Keep this panel accessible regardless of current capture mode.
            $('#nav-vg-thankyou').show();
        }

        function _applyTyImage(file) {
            if (appConfig.vgThankYouImage) {
                URL.revokeObjectURL(appConfig.vgThankYouImage.objectUrl);
            }
            const objectUrl = URL.createObjectURL(file);
            appConfig.vgThankYouImage = { objectUrl };

            // Thumb in upload zone
            $('#ty-media-thumb-wrap').html('<img src="' + objectUrl + '" style="width:100%; height:100%; object-fit:cover;">');
            $('#ty-media-empty').hide();
            $('#ty-media-filled').show();

            // Preview frame
            $('#ty-preview-bg').attr('src', objectUrl).show();
            $('#ty-preview-frame').addClass('has-bg');
        }

        function _clearTyImage() {
            if (appConfig.vgThankYouImage) {
                URL.revokeObjectURL(appConfig.vgThankYouImage.objectUrl);
                appConfig.vgThankYouImage = null;
            }
            $('#ty-media-thumb-wrap').empty();
            $('#ty-media-filled').hide();
            $('#ty-media-empty').show();
            $('#ty-media-input').val('');
            $('#ty-preview-bg').attr('src', '').hide();
            $('#ty-preview-frame').removeClass('has-bg');
        }

        // Duration slider
        $('#setting-ty-duration').val(appConfig.vgThankYouDuration).on('input', function() {
            appConfig.vgThankYouDuration = parseInt(this.value, 10);
            $('#val-ty-duration').text(this.value);
        });
        $('#val-ty-duration').text(appConfig.vgThankYouDuration);

        // Toggle
        _syncToggle();
        $('#toggle-vg-thankyou').on('change', function() {
            appConfig.vgThankYouEnabled = this.checked;
            $('#toggle-vg-thankyou-label').text(this.checked ? 'ON' : 'OFF');
            $(this).closest('.toggle-switch').toggleClass('is-on', this.checked);
            $('#vg-thankyou-config').toggle(this.checked);
        });

        // File picker
        $('#ty-media-drop').on('click', function(e) {
            if ($(e.target).closest('#ty-media-remove, #ty-media-filled, #btn-pick-ty-media').length) return;
            document.getElementById('ty-media-input').click();
        });
        $('#ty-media-input').on('change', function() {
            const file = this.files[0];
            if (file) _applyTyImage(file);
        });
        $('#ty-media-drop').on('dragover dragenter', function(e) {
            e.preventDefault(); e.stopPropagation();
            $(this).addClass('drag-over');
        }).on('dragleave dragend drop', function(e) {
            e.preventDefault(); e.stopPropagation();
            $(this).removeClass('drag-over');
            if (e.type === 'drop') {
                const file = e.originalEvent.dataTransfer.files[0];
                if (file && file.type.startsWith('image/')) _applyTyImage(file);
            }
        });
        $('#ty-media-remove').on('click', function(e) {
            e.stopPropagation();
            _clearTyImage();
        });

    })();

    // --- Capture Review toggle — Video Guestbook ---
    (function initVgCaptureReview() {
        function _syncToggle() {
            const on = appConfig.vgCaptureReviewEnabled;
            $('#toggle-vg-capture-review').prop('checked', on).closest('.toggle-switch').toggleClass('is-on', on);
            $('#toggle-vg-capture-review-label').text(on ? 'ON' : 'OFF');
        }
        _syncToggle();
        $('#toggle-vg-capture-review').on('change', function() {
            appConfig.vgCaptureReviewEnabled = this.checked;
            $('#toggle-vg-capture-review-label').text(this.checked ? 'ON' : 'OFF');
            $(this).closest('.toggle-switch').toggleClass('is-on', this.checked);
        });
    })();

    // --- Photo Booth offer toggle — Video Guestbook ---
    (function initVgOfferPb() {
        function _syncToggle() {
            const on = appConfig.vgOfferPb;
            $('#toggle-vg-offer-pb').prop('checked', on).closest('.toggle-switch').toggleClass('is-on', on);
            $('#toggle-vg-offer-pb-label').text(on ? 'ON' : 'OFF');
            $('#photo-offer-config').toggle(on);
        }
        _syncToggle();
        $('#toggle-vg-offer-pb').on('change', function() {
            appConfig.vgOfferPb = this.checked;
            $('#toggle-vg-offer-pb-label').text(this.checked ? 'ON' : 'OFF');
            $(this).closest('.toggle-switch').toggleClass('is-on', this.checked);
            $('#photo-offer-config').toggle(this.checked);
            _scheduleSave();
        });
    })();

    // --- Photo Booth Splash Screen toggle + duration slider ---
    (function initPbSplash() {
        function _syncToggle() {
            const on = appConfig.pbSplashEnabled;
            $('#toggle-pb-splash').prop('checked', on).closest('.toggle-switch').toggleClass('is-on', on);
            $('#toggle-pb-splash-label').text(on ? 'ON' : 'OFF');
            $('#pb-splash-config').toggle(on);
        }
        _syncToggle();
        $('#toggle-pb-splash').on('change', function() {
            appConfig.pbSplashEnabled = this.checked;
            $('#toggle-pb-splash-label').text(this.checked ? 'ON' : 'OFF');
            $(this).closest('.toggle-switch').toggleClass('is-on', this.checked);
            $('#pb-splash-config').toggle(this.checked);
            _scheduleSave();
        });
        $('#setting-pb-splash-duration').val(appConfig.pbSplashDuration).on('input', function() {
            appConfig.pbSplashDuration = parseInt(this.value, 10);
            $('#val-pb-splash-duration').text(this.value);
            _scheduleSave();
        });
        $('#val-pb-splash-duration').text(appConfig.pbSplashDuration);
    })();

    // Opens the disclaimer modal; resolves true (accepted) or false (rejected)
    function showDisclaimerDialog(header, text, org) {
        return new Promise(resolve => {
            const rendered = _renderDisclaimerText(text, org);
            $('#disclaimer-modal-title').text(header || 'Do you agree with the terms?');
            // Convert newlines to paragraphs
            const html = rendered.split(/\n\n+/).map(p => `<p>${$('<div>').text(p.trim()).html()}</p>`).join('');
            $('#disclaimer-modal-body').html(html);
            $('#disclaimer-overlay').css('display', 'flex');

            function cleanup() {
                $('#disclaimer-overlay').hide();
                $('#btn-disclaimer-accept, #btn-disclaimer-reject').off('click.disc');
            }
            $('#btn-disclaimer-accept').one('click.disc', function() { cleanup(); resolve(true); });
            $('#btn-disclaimer-reject').one('click.disc', function() { cleanup(); resolve(false); });
        });
    }

    // Keep template preview synced when layout changes
    $('input[name="layout"]').on('change', function() {
        updateTemplateSizeHint();
    });
    updateTemplateSizeHint();

    // --- Photo Template Image Upload ---
    async function loadImageFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => {
                const img = new Image();
                img.onload  = () => resolve(img);
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async function applyBgImage(file) {
        try {
            const img = await loadImageFromFile(file);
            appConfig.templateBg = img;
            $('#bg-thumb').attr('src', img.src);
            $('#bg-filename').text(file.name);
            $('#bg-dims').text(img.naturalWidth + ' × ' + img.naturalHeight + ' px');
            $('#bg-empty-state').hide();
            $('#bg-preview-state').show();
            drawTemplatePreview();
        } catch(e) { console.error('Failed to load background image', e); }
    }

    $('#bg-empty-state').on('click', function(e) {
        if (!$(e.target).closest('button, label').length) $('#upload-template-bg').click();
    });
    $('#upload-template-bg').on('change', async function() {
        if (this.files[0]) await applyBgImage(this.files[0]);
        this.value = '';
    });
    $('#btn-clear-bg').on('click', function() {
        appConfig.templateBg = null;
        $('#bg-preview-state').hide();
        $('#bg-empty-state').show();
        drawTemplatePreview();
    });

    // Drag-and-drop on background upload zone
    const bgZone = document.getElementById('bg-upload-zone');
    if (bgZone) {
        bgZone.addEventListener('dragover', e => { e.preventDefault(); bgZone.classList.add('drag-over'); });
        bgZone.addEventListener('dragleave', () => bgZone.classList.remove('drag-over'));
        bgZone.addEventListener('drop', async e => {
            e.preventDefault();
            bgZone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (!file || !file.type.match(/image\/(jpeg|png)/)) return;
            await applyBgImage(file);
        });
    }

    // =====================================================================
    // GOOGLE DRIVE — handled by window.PB.drive (src/lib/drive)
    // =====================================================================
    // The unified DriveClient owns OAuth, folder caching, upload retry,
    // bounded concurrency, and an IndexedDB-backed offline queue.
    // The UI handlers below thinly wrap that client.

    // (Folder/event/session-folder management lives in window.PB.drive.)

    // ─── DRIVE UI HANDLERS ────────────────────────────────────────────────────
    // Folder/event/session creation, OAuth, retry, offline queue all live in
    // window.PB.drive (src/lib/drive). The handlers here just wire DOM inputs
    // to that client and update the local status banner.

    function _vgDriveSetStatus(msg, isErr = false) {
        const el = document.getElementById('vg-drive-auth-status');
        if (el) { el.innerHTML = msg; el.style.color = isErr ? '#dc2626' : '#6b7280'; }
    }

    $('#vg-drive-folder-name').on('input', function() {
        appConfig.vgDriveFolderName = this.value.trim() || 'Video Guestbook Captures';
        window.PB.drive.invalidateFolders('video-guestbook');
    });

    $('#vg-drive-client-id').on('input', function() {
        appConfig.vgDriveClientId = this.value.trim();
        window.PB.drive.signOut();
    });

    $('#btn-vg-drive-signin').on('click', async function() {
        const btn = $(this);
        btn.prop('disabled', true).text('Signing in…');
        _vgDriveSetStatus('');
        try {
            await window.PB.drive.getToken({ forcePrompt: true });
            _vgDriveSetStatus('<i class="fa-solid fa-check"></i> Connected — captures will upload automatically', false);
            btn.hide();
            $('#btn-vg-drive-signout').show();
            // Best-effort: flush any uploads that queued offline last session.
            window.PB.drive.flushQueue().catch(() => {});
        } catch (e) {
            _vgDriveSetStatus('Sign-in failed: ' + e.message, true);
        } finally {
            btn.prop('disabled', false).text('Sign in with Google');
        }
    });

    $('#btn-vg-drive-signout').on('click', function() {
        window.PB.drive.signOut();
        $(this).hide();
        $('#btn-vg-drive-signin').show();
        _vgDriveSetStatus('Signed out', false);
    });

    // ─── PB CAMERA SELECTION + TEST PREVIEW ──────────────────────────────────
    // Enumeration, preview lifecycle, USB-prefer heuristic all live in
    // window.PB.devices.

    $('#camera-select').on('change', function() {
        appConfig.selectedCameraId = this.value;
    });

    $('#btn-test-camera').on('click', () => window.PB.devices.toggleCameraTest('pb'));
    $('#btn-stop-camera-test').on('click', () => window.PB.devices.stopCameraTest('pb'));

    // --- Video Guestbook Settings ---
    $('#setting-vg-duration').on('input', function() {
        appConfig.vgMaxDuration = parseInt(this.value, 10);
        $('#val-vg-duration').text(this.value);
    });
    $('#setting-vg-countdown').on('input', function() {
        appConfig.vgCountdown = parseInt(this.value, 10);
        $('#val-vg-countdown').text(this.value);
    });
    $('#setting-vg-prompt').on('input', function() {
        appConfig.vgPromptText = this.value;
    });

    // ─── VG CAMERA SELECTION + TEST PREVIEW ──────────────────────────────────
    $('#vg-camera-select').on('change', function() {
        appConfig.vgSelectedCameraId = this.value;
    });

    $('#btn-refresh-vg-cameras').on('click', function() {
        const btn = $(this);
        btn.prop('disabled', true).text('Refreshing…');
        window.PB.devices.populateCameraList('vg').finally(() => btn.prop('disabled', false).text('↺ Refresh'));
    });

    $('#btn-test-vg-camera').on('click', () => window.PB.devices.toggleCameraTest('vg'));
    $('#btn-stop-vg-camera-test').on('click', () => window.PB.devices.stopCameraTest('vg'));

    // ─── VG AUDIO DEVICE SELECTION (mic + speaker) ───────────────────────────

    $('#vg-mic-select').on('change', function() {
        appConfig.vgSelectedMicId = this.value;
        _scheduleSave();
    });

    $('#vg-speaker-select').on('change', function() {
        appConfig.vgSelectedSpeakerId = this.value;
        _scheduleSave();
    });

    $('#btn-refresh-vg-audio').on('click', function() {
        const btn = $(this);
        btn.prop('disabled', true).text('Refreshing…');
        window.PB.devices.populateAudioDeviceList().finally(() => btn.prop('disabled', false).text('↺ Refresh'));
    });

    // --- VG Storage — checkbox toggles (both local + drive can be active) ---
    $('#chk-vg-save-local').on('change', function() {
        appConfig.vgSaveLocal = this.checked;
        if (this.checked) {
            $('#vg-local-folder-config').slideDown();
        } else {
            $('#vg-local-folder-config').slideUp();
        }
    });

    $('#chk-vg-save-drive').on('change', function() {
        appConfig.vgSaveDrive = this.checked;
        if (this.checked) {
            $('#vg-drive-config').slideDown();
        } else {
            $('#vg-drive-config').slideUp();
        }
        _updateEventNameWarnings();
    });

    $('#btn-vg-select-dir').on('click', async function() {
        try {
            if (!window.showDirectoryPicker) {
                alert("Your browser does not support seamless folder saving. Files will be saved via standard downloads.");
                return;
            }
            directoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            $('#vg-dir-status').text(`Saving to: /${directoryHandle.name}`);
        } catch (err) {
            console.log("Directory picker cancelled or failed.", err);
        }
    });

    // Populate VG camera and audio device lists on load
    window.PB.devices.populateCameraList('vg');
    window.PB.devices.populateAudioDeviceList();

    // --- Advanced nav visibility ---
    function updateAdvancedNavForMode(mode) {
        $('#nav-photo-layout, #nav-template, #nav-video-overlay, #nav-vg-thankyou, #nav-vg-prompts').show();
    }

    // --- Video Overlay upload ---
    // The #btn-pick-vg-overlay label already opens the file picker natively (safe on mobile).
    // The drop-zone click handler only fires when clicking elsewhere on the drop zone.
    $('#vg-overlay-drop').on('click', function(e) {
        // Let label, remove button, and thumb handle themselves
        if ($(e.target).closest('#btn-pick-vg-overlay, #vg-overlay-remove').length) return;
        $('#vg-overlay-input').trigger('click');
    });

    $('#vg-overlay-input').on('change', function() {
        const file = this.files[0];
        this.value = '';
        if (!file) return;
        if (file.type !== 'image/png') {
            _showOverlayError('Please select a PNG file.');
            return;
        }
        const url = URL.createObjectURL(file);
        const testImg = new Image();
        testImg.onload = function() {
            if (testImg.naturalWidth !== 1920 || testImg.naturalHeight !== 1080) {
                URL.revokeObjectURL(url);
                _showOverlayError(`Image must be exactly 1920 × 1080 px (yours is ${testImg.naturalWidth} × ${testImg.naturalHeight} px).`);
                return;
            }
            _applyVgOverlay(url, file.name, testImg);
        };
        testImg.onerror = function() {
            URL.revokeObjectURL(url);
            _showOverlayError('Could not read the image. Please try another file.');
        };
        testImg.src = url;
    });

    // Drag-and-drop on overlay drop zone
    $('#vg-overlay-drop').on('dragover', function(e) { e.preventDefault(); $(this).addClass('drag-over'); });
    $('#vg-overlay-drop').on('dragleave drop', function(e) { e.preventDefault(); $(this).removeClass('drag-over'); });
    $('#vg-overlay-drop').on('drop', function(e) {
        const file = e.originalEvent.dataTransfer.files[0];
        if (!file) return;
        $('#vg-overlay-input')[0].files;  // clear
        // Reuse input change logic via synthetic assignment
        const dt = new DataTransfer();
        dt.items.add(file);
        const inp = document.getElementById('vg-overlay-input');
        inp.files = dt.files;
        $(inp).trigger('change');
    });

    $('#vg-overlay-remove').on('click', function(e) {
        e.stopPropagation();
        if (appConfig.vgOverlay) {
            URL.revokeObjectURL(appConfig.vgOverlay.objectUrl);
            appConfig.vgOverlay = null;
        }
        $('#vg-overlay-filled').hide();
        $('#vg-overlay-empty').show();
        $('#vg-overlay-thumb').attr('src', '');
        $('#vg-overlay-live').hide().attr('src', '');
        _clearOverlayError();
    });

    function _applyVgOverlay(url, filename, img) {
        if (appConfig.vgOverlay) URL.revokeObjectURL(appConfig.vgOverlay.objectUrl);
        appConfig.vgOverlay = { objectUrl: url, img };
        $('#vg-overlay-thumb').attr('src', url);
        $('#vg-overlay-filename').text(filename);
        $('#vg-overlay-empty').hide();
        $('#vg-overlay-filled').show();
        _clearOverlayError();
    }

    function _showOverlayError(msg) {
        $('#vg-overlay-error').text(msg).show();
    }
    function _clearOverlayError() {
        $('#vg-overlay-error').hide().text('');
    }

    $('#btn-refresh-cameras').on('click', function() {
        const btn = $(this);
        btn.prop('disabled', true).text('Refreshing…');
        window.PB.devices.populateCameraList('pb').finally(() => btn.prop('disabled', false).text('↺ Refresh'));
    });

    // Populate on load (non-blocking)
    window.PB.devices.populateCameraList('pb');

    // --- Launch Kiosk ---
    // Mobile duplicate button delegates to the main launch button
    $('#btn-launch-booth-mobile').on('click', function() { $('#btn-launch-booth').trigger('click'); });

    $('#btn-launch-booth').on('click', async function() {
        appConfig.layout = $('input[name="layout"]:checked').val();
        const launchBtn = $(this);
        launchBtn.prop('disabled', true).text('Initializing Hardware...');
        window.PB.devices.stopAllCameraTests(); // release any preview streams before launching

        try {
        // ── getUserMedia path ─────────────────────────────────────────────
            // Build video constraints: specific device takes priority.
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
                const videoConstraints = { width: { ideal: 1920 }, height: { ideal: 1080 } };
                if (appConfig.selectedCameraId) {
                    videoConstraints.deviceId = { exact: appConfig.selectedCameraId };
                }
                currentStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
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
            
        } catch (err) {
            console.error("Camera error:", err);
            let hint = '';
            if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                hint = 'The selected camera was not found. Unplug and replug the USB cable, then tap Refresh in Camera Settings.';
            } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                hint = 'Camera permission was denied. Grant camera access in your browser settings, then try again.';
            } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
                hint = 'The camera is in use by another app, or the USB connection dropped. Unplug and replug, close other camera apps, then try again.';
            } else {
                hint = err.message;
            }
            $('#camera-error-title').text('Camera error: ' + err.name);
            $('#camera-error-msg').text(hint);
            $('#camera-error-card').slideDown(200);
        } finally {
            launchBtn.prop('disabled', false).html('<i class="fa-solid fa-rocket"></i> Launch Kiosk Mode');
        }
    });

    // --- Camera error card dismiss ---
    $('#btn-camera-error-close').on('click', function() {
        $('#camera-error-card').slideUp(200);
    });

    // --- Kiosk PIN admin form ---
    // Three fields: Current (only if a PIN already exists), New, Confirm. Apply
    // button verifies the current PIN (when required), checks the new one
    // matches the confirm, then hashes (PBKDF2 via window.PB.security) and
    // saves. Raw PINs never persist in appConfig or localStorage.

    function _hasKioskPin() {
        return !!appConfig.kioskPin && appConfig.kioskPinLen > 0;
    }

    function _renderPinAdminForm() {
        $('#kiosk-pin-current-row').toggle(_hasKioskPin());
        $('#kiosk-pin-status').html(_hasKioskPin()
            ? '<i class="fa-solid fa-lock"></i> PIN set'
            : 'No PIN — exit without prompt');
        // Button label reflects intent: "Remove PIN" when clearing, "Update"
        // when replacing, "Set PIN" when creating fresh.
        const newRaw = String($('#kiosk-pin-new').val() || '').trim();
        let label;
        if (_hasKioskPin()) {
            label = newRaw === '' ? 'Remove PIN' : 'Update PIN';
        } else {
            label = 'Set PIN';
        }
        $('#btn-kiosk-pin-apply').text(label);
        $('#kiosk-pin-new-label').text(_hasKioskPin() ? 'New PIN' : 'PIN');
    }

    function _setPinFeedback(msg, kind) {
        const color = kind === 'error' ? '#dc2626' : kind === 'ok' ? '#16a34a' : '#6b7280';
        $('#kiosk-pin-feedback').css('color', color).text(msg || '');
    }

    function _clearPinAdminFields() {
        $('#kiosk-pin-current').val('');
        $('#kiosk-pin-new').val('');
        $('#kiosk-pin-confirm').val('');
    }

    // Restrict all three PIN fields to digits only (including pasted content;
    // `inputmode="numeric"` only hints the mobile keyboard, it doesn't enforce).
    function _sanitizeNumericInput(el) {
        const cleaned = el.value.replace(/\D/g, '');
        if (cleaned !== el.value) el.value = cleaned;
    }
    $('#kiosk-pin-current, #kiosk-pin-confirm').on('input', function() {
        _sanitizeNumericInput(this);
    });
    // The New field also drives the button label.
    $('#kiosk-pin-new').on('input', function() {
        _sanitizeNumericInput(this);
        _renderPinAdminForm();
    });

    $('#btn-kiosk-pin-apply').on('click', async function() {
        const btn = $(this);
        const currentRaw = String($('#kiosk-pin-current').val() || '').trim();
        const newRaw     = String($('#kiosk-pin-new').val()     || '').trim();
        const confirmRaw = String($('#kiosk-pin-confirm').val() || '').trim();

        // Validate new PIN (allow empty = remove).
        if (newRaw !== '' && !/^\d{4,8}$/.test(newRaw)) {
            _setPinFeedback('New PIN must be 4–8 digits.', 'error');
            return;
        }
        if (newRaw !== confirmRaw) {
            _setPinFeedback('New PIN and confirmation do not match.', 'error');
            return;
        }

        const hadPinBefore = _hasKioskPin();
        btn.prop('disabled', true);
        _setPinFeedback('Verifying…', 'info');
        try {
            // When a PIN already exists, verify the current one first.
            if (hadPinBefore) {
                if (!currentRaw) {
                    _setPinFeedback('Enter the current PIN to change it.', 'error');
                    return;
                }
                const result = await window.PB.security.verifyPin(currentRaw, appConfig.kioskPin);
                if (!result.ok) {
                    _setPinFeedback('Current PIN is incorrect.', 'error');
                    return;
                }
                // If the existing hash was legacy SHA-256, the verify call
                // already returned a PBKDF2 hash for us — but we're about to
                // overwrite it with hashPin(newRaw) anyway, so the migration
                // is moot in this branch. We still log it for parity.
                if (result.upgradedHash) {
                    console.info('[Security] Legacy SHA-256 hash detected during PIN change');
                }
            }

            // Apply the new PIN (or clear it).
            appConfig.kioskPin    = await window.PB.security.hashPin(newRaw);
            appConfig.kioskPinLen = newRaw.length;
            saveConfig();
            _clearPinAdminFields();
            _renderPinAdminForm();
            _setPinFeedback(
                newRaw === '' ? 'PIN removed.' : (hadPinBefore ? 'PIN updated.' : 'PIN set.'),
                'ok',
            );
        } finally {
            btn.prop('disabled', false);
        }
    });

    // --- PIN modal logic ---
    let _pinBuffer = '';

    function _renderPinDisplay() {
        const len = _pinBuffer.length;
        const max = Math.max(len, 4);
        $('#pin-display').text(Array.from({ length: max }, (_, i) => i < len ? '●' : '–').join(''));
    }

    function _showPinModal() {
        _pinBuffer = '';
        _renderPinDisplay();
        $('#pin-error').hide();
        $('#pin-overlay').css('display', 'flex');
    }

    function _hidePinModal() {
        $('#pin-overlay').hide();
    }

    // (Fullscreen helpers live in window.PB.security.)

    function _doExitKiosk() {
        stopVgRecordingIfActive();
        if (currentStream) { currentStream.getTracks().forEach(track => track.stop()); currentStream = null; }
        window.PB.audio.teardownSinkBeep();
        window.PB.security.exitFullscreen();
        $('#kiosk-mode').hide();
        $('#vg-booth').hide();
        $('#live-booth').hide();
        $('#admin-dashboard').fadeIn(400);
    }

    $('#btn-exit-kiosk').on('click', function() {
        if (appConfig.kioskPin && appConfig.kioskPinLen > 0) {
            _showPinModal();
        } else {
            _doExitKiosk();
        }
    });

    $('#btn-pin-cancel').on('click', _hidePinModal);

    $('#btn-pin-del').on('click', function() {
        _pinBuffer = _pinBuffer.slice(0, -1);
        _renderPinDisplay();
        $('#pin-error').hide();
    });

    // Compare entered digits against stored hash once enough digits entered.
    // verifyPin handles both PBKDF2 and legacy SHA-256, and returns an upgraded
    // hash on a legacy match so we can transparently migrate the storage.
    $(document).on('click', '.pin-key[data-k]', async function() {
        if (_pinBuffer.length >= 8) return;
        _pinBuffer += $(this).data('k').toString();
        _renderPinDisplay();
        $('#pin-error').hide();
        if (_pinBuffer.length >= appConfig.kioskPinLen && appConfig.kioskPinLen > 0) {
            const result = await window.PB.security.verifyPin(_pinBuffer, appConfig.kioskPin);
            if (result.ok) {
                if (result.upgradedHash) {
                    appConfig.kioskPin = result.upgradedHash;
                    saveConfig();
                    console.info('[Security] PIN hash migrated from SHA-256 to PBKDF2');
                }
                _hidePinModal();
                _doExitKiosk();
            } else {
                $('#pin-error').show();
                _pinBuffer = '';
                _renderPinDisplay();
            }
        }
    });

    // --- Kiosk Logic (PhotoBooth) ---
    $('#btn-start-session').on('click', async function() {
        if (appConfig.disclaimerEnabled) {
            const accepted = await showDisclaimerDialog(
                appConfig.disclaimerHeader,
                appConfig.disclaimerText,
                appConfig.disclaimerOrg
            );
            if (!accepted) return; // session forfeited — do nothing, no saves
        }
        $('#guest-welcome').addClass('hidden');
        setTimeout(triggerCaptureSequence, 500);
    });

    // --- Kiosk Logic (Video Guestbook) ---
    $('#btn-start-vg-session').on('click', async function() {
        if (appConfig.disclaimerEnabled) {
            const accepted = await showDisclaimerDialog(
                appConfig.disclaimerHeader,
                appConfig.disclaimerText,
                appConfig.disclaimerOrg
            );
            if (!accepted) return; // session forfeited — do nothing, no saves
        }
        $('#guest-welcome').addClass('hidden');
        setTimeout(triggerVgSequence, 500);
    });

    // Prompts preview modal
    $('#btn-show-prompts-preview').on('click', function(e) {
        e.stopPropagation();
        const disabled = appConfig.vgDisabledTemplatePrompts;
        const prompts = [
            ...(PROMPT_TEMPLATES[appConfig.vgPromptCategory] || []).filter(function(q) { return disabled.indexOf(q) === -1; }),
            ...appConfig.vgCustomPrompts.filter(function(p) { return p.enabled; }).map(function(p) { return p.text; })
        ];
        const $list = $('#prompts-preview-list').empty();
        prompts.forEach(function(q) {
            $list.append($('<div class="prompt-preview-item">').text(q));
        });
        $('#prompts-preview-modal').css('display', 'flex');
    });

    $('#btn-close-prompts-preview').on('click', function() {
        $('#prompts-preview-modal').hide();
    });

    $('#prompts-preview-modal').on('click', function(e) {
        if ($(e.target).is('#prompts-preview-modal')) {
            $(this).hide();
        }
    });

    // Tap anywhere on the welcome screen to start (not just the small button)
    $('#guest-welcome').on('click', function(e) {
        if ($(e.target).closest('#btn-exit-kiosk, #btn-start-session, #btn-start-vg-session, #btn-show-prompts-preview, .welcome-vg-panel').length) return;
        if (appConfig.captureMode === 'videoguestbook') {
            $('#btn-start-vg-session').trigger('click');
        } else {
            $('#btn-start-session').trigger('click');
        }
    });

    // Lock scroll/pinch-zoom inside kiosk (prevents accidental browser gestures)
    document.getElementById('kiosk-mode').addEventListener('touchmove', function(e) {
        e.preventDefault();
    }, { passive: false });

    // If fullscreen is exited while kiosk is active (e.g. Escape key), treat it as Exit button press
    document.addEventListener('fullscreenchange', function() {
        if (!document.fullscreenElement && $('#kiosk-mode').is(':visible')) {
            if (appConfig.kioskPin && appConfig.kioskPinLen > 0) {
                _showPinModal();
            } else {
                _doExitKiosk();
            }
        }
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

    function _getVgPanelSubtitle() {
        const name = (appConfig.vgCoupleName || '').trim();
        if (name) return 'Answer just a few questions on video for ' + name + '.';
        return appConfig.vgPromptText || 'Share a message for the happy couple!';
    }

    function resetToWelcomeScreen() {
        // Hide capture screens
        $('#photo-canvas').hide();
        // Show the camera feed element
        $('#camera-feed').show();
        $('#processing-overlay').hide();
        $('#live-booth').hide();
        $('#vg-booth').hide();

        // Show the correct layout for the active mode
        const isVg = appConfig.captureMode === 'videoguestbook';
        $('#welcome-photo-content, #welcome-photo-action').toggle(!isVg);
        $('#btn-start-session').toggle(!isVg);
        if (isVg) {
            $('#welcome-vg-panel').css('display', 'flex');
            $('#live-ws-title-vg').text(appConfig.vgPanelTitle || 'Raise a Toast!');
            $('#live-ws-subtitle-vg').text(_getVgPanelSubtitle());
            $('#btn-show-prompts-preview').toggle(!!appConfig.vgPromptsEnabled);
        } else {
            $('#welcome-vg-panel').hide();
            $('#live-ws-subtitle').text(appConfig.welcomeSubtitle || $('#edit-subtitle').val());
        }

        // Show recent captures button if there are any captures
        const totalCaptures = capturedPhotos.length + capturedVideos.length;
        $('#btn-recent-captures').toggle(totalCaptures > 0);

        $('#guest-welcome').removeClass('hidden');
        // Resume welcome video if it was paused
        const kv = $('#ws-video-bg')[0];
        if (kv && appConfig.welcomeMedia && appConfig.welcomeMedia.type === 'video' && kv.paused) {
            kv.play();
        }

        // Release camera + mic for VG mode so the OS indicator light goes off
        // while the kiosk is idle.  The stream is re-acquired per session inside
        // triggerVgSequence().
        if (isVg) {
            _releaseVgStream();
        }
    }

    // ==================== RECENT CAPTURES KIOSK MODAL ====================
    (function initRecentCapturesModal() {
        let _rcmItems = []; // [{type:'photo'|'video', src:string}]
        let _rcmIdx   = 0;

        function _buildItems() {
            _rcmItems = [];
            capturedPhotos.forEach(function(src) { _rcmItems.push({ type: 'photo', src: src }); });
            capturedVideos.forEach(function(src) { _rcmItems.push({ type: 'video', src: src }); });
        }

        function _openModal() {
            _buildItems();
            const $modal = $('#recent-captures-modal');
            const $grid  = $('#rcm-grid').empty();
            const $empty = $('#rcm-empty');
            if (_rcmItems.length === 0) {
                $empty.css('display', 'flex');
                $grid.hide();
            } else {
                $empty.hide();
                $grid.show();
                _rcmItems.forEach(function(item, idx) {
                    if (item.type === 'photo') {
                        const $card = $('<div class="rcm-card" data-idx="' + idx + '"><img src="' + item.src + '" alt=""><div class="rcm-badge"><i class="fa-solid fa-camera"></i></div></div>');
                        $grid.append($card);
                    } else {
                        const $card = $('<div class="rcm-card rcm-card-video" data-idx="' + idx + '"><video src="' + item.src + '" muted playsinline preload="metadata"></video><div class="rcm-badge"><i class="fa-solid fa-clapperboard"></i></div><div class="rcm-play-icon"><i class="fa-solid fa-play"></i></div></div>');
                        $grid.append($card);
                        // Seek to a frame for thumbnail
                        const vid = $card.find('video')[0];
                        vid.addEventListener('loadedmetadata', function() { vid.currentTime = Math.min(0.5, vid.duration * 0.1); }, { once: true });
                    }
                });
            }
            $modal.css('display', 'flex');
        }

        function _openLightbox(idx) {
            _rcmIdx = idx;
            _renderLightbox();
            $('#rcm-lightbox').css('display', 'flex');
        }

        function _renderLightbox() {
            const item = _rcmItems[_rcmIdx];
            if (!item) return;
            const $img   = $('#rcm-lb-img');
            const $video = $('#rcm-lb-video');
            if (item.type === 'photo') {
                $video.hide().attr('src', '')[0].pause();
                $img.attr('src', item.src).show();
            } else {
                $img.hide().attr('src', '');
                $video.attr('src', item.src).show()[0].play();
            }
            $('#rcm-lb-counter').text((_rcmIdx + 1) + ' / ' + _rcmItems.length);
            $('#btn-rcm-lb-prev').toggle(_rcmIdx > 0);
            $('#btn-rcm-lb-next').toggle(_rcmIdx < _rcmItems.length - 1);
        }

        function _closeLightbox() {
            $('#rcm-lb-video')[0].pause();
            $('#rcm-lightbox').hide();
        }

        // Event bindings
        $('#btn-recent-captures').on('click', function(e) {
            e.stopPropagation();
            _openModal();
        });

        $('#btn-close-rcm').on('click', function() {
            _closeLightbox();
            $('#recent-captures-modal').hide();
        });

        $(document).on('click', '.rcm-card', function() {
            _openLightbox(parseInt($(this).data('idx'), 10));
        });

        $('#btn-rcm-lb-close').on('click', _closeLightbox);

        $('#btn-rcm-lb-prev').on('click', function() {
            if (_rcmIdx > 0) { _rcmIdx--; _renderLightbox(); }
        });

        $('#btn-rcm-lb-next').on('click', function() {
            if (_rcmIdx < _rcmItems.length - 1) { _rcmIdx++; _renderLightbox(); }
        });
    })();

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
                    ? 'You\'ve got <strong>1 shot</strong> — make it amazing! Strike your best pose and have fun! 🤩'
                    : 'You\'ll take <strong>' + photoCount + ' photos</strong> — warm up, get creative, and show us your best side! ✨';
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
            for (let i = 0; i < photoSlots.length; i++) {
                let waitTime = (i === 0) ? appConfig.countdownFirst : appConfig.countdownOthers;
                await runCountdown(waitTime);
                triggerFlash();
                await new Promise(r => setTimeout(r, 150)); // let flash peak before capture
                const slot = photoSlots[i];
                await drawPhoto(stripCtx, video, slot.x, slot.y, slot.w, slot.h);
            }

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
            const _disabled = appConfig.vgDisabledTemplatePrompts;
            const _prompts = [
                ...(PROMPT_TEMPLATES[appConfig.vgPromptCategory] || []).filter(function(q) { return _disabled.indexOf(q) === -1; }),
                ...appConfig.vgCustomPrompts.filter(function(p) { return p.enabled; }).map(function(p) { return p.text; })
            ];
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

    async function saveVgVideo(blob, ext) {
        // Stop canvas compositing if it was active
        if (_vgFrameAnimId) { cancelAnimationFrame(_vgFrameAnimId); _vgFrameAnimId = null; }

        // Same generator as the photo path, with a guestbook-flavoured prefix
        // when no event name is configured.
        const prefix = appConfig.eventName || 'guestbook';
        const filename = window.PB.capture.makeFilename(prefix, ext);

        // Keep a blob URL in memory for gallery playback (intentionally not revoked)
        const galleryBlobUrl = URL.createObjectURL(blob);
        capturedVideos.unshift(galleryBlobUrl);
        capturedVideoDriveLinks.unshift(null); // will be updated after Drive upload completes
        _evictOldCaptures();
        updateDashboardGallery();
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
                    capturedVideoDriveLinks[0] = currentSessionFolderLink;
                    _appendGalleryQrBtn(0, 'video', currentSessionFolderLink);
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
                if (currentStream) {
                    // VG may include microphone audio; disable it before PB capture.
                    const videoTracks = currentStream.getVideoTracks().filter(t => t.readyState === 'live');
                    const audioTracks = currentStream.getAudioTracks();
                    audioTracks.forEach(track => {
                        try { track.stop(); } catch (e) {}
                    });
                    if (videoTracks.length > 0) {
                        currentStream = new MediaStream(videoTracks);
                    }
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

    function showVgPbOffer() {
        return new Promise(function(resolve) {
            const overlay     = document.getElementById('vg-pb-offer');
            const yesBtn      = document.getElementById('btn-vg-pbo-yes');
            const noBtn       = document.getElementById('btn-vg-pbo-no');
            const ring        = document.getElementById('vg-pbo-ring-progress');
            const secsEl      = document.getElementById('vg-pbo-secs');
            const SECS        = 15;
            let remaining     = SECS;

            // Frozen-frame backdrop: draw the last live frame from the VG video
            // element into a canvas so the offer has the guest's own moment
            // (blurred + vignetted) behind it instead of flat black.
            _paintVgPbOfferBackdrop();

            // Reset ring + label to initial state.
            if (ring) {
                ring.style.transition = 'none';
                ring.style.strokeDashoffset = '0';
                // Force layout flush so the transition reset applies before we
                // re-enable the transition for the drain animation.
                void ring.getBoundingClientRect();
                ring.style.transition = 'stroke-dashoffset 1s linear';
            }
            if (secsEl) secsEl.textContent = String(remaining);
            overlay.style.display = 'flex';

            const timer = setInterval(function() {
                remaining--;
                const drained = ((SECS - remaining) / SECS) * 100;
                if (ring) ring.style.strokeDashoffset = String(drained);
                if (secsEl) secsEl.textContent = String(Math.max(0, remaining));
                if (remaining <= 0) finish(false);
            }, 1000);

            function finish(accepted) {
                clearInterval(timer);
                overlay.style.display = 'none';
                yesBtn.removeEventListener('click', onYes);
                noBtn.removeEventListener('click', onNo);
                resolve(accepted);
            }

            function onYes() { finish(true);  }
            function onNo()  { finish(false); }

            yesBtn.addEventListener('click', onYes);
            noBtn.addEventListener('click', onNo);
        });
    }

    // Draw the current frame of the VG video element to the offer's backdrop
    // canvas. Called at offer-show time, when the live stream is still active.
    // Best-effort: if the video isn't ready, the canvas stays blank and the
    // overlay falls back to its dark background.
    function _paintVgPbOfferBackdrop() {
        const canvas = document.getElementById('vg-pbo-bg-canvas');
        const videoEl = document.getElementById('vg-camera-feed');
        if (!canvas || !videoEl) return;
        const vw = videoEl.videoWidth;
        const vh = videoEl.videoHeight;
        if (!vw || !vh) return;
        canvas.width = vw;
        canvas.height = vh;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        try {
            // Mirror to match the viewfinder orientation guests saw.
            ctx.save();
            ctx.translate(vw, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(videoEl, 0, 0, vw, vh);
            ctx.restore();
        } catch (e) {
            console.warn('[PB-Offer] backdrop draw failed:', e && e.message);
        }
    }

    // Consolidated post-capture Done screen. Replaces the legacy three-overlay
    // chain (Drive-QR-ask → Drive-QR-show → ThankYou). Caller decides whether
    // to show it via the wantsDoneScreen check; this function then renders
    // whichever sections apply (headline, QR card, both, or just the action
    // button) and auto-dismisses via a draining ring countdown.
    // Two-phase post-capture screen:
    //   Phase A (when Drive QR is configured): QR card + "All done" button
    //     (no draining ring). Guest taps All done OR a 90s safety timeout
    //     fires → QR card fades out → Phase B begins.
    //   Phase B (always, when reached): bg image (or dark) + All-done button
    //     with a visible ring counting down vgThankYouDuration. Guest can
    //     tap to advance early; otherwise the ring drains to welcome.
    function showVgDoneScreen() {
        return new Promise(function(resolve) {
            const overlay      = document.getElementById('vg-done-screen');
            const bgImg        = document.getElementById('vg-done-bg-img');
            const qrCard       = document.getElementById('vg-done-qr-card');
            const qrTarget     = document.getElementById('vg-done-qr-image');
            const qrLinkEl     = document.getElementById('vg-done-qr-link');
            const doneBtn      = document.getElementById('btn-vg-done');
            const doneTimerEl  = doneBtn ? doneBtn.querySelector('.vg-pbo-no-timer') : null;
            const ring         = document.getElementById('vg-done-ring-progress');
            const secsEl       = document.getElementById('vg-done-secs');

            const showQr = !!appConfig.vgSaveDrive && window.PB.drive.isSignedIn();
            const TY_SECS = Math.max(2, appConfig.vgThankYouDuration || 5);
            const QR_SAFETY_MS = 90000; // safety timeout in case guest walks away
            let qrPhaseTimeoutId = null;
            let tyTimerId        = null;
            let tyTickId         = null;
            let qrPollId         = null;
            let resolved         = false;

            // Configured background image (if any).
            if (appConfig.vgThankYouImage) {
                bgImg.src = appConfig.vgThankYouImage.objectUrl;
                overlay.classList.add('has-bg-image');
            } else {
                bgImg.src = '';
                overlay.classList.remove('has-bg-image');
            }

            // Reset button visibility from any prior session.
            doneBtn.style.display = '';
            doneBtn.style.opacity = '';
            doneBtn.style.transition = '';

            overlay.style.display = 'flex';

            if (showQr) {
                // ─── Phase A: QR modal ─────────────────────────────────────
                qrCard.classList.remove('is-ready');
                qrTarget.innerHTML = '';
                qrLinkEl.textContent = '';
                qrCard.style.display = 'flex';
                // Re-trigger the entrance animation by force-reflowing.
                qrCard.style.animation = 'none';
                void qrCard.offsetWidth;
                qrCard.style.animation = '';
                // All-done is visible from the start; ring is hidden during
                // Phase A so the guest isn't pressured to scan against a clock.
                if (doneTimerEl) doneTimerEl.style.display = 'none';
                _waitForLinkAndShowQr();

                qrPhaseTimeoutId = setTimeout(_endQrPhase, QR_SAFETY_MS);
                doneBtn.addEventListener('click', _endQrPhase, { once: true });
            } else {
                // No QR — go straight to Phase B with the ring countdown.
                qrCard.style.display = 'none';
                if (doneTimerEl) doneTimerEl.style.display = '';
                _startThankYouPhase();
            }

            function _endQrPhase() {
                clearTimeout(qrPhaseTimeoutId);
                qrPhaseTimeoutId = null;
                doneBtn.removeEventListener('click', _endQrPhase);
                if (qrPollId) {
                    clearTimeout(qrPollId);
                    qrPollId = null;
                }
                // Fade only the QR card; keep the All-done button visible so
                // the guest can still dismiss during the thank-you pause.
                qrCard.style.transition = 'opacity 250ms ease-out';
                qrCard.style.opacity = '0';
                setTimeout(function() {
                    qrCard.style.display = 'none';
                    qrCard.style.opacity = '';
                    qrCard.style.transition = '';
                    // Reveal the ring + start the thank-you countdown.
                    if (doneTimerEl) doneTimerEl.style.display = '';
                    _startThankYouPhase();
                }, 260);
            }

            function _startThankYouPhase() {
                const total = TY_SECS;
                let remaining = total;

                if (ring) {
                    ring.style.transition = 'none';
                    ring.style.strokeDashoffset = '0';
                    void ring.getBoundingClientRect();
                    ring.style.transition = 'stroke-dashoffset 1s linear';
                }
                if (secsEl) secsEl.textContent = String(total);
                tyTickId = setInterval(function() {
                    remaining--;
                    const drained = ((total - remaining) / total) * 100;
                    if (ring) ring.style.strokeDashoffset = String(drained);
                    if (secsEl) secsEl.textContent = String(Math.max(0, remaining));
                    if (remaining <= 0) _finish();
                }, 1000);
                doneBtn.addEventListener('click', _finish, { once: true });
            }

            function _finish() {
                if (resolved) return;
                resolved = true;
                clearTimeout(qrPhaseTimeoutId);
                clearTimeout(tyTimerId);
                clearInterval(tyTickId);
                if (qrPollId) clearTimeout(qrPollId);
                doneBtn.removeEventListener('click', _finish);
                doneBtn.removeEventListener('click', _endQrPhase);
                overlay.style.display = 'none';
                resolve();
            }

            function _waitForLinkAndShowQr() {
                const MAX_WAIT_MS = 30000;
                const POLL_MS     = 500;
                let elapsed       = 0;

                function poll() {
                    if (currentSessionFolderLink) {
                        qrTarget.innerHTML = '';
                        try {
                            new QRCode(qrTarget, {
                                text: currentSessionFolderLink,
                                width: 178,
                                height: 178,
                                colorDark: '#0b0b0f',
                                colorLight: '#ffffff',
                                correctLevel: QRCode.CorrectLevel.M
                            });
                            qrLinkEl.textContent = currentSessionFolderLink;
                        } catch (e) {
                            console.warn('[QR] Drive QR generation failed:', e);
                            qrTarget.innerHTML = '<div style="color:#9ca3af;font-size:0.78rem;padding:0.5rem;text-align:center;line-height:1.4;">Could not generate QR code.</div>';
                        }
                        qrCard.classList.add('is-ready');
                        return;
                    }
                    elapsed += POLL_MS;
                    if (elapsed >= MAX_WAIT_MS) {
                        qrTarget.innerHTML = '<div style="color:#9ca3af;font-size:0.78rem;padding:0.5rem;text-align:center;line-height:1.4;">Upload in progress.<br>See the operator for your link.</div>';
                        qrCard.classList.add('is-ready');
                        return;
                    }
                    qrPollId = setTimeout(poll, POLL_MS);
                }
                poll();
            }
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
            overlay.style.display = 'flex';

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

    // Cap how many captures are kept in the in-memory gallery to bound RAM growth.
    // Files are already saved to disk/Drive; these arrays are only for the dashboard preview.
    const MAX_GALLERY_PHOTOS = 30;
    const MAX_GALLERY_VIDEOS = 10;
    function _evictOldCaptures() {
        while (capturedPhotos.length > MAX_GALLERY_PHOTOS) {
            capturedPhotos.pop();           // data URL string — GC reclaims the memory
            capturedPhotoDriveLinks.pop();
        }
        while (capturedVideos.length > MAX_GALLERY_VIDEOS) {
            const old = capturedVideos.pop();
            capturedVideoDriveLinks.pop();
            if (old && old.startsWith('blob:')) URL.revokeObjectURL(old); // release the binary blob
        }
    }

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
        capturedPhotos.unshift(photoDataUrl);
        capturedPhotoDriveLinks.unshift(null); // will be updated after Drive upload completes
        _evictOldCaptures();
        updateDashboardGallery();
        // Broadcast to Live Viewer peers (fire-and-forget)
        window.PB.liveViewer.host.broadcastPhoto(photoDataUrl, filename);

        // --- Upload to Google Drive (fire-and-forget; queues offline if needed) ---
        if (appConfig.saveDrive && window.PB.drive.isSignedIn()) {
            canvas.toBlob(async function(blob) {
                try {
                    await window.PB.drive.upload('photo-booth', blob, filename);
                    console.log('[Drive] Uploaded:', filename);
                    if (currentSessionFolderLink) {
                        capturedPhotoDriveLinks[0] = currentSessionFolderLink;
                        _appendGalleryQrBtn(0, 'photo', currentSessionFolderLink);
                        window.PB.liveViewer.host.broadcastDriveUpdate(filename, currentSessionFolderLink);
                    }
                } catch (e) {
                    console.warn('[Drive] Upload failed:', e.message);
                }
            }, 'image/jpeg', 0.92);
        }

        $('#processing-overlay').fadeOut(200);

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
            $('#processing-overlay h2').text('Processing...');
            $('.spinner').show();
            resetToWelcomeScreen();
        }, previewMs);
    }

    function updateTemplateSizeHint() {
        const layout = $('input[name="layout"]:checked').val() || appConfig.layout;
        const def = LAYOUT_DEFS[layout] || LAYOUT_DEFS['4x6-1'];
        const paper = PAPER_SIZES[def.paper];
        const sizeStr = def.pW + ' × ' + def.pH + ' px';
        $('#hint-layout-name').text(def.name);
        $('#hint-canvas-size').text(sizeStr);
        $('#hint-paper').text(paper ? paper.selphy : '');
        $('#bg-size-hint').text(sizeStr);
        $('#template-canvas-label').text(def.name);
        drawTemplatePreview();
    }

    function drawTemplatePreview() {
        const canvas = document.getElementById('template-preview-canvas');
        if (!canvas) return;
        const layout = $('input[name="layout"]:checked').val() || appConfig.layout;
        const def = LAYOUT_DEFS[layout] || LAYOUT_DEFS['4x6-1'];
        // Scale down to 260px tall
        const maxH  = 260;
        const scale = maxH / def.pH;
        canvas.width  = Math.round(def.pW * scale);
        canvas.height = maxH;
        const ctx = canvas.getContext('2d');
        // Background
        if (appConfig.templateBg) {
            ctx.drawImage(appConfig.templateBg, 0, 0, canvas.width, canvas.height);
        } else {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        // Geometry (mirrors computeLayout, scaled)
        const pad     = Math.round(def.pW * 0.05  * scale);
        const gap     = Math.round(def.pW * 0.025 * scale);
        const footerH = Math.round(def.pH * 0.15  * scale);  // polaroid footer zone
        const photoZoneW = canvas.width  - 2 * pad;
        const photoZoneH = canvas.height - 2 * pad - footerH;
        const maxPhotoW  = Math.floor((photoZoneW - gap * (def.cols - 1)) / def.cols);
        const maxPhotoH  = Math.floor((photoZoneH - gap * (def.rows - 1)) / def.rows);
        const slotW  = (def.square === false) ? maxPhotoW : Math.min(maxPhotoW, maxPhotoH);
        const slotH  = (def.square === false) ? maxPhotoH : slotW;
        const gridW  = slotW * def.cols + gap * (def.cols - 1);
        const gridH  = slotH * def.rows + gap * (def.rows - 1);
        const startX = Math.round((canvas.width  - gridW) / 2);
        const startY = Math.round(pad + (photoZoneH - gridH) / 2);
        // Photo slot placeholders
        const bgColors = ['#e2e8f0', '#f1f5f9', '#dde6ef', '#eef2f6'];
        let si = 0;
        for (let r = 0; r < def.rows; r++) {
            for (let c = 0; c < def.cols; c++, si++) {
                const px = startX + c * (slotW + gap);
                const py = startY + r * (slotH + gap);
                ctx.fillStyle = bgColors[si % bgColors.length];
                ctx.fillRect(px, py, slotW, slotH);
                ctx.fillStyle = '#94a3b8';
                ctx.font = Math.max(8, Math.round(slotW * 0.38)) + 'px serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('📷', px + slotW / 2, py + slotH / 2);
            }
        }
        // Footer zone indicator (dashed line + tint when no background is loaded)
        const footerY = canvas.height - footerH;
        if (!appConfig.templateBg) {
            ctx.fillStyle = 'rgba(148,163,184,0.12)';
            ctx.fillRect(0, footerY, canvas.width, footerH);
        }
        ctx.save();
        ctx.strokeStyle = 'rgba(148,163,184,0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(0, footerY);
        ctx.lineTo(canvas.width, footerY);
        ctx.stroke();
        ctx.restore();
        ctx.textBaseline = 'alphabetic';
    }

    // (Audio beeps, BT sink routing, and speaker test live in window.PB.audio.)

    $('#btn-test-speaker').on('click', function() {
        window.PB.audio.testSpeakerOutput(appConfig.vgSelectedSpeakerId);
    });

    $('#btn-grant-audio-output').on('click', async function() {
        if (typeof navigator.mediaDevices.selectAudioOutput !== 'function') {
            $(this).hide();
            return;
        }
        const btn = $(this);
        btn.prop('disabled', true).text('Opening picker…');
        try {
            const device = await navigator.mediaDevices.selectAudioOutput();
            appConfig.vgSelectedSpeakerId = device.deviceId;
            await window.PB.devices.populateAudioDeviceList();
            // Re-select the device that was just granted
            const spkSel = document.getElementById('vg-speaker-select');
            if ([...spkSel.options].some(o => o.value === device.deviceId)) {
                spkSel.value = device.deviceId;
                appConfig.vgSelectedSpeakerId = device.deviceId;
            }
            saveConfig();
        } catch (e) {
            if (e.name !== 'AbortError') {
                const diag = document.getElementById('vg-audio-diag');
                if (diag) diag.innerHTML += `<span style="color:#dc2626; display:block;"><i class="fa-solid fa-triangle-exclamation"></i> ${e.message}</span>`;
            }
        } finally {
            btn.prop('disabled', false).html('<i class="fa-solid fa-key"></i> Grant Bluetooth Access');
        }
    });
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

    // --- Dashboard Gallery UI Engine ---
    function updateDashboardGallery() {
        const total = capturedPhotos.length + capturedVideos.length;
        $('#stat-captures').text(total);
        $('#count-photos').text(capturedPhotos.length);
        $('#count-videos').text(capturedVideos.length);

        // --- Photo grid ---
        const photoGrid = $('#dashboard-gallery-photo');
        photoGrid.empty();
        if (capturedPhotos.length === 0) {
            photoGrid.append('<div class="empty-gallery">No photos yet. Launch the Kiosk to start a session!</div>');
        } else {
            capturedPhotos.slice(0, 8).forEach((src, index) => {
                const num = capturedPhotos.length - index;
                const driveLink = capturedPhotoDriveLinks[index] || null;
                const qrBtn = driveLink
                    ? `<button class="gallery-qr-btn" data-url="${driveLink}" title="Get QR code to download"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3" height="3"/><rect x="18" y="18" width="3" height="3"/><rect x="14" y="18" width="3" height="0"/></svg>QR</button>`
                    : '';
                photoGrid.append(`<div class="gallery-item" data-index="${index}" title="Photo #${num}"><img src="${src}" alt="Photo #${num}"><div class="overlay">Photo #${num}</div>${qrBtn}</div>`);
            });
        }

        // --- Video grid ---
        const videoGrid = $('#dashboard-gallery-video');
        videoGrid.empty();
        if (capturedVideos.length === 0) {
            videoGrid.append('<div class="empty-gallery">No videos yet. Switch to Video Guestbook mode and record a message!</div>');
        } else {
            capturedVideos.slice(0, 8).forEach((src, index) => {
                const num = capturedVideos.length - index;
                const driveLink = capturedVideoDriveLinks[index] || null;
                const qrBtn = driveLink
                    ? `<button class="gallery-qr-btn" data-url="${driveLink}" title="Get QR code to download"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3" height="3"/><rect x="18" y="18" width="3" height="3"/><rect x="14" y="18" width="3" height="0"/></svg>QR</button>`
                    : '';
                videoGrid.append(`
                    <div class="gallery-item gallery-item-video" data-vindex="${index}" title="Video #${num}">
                        <video src="${src}" preload="metadata" muted playsinline></video>
                        <div class="gallery-play-icon">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        </div>
                        <div class="overlay">Video #${num}</div>
                        ${qrBtn}
                    </div>`);
            });
        }

        // --- Dashboard gallery tab switching ---
        $(document).off('click.galtabs').on('click.galtabs', '[data-gallery-tab]', function() {
            const target = $(this).data('gallery-tab');
            $(this).closest('.gallery-section').find('[data-gallery-tab]').removeClass('active');
            $(this).addClass('active');
            $(this).closest('.gallery-section').find('.gallery-tab-content').hide();
            $('#' + target).show();
        });
    }

    // Append (or show) a QR button on an existing gallery thumbnail without full re-render
    function _appendGalleryQrBtn(arrIndex, type, driveLink) {
        if (!driveLink) return;
        const selector = type === 'video'
            ? `.gallery-item[data-vindex="${arrIndex}"]`
            : `.gallery-item[data-index="${arrIndex}"]`;
        const $item = $(selector);
        if ($item.length && !$item.find('.gallery-qr-btn').length) {
            $item.append(`<button class="gallery-qr-btn" data-url="${driveLink}" title="Get QR code to download"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3" height="3"/><rect x="18" y="18" width="3" height="3"/></svg>QR</button>`);
        }
    }

    // --- Gallery lightbox ---
    let _lightboxIdx = 0;
    let _lightboxType = 'photo'; // 'photo' | 'video'

    function _lightboxItems() {
        return _lightboxType === 'video' ? capturedVideos : capturedPhotos;
    }

    function _renderLightbox() {
        const items = _lightboxItems();
        const isVideo = _lightboxType === 'video';
        if (isVideo) {
            $('#lightbox-img').hide();
            const vid = $('#lightbox-video');
            vid.attr('src', items[_lightboxIdx]).show();
            vid[0].load();
        } else {
            $('#lightbox-video').hide().attr('src', '');
            $('#lightbox-img').attr('src', items[_lightboxIdx]).show();
        }
        $('#lightbox-counter').text((_lightboxIdx + 1) + ' / ' + items.length);
        $('#lightbox-prev').toggle(_lightboxIdx > 0);
        $('#lightbox-next').toggle(_lightboxIdx < items.length - 1);
    }
    function openLightbox(idx) {
        _lightboxType = 'photo';
        _lightboxIdx = idx;
        _renderLightbox();
        $('#photo-lightbox').fadeIn(200);
    }
    function openVideoLightbox(idx) {
        _lightboxType = 'video';
        _lightboxIdx = idx;
        _renderLightbox();
        $('#photo-lightbox').fadeIn(200);
    }
    // QR button on gallery thumbnails — open Drive link directly
    $(document).on('click', '.gallery-qr-btn', function(e) {
        e.stopPropagation();
        const url = $(this).data('url');
        if (url) window.open(url, '_blank', 'noopener');
    });
    $(document).on('click', '.gallery-item:not(.gallery-item-video)', function() {
        openLightbox(parseInt($(this).data('index')));
    });
    $(document).on('click', '.gallery-item.gallery-item-video', function() {
        openVideoLightbox(parseInt($(this).data('vindex')));
    });
    $(document).on('click', '#lightbox-close, #photo-lightbox-backdrop', function() {
        const vid = document.getElementById('lightbox-video');
        if (vid) vid.pause();
        $('#photo-lightbox').fadeOut(200);
    });
    $('#lightbox-prev').on('click', function(e) {
        e.stopPropagation();
        if (_lightboxIdx > 0) { _lightboxIdx--; _renderLightbox(); }
    });
    $('#lightbox-next').on('click', function(e) {
        e.stopPropagation();
        if (_lightboxIdx < _lightboxItems().length - 1) { _lightboxIdx++; _renderLightbox(); }
    });

    // --- Lightbox swipe (touch) ---
    (function() {
        let _tsX = null, _tsY = null;
        const lb = document.getElementById('photo-lightbox');
        lb.addEventListener('touchstart', function(e) {
            _tsX = e.touches[0].clientX;
            _tsY = e.touches[0].clientY;
        }, { passive: true });
        lb.addEventListener('touchend', function(e) {
            if (_tsX === null) return;
            const dx = e.changedTouches[0].clientX - _tsX;
            const dy = e.changedTouches[0].clientY - _tsY;
            _tsX = null; _tsY = null;
            if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
            const items = _lightboxItems();
            if (dx < 0 && _lightboxIdx < items.length - 1) { _lightboxIdx++; _renderLightbox(); }
            else if (dx > 0 && _lightboxIdx > 0) { _lightboxIdx--; _renderLightbox(); }
        }, { passive: true });
    })();

    // --- Full gallery modal ---
    function openGalleryModal() {
        // Photo grid
        const photoGrid = $('#gallery-modal-grid');
        photoGrid.empty();
        if (capturedPhotos.length === 0) {
            photoGrid.append('<div class="empty-gallery">No photos captured yet.</div>');
        } else {
            capturedPhotos.forEach((src, idx) => {
                const num = capturedPhotos.length - idx;
                photoGrid.append(`<div class="gallery-modal-item" data-index="${idx}"><img src="${src}" alt="Photo #${num}"><div class="overlay">Photo #${num}</div></div>`);
            });
        }
        // Video grid
        const videoGrid = $('#gallery-modal-grid-video');
        videoGrid.empty();
        if (capturedVideos.length === 0) {
            videoGrid.append('<div class="empty-gallery">No videos captured yet.</div>');
        } else {
            capturedVideos.forEach((src, idx) => {
                const num = capturedVideos.length - idx;
                videoGrid.append(`
                    <div class="gallery-modal-item gallery-modal-item-video" data-vindex="${idx}" title="Video #${num}">
                        <video src="${src}" preload="metadata" muted playsinline></video>
                        <div class="gallery-play-icon">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        </div>
                        <div class="overlay">Video #${num}</div>
                    </div>`);
            });
        }
        const total = capturedPhotos.length + capturedVideos.length;
        $('#gallery-modal-count').text('(' + total + ')');
        $('#gallery-modal').fadeIn(200);

        // Modal tab switching
        $(document).off('click.modaltabs').on('click.modaltabs', '[data-modal-tab]', function() {
            const target = $(this).data('modal-tab');
            $('#gallery-modal').find('[data-modal-tab]').removeClass('active');
            $(this).addClass('active');
            $('.gallery-modal-tab-content').hide();
            $('#' + target).show();
        });
    }
    $('#btn-view-all-gallery').on('click', function(e) { e.preventDefault(); openGalleryModal(); });
    $('#gallery-modal-close, #gallery-modal-backdrop').on('click', function() { $('#gallery-modal').fadeOut(200); });
    $(document).on('click', '.gallery-modal-item:not(.gallery-modal-item-video)', function() {
        $('#gallery-modal').fadeOut(150);
        openLightbox(parseInt($(this).data('index')));
    });
    $(document).on('click', '.gallery-modal-item.gallery-modal-item-video', function() {
        $('#gallery-modal').fadeOut(150);
        openVideoLightbox(parseInt($(this).data('vindex')));
    });

    // --- Event Name handlers ---
    function _updateFilenamePreview() {
        const name = appConfig.eventName || 'photobooth';
        const safe = name.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'photobooth';
        $('#filename-preview').text(safe + '_YYYYMMDD_HHMMSS.png');
    }

    // Show/hide inline warning below the event name field when Drive is on but name is empty
    function _updateEventNameWarnings() {
        const needsName = (appConfig.saveDrive || appConfig.vgSaveDrive) && !appConfig.eventName;
        $('#event-name-drive-warning').toggle(needsName);
        $('#event-name-input').toggleClass('input-required-highlight', needsName);
    }
    $('#event-name-input').on('input', function() {
        appConfig.eventName = this.value.trim();
        $('#event-name-input').val(appConfig.eventName);
        // Drive client invalidates its event-folder cache automatically when
        // it next reads the event name; tell it now so any in-flight session
        // folder is also reset.
        window.PB.drive.invalidateFolders();
        _updateFilenamePreview();
        _updateEventNameWarnings();
    });

    // ─── LIVE GALLERY VIEWER (host-side wiring) ──────────────────────────────
    // PeerJS host, broadcast queue, video-thumb generation, and viewer-mode
    // bootstrap all live in window.PB.liveViewer (src/lib/live-viewer).

    $('#btn-lv-start').on('click', () => window.PB.liveViewer.host.start());
    $('#btn-lv-stop').on('click', () => window.PB.liveViewer.host.stop());
    $('#lv-network-addr').on('input', function() {
        appConfig.lvNetworkAddr = $(this).val().trim();
    });

    // (Viewer-mode bootstrap lives in window.PB.liveViewer via LiveViewerClient.tryStart() in src/main.ts.)


    // ── Sync all UI controls to the loaded appConfig ──────────────────────────
    // Called once after all event handlers are wired so that the DOM reflects
    // whatever was restored from localStorage.
    function syncUIFromConfig() {

        // Layout radio
        $('input[name="layout"][value="' + appConfig.layout + '"]').prop('checked', true);
        updateTemplateSizeHint();

        // Capture settings are Video Guestbook-only.
        const capEl = document.getElementById('cap-tab-videoguestbook');
        if (capEl) capEl.style.display = '';
        updateAdvancedNavForMode(appConfig.captureMode);

        // Event name
        $('#event-name-input').val(appConfig.eventName);
        if (appConfig.eventName) {
            const prefix = appConfig.eventName.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
            $('#filename-preview').text(prefix + '_YYYYMMDD_HHMMSS.png');
        }

        // Kiosk PIN — fields are always empty (we only store the hash); the
        // helper toggles the Current-PIN row and contextual button label.
        _clearPinAdminFields();
        _renderPinAdminForm();
        _setPinFeedback('');

        // Countdown sliders
        $('#setting-cd-1').val(appConfig.countdownFirst);
        $('#val-cd-1').text(appConfig.countdownFirst);
        $('#setting-cd-others').val(appConfig.countdownOthers);
        $('#val-cd-others').text(appConfig.countdownOthers);
        $('#setting-review').val(appConfig.reviewTime);
        $('#val-review').text(appConfig.reviewTime);

        // Welcome screen
        $('#edit-bg-color').val(appConfig.welcomeBg);
        $('#color-hex').text(appConfig.welcomeBg);
        // Legacy welcomeTitle / welcomeSubtitle inputs are hidden in the UI but
        // keep their values populated for safety in case future code reads them.
        $('#edit-title').val(appConfig.welcomeTitle);
        $('#edit-subtitle').val(appConfig.welcomeSubtitle);
        $('#live-ws-title').text(appConfig.welcomeTitle);
        $('#live-ws-subtitle').text(appConfig.welcomeSubtitle);
        // Active welcome controls (VG-first design).
        const vgTitle = appConfig.vgPanelTitle || 'Raise a Toast!';
        const vgSubtitle = _getVgPanelSubtitle();
        $('#edit-vg-panel-title').val(vgTitle);
        $('#edit-vg-couple-name').val(appConfig.vgCoupleName || '');
        $('#vg-couple-name-preview').text(appConfig.vgCoupleName || 'Ken & Alexa');
        $('#live-ws-title-vg').text(vgTitle);
        $('#live-ws-subtitle-vg').text(vgSubtitle);
        $('#prev-vg-title').text(vgTitle);
        $('#prev-vg-subtitle').text(vgSubtitle);
        $('#prev-vg-prompts-chip').toggle(!!appConfig.vgPromptsEnabled);
        if (!appConfig.welcomeMedia) {
            $('#designer-preview, #guest-welcome').css('background-color', appConfig.welcomeBg);
        }

        // Photo mode toggle
        $('#toggle-photo-mode').prop('checked', appConfig.photoMode)
            .closest('.toggle-switch').toggleClass('is-on', appConfig.photoMode);
        $('#toggle-photo-label').text(appConfig.photoMode ? 'ON' : 'OFF');

        // Storage — Photo Booth
        $('#chk-save-local').prop('checked', appConfig.saveLocal);
        $('#chk-save-drive').prop('checked', appConfig.saveDrive);

        // Camera — Photo Booth
        $('#camera-specific-card').toggle(true);
        if (appConfig.selectedCameraId) $('#camera-select').val(appConfig.selectedCameraId);

        // VG settings
        $('#setting-vg-duration').val(appConfig.vgMaxDuration);
        $('#val-vg-duration').text(appConfig.vgMaxDuration);
        $('#setting-vg-countdown').val(appConfig.vgCountdown);
        $('#val-vg-countdown').text(appConfig.vgCountdown);
        $('#setting-vg-prompt').val(appConfig.vgPromptText);
        $('#vg-camera-specific-card').show();
        if (appConfig.vgSelectedCameraId) $('#vg-camera-select').val(appConfig.vgSelectedCameraId);

        // VG storage
        $('#chk-vg-save-local').prop('checked', appConfig.vgSaveLocal);
        $('#vg-local-folder-config').toggle(appConfig.vgSaveLocal);
        $('#chk-vg-save-drive').prop('checked', appConfig.vgSaveDrive);
        $('#vg-drive-config').toggle(appConfig.vgSaveDrive);
        $('#vg-drive-folder-name').val(appConfig.vgDriveFolderName);
        if (appConfig.vgDriveClientId) $('#vg-drive-client-id').val(appConfig.vgDriveClientId);

        // VG prompts — category button (toggle/list handled by initVgPrompts above)
        $('.prompt-cat-btn').removeClass('active');
        $('.prompt-cat-btn[data-cat="' + appConfig.vgPromptCategory + '"]').addClass('active');

        // VG prompts — splash screen duration
        $('#setting-vg-splash-duration').val(appConfig.vgSplashDuration);
        $('#val-vg-splash-duration').text(appConfig.vgSplashDuration);

        // Photo Booth splash screen
        $('#setting-pb-splash-duration').val(appConfig.pbSplashDuration);
        $('#val-pb-splash-duration').text(appConfig.pbSplashDuration);

        // VG thank you duration (toggle handled by initVgThankYou above)
        $('#setting-ty-duration').val(appConfig.vgThankYouDuration);
        $('#val-ty-duration').text(appConfig.vgThankYouDuration);

        // Live Viewer network address
        $('#lv-network-addr').val(appConfig.lvNetworkAddr || '');

        _updateEventNameWarnings();
    }

    syncUIFromConfig();

    // Auto-save on any admin UI input change (covers text, checkboxes, radios, selects, sliders)
    $(document).on('change input',
        '#admin-dashboard input, #admin-dashboard select, #admin-dashboard textarea',
        _scheduleSave
    );

});
