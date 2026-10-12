/* 恋爱清单（复刻 list.php）：已完成/未完成样式 + 点击展开图片 */
(function () {
  "use strict"
  window.LG = window.LG || {}
  window.LG.pageTitle = "恋爱事件"

  window.LG.onReady = function (data) {
    var esc = window.LG.esc
    var anim = data.site.animation ? "animated fadeInUp delay-03s" : ""
    var host = document.getElementById("lovelist")
    var animHost = document.getElementById("list-anim")
    if (animHost) animHost.className = "list_texts " + anim
    var items = data.wishes || []
    if (!items.length) {
      host.innerHTML = '<div style="color:#999;padding:40px 0">还没有清单，快去后台添加吧～</div>'
      return
    }
    host.innerHTML = items
      .map(function (w) {
        var done = w.done
        var iconCls = done ? "iconfont icon-chenggong2 com" : "iconfont icon-chenggong2 air"
        var spanCls = done ? "success" : "unfinished"
        var imgIcon = w.image ? '<svg class="icon" aria-hidden="true"><use xlink:href="#icon-tupian"></use></svg>' : ""
        var img = w.image ? '<img data-funlazy="' + esc(w.image) + '" alt="' + esc(w.text) + '">' : ""
        return (
          '<li class="cike">' +
          '<i class="' + iconCls + '"></i>' +
          '<span class="' + spanCls + '">' + esc(w.text) + "</span>" +
          imgIcon +
          "</li>" +
          "<ul><li>" + img + "</li></ul>"
        )
      })
      .join("")

    var $ = window.jQuery
    if ($) {
      $(".lovelist ul").hide()
      $(".lovelist > li").on("click", function () {
        $(this).next("ul").slideToggle(500).siblings("ul").slideUp(500)
      })
    }
    if (window.FunLazy) {
      window.FunLazy({ placeholder: "/Style/img/Loading2.gif", effect: "show", strictLazyMode: false, useErrorImagePlaceholder: "/Style/img/error.svg" })
    }
    if ($) $(".lovelist img").addClass("spotlight")
  }
})()
