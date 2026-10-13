/**
 * LikeGirl CE — 公共前端脚本
 * 负责拉取 /api/data，注入原版页头/页脚 DOM（复用 Style/ 与 Botui/ 资源），
 * 并提供各页面共用的工具函数与交互初始化。
 * 作为经典脚本加载，运行于 jQuery/Vue/BotUI/spotlight/funlazy 等库之后。
 */
(function () {
  "use strict"

  /* -------------------- 工具函数 -------------------- */
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    })
  }
  // logo 中 {xx} -> <b>xx</b>，复刻原版 preg_replace
  function logoHtml(logo) {
    return esc(logo).replace(/\{([^}]+)\}/g, "<b>$1</b>")
  }
  function qqAvatar(qq, size) {
    var s = size || 640
    return qq ? "https://q1.qlogo.cn/g?b=qq&nk=" + encodeURIComponent(qq) + "&s=" + s : ""
  }
  // 复刻原版 time_tran：把时间戳/ISO 字符串转成“刚刚/x分钟前”
  function timeTran(t) {
    if (!t) return ""
    var d = t instanceof Date ? t : new Date(t)
    var time = d.getTime()
    if (isNaN(time)) return ""
    var cur = Date.now()
    var diff = Math.floor((cur - time) / 1000)
    if (diff < 0) return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate())
    if (diff < 60) return "刚刚"
    if (diff < 3600) return Math.floor(diff / 60) + "分钟前"
    if (diff < 86400) return Math.floor(diff / 3600) + "小时前"
    if (diff < 2592000) return Math.floor(diff / 86400) + "天前"
    if (diff < 31536000) return Math.floor(diff / 2592000) + "月前"
    return Math.floor(diff / 31536000) + "年前"
  }
  function pad(n) {
    return n < 10 ? "0" + n : "" + n
  }
  function fmtDateTime(t) {
    var d = t instanceof Date ? t : new Date(t)
    if (isNaN(d.getTime())) return ""
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds())
  }

  /* -------------------- 文章 HTML 白名单清洗 -------------------- */
  var ALLOWED_TAGS = {
    QUOTE: 1, HR: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, B: 1, S: 1, I: 1, EM: 1,
    STRONG: 1, U: 1, CODE: 1, CENTER: 1, IMG: 1, VIDEO: 1, SOURCE: 1, A: 1, P: 1, BR: 1,
    UL: 1, OL: 1, LI: 1, SPAN: 1, DIV: 1, FONT: 1, BLOCKQUOTE: 1, PRE: 1, TABLE: 1,
    THEAD: 1, TBODY: 1, TR: 1, TD: 1, TH: 1,
  }
  var ALLOWED_ATTR = /^(href|src|alt|title|width|height|style|controls|target|colspan|rowspan|color|size|face|align|valign|class)$/i
  function sanitizeHTML(htmlStr) {
    var doc = new DOMParser().parseFromString("<div>" + htmlStr + "</div>", "text/html")
    walk(doc.body)
    return doc.body.innerHTML
  }
  function walk(node) {
    var children = [].slice.call(node.childNodes)
    for (var i = 0; i < children.length; i++) {
      var el = children[i]
      if (el.nodeType === 1) {
        var tag = el.tagName
        if (!ALLOWED_TAGS[tag]) {
          // 保留内部文本与子节点，移除危险标签本身
          while (el.firstChild) node.insertBefore(el.firstChild, el)
          node.removeChild(el)
          continue
        }
        // 清理属性
        var attrs = [].slice.call(el.attributes)
        for (var j = 0; j < attrs.length; j++) {
          var name = attrs[j].name
          var val = attrs[j].value
          if (name.toLowerCase().indexOf("on") === 0 || !ALLOWED_ATTR.test(name)) {
            el.removeAttribute(name)
          } else if ((name === "href" || name === "src") && /^\s*javascript:/i.test(val)) {
            el.removeAttribute(name)
          }
        }
        walk(el)
      } else if (el.nodeType === 8) {
        node.removeChild(el) // 注释节点移除
      }
    }
  }

  /* -------------------- 数据拉取 -------------------- */
  var dataPromise = null
  function fetchData(refresh) {
    if (dataPromise && !refresh) return dataPromise
    dataPromise = fetch("/api/data", { headers: { Accept: "application/json" }, cache: "no-store" })
      .then(function (r) {
        return r.json().then(function (body) {
          if (!r.ok) throw new Error(body.error || "HTTP " + r.status)
          return body
        })
      })
      .catch(function (e) {
        console.error("[LikeGirl] 数据加载失败", e)
        dataPromise = null
        var errorBox = document.getElementById("lg-data-error")
        if (!errorBox) {
          errorBox = document.createElement("div")
          errorBox.id = "lg-data-error"
          errorBox.setAttribute("role", "alert")
          errorBox.style.cssText = "position:fixed;inset:16px 16px auto;z-index:999999;background:#fff;padding:16px;border:1px solid #ff5295;border-radius:12px;color:#46314f;text-align:center"
          document.body.appendChild(errorBox)
        }
        errorBox.textContent = e.message + "。"
        var retry = document.createElement("button")
        retry.type = "button"
        retry.textContent = "重新加载"
        retry.addEventListener("click", function () { location.reload() })
        errorBox.appendChild(retry)
        return null
      })
    return dataPromise
  }

  /* -------------------- 页头 / 页脚 DOM 注入 -------------------- */
  var WAVES_SVG =
    '<svg class="waves" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 24 150 28" preserveAspectRatio="none" shape-rendering="auto">' +
    '<defs><path id="gentle-wave" d="M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v44h-352z" /></defs>' +
    '<g class="parallax">' +
    '<use xlink:href="#gentle-wave" x="48" y="0" fill="rgba(255,255,255,0.7" />' +
    '<use xlink:href="#gentle-wave" x="48" y="3" fill="rgba(255,255,255,0.5)" />' +
    '<use xlink:href="#gentle-wave" x="48" y="5" fill="rgba(255,255,255,0.3)" />' +
    '<use xlink:href="#gentle-wave" x="48" y="7" fill="#fff" />' +
    "</g></svg>"

  function renderHeader(data) {
    var s = data.site
    var host = document.getElementById("lg-header")
    if (!host) return
    var anim = s.animation ? "animated fadeInDown" : ""
    var blurOff = s.blur === false ? "Blurkg" : ""
    host.innerHTML =
      '<div class="header-wrap"><div class="header">' +
      '<div class="logo"><h1><a class="alogo" href="/index.html">' + logoHtml(s.logo) + "</a></h1></div>" +
      '<div class="word" data-tip="' + esc(s.writing) + '" data-tip-position="bottom"><span class="wenan">' + esc(s.writing) + "</span></div>" +
      "</div></div>" +
      '<div class="bg-wrap"><div class="bg-img"><div class="central central-800">' +
      '<div class="middle ' + anim + " " + blurOff + '">' +
      '<div class="img-male"><img src="' + esc(qqAvatar(s.boyQQ, 640)) + '" draggable="false"><span>' + esc(s.boy) + "</span></div>" +
      '<div class="love-icon"><img src="/Style/img/like.svg" draggable="false"></div>' +
      '<div class="img-female"><img src="' + esc(qqAvatar(s.girlQQ, 640)) + '" draggable="false"><span>' + esc(s.girl) + "</span></div>" +
      "</div></div>" + WAVES_SVG + "</div></div>" +
      "<style>" +
      '.bg-img{background:url("' + esc(s.background).replace(/"/g, "") + '") no-repeat center !important;background-size:cover !important;}' +
      ".wenan{color:rgb(97 97 97);transition:all 0.2s linear;}" +
      ".alogo{color:rgb(97 97 97);transition:all 0.2s linear;}" +
      "::selection{background:#6f6f6fc7;color:#ffffff;}" +
      "::-moz-selection{background:#6f6f6fc7;color:#ffffff;}" +
      ".delay-03s{-webkit-animation-delay:.3s;animation-delay:.3s;}" +
      ".Blurkg{backdrop-filter:blur(0px) !important;-webkit-backdrop-filter:blur(0px) !important;background:transparent !important;}" +
      ".cpt-loading-mask.column{background:transparent !important;}" +
      "</style>" +
      (s.customCss ? "<style>" + s.customCss + "</style>" : "") +
      (s.headHtml ? s.headHtml : "")
  }

  function renderFooter(data) {
    var s = data.site
    var host = document.getElementById("lg-footer")
    if (!host) return
    var icp = s.icp ? '<p><img src="/Style/img/icp.svg"><a href="https://beian.miit.gov.cn/#/Integrated/index" target="_blank">' + esc(s.icp) + "</a></p>" : ""
    var copy = s.copyright ? "<p>" + esc(s.copyright) + "</p>" : ""
    var foot = icp || copy ? '<div class="footer-warp"><div class="footer">' + icp + copy + "</div></div>" : ""
    host.innerHTML =
      '<div class="lg-sidebar"><ul>' +
      '<li class="lg-sidebar-item" title="返回顶部" id="lg-top"><svg class="lg-sidebar-icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"><path d="M898.346667 932.693333c-9.088 9.088-18.176 9.088-31.744 4.565334L512.853333 738.133333l-354.346666 200.234667c-13.653333 4.522667-22.741333 4.522667-31.786667-4.522667-9.045333-9.045333-9.045333-18.133333-9.045333-27.221333l373.418666-835.626667c0.042667-9.045333 13.653333-13.653333 22.741334-13.653333 9.088 0 18.133333 9.045333 22.656 13.568l366.421333 839.125333c4.48 4.522667-0.042667 18.133333-4.608 22.698667z" fill="#ffffff"></path></svg></li>' +
      '<li class="lg-sidebar-item" title="小站首页" id="lg-home"><a href="/index.html" style="display:none;"></a><svg class="lg-sidebar-icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"><path d="M920.38 408.41L584.24 65.21c-0.3-0.3-0.6-0.59-0.92-0.88-19.1-17.18-44.43-26.65-71.33-26.65-26.89 0-52.23 9.46-71.33 26.65-0.32 0.28-0.62 0.58-0.92 0.88l-336.12 343.2c-3.52 3.6-5.48 8.31-5.48 13.19v474.47c0.01 50.74 45.48 92.02 101.35 92.02H347.6c11.43 0 20.69-8.72 20.69-19.47V699.74c0-29.27 26.9-53.09 59.95-53.09h167.5c33.06 0 59.95 23.81 59.95 53.09v268.89c0 10.75 9.26 19.47 20.69 19.47h148.11c55.88 0 101.34-41.28 101.34-92.03V421.61c0.02-4.89-1.93-9.6-5.45-13.2z" fill="#ffffff"></path></svg></li>' +
      "</ul></div>" +
      '<style>.icon{width:1.5em;height:1.5em;vertical-align:-0.3em;fill:currentColor;overflow:hidden;}li.cike{border-bottom:1px solid #ddd;}li{list-style-type:none;}.cike:hover{cursor:pointer;cursor:url(/Style/cur/hover.cur),pointer;}button:disabled{background:#888;opacity:0.6;}.avatar{width:3em;height:3em;border-radius:50%;box-shadow:0 2px 20px #c5c5c575;border:2px solid #fff;margin-right:0.8rem;}</style>' +
      foot +
      (s.footerHtml ? s.footerHtml : "")
  }

  /* -------------------- 公共交互初始化 -------------------- */
  function initCommon() {
    var $ = window.jQuery
    // 侧栏按钮
    var top = document.getElementById("lg-top")
    if (top && $) top.onclick = function () { $("html,body").animate({ scrollTop: 0 }, 500) }
    var home = document.getElementById("lg-home")
    if (home) home.onclick = function () { location.href = "/index.html" }

    if (!$) return

    // 悬浮提示
    var $tip = null
    function showTip($el) {
      var txt = $el.data("tip") || ""
      var pos = $el.data("tip-position") || "top"
      if (!txt) return
      if (!$tip) $tip = $('<div class="custom-tooltip"></div>').appendTo("body")
      $tip.text(txt).removeClass("top bottom left right").addClass(pos).show()
      var offset = $el.offset(), ew = $el.outerWidth(), eh = $el.outerHeight()
      $tip.css({ visibility: "hidden", display: "block" })
      var tw = $tip.outerWidth(), th = $tip.outerHeight()
      var t = 0, l = 0
      if (pos === "top") { t = offset.top - th - 10; l = offset.left + (ew - tw) / 2 }
      else if (pos === "bottom") { t = offset.top + eh + 10; l = offset.left + (ew - tw) / 2 }
      else if (pos === "left") { t = offset.top + (eh - th) / 2; l = offset.left - tw - 10 }
      else { t = offset.top + (eh - th) / 2; l = offset.left + ew + 10 }
      var vw = $(window).width(), dh = $(document).height()
      if (l < 10) l = 10
      if (l + tw > vw - 10) l = vw - tw - 10
      if (t < 10) t = 10
      if (t + th > dh - 10) t = dh - th - 10
      $tip.css({ top: t + "px", left: l + "px", visibility: "visible", opacity: 1 })
    }
    $(document).on({ mouseenter: function () { showTip($(this)) }, mouseleave: function () { if ($tip) $tip.hide() } }, "[data-tip]")
    $(window).on("scroll touchstart touchmove", function () { if ($tip) $tip.hide() })

    // 卡片点击跳转
    $(".card, .card-b").click(function () {
      var link = $(this).find("a").get(0)
      if (link) link.click()
    })

    // 视频播放器
    function setupVideo($v) {
      if ($v.closest(".video-container").length) return
      var $c = $('<div class="video-container"></div>')
      var $btn = $('<div class="play-pause-btn"></div>')
      $btn.html('<svg class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"><path d="M861.829969 330.562413L391.150271 33.456576A214.465233 214.465233 0 0 0 62.30358 214.751187V809.248813a214.465233 214.465233 0 0 0 328.846691 181.294611l470.679698-297.105837a214.751187 214.751187 0 0 0 0-362.875174z" fill="#ffffff"></path></svg>')
      $v.wrap($c).parent().append($btn)
      $v.attr("controls", false).css({ width: "100%", height: "auto" })
      $btn.show()
      $btn.on("click", function (e) { e.stopPropagation(); if ($v[0].paused) { $v[0].play(); $btn.hide() } else { $v[0].pause(); $btn.show() } })
      $v.on("click", function () { if ($v[0].paused) { $v[0].play(); $btn.hide() } else { $v[0].pause(); $btn.show() } })
    }
    window.LG = window.LG || {}
    window.LG.setupVideo = setupVideo
    $("video").each(function () { setupVideo($(this)) })

    // 滚动时页头颜色
    window.onscroll = function () {
      var st = document.documentElement.scrollTop || document.body.scrollTop
      if (st > 500) { $(".wenan").css("color", "#333333"); $(".alogo").css("color", "#333333") }
      if (st < 500) { $(".wenan").css("color", "rgb(97 97 97)"); $(".alogo").css("color", "rgb(97 97 97)") }
    }

    // 懒加载
    if (window.FunLazy) {
      window.FunLazy({
        placeholder: "/Style/img/Loading2.gif",
        effect: "show",
        strictLazyMode: false,
        useErrorImagePlaceholder: "/Style/img/error.svg",
      })
    }
    // 图片预览
    $(".love_img img,.lovelist img,.little_texts img").addClass("spotlight")
  }

  /* -------------------- 启动 -------------------- */
  window.LG = window.LG || {}
  Object.assign(window.LG, {
    esc: esc, timeTran: timeTran, fmtDateTime: fmtDateTime, sanitizeHTML: sanitizeHTML,
    qqAvatar: qqAvatar, fetchData: fetchData,
  })

  function boot() {
    fetchData().then(function (data) {
      if (!data) return
      window.LG.data = data
      renderHeader(data)
      renderFooter(data)
      document.title = data.site.title + (window.LG.pageTitle ? " — " + window.LG.pageTitle : "")
      initCommon()
      // 暴露给页面脚本的数据就绪回调
      if (typeof window.LG.onReady === "function") {
        try { window.LG.onReady(data) } catch (e) { console.error("[LikeGirl] onReady", e) }
      }
    })
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot)
  else boot()
})()
