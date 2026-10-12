/* 文章详情（复刻 page.php，?id= 读取单篇，内容经白名单清洗） */
(function () {
  "use strict"
  window.LG = window.LG || {}
  window.LG.pageTitle = "点点滴滴"

  window.LG.onReady = function (data) {
    var esc = window.LG.esc
    var sanitize = window.LG.sanitizeHTML
    var id = new URLSearchParams(location.search).get("id")
    var host = document.getElementById("article-detail")
    var anim = data.site.animation ? "animated fadeInUp delay-03s" : ""

    var article = (data.stories || []).filter(function (a) { return a.id === id })[0]
    if (!article) {
      host.innerHTML =
        '<div class="card col-lg-12 col-md-12 col-sm-12 col-sm-x-12"><div class="little_texts" style="padding:40px;text-align:center">参数错误或页面不存在！<br><a href="/little.html">返回列表</a></div></div>'
      return
    }
    document.title = data.site.title + " — " + article.title
    host.innerHTML =
      '<div class="card col-lg-12 col-md-12 col-sm-12 col-sm-x-12 ' + anim + '">' +
      '<div class="little_texts">' +
      '<div class="top-title f2">' + esc(article.title) +
      '<svg class="little_icon" aria-hidden="true"><use xlink:href="#icon-zhankai"></use></svg></div>' +
      '<div class="info"><span><svg class="little_icon" aria-hidden="true"><use xlink:href="#icon-shoucang"></use></svg>' +
      esc(article.author) + " <i>记录于</i> " + esc(article.date) + "</span></div>" +
      '<div class="line-top"></div>' +
      '<div id="md-view" class="file">' + sanitize(article.content) + "</div>" +
      '<div class="line"><p><svg class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"><path d="M512 85.3c235.3 0 426.7 191.4 426.7 426.7 0 235.3-191.4 426.7-426.7 426.7S85.3 747.3 85.3 512C85.3 276.7 276.7 85.3 512 85.3m0-64C241 21.3 21.3 241 21.3 512S241 1002.7 512 1002.7 1002.7 783 1002.7 512 783 21.3 512 21.3z" fill="#b5b5b5"></path><path d="M512 277.3m-64 0a64 64 0 1 0 128 0 64 64 0 1 0-128 0Z" fill="#b5b5b5"></path><path d="M512 810.7c-35.3 0-64-28.7-64-64v-256c0-35.3 28.7-64 64-64s64 28.7 64 64v256c0 35.3-28.7 64-64 64z" fill="#b5b5b5"></path></svg> The content ends here.</p></div>' +
      "</div></div>"
    // 清洗后再初始化视频与懒加载
    if (window.LG.setupVideo && window.jQuery) window.jQuery("#md-view video").each(function () { window.LG.setupVideo(window.jQuery(this)) })
    if (window.FunLazy) window.FunLazy({ placeholder: "/Style/img/Loading2.gif", effect: "show", strictLazyMode: false, useErrorImagePlaceholder: "/Style/img/error.svg" })
  }
})()
