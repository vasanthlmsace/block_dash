/**
 * Details area module — provides expanding, floating & modal support for non-cards layouts.
 *
 * Usage from a Mustache template:
 *   require(['block_dash/details_area'], function(DetailsArea) {
 *       DetailsArea.init('#dash-grid-123', {
 *           detailsBgColor: '{{preferences.details_bg_color}}',
 *           detailsTextColor: '{{preferences.details_text_color}}',
 *           rowSelector: 'tbody tr[data-detailheader]',
 *           mode: '{{preferences.details_area_mode}}'   // expanding | floating | modal
 *       });
 *   });
 *
 * Trigger paths (all three modes):
 *  1. Explicit — click on [data-action="open-details-modal"] (details button / details link)
 *  2. Fallback — click (expanding/modal) or hover (floating) on the row when rowSelector is given
 *
 * @module     block_dash/details_area
 * @copyright  2019 bdecent gmbh <https://bdecent.de>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define([
    'jquery',
    'core/modal_factory',
    'core/modal_events',
    'core/templates',
    'core/str',
    'core/notification'
], function($, Modal, ModalEvents, Templates, Str, Notification) {

    /** Track which containers have been initialised to prevent double-bind. */
    var initialisedContainers = {};

    /** Whether page-level hash handlers have been bound (idempotent guard). */
    var hashInitialised = false;

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Read detail data attributes from an element (or its child .card-info / .detail-info).
     * Always reads DIRECTLY from the DOM element that was clicked/hovered — never cached.
     *
     * @param {jQuery}  $element The row / container element.
     * @param {Object}  options  Init options.
     * @returns {Object} Template context for local_dash/layouts_cards_detailarea.
     */
    var getDetailContext = function($element, options) {
        // For non-cards layouts the data attrs sit directly on the row element (tr, li, .card).
        // For cards layouts they sit on a child .card-info div.
        var $info = $element.find('.card-info').first();
        if (!$info.length) {
            $info = $element.find('.detail-info').first();
        }
        if (!$info.length) {
            $info = $element;
        }

        var context = {
            detailheader: $info.attr('data-detailheader') || '',
            detailheading: $info.attr('data-detailheading') || '',
            detailbody: $info.attr('data-detailbody') || '',
            detailbody2: $info.attr('data-detailbody2') || '',
            detailbody3: $info.attr('data-detailbody3') || '',
            detailfooter: $info.attr('data-detailfooter') || '',
            detailfooterright: $info.attr('data-detailfooterright') || '',
            customcontent: $info.attr('data-customcontent') || '',
            details_bg_color: options.detailsBgColor || '',
            details_text_color: options.detailsTextColor || '',
            detailmodal: options.mode === 'modal' ? 'true' : ''
        };

        return context;
    };

    /**
     * Render the detail area partial.
     *
     * @param {Object} context Template context.
     * @returns {Promise<string>} Rendered HTML.
     */
    var renderDetailArea = function(context) {
        return Templates.render('block_dash/layouts_cards_detailarea', context);
    };

    /**
     * Locate the logical row element that holds the data-detail attributes.
     * Every layout places data-detailheader directly on the row element
     * (tr, li, .card, .panel), so we simply walk up to that attribute.
     *
     * When a CSS stretched-link (or similar absolute positioning) causes
     * the event target to belong to a different row than the one visually
     * clicked, the function falls back to coordinate-based detection.
     *
     * @param {jQuery}  $trigger   The clicked element (button/link inside a row).
     * @param {jQuery=} $container The layout container (used for coordinate fallback).
     * @param {Event=}  e          The original DOM event (used for coordinate fallback).
     * @returns {jQuery} The row element.
     */
    var findRow = function($trigger, $container, e) {
        // Walk up from the clicked button/link to the nearest element with data-detailheader.
        var $row = $trigger.closest('[data-detailheader]');

        // Guard: verify the found row actually contains the click point.
        // This catches CSS positioning issues (e.g. stretched-link ::after intercepting
        // clicks on behalf of a different row).
        if ($row.length && e && $container && typeof e.clientX === 'number') {
            var rect = $row[0].getBoundingClientRect();
            var inBounds = (e.clientX >= rect.left && e.clientX <= rect.right &&
                            e.clientY >= rect.top && e.clientY <= rect.bottom);
            if (!inBounds) {
                var $correct = $();
                $container.find('[data-detailheader]').each(function() {
                    var r = this.getBoundingClientRect();
                    if (e.clientX >= r.left && e.clientX <= r.right &&
                        e.clientY >= r.top && e.clientY <= r.bottom) {
                        $correct = $(this);
                        return false; // break
                    }
                });
                if ($correct.length) {
                    $row = $correct;
                }
            }
        }

        if (!$row.length) {
            window.console.warn('[DASH details_area] findRow: no [data-detailheader] ancestor for', $trigger[0]);
        }
        return $row;
    };

    /**
     * Verify that the jQuery-delegated row target actually contains the click point.
     * If not (e.g. due to CSS ::after overlays), find the correct row by coordinates.
     *
     * @param {jQuery}  $row       The row returned by jQuery delegation ($(this)).
     * @param {jQuery}  $container The layout container.
     * @param {Object}  options    Init options (needs rowSelector).
     * @param {Event}   e          The original DOM event.
     * @returns {jQuery} The validated (possibly corrected) row element.
     */
    var validateRowTarget = function($row, $container, options, e) {
        if (!$row.length || !e || typeof e.clientX !== 'number') {
            return $row;
        }
        var rect = $row[0].getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right &&
            e.clientY >= rect.top && e.clientY <= rect.bottom) {
            return $row;
        }
        // The matched row does not contain the click — find the correct one.
        var selector = options.rowSelector || '[data-detailheader]';
        var $correct = $();
        $container.find(selector).each(function() {
            var r = this.getBoundingClientRect();
            if (e.clientX >= r.left && e.clientX <= r.right &&
                e.clientY >= r.top && e.clientY <= r.bottom) {
                $correct = $(this);
                return false; // break
            }
        });
        return $correct.length ? $correct : $row;
    };

    /**
     * Check if click originated from an interactive child that should NOT trigger details.
     *
     * @param {Event} e Original DOM event.
     * @returns {boolean}
     */
    var isInteractiveChild = function(e) {
        var $t = $(e.target);
        if ($t.closest('[data-action="open-details-modal"]').length) {
            return true;
        }
        // Ignore links that are details-area triggers (their href starts with #dash-detail-).
        if ($t.closest('a[href]:not([href^="#dash-detail-"]):not([href="javascript:void(0)"]), ' +
            'button:not([data-action="open-details-modal"])').length) {
            return true;
        }
        return false;
    };

    /**
     * Update the URL hash to the detail-id of the clicked trigger, so the URL
     * can be copied/shared and will auto-open the same details area on load.
     *
     * Uses replaceState to avoid adding a history entry for every click.
     *
     * @param {jQuery} $trigger The clicked button/link element.
     */
    var updateHash = function($trigger) {
        var detailId = $trigger.attr('data-detail-id');
        if (detailId && window.history && window.history.replaceState) {
            window.history.replaceState(null, '', '#' + detailId);
        }
    };

    // -------------------------------------------------------------------------
    // MODAL mode
    // -------------------------------------------------------------------------

    /**
     * Open a Moodle modal with the details area content.
     *
     * @param {Object} templatecontext Rendered context.
     */
    var openModal = function(templatecontext) {
        Modal.create({
            title: Str.get_string('strinfo', 'block_dash'),
            type: Modal.types.CANCEL,
            body: renderDetailArea(templatecontext),
            large: true
        }).then(function(modal) {
            modal.show();
            modal.getRoot().on(ModalEvents.hidden, function() {
                modal.destroy();
            });
            return modal;
        }).catch(Notification.exception);
    };

    /**
     * Bind modal-mode handlers on a container.
     *
     * @param {jQuery} $container
     * @param {Object} options
     */
    var initModal = function($container, options) {
        var handler = function($row) {
            openModal(getDetailContext($row, options));
        };

        // Explicit button / link clicks.
        $container.on('click', '[data-action="open-details-modal"]', function(e) {
            // so the real URL can be opened in a new tab or copied.
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.which === 2) {
                return;
            }
            e.preventDefault();
            e.stopImmediatePropagation();
            var $clicked = $(this);
            var $row = findRow($clicked, $container, e);
            if ($row.length) {
                handler($row);
                updateHash($clicked);
            }
        });

        // Row-level fallback clicks.
        if (options.rowSelector) {
            $container.on('click', options.rowSelector, function(e) {
                if (isInteractiveChild(e)) {
                    return;
                }
                e.preventDefault();
                var $row = validateRowTarget($(this), $container, options, e);
                handler($row);
                // Try to find a detail-id trigger inside the row.
                var $trigger = $row.find('[data-detail-id]').first();
                if ($trigger.length) {
                    updateHash($trigger);
                }
            });
        }
    };

    // -------------------------------------------------------------------------
    // EXPANDING mode
    // -------------------------------------------------------------------------

    /**
     * Remove any existing expand panel owned by a row and clean up its state.
     *
     * @param {jQuery} $row
     */
    var removeExpandPanel = function($row) {
        var $panel = $row.data('dash-detail-panel');
        if ($panel && $panel.length) {
            $panel.remove();
        }
        $row.removeData('dash-detail-panel');
        $row.removeClass('dash-details-expanded');
    };

    /**
     * Collapse and remove all expanded panels inside the container, optionally excluding one row.
     *
     * @param {jQuery}  $container
     * @param {jQuery=} $except  Row to skip.
     */
    var collapseAll = function($container, $except) {
        $container.find('.dash-details-expanded').each(function() {
            if ($except && $except.is(this)) {
                return;
            }
            removeExpandPanel($(this));
        });
        // Also remove any orphaned expand rows/panels that might remain.
        $container.find('.dash-details-expand-row, .dash-details-expand-panel, .dash-details-expand-li').each(function() {
            $(this).remove();
        });
    };

    /**
     * Toggle an inline detail panel below the clicked row.
     * Always renders fresh content from the row's current data attributes.
     *
     * @param {jQuery} $row      The clicked row element.
     * @param {jQuery} $container The layout container.
     * @param {Object} options   Init options.
     */
    var handleExpand = function($row, $container, options) {
        // If this row already has a visible panel, toggle it OFF.
        var $existing = $row.data('dash-detail-panel');
        if ($existing && $existing.length && $existing.is(':visible')) {
            removeExpandPanel($row);
            return;
        }

        // Collapse and remove ALL other panels.
        collapseAll($container);

        // Always read fresh context from DOM attributes.
        var context = getDetailContext($row, options);
        var sizeClass = (options.detailsAreaSize === 'fit_content')
            ? 'dash-details-size-fit-content'
            : 'dash-details-size-like-item';
        renderDetailArea(context).then(function(html) {
            var $panel;
            var tagName = ($row[0].tagName || '').toLowerCase();

            if (tagName === 'tr') {
                // Table layouts (grid, accordion-with-tables): wrap in <tr><td colspan>.
                var colCount = $row.find('td').length || $row.closest('table').find('thead th').length || 1;
                $panel = $('<tr class="dash-details-expand-row ' + sizeClass + '">' +
                    '<td colspan="' + colCount + '">' +
                    '<div class="dash-details-expand-content">' + html + '</div>' +
                    '</td></tr>');
            } else if (tagName === 'li') {
                // Timeline layout: wrap in <li> so it stays valid inside <ul>.
                $panel = $('<li class="dash-details-expand-li ' + sizeClass + '">' +
                    '<div class="dash-details-expand-content">' + html + '</div>' +
                    '</li>');
            } else {
                // Accordion2 (.card / .panel) and any custom layout: wrap in <div>.
                $panel = $('<div class="dash-details-expand-panel ' + sizeClass + '">' + html + '</div>');
            }
            $row.after($panel);
            $row.data('dash-detail-panel', $panel);
            $row.addClass('dash-details-expanded');
            $panel.hide().slideDown(250);
            return;
        }).catch(Notification.exception);
    };

    /**
     * Bind expanding-mode handlers on a container.
     *
     * @param {jQuery} $container
     * @param {Object} options
     */
    var initExpanding = function($container, options) {
        var handler = function($row) {
            handleExpand($row, $container, options);
        };

        // Explicit button / link clicks.
        $container.on('click', '[data-action="open-details-modal"]', function(e) {
            // Let the browser handle modifier clicks so the real URL can be followed.
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.which === 2) {
                return;
            }
            e.preventDefault();
            e.stopImmediatePropagation();
            var $clicked = $(this);
            var $row = findRow($clicked, $container, e);
            if ($row.length) {
                handler($row);
                updateHash($clicked);
            }
        });

        // Row-level fallback clicks.
        if (options.rowSelector) {
            $container.on('click', options.rowSelector, function(e) {
                if (isInteractiveChild(e)) {
                    return;
                }
                var $row = validateRowTarget($(this), $container, options, e);
                handler($row);
                var $trigger = $row.find('[data-detail-id]').first();
                if ($trigger.length) {
                    updateHash($trigger);
                }
            });
        }
    };

    // -------------------------------------------------------------------------
    // FLOATING mode
    // -------------------------------------------------------------------------

    /**
     * Bind floating-mode handlers on a container.
     *
     * @param {jQuery} $container
     * @param {Object} options
     */
    var initFloating = function($container, options) {
        var sizeClass = (options.detailsAreaSize === 'fit_content')
            ? 'dash-details-size-fit-content'
            : 'dash-details-size-like-item';
        var $panel = $('<div class="dash-details-floating-panel ' + sizeClass + '"></div>').appendTo('body');
        var hideTimeout = null;
        var currentRow = null;

        /**
         * Show the floating panel near the given row.
         * Always reads fresh data attributes from the DOM.
         *
         * @param {jQuery} $row
         */
        var show = function($row) {
            currentRow = $row[0];
            clearTimeout(hideTimeout);

            var context = getDetailContext($row, options);
            renderDetailArea(context).then(function(html) {
                // Guard: user may have moved away while render was in flight.
                if (currentRow !== $row[0]) {
                    return;
                }
                $panel.html(html);

                // Position below the row, clamped to viewport.
                var offset = $row.offset();
                var rowH = $row.outerHeight();
                var winW = $(window).width();
                var top = offset.top + rowH + 4;
                var left = offset.left;
                var panelW = Math.min(400, winW - 40);

                if (left + panelW > winW) {
                    left = winW - panelW - 20;
                }
                if (left < 10) {
                    left = 10;
                }

                $panel.css({top: top, left: left, maxWidth: panelW});
                $panel.addClass('show');
                return;
            }).catch(Notification.exception);
        };

        var hide = function() {
            hideTimeout = setTimeout(function() {
                $panel.removeClass('show');
                currentRow = null;
            }, 300);
        };

        var cancelHide = function() {
            clearTimeout(hideTimeout);
        };

        // Keep panel visible while mouse is over it.
        $panel.on('mouseenter', cancelHide);
        $panel.on('mouseleave', hide);

        var rowSelector = options.rowSelector || '[data-detailheader]';

        // Hover triggers.
        $container.on('mouseenter', rowSelector, function() {
            cancelHide();
            show($(this));
        });
        $container.on('mouseleave', rowSelector, hide);

        // Explicit button / link clicks also show the panel.
        $container.on('click', '[data-action="open-details-modal"]', function(e) {
            // Let the browser handle modifier clicks so the real URL can be followed.
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.which === 2) {
                return;
            }
            e.preventDefault();
            e.stopImmediatePropagation();
            var $clicked = $(this);
            var $row = findRow($clicked, $container, e);
            if ($row.length) {
                cancelHide();
                show($row);
                updateHash($clicked);
            }
        });

        // Row clicks also show the panel (for touch devices).
        if (options.rowSelector) {
            $container.on('click', options.rowSelector, function(e) {
                if (isInteractiveChild(e)) {
                    return;
                }
                cancelHide();
                var $row = validateRowTarget($(this), $container, options, e);
                show($row);
                var $trigger = $row.find('[data-detail-id]').first();
                if ($trigger.length) {
                    updateHash($trigger);
                }
            });
        }
    };

    // -------------------------------------------------------------------------
    // Hash-based auto-open & page-level hash management
    // -------------------------------------------------------------------------

    /**
     * If location.hash matches a data-detail-id anywhere on the page,
     * programmatically click the trigger to open its details area.
     *
     * This enables shareable URLs like  https://site.com/my/#dash-detail-b5-c42 :
     * when a user follows such a link the page loads and the correct details
     * area opens automatically.
     *
     * The search is page-level (not scoped to a single container) so it works
     * for ALL layout types — grid, cards, accordion, timeline, etc.
     */
    var autoOpenFromHash = function() {
        var hash = window.location.hash;
        if (!hash || hash.indexOf('#dash-detail-') !== 0) {
            return;
        }
        var detailId = hash.substring(1); // Strip leading '#'.

        // Validate format to prevent selector injection: only allow alphanumeric, dash, underscore.
        if (!/^dash-detail-[\w-]+$/.test(detailId)) {
            return;
        }

        var $trigger = $(document).find('[data-detail-id="' + detailId + '"]').first();
        if ($trigger.length) {
            // Small delay so the layout is fully rendered before triggering.
            setTimeout(function() {
                $trigger[0].click();
                // Scroll the trigger into view.
                if ($trigger[0].scrollIntoView) {
                    $trigger[0].scrollIntoView({behavior: 'smooth', block: 'center'});
                }
            }, 500);
        }
    };

    /**
     * Set up page-level hash management (idempotent — safe to call many times).
     *
     * Binds:
     * 1. A delegated click handler on [data-detail-id] that updates location.hash.
     * 2. A one-time auto-open from the current URL hash.
     */
    var initHash = function() {
        if (hashInitialised) {
            return;
        }
        hashInitialised = true;

        // Page-level delegated handler: update hash when ANY details trigger is clicked.
        // This works for all layouts (grid, cards, accordion, timeline, etc.).
        $(document).on('click', '[data-detail-id]', function(e) {
            // Let modifier-clicks pass through (Ctrl/Cmd/Shift/middle-click).
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.which === 2) {
                return;
            }
            updateHash($(this));
        });

        // Auto-open the details area that matches the URL hash.
        autoOpenFromHash();
    };

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    return {
        /**
         * Initialise details area handling for a container.
         *
         * @param {string} containerSelector CSS selector for the layout container.
         * @param {Object} options Configuration options.
         * @param {string} [options.mode='modal']  Display mode: expanding | floating | modal.
         * @param {string} [options.detailsBgColor]  Background colour for the details panel.
         * @param {string} [options.detailsTextColor]  Text colour for the details panel.
         * @param {string} [options.rowSelector]  CSS selector for clickable/hoverable row elements.
         * @param {string} [options.detailsAreaSize='like_item']  Size: like_item | fit_content.
         */
        init: function(containerSelector, options) {
            // Prevent double-init on the same container (e.g. after AJAX pagination).
            /* if (initialisedContainers[containerSelector]) {
                return;
            }
            initialisedContainers[containerSelector] = true; */

            options = options || {};
            var mode = options.mode || 'modal';
            var $container = $(containerSelector);

            if (!$container.length) {
                return;
            }

            // Remove any stretched-link classes that cause ::after pseudo-elements
            // to intercept clicks on the wrong row (the ::after covers the nearest
            // position:relative ancestor, which in tables may be the entire table).
            // Preserve stretched-link on the details open link itself.
            $container.find('.stretched-link').not('.dash-details-open-link').removeClass('stretched-link');

            // Apply CSS marker classes for mode and size on the container
            // so that CSS can style the layout appropriately.
            var sizeClass = (options.detailsAreaSize === 'fit_content')
                ? 'dash-details-size-fit-content'
                : 'dash-details-size-like-item';
            $container.addClass('dash-details-enabled');
            $container.addClass('dash-details-mode-' + mode);
            $container.addClass(sizeClass);

            switch (mode) {
                case 'expanding':
                    initExpanding($container, options);
                    break;
                case 'floating':
                    initFloating($container, options);
                    break;
                case 'modal':
                default:
                    initModal($container, options);
                    break;
            }

            // Set up page-level hash management (auto-open from URL hash,
            // update hash on click).  Idempotent — safe to call from every init.
            initHash();
        },

        /**
         * Initialise ONLY hash-based features (auto-open & hash-update on click)
         * without binding any mode handlers.
         *
         * Call this from layouts that manage their own click/hover handling
         * (e.g. the cards layout) so the shareable-URL feature still works.
         *
         * Usage:
         *   require(['block_dash/details_area'], function(DetailsArea) {
         *       DetailsArea.hashInit();
         *   });
         */
        hashInit: function() {
            initHash();
        }
    };
});
