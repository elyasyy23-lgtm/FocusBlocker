/*
 * Tavakkol site — shared page script.
 *
 * One language engine for every page. A page only supplies its own English
 * strings in `window.I18N_EN` BEFORE this file loads; everything else (the
 * Persian source markup, the toggle buttons, dir/lang switching, localStorage
 * persistence) is handled here, identically on the home page and on every app
 * detail page. Adding a page = copy the header markup + give it a dict.
 *
 * Events: dispatches `tavakkol:lang` with { detail: { lang } } after every
 * switch, so page-specific widgets (download counters etc.) can react.
 */
(function () {
  var EN = window.I18N_EN || {};

  var textEls = Array.prototype.slice.call(document.querySelectorAll('[data-i18n]'));
  var attrEls = Array.prototype.slice.call(
    document.querySelectorAll(
      '[data-i18n-title],[data-i18n-aria],[data-i18n-alt],[data-i18n-placeholder]'
    )
  );
  var metaEls = [
    { id: 'page-title', kind: 'text', key: 'meta.title' },
    { id: 'meta-description', kind: 'content', key: 'meta.description' },
    { id: 'og-title', kind: 'content', key: 'meta.title' },
    { id: 'og-description', kind: 'content', key: 'meta.description' },
    { id: 'tw-title', kind: 'content', key: 'meta.title' },
    { id: 'tw-description', kind: 'content', key: 'meta.description' },
    { id: 'og-site-name', kind: 'content', key: 'meta.siteName' }
  ].map(function (entry) {
    return { el: document.getElementById(entry.id), kind: entry.kind, key: entry.key };
  });

  /* Cache the Persian originals once, so switching back is lossless. */
  var faText = new Map();
  textEls.forEach(function (el) { faText.set(el, el.innerHTML); });

  var faAttr = new Map();
  attrEls.forEach(function (el) {
    faAttr.set(el, {
      title: el.getAttribute('title'),
      'aria-label': el.getAttribute('aria-label'),
      alt: el.getAttribute('alt'),
      placeholder: el.getAttribute('placeholder')
    });
  });

  var faMeta = new Map();
  metaEls.forEach(function (entry) {
    if (!entry.el) return;
    faMeta.set(entry, entry.kind === 'text' ? entry.el.textContent : entry.el.getAttribute('content'));
  });

  var enMode = false;
  var buttons = Array.prototype.slice.call(document.querySelectorAll('.lang button'));

  function setAttr(el, attr, dataAttr) {
    var key = el.getAttribute(dataAttr);
    if (!key) return;
    var original = faAttr.get(el) || {};
    var value = enMode ? EN[key] : original[attr];
    if (typeof value === 'string') el.setAttribute(attr, value);
  }

  function apply(lang) {
    enMode = lang === 'en';

    textEls.forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var value = enMode ? EN[key] : faText.get(el);
      if (typeof value === 'string') el.innerHTML = value;
    });

    attrEls.forEach(function (el) {
      setAttr(el, 'title', 'data-i18n-title');
      setAttr(el, 'aria-label', 'data-i18n-aria');
      setAttr(el, 'alt', 'data-i18n-alt');
      setAttr(el, 'placeholder', 'data-i18n-placeholder');
    });

    metaEls.forEach(function (entry) {
      if (!entry.el) return;
      var value = enMode ? EN[entry.key] : faMeta.get(entry);
      if (typeof value !== 'string') return;
      if (entry.kind === 'text') entry.el.textContent = value;
      else entry.el.setAttribute('content', value);
    });

    document.documentElement.lang = enMode ? 'en' : 'fa';
    document.documentElement.dir = enMode ? 'ltr' : 'rtl';
    document.documentElement.classList.toggle('lang-en', enMode);
    window.TAVAKKOL_LANG = lang;

    buttons.forEach(function (button) {
      var active = button.getAttribute('data-lang') === lang;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    document.dispatchEvent(new CustomEvent('tavakkol:lang', { detail: { lang: lang } }));
  }

  buttons.forEach(function (button) {
    button.addEventListener('click', function () {
      var lang = button.getAttribute('data-lang') === 'en' ? 'en' : 'fa';
      try { localStorage.setItem('tavakkol_lang', lang); } catch (error) {}
      apply(lang);
    });
  });

  /*
   * Tag a download URL with its version. Chrome treats a repeated identical
   * URL as "download this file again?" and renames the copy to `name (1).apk`;
   * a changing query string avoids that while the filename stays stable.
   */
  window.siteVersionedUrl = function (base, tag) {
    if (!base || !tag) return base;
    var separator = base.indexOf('?') === -1 ? '?' : '&';
    return base + separator + 'v=' + encodeURIComponent(String(tag));
  };

  apply(window.TAVAKKOL_LANG === 'en' ? 'en' : 'fa');
})();
