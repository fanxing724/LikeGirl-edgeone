/* 恋爱相册（复刻 loveImg.php）：单图/多图缩略图格子、+n、模态预览（复用 Style/js/loveImg.js） */
(function () {
  "use strict"
  window.LG = window.LG || {}
  window.LG.pageTitle = "恋爱相册"

  function render(data) {
    var esc = window.LG.esc
    var photos = data.photos || []
    var host = document.getElementById("album-container")
    if (!photos.length) {
      host.innerHTML = '<div class="text-ce central" style="grid-column:1/-1;color:#999;padding:40px 0">暂无照片，快去后台上传第一张吧！</div>'
      return
    }
    host.innerHTML = photos
      .map(function (p, index) {
        var urls = (p.urls || []).filter(Boolean)
        var date = p.date || ""
        var text = p.text || ""
        var count = urls.length
        var display = Math.min(count, 9)
        var body = ""
        if (count === 0) {
          body = '<img src="https://via.placeholder.com/300x220?text=No+Image" alt="暂无图片" class="single-img">'
        } else if (count === 1) {
          body = '<img src="' + esc(urls[0]) + '" alt="' + esc(text) + '" class="single-img">'
        } else {
          var thumbs = ""
          for (var i = 0; i < display; i++) {
            thumbs += '<div class="thumbnail-item"><img src="' + esc(urls[i]) + '" alt="缩略图' + (i + 1) + '" class="thumbnail-img"></div>'
          }
          body = '<div class="thumbnails-grid thumbnails-' + display + '">' + thumbs + "</div>"
          if (count > 9) body += '<div class="multi-img-indicator">+' + (count - 9) + "</div>"
        }
        return (
          '<div class="photo-card photo-item" data-id="' + esc(p.id) + '" data-description="' + esc(text) +
          '" data-date="' + esc(date) + '" data-images="' + esc(urls.join(";")) + '" style="transition-delay:' + (index * 0.1) + 's">' +
          '<div class="photo-img-container">' + body + "</div>" +
          '<div class="photo-info"><div class="photo-description">' + esc(text) + '</div><div class="date">' + esc(date) + "</div></div></div>"
        )
      })
      .join("")
    // 卡片渲染完成后动态加载相册库并初始化（保证只绑定一次）
    if (!window.__lgGalleryLoaded) {
      window.__lgGalleryLoaded = true
      var s = document.createElement("script")
      s.src = "/Style/js/loveImg.js"
      s.onload = function () {
        if (typeof window.initLoveGallery === "function") {
          try { window.initLoveGallery() } catch (e) { console.error("[LikeGirl] gallery init", e) }
        }
      }
      document.body.appendChild(s)
    } else if (typeof window.initLoveGallery === "function") {
      window.initLoveGallery()
    }
  }

  window.LG.onReady = render
})()
