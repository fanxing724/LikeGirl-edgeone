/* 点点滴滴 文章列表（复刻 little.php） */
(function () {
  "use strict"
  window.LG = window.LG || {}
  window.LG.pageTitle = "点点滴滴"

  window.LG.onReady = function (data) {
    var esc = window.LG.esc
    var anim = data.site.animation ? "animated fadeInUp delay-03s" : ""
    document.getElementById("little-title").textContent = data.site.deci1
    var list = data.stories || []
    var host = document.getElementById("article-list")
    if (!list.length) {
      host.innerHTML = '<div class="central" style="color:#999;padding:40px 0">还没有记录，快去后台添加吧～</div>'
      return
    }
    host.innerHTML = list
      .map(function (a) {
        return (
          '<div class="card col-lg-12 col-md-12 col-sm-12 col-sm-x-12 ' + anim + '">' +
          '<div class="little_texts">' +
          '<a href="/page.html?id=' + encodeURIComponent(a.id) + '">' +
          '<div class="top-title textOneHide">' + esc(a.title) +
          '<svg class="little_icon" aria-hidden="true"><use xlink:href="#icon-zhankai"></use></svg>' +
          "</div></a>" +
          '<div class="info"><span><svg class="little_icon" aria-hidden="true"><use xlink:href="#icon-shoucang"></use></svg>' +
          esc(a.author) + " <i>记录于</i> " + esc(a.date) + "</span></div>" +
          "</div></div>"
        )
      })
      .join("")
  }
})()
