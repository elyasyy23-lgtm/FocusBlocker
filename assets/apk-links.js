/*
 * Stable APK filenames + a fresh cache-busting tag.
 * -------------------------------------------------
 * Every download button points at the SAME filename for ever
 * (RakaatCounter-release.apk), so Chrome never shows the
 * "Download file again?" prompt and never renames the file.
 *
 * The only thing that changes between releases is the query string:
 * we ask the GitHub API for the newest tag and append ?v=<tag>.
 * If the API fails (offline, rate limit) the plain link still works.
 *
 * Usage:  <a href="RakaatCounter-release.apk"
 *            data-repo="elyasyy23-lgtm/RakaatCounter">…</a>
 */
(function () {
  'use strict';

  var links = Array.prototype.slice.call(document.querySelectorAll('a[data-repo][href$=".apk"]'));
  if (!links.length) return;

  var groups = {};
  links.forEach(function (link) {
    var repo = link.getAttribute('data-repo');
    if (!repo) return;
    (groups[repo] = groups[repo] || []).push(link);
  });

  function stamp(url, tag) {
    var separator = url.indexOf('?') === -1 ? '?' : '&';
    return url + separator + 'v=' + encodeURIComponent(tag);
  }

  Object.keys(groups).forEach(function (repo) {
    fetch('https://api.github.com/repos/' + repo + '/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' }
    })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (release) {
        var tag = release && release.tag_name;
        if (!tag) return;
        groups[repo].forEach(function (link) {
          link.href = stamp(link.getAttribute('href'), tag);
        });
      })
      .catch(function () { /* plain link still downloads fine */ });
  });
})();
