package com.focusblocker.guard

/**
 * v1.4.9 — built-in "Strict Adult Content Lock" list.
 *
 * The owner's third blocking option: one switch that adds this whole list to the
 * guard without touching the user's own keyword/domain lists. Entries are kept
 * in the same shape the guard already understands:
 *
 *  * KEYWORDS are matched whole-word (the v1.2.0 matcher folds Persian/Arabic
 *    spelling + ZWNJ before comparing), so "sex" never fires inside "Sussex".
 *  * DOMAINS are bare hosts matched as suffix, so `pornhub.com` also catches
 *    `de.pornhub.com`.
 *
 * Honest limit (kept in the UI text too): the guard can only read TEXT and web
 * ADDRESSES on screen. It cannot classify images or video — no local model
 * ships with this app — so this list is a strong filter, not a detector.
 *
 * Keep entries lowercase, one per line, and add nothing ambiguous: a false
 * positive closes a legitimate app.
 */
object AdultFilter {

  val KEYWORDS: List<String> = listOf(
    // ---------------------------------------------------------------- English
    "porn", "porno", "pornography", "xxx", "nsfw",
    "sex", "sexy", "sexting", "sexcam",
    "nude", "nudes", "nudity", "naked",
    "erotic", "erotica", "hentai", "ecchi", "doujin",
    "milf", "blowjob", "handjob", "cumshot", "creampie",
    "anal sex", "oral sex", "orgasm", "orgy",
    "masturbation", "masturbate", "dildo",
    "camgirl", "camsex", "webcam sex", "livejasmin",
    "striptease", "stripper", "strip club",
    "bdsm", "fetish", "incest", "threesome", "gangbang",
    "onlyfans", "fansly", "chaturbate", "stripchat",
    "pornhub", "xvideos", "xhamster", "xnxx",
    "teen sex", "amateur porn", "adult video", "adult movie",
    // ---------------------------------------------------------------- Persian
    "سکس", "سکسی", "سکس‌چت", "سکس چت",
    "پورن", "پورنو", "پورنوگرافی",
    "برهنه", "لخت", "لختی",
    "شهوانی", "شهوت", "شهوت‌انگیز",
    "ارگاسم", "انزال", "خودارضایی", "استمنا",
    "فیلم سوپر", "سایت سوپر", "فیلم مستهجن", "مستهجن",
    "جنده", "روسپی", "فاحشه", "تن‌فروشی",
    "کوس", "کیر", "کص", "کون",
    "چت جنسی", "دوست جنسی", "رابطه جنسی", "برده جنسی", "سادیسم"
  )

  val DOMAINS: List<String> = listOf(
    // Big tubes
    "pornhub.com", "pornhub.org", "xvideos.com", "xnxx.com",
    "xhamster.com", "xhamster2.com", "xhamster19.com", "xhaccess.com",
    "redtube.com", "youporn.com", "spankbang.com", "txxx.com",
    "eporner.com", "hqporner.com", "beeg.com", "motherless.com",
    "xmoviesforyou.com", "porn.com", "sex.com", "porn300.com",
    "ixxx.com", "tubegalore.com", "fuq.com", "drtuber.com",
    // Cams / subscriptions
    "chaturbate.com", "stripchat.com", "onlyfans.com", "fansly.com",
    "cam4.com", "livejasmin.com", "bongacams.com", "myfreecams.com",
    "camsoda.com", "jerkmate.com", "flirt4free.com",
    // Asian / hentai / image boards
    "javhd.com", "javbus.com", "missav.com", "supjav.com",
    "hanime.tv", "nhentai.net", "hentaihaven.xxx",
    "rule34.xxx", "rule34.paheal.net", "e621.net",
    "gelbooru.com", "danbooru.donmai.us", "sankakucomplex.com",
    "imagefap.com", "8muses.com",
    // Stories / comics
    "literotica.com", "nifty.org", "asstr.org", "f95zone.to"
  )
}
