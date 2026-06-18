/**
 * footnote.js — page sharing link (footnote toolbar)
 *
 * ⚠️ HOME: Travel Website/assets/footnote.js — PERMANENT. Lives next to
 * toolbar.js inside assets/. toolbar.js loads it from {base}assets/footnote.js.
 *
 * Injects a centered sharing URL as the very last element of <body>.
 * Loaded automatically by toolbar.js — no per-page script tag needed.
 * Can also be included standalone on pages without the navigation toolbar.
 *
 * To suppress on a specific page, add data-no-footnote="1" to the toolbar-mount div
 * (or to any element with id="toolbar-mount" before this script runs).
 */
(function () {
  'use strict';

  if (document.querySelector('[data-no-footnote]')) return;

  var SITE_BASE   = 'https://dbellinello.github.io/Travel/';
  var decodedPath = decodeURIComponent(location.pathname);
  if (decodedPath.indexOf('.html') < 0 && decodedPath.charAt(decodedPath.length - 1) !== '/') return;

  var shareUrl, shareText;
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    shareUrl  = location.origin + location.pathname;
    shareText = (location.host + decodeURIComponent(location.pathname)).replace(/^www\./, '');
  } else {
    var fm  = decodedPath.match(/\/(?:travel|travel_guides|Travel)\/(.+)$/);
    var sub = fm ? fm[1] : (decodedPath.split('/').pop() || '');
    shareUrl  = SITE_BASE + sub.split('/').map(encodeURIComponent).join('/');
    shareText = SITE_BASE.replace(/^https?:\/\//, '') + sub;
  }

  var foot = document.createElement('div');
  foot.className = 'tb-footnote';
  foot.style.cssText = 'text-align:center;margin:48px 0 0;padding:0 16px 24px;font-size:11px;' +
    'word-break:break-all;overflow-wrap:anywhere';   /* long URLs wrap on narrow mobile screens */

  var fa = document.createElement('a');
  fa.href       = shareUrl;
  fa.target     = '_blank';
  fa.style.cssText = 'color:#9a9890;text-decoration:none;font-weight:normal';
  fa.textContent   = shareText;
  foot.appendChild(fa);

  /* Always appended directly to <body> — genuinely the last element on the page,
     regardless of content wrappers (.container, .wrap, etc.)                    */
  function place() {
    document.body.appendChild(foot);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', place);
  } else {
    place();
  }
}());
