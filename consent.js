/* ==========================================================================
   consent.js — minimal consent banner that gates ad scripts.

   Behaviour:
   - No stored choice  -> show banner, load no ad scripts.
   - Choice = accepted -> loadAdScripts() runs (paste the AdSense loader
     inside that function after approval).
   - Choice = declined -> nothing loads.
   - The footer link with id="manage-consent" (present on every page)
     reopens the banner so the choice can be changed at any time.

   If a Google-certified CMP is adopted later, it replaces this file: keep
   the same contract (block ad scripts until an explicit choice exists).
   ========================================================================== */

(function () {
  "use strict";

  var STORAGE_KEY = "adConsentChoice"; // "accepted" | "declined"

  function getChoice() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null; // storage unavailable -> treat as no choice, load nothing
    }
  }

  function setChoice(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (e) {
      /* storage unavailable: choice lasts for this page view only */
    }
  }

  function loadAdScripts() {
    /* ------------------------------------------------------------------
       AdSense loader goes here after approval, e.g.:

       var s = document.createElement("script");
       s.async = true;
       s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX";
       s.crossOrigin = "anonymous";
       document.head.appendChild(s);

       Until then this is a deliberate no-op: the .ad-slot containers stay
       empty and keep their reserved height.
       ------------------------------------------------------------------ */
  }

  function removeBanner() {
    var el = document.getElementById("consent-banner");
    if (el) el.parentNode.removeChild(el);
  }

  function showBanner() {
    if (document.getElementById("consent-banner")) return;

    var banner = document.createElement("div");
    banner.id = "consent-banner";
    banner.className = "consent-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", "Cookie consent");

    banner.innerHTML =
      '<div class="inner">' +
      "<p>This site plans to show ads, which use cookies to work. " +
      "Nothing loads until you choose, and you can change your choice any " +
      'time via “Cookie settings” in the footer. Details in the ' +
      '<a href="privacy.html">privacy policy</a>.</p>' +
      '<div class="buttons">' +
      '<button type="button" class="decline">Decline</button>' +
      '<button type="button" class="accept">Accept</button>' +
      "</div></div>";

    banner.querySelector("button.accept").addEventListener("click", function () {
      setChoice("accepted");
      removeBanner();
      loadAdScripts();
    });

    banner.querySelector("button.decline").addEventListener("click", function () {
      setChoice("declined");
      removeBanner();
    });

    document.body.appendChild(banner);
  }

  function init() {
    var choice = getChoice();
    if (choice === "accepted") {
      loadAdScripts();
    } else if (choice !== "declined") {
      showBanner();
    }

    // Any "Cookie settings" link reopens the banner (footer on every page,
    // plus in-text links such as on the privacy page).
    var links = document.querySelectorAll("#manage-consent, .manage-consent");
    Array.prototype.forEach.call(links, function (link) {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        showBanner();
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
