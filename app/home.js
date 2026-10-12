/* 首页：实时计时 + 五张导航卡片（复刻 index.php） */
(function () {
  "use strict"
  window.LG = window.LG || {}
  window.LG.pageTitle = "首页"

  var timer = null
  function tick(data) {
    var el = document.getElementById("span_dt_dt")
    if (!el) return
    var start = new Date(data.site.startTime).getTime()
    var diff = Date.now() - start
    var s = Math.max(0, Math.floor(diff / 1000))
    var d = Math.floor(s / 86400); s %= 86400
    var h = Math.floor(s / 3600); s %= 3600
    var m = Math.floor(s / 60); s %= 60
    document.getElementById("span_dt_dt").innerHTML = "这是我们一起走过的"
    document.getElementById("tian").innerHTML = d + "天"
    document.getElementById("shi").innerHTML = h + "时"
    document.getElementById("fen").innerHTML = m + "分"
    document.getElementById("miao").innerHTML = (s < 10 ? "0" + s : s) + "秒"
  }

  function renderCards(data) {
    var s = data.site
    var anim = s.animation ? "animated fadeInUp" : ""
    var esc = window.LG.esc
    var cards = [
      { cls: "card col-lg-4 col-sm-12 col-sm-x-12 flex-h", img: "/Style/img/card/likegirl_card_1.svg", name: s.card1, dec: s.deci1, href: "/little.html" },
      { cls: "card col-lg-4 col-sm-12 col-sm-x-12 flex-h", img: "/Style/img/card/likegirl_card_2.svg", name: s.card2, dec: s.deci2, href: "/leaving.html" },
      { cls: "card col-lg-4 col-sm-12 col-sm-x-12 flex-h", img: "/Style/img/card/likegirl_card_3.svg", name: s.card3, dec: s.deci3, href: "/about.html" },
      { cls: "card-b col-lg-6 col-12 col-sm-12 flex-h", img: "/Style/img/card/likegirl_card_4.svg", name: "Love Photo", dec: "恋爱相册 记录最美瞬间", href: "/loveImg.html" },
      { cls: "card-b col-lg-6 col-12 col-sm-12 flex-h", img: "/Style/img/card/likegirl_card_5.svg", name: "Love List", dec: "恋爱列表 你我之间的约定", href: "/list.html" },
    ]
    document.getElementById("home-cards").innerHTML = cards.map(function (c) {
      return (
        '<div class="' + c.cls + " " + anim + '">' +
        '<img src="' + c.img + '">' +
        '<div class="text"><span><a target="_self" href="' + c.href + '">' + esc(c.name) + "</a></span><p>" + esc(c.dec) + "</p></div>" +
        "</div>"
      )
    }).join("")
  }

  window.LG.onReady = function (data) {
    renderCards(data)
    tick(data)
    timer = setInterval(function () { tick(data) }, 1000)
  }
  window.addEventListener("beforeunload", function () { if (timer) clearInterval(timer) })
})()
