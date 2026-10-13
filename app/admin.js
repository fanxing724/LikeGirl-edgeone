/**
 * LikeGirl CE — 后台管理 SPA（EdgeOne 适配）
 * 复用 admin/assets 视觉，由 /api/admin/* 驱动；鉴权使用 HMAC Bearer Token。
 */
(function () {
  "use strict"
  var $ = window.jQuery
  var TOKEN_KEY = "lg_token"
  var token = sessionStorage.getItem(TOKEN_KEY) || ""
  var data = null
  var route = "dashboard"

  /* -------------------- 工具 -------------------- */
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    })
  }
  function qqAvatar(qq, s) {
    return qq ? "https://q1.qlogo.cn/g?b=qq&nk=" + encodeURIComponent(qq) + "&s=" + (s || 640) : ""
  }
  // 站长头像：有 QQ 用 QQ 头像，否则用名字首字的粉紫渐变占位头像
  function ownerAvatar(name, qq) {
    if (qq) return qqAvatar(qq, 640)
    var ch = (name || "星").charAt(0)
    var svg =
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>" +
      "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>" +
      "<stop offset='0' stop-color='#ff5295'/><stop offset='1' stop-color='#b39ddb'/></linearGradient></defs>" +
      "<rect width='64' height='64' rx='32' fill='url(#g)'/>" +
      "<text x='32' y='43' font-size='30' text-anchor='middle' fill='#ffffff' font-family='sans-serif'>" + ch + "</text></svg>"
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg)
  }
  function timeTran(t) {
    if (!t) return ""
    var d = new Date(t)
    var time = d.getTime()
    if (isNaN(time)) return ""
    var diff = Math.floor((Date.now() - time) / 1000)
    if (diff < 0) return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate())
    if (diff < 60) return "刚刚"
    if (diff < 3600) return Math.floor(diff / 60) + "分钟前"
    if (diff < 86400) return Math.floor(diff / 3600) + "小时前"
    if (diff < 2592000) return Math.floor(diff / 86400) + "天前"
    return Math.floor(diff / 2592000) + "月前"
  }
  function fmt(t) {
    var d = new Date(t)
    if (isNaN(d.getTime())) return ""
    function p(n) { return n < 10 ? "0" + n : "" + n }
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds())
  }
  function uuid() {
    return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "id-" + Date.now() + "-" + Math.random().toString(36).slice(2)
  }
  function notify(msg, type) {
    if (window.toastr) toastr[type || "success"](msg, "Like_Girl")
    else alert(msg)
  }
  function today() {
    var d = new Date()
    function p(n) { return n < 10 ? "0" + n : "" + n }
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate())
  }

  /* -------------------- API -------------------- */
  async function api(path, opts) {
    opts = opts || {}
    var headers = Object.assign({ "content-type": "application/json" }, opts.headers || {})
    if (token) headers.authorization = "Bearer " + token
    var r = await fetch("/api/" + path, Object.assign({}, opts, { headers: headers }))
    var body = await r.json().catch(function () { return { error: "HTTP " + r.status } })
    if (!r.ok) throw new Error(body.error || "请求失败 (" + r.status + ")")
    return body
  }
  async function uploadFile(file) {
    if (!file || !file.size) throw new Error("请选择图片")
    var form = new FormData()
    form.append("file", file)
    var r = await fetch("/api/admin/upload", { method: "POST", headers: { authorization: "Bearer " + token }, body: form })
    var body = await r.json().catch(function () { return { error: "HTTP " + r.status } })
    if (!r.ok) throw new Error(body.error || "上传失败")
    return body.url
  }
  async function uploadAll(fileList) {
    var files = [].slice.call(fileList || []).filter(function (f) { return f && f.size })
    var urls = []
    for (var i = 0; i < files.length; i++) urls.push(await uploadFile(files[i]))
    return urls
  }
  async function loadData() {
    data = await api("admin/data")
    return data
  }
  async function save(patch) {
    data = await api("admin/data", { method: "PUT", body: JSON.stringify(patch) })
    return data
  }

  /* -------------------- 表单辅助 -------------------- */
  function field(label, name, value, opts) {
    opts = opts || {}
    var t = opts.type || "text"
    var ph = opts.placeholder ? ' placeholder="' + esc(opts.placeholder) + '"' : ""
    var val = ' value="' + esc(value == null ? "" : value) + '"'
    if (t === "textarea") return '<div class="form-group mb-3"><label>' + esc(label) + "</label><textarea name='" + name + "' class='form-control' rows='" + (opts.rows || 3) + "'" + ph + ">" + esc(value == null ? "" : value) + "</textarea></div>"
    if (t === "select") {
      var optsHtml = (opts.options || []).map(function (o) { return "<option value='" + esc(o[0]) + "'" + (String(o[0]) === String(value) ? " selected" : "") + ">" + esc(o[1]) + "</option>" }).join("")
      return "<div class='form-group mb-3'><label>" + esc(label) + "</label><select name='" + name + "' class='form-control'>" + optsHtml + "</select></div>"
    }
    return "<div class='form-group mb-3'><label>" + esc(label) + "</label><input type='" + t + "' name='" + name + "' class='form-control'" + ph + val + "></div>"
  }
  function fileField(label, name, accept) {
    return "<div class='form-group mb-3'><label>" + esc(label) + "</label><input type='file' name='" + name + "' class='form-control' accept='" + (accept || "image/jpeg,image/png,image/webp,image/gif") + "'></div>"
  }
  function formVals(form) {
    var obj = {}
    var els = form.querySelectorAll("input[name], textarea[name], select[name]")
    for (var i = 0; i < els.length; i++) {
      var el = els[i]
      if (el.type === "file") continue
      obj[el.name] = el.value
    }
    return obj
  }

  /* -------------------- 登录 -------------------- */
  function renderLogin() {
    document.body.classList.remove("lg-menu-open")
    document.body.classList.add("lg-login-mode")
    $("#lg-admin").html(
      '<div id="lg-login"><div class="card"><div class="card-body text-center">' +
        '<div class="lg-login-heart">&#10084;</div>' +
        '<h4 class="header-title mb-1">管理后台</h4>' +
        '<p class="lg-login-sub mb-3">LikeGirl CE · 愿得一心人 白头不相离</p>' +
        '<form id="lg-login-form">' +
        '<div class="form-group mb-3"><input type="password" name="password" class="form-control" placeholder="管理员密码" required></div>' +
        '<div class="form-group mb-3"><button class="btn btn-primary" type="submit">登 录</button></div>' +
        "</form>" +
        '<p class="mb-0"><a href="/index.html">返回前台</a></p>' +
        "</div></div></div>"
    )
    $("#lg-login-form").on("submit", async function (e) {
      e.preventDefault()
      var pw = this.password.value
      try {
        var r = await api("login", { method: "POST", body: JSON.stringify({ password: pw }) })
        token = r.token
        sessionStorage.setItem(TOKEN_KEY, token)
        await loadData()
        notify("登录成功")
        render()
      } catch (err) {
        notify(err.message, "error")
      }
    })
  }

  /* -------------------- 框架（顶栏 + 侧栏 + 内容） -------------------- */
  function render() {
    if (!token || !data) return renderLogin()
    document.body.classList.remove("lg-login-mode", "lg-menu-open")
    var s = data.site
    var chrome =
      '<div class="navbar-custom topnav-navbar"><div class="container-fluid">' +
      '<a href="#dashboard" class="topnav-logo"><span class="topnav-logo-lg">' + esc(s.title) + '</span><span class="topnav-logo-sm">' + esc(s.title) + "</span></a>" +
      '<ul class="list-unstyled topbar-right-menu float-right mb-0">' +
      '<li class="dropdown notification-list"><a class="nav-link" href="#settings"><i class="dripicons-gear noti-icon"></i></a></li>' +
      '<li class="dropdown notification-list"><a class="nav-link dropdown-toggle nav-user arrow-none mr-0" href="#settings"><span class="account-user-avatar"><img src="' + esc(ownerAvatar(s.userName, s.userQQ)) + '" alt="user-image" class="rounded-circle"></span>' +
      '<span><span class="account-user-name">' + esc(s.userName) + '</span><span class="account-position">操作</span></span></a></li>' +
      "</ul>" +
      '<button type="button" class="lg-menu-toggle" aria-label="打开导航菜单" aria-controls="lg-sidebar" aria-expanded="false"><i class="dripicons-menu" aria-hidden="true"></i></button>' +
      '<div class="app-search"></div></div></div>' +
      '<div class="container-fluid"><div class="wrapper">' +
      '<button type="button" class="lg-menu-backdrop" aria-label="关闭导航菜单" hidden></button>' +
      '<div class="left-side-menu" id="lg-sidebar"><div class="leftbar-user"><a href="#"><img src="' + esc(ownerAvatar(s.userName, s.userQQ)) + '" height="42" class="rounded-circle shadow-sm"><span class="leftbar-user-name">' + esc(s.title) + "</span></a></div>" +
      '<ul class="metismenu side-nav">' +
      sideItem("dashboard", "dripicons-direction", "后台首页") +
      sideItem("settings", "dripicons-meter", "基本设置") +
      sideItem("messages", "dripicons-view-apps", "留言管理", data.messages.length) +
      sideItem("stories", "dripicons-copy", "点点滴滴", data.stories.length) +
      sideItem("photos", "dripicons-photo-group", "恋爱相册", data.photos.length) +
      sideItem("wishes", "dripicons-location", "恋爱清单", data.wishes.length) +
      sideItem("about", "dripicons-tags", "关于页面") +
      sideItem("ips", "dripicons-location", "IP/拉黑", data.blockedIps.length) +
      sideItem("warnings", "dripicons-time-reverse", "非法访问", data.accessWarnings.length) +
      '<li class="side-nav-item"><a href="#info" class="side-nav-link"><i class="dripicons-information"></i><span> 关于Like Girl</span></a></li>' +
      "</ul>" +
      '<div class="help-box text-center"><img src="/admin/assets/images/help-icon.svg" height="90"><h5 class="mt-3">Like_Girl v5.2.1-Stable</h5><p class="mb-3">愿得一心人 白头不相离</p><a href="https://gitee.com/kiCode111/like-girl-v5.2.0" target="_blank" class="btn btn-outline-primary btn-sm">原项目地址</a></div>' +
      '<div class="clearfix"></div></div>' +
      '<div class="content-page"><div class="content" id="lg-content"></div>' +
      '<footer class="footer"><div class="row footer_center"><div class="col-md-6">Copyright © 2022-' + new Date().getFullYear() + ' <a href="https://blog.kikiw.cn/index.php/archives/52/" target="_blank">Ki</a> All Rights Reserved.</div></div></footer>' +
      "</div></div></div>"
    $("#lg-admin").html(chrome)
    var toggle = document.querySelector(".lg-menu-toggle")
    var backdrop = document.querySelector(".lg-menu-backdrop")
    function setMenu(open) {
      document.body.classList.toggle("lg-menu-open", open)
      toggle.setAttribute("aria-expanded", String(open))
      toggle.setAttribute("aria-label", open ? "关闭导航菜单" : "打开导航菜单")
      backdrop.hidden = !open
    }
    toggle.addEventListener("click", function () { setMenu(!document.body.classList.contains("lg-menu-open")) })
    backdrop.addEventListener("click", function () { setMenu(false) })
    document.querySelector("#lg-sidebar").addEventListener("click", function (e) {
      if (e.target.closest("a")) setMenu(false)
    })
    renderContent()
  }
  function sideItem(name, icon, label, count) {
    var badge = count != null ? '<span class="badge badge-danger float-right">' + count + "</span>" : ""
    return '<li class="side-nav-item"><a href="#' + name + '" class="side-nav-link ' + (route === name ? "active" : "") + '"><i class="' + icon + '"></i><span> ' + esc(label) + " " + badge + "</span></a></li>"
  }
  function renderContent() {
    var c = $("#lg-content")
    var map = { dashboard: dashboard, settings: settings, messages: messages, stories: stories, photos: photos, wishes: wishes, about: about, ips: ips, warnings: warnings, info: info }
    ;(map[route] || dashboard)(c)
  }

  /* -------------------- 仪表盘 -------------------- */
  function dashboard(c) {
    var latest = data.messages.slice(0, 6)
    var cards = [
      ["留言祝福", data.messages.length, "FA6666"],
      ["点点滴滴", data.stories.length, "F779D4"],
      ["恋爱清单", data.wishes.length, "C98FFF"],
    ].map(function (x) {
      return '<div class="col-md-6 col-xl-4"><div class="card"><div class="card-body"><div class="row align-items-center"><div class="col-6"><h5 class="text-muted font-weight-normal mt-0 text-truncate">' + x[0] + '</h5><h3 class="my-2 py-1">' + x[1] + "<i>条</i></h3></div><div class='col-6 text-center'></div></div></div></div></div>"
    })
    var rows = latest
      .map(function (m, i) {
        return "<tr><td><div class='textHide index'>" + esc(m.text) + "</div></td><td><small class='text-muted'>" + esc(fmt(m.createdAt)) + "<div class='color'>" + esc(timeTran(m.createdAt)) + "</div></small></td><td><h5><span class='badge badge-success-lighten'><i class='mdi mdi-account-circle mr-1'></i>" + esc(m.name) + "</span></h5></td><td>" + esc(m.qq) + "</td><td><h5><span class='badge badge-danger-lighten'>" + esc(m.ip || "127.0.0.1") + "</span></h5></td></tr>"
      })
      .join("") || '<tr><td colspan="5" class="lg-empty">暂无留言</td></tr>'
    c.html(
      '<div class="row">' + cards.join("") + '</div><div class="row"><div class="col-12"><div class="card"><div class="card-body">' +
        '<div class="row mb-2"><div class="col-lg-4"><button type="button" class="btn btn-danger mb-2 mr-2"><i class="mdi mdi-basket mr-1"></i> 最新留言</button></div></div>' +
        '<div class="table-responsive"><table class="table table-centered mb-0"><thead class="thead-light"><tr><th>评论内容</th><th>Date</th><th>Name</th><th>QQ</th><th>IP</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
        "</div></div></div></div>"
    )
  }

  /* -------------------- 基本设置 -------------------- */
  function settings(c) {
    var s = data.site, d = data.site
    var blurOpts = [["true", "开启高斯模糊"], ["false", "关闭高斯模糊"]]
    var animOpts = [["true", "开启"], ["false", "关闭"]]
    c.html(
      '<div class="row">' +
      '<div class="col-lg-6"><div class="card"><div class="card-body"><h4 class="header-title mb-3">基本设置</h4><form id="f-basic">' +
      field("站点标题", "title", s.title) + field("站点LOGO", "logo", s.logo) + field("站点文案", "writing", s.writing) +
      field("是否关闭头像背景高斯模糊", "blur", String(d.blur), { type: "select", options: blurOpts }) +
      field("是否开启前端无刷新加载", "pjax", String(d.pjax), { type: "select", options: animOpts }) +
      field("是否开启前端加载动画", "animation", String(d.animation), { type: "select", options: animOpts }) +
      '<div class="form-group mb-3 text_right"><button class="btn btn-primary" type="submit">提交修改</button></div></form></div></div></div>' +
      '<div class="col-lg-6"><div class="card"><div class="card-body"><h4 class="header-title mb-3">情侣配置</h4><form id="f-couple">' +
      field("男主Name", "boy", s.boy) + field("女主Name", "girl", s.girl) + field("男主QQ", "boyQQ", s.boyQQ) + field("女主QQ", "girlQQ", s.girlQQ) + field("起始时间", "startTime", s.startTime, { type: "datetime-local" }) +
      '<div class="form-group mb-3 text_right"><button class="btn btn-primary" type="submit">提交修改</button></div></form></div></div></div>' +
      '<div class="col-lg-12"><div class="card"><div class="card-body"><h4 class="header-title mb-3">卡片配置&版权配置</h4><form id="f-card">' +
      field("背景图片URL地址", "background", s.background) + fileField("或上传背景图", "backgroundFile") +
      field("卡片1 Name", "card1", s.card1) + field("卡片1描述", "deci1", s.deci1) +
      field("卡片2 Name", "card2", s.card2) + field("卡片2描述", "deci2", s.deci2) +
      field("卡片3 Name", "card3", s.card3) + field("卡片3描述", "deci3", s.deci3) +
      field("域名备案号", "icp", s.icp) + field("站点版权信息", "copyright", s.copyright) +
      field("站长Name", "userName", s.userName) + field("站长QQ", "userQQ", s.userQQ) +
      '<div class="form-group mb-3 text_right"><button class="btn btn-primary" type="submit">提交修改</button></div></form></div></div></div>' +
      '<div class="col-lg-12"><div class="card"><div class="card-body"><h4 class="header-title mb-3">自定义代码（DIY）</h4><form id="f-diy">' +
      field("自定义前端全局CSS样式", "customCss", s.customCss, { type: "textarea", rows: 5 }) +
      field("自定义头部标签（HTML/CSS外链）", "headHtml", s.headHtml, { type: "textarea", rows: 5 }) +
      field("自定义底部标签（HTML/JS外链）", "footerHtml", s.footerHtml, { type: "textarea", rows: 5 }) +
      '<div class="form-group mb-3 text_right"><button class="btn btn-primary" type="submit">提交修改</button></div></form></div></div></div>' +
      "</div>"
    )
    $("#f-basic").on("submit", function (e) { e.preventDefault(); submitSite(this, ["title", "logo", "writing", "blur", "pjax", "animation"]) })
    $("#f-couple").on("submit", function (e) { e.preventDefault(); submitSite(this, ["boy", "girl", "boyQQ", "girlQQ", "startTime"]) })
    $("#f-card").on("submit", async function (e) {
      e.preventDefault()
      var v = formVals(this)
      var file = this.backgroundFile.files[0]
      try {
        if (file) v.background = await uploadFile(file)
        await save({ site: Object.assign({}, data.site, pick(v, ["background", "card1", "deci1", "card2", "deci2", "card3", "deci3", "icp", "copyright", "userName", "userQQ"])) })
        notify("保存成功")
        render()
      } catch (err) { notify(err.message, "error") }
    })
    $("#f-diy").on("submit", function (e) { e.preventDefault(); submitSite(this, ["customCss", "headHtml", "footerHtml"]) })
  }
  function pick(obj, keys) { var o = {}; keys.forEach(function (k) { o[k] = obj[k] }); return o }
  function boolFields(v, keys) { keys.forEach(function (k) { v[k] = v[k] === "true" || v[k] === true }); return v }
  async function submitSite(form, keys) {
    var v = formVals(form)
    boolFields(v, ["blur", "pjax", "animation"].filter(function (k) { return keys.indexOf(k) >= 0 }))
    try {
      await save({ site: Object.assign({}, data.site, pick(v, keys)) })
      notify("保存成功")
      render()
    } catch (err) { notify(err.message, "error") }
  }

  /* -------------------- 文章 -------------------- */
  function stories(c) {
    var rows = data.stories.map(function (a, i) {
      return "<tr><td><div class='SerialNumber'>" + (i + 1) + "</div></td><td>" + esc(a.title) + "</td><td>" + esc(a.date) + "</td><td>" + esc(a.author) + "</td><td><button class='btn btn-secondary btn-rounded btn-sm' data-edit='" + esc(a.id) + "'><i class='mdi mdi-clipboard-text-play-outline mr-1'></i>修改</button> <button class='btn btn-danger btn-rounded btn-sm' data-del='" + esc(a.id) + "'><i class='mdi mdi-delete-empty mr-1'></i>删除</button></td></tr>"
    }).join("") || '<tr><td colspan="5" class="lg-empty">暂无文章</td></tr>'
    c.html(
      '<div class="row"><div class="col-12"><div class="card"><div class="card-body">' +
        '<h4 class="header-title mb-3 size_18">点点滴滴<button class="btn btn-success btn-sm right_10" data-add><i class="mdi mdi-circle-edit-outline"></i> 新增</button></h4>' +
        '<div class="table-responsive"><table class="table dt-responsive nowrap" width="100%"><thead><tr><th>序号</th><th>标题</th><th>发布时间</th><th>发布者</th><th style="width:150px">操作</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
        '<div id="lg-editor"></div></div></div></div></div>'
    )
    c.find("[data-add]").on("click", function () { storyForm(null) })
    c.find("[data-edit]").on("click", function () { storyForm(findById(data.stories, this.getAttribute("data-edit"))) })
    c.find("[data-del]").on("click", async function () {
      if (!confirm("确定删除该文章？")) return
      try { await save({ stories: data.stories.filter(function (x) { return x.id !== this.getAttribute("data-del") }.bind(this)) }); notify("已删除"); render() } catch (e) { notify(e.message, "error") }
    })
  }
  function storyForm(item) {
    var a = item || { id: "", title: "", author: data.site.boy, date: today(), content: "" }
    $("#lg-editor").html(
      '<div class="card mt-3"><div class="card-body"><h4 class="header-title mb-3">' + (item ? "修改文章" : "新增文章") + '</h4><form id="f-story">' +
      '<input type="hidden" name="id" value="' + esc(a.id) + '">' +
      field("发布者Name", "author", a.author, { type: "select", options: [[data.site.boy, data.site.boy], [data.site.girl, data.site.girl]] }) +
      field("标题", "title", a.title) +
      '<div class="form-group mb-3"><label>内容（支持 HTML）</label><textarea name="content" class="form-control" rows="10">' + esc(a.content) + "</textarea></div>" +
      field("日期", "date", a.date, { type: "date" }) +
      '<div class="form-group mb-3 text_right"><button class="btn btn-primary" type="submit">' + (item ? "保存修改" : "发布文章") + '</button> <button class="btn btn-secondary" type="button" id="cancel-story">取消</button></div></form></div></div>'
    )
    $("#cancel-story").on("click", function () { $("#lg-editor").empty() })
    $("#f-story").on("submit", async function (e) {
      e.preventDefault()
      var v = formVals(this)
      if (!v.title || !v.content) return notify("标题和内容不能为空", "error")
      var list = data.stories.slice()
      if (v.id) { var i = list.findIndex(function (x) { return x.id === v.id }); if (i >= 0) Object.assign(list[i], v) }
      else { v.id = uuid(); list.unshift(v) }
      try { await save({ stories: list }); notify("已保存"); render() } catch (e) { notify(e.message, "error") }
    })
  }

  /* -------------------- 相册 -------------------- */
  function photos(c) {
    var rows = data.photos.map(function (p, i) {
      var preview = (p.urls || [])[0] ? '<img src="' + esc(p.urls[0]) + '" height="40" style="border-radius:6px">' : "暂无图片"
      return "<tr><td><div class='SerialNumber'>" + (i + 1) + "</div></td><td>" + esc(p.text) + "</td><td>" + esc(p.date) + "</td><td>" + (p.urls || []).length + " 张</td><td>" + preview + "</td><td><button class='btn btn-secondary btn-rounded btn-sm' data-edit='" + esc(p.id) + "'>修改</button> <button class='btn btn-danger btn-rounded btn-sm' data-del='" + esc(p.id) + "'>删除</button></td></tr>"
    }).join("") || '<tr><td colspan="6" class="lg-empty">暂无照片</td></tr>'
    c.html(
      '<div class="row"><div class="col-12"><div class="card"><div class="card-body">' +
        '<h4 class="header-title mb-3 size_18">恋爱相册<button class="btn btn-success btn-sm right_10" data-add><i class="mdi mdi-circle-edit-outline"></i> 新增</button></h4>' +
        '<div class="table-responsive"><table class="table dt-responsive nowrap" width="100%"><thead><tr><th>序号</th><th>描述</th><th>日期</th><th>数量</th><th>预览</th><th style="width:150px">操作</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
        '<div id="lg-editor"></div></div></div></div></div>'
    )
    c.find("[data-add]").on("click", function () { photoForm(null) })
    c.find("[data-edit]").on("click", function () { photoForm(findById(data.photos, this.getAttribute("data-edit"))) })
    c.find("[data-del]").on("click", async function () {
      if (!confirm("确定删除该相册？")) return
      try { await save({ photos: data.photos.filter(function (x) { return x.id !== this.getAttribute("data-del") }.bind(this)) }); notify("已删除"); render() } catch (e) { notify(e.message, "error") }
    })
  }
  function photoForm(item) {
    var p = item || { id: "", date: today(), text: "", urls: [] }
    $("#lg-editor").html(
      '<div class="card mt-3"><div class="card-body"><h4 class="header-title mb-3">' + (item ? "修改相册" : "新增相册") + '</h4><form id="f-photo">' +
      '<input type="hidden" name="id" value="' + esc(p.id) + '">' +
      field("日期", "date", p.date, { type: "date" }) +
      field("图片描述", "text", p.text) +
      '<div class="form-group mb-3"><label>图片URL（多个用分号 ; 分隔）</label><textarea name="urls" class="form-control" rows="3" placeholder="可填外部图片地址，多个用分号分隔">' + esc((p.urls || []).join(";")) + "</textarea></div>" +
      fileField("或上传图片（可多选，单张最大 4MB）", "files", "image/jpeg,image/png,image/webp,image/gif") +
      '<div class="form-group mb-3 text_right"><button class="btn btn-primary" type="submit">' + (item ? "保存修改" : "新增") + '</button> <button class="btn btn-secondary" type="button" id="cancel-photo">取消</button></div></form></div></div>'
    )
    $("#cancel-photo").on("click", function () { $("#lg-editor").empty() })
    $("#f-photo").on("submit", async function (e) {
      e.preventDefault()
      var v = formVals(this)
      if (!v.text) return notify("描述不能为空", "error")
      var urls = (v.urls ? v.urls.split(";") : []).map(function (u) { return u.trim() }).filter(Boolean)
      try {
        var uploaded = await uploadAll(this.files.files)
        urls = urls.concat(uploaded)
        if (!urls.length) return notify("请上传图片或填写URL", "error")
        var list = data.photos.slice()
        var obj = { id: v.id || uuid(), date: v.date, text: v.text, urls: urls }
        if (v.id) { var i = list.findIndex(function (x) { return x.id === v.id }); if (i >= 0) list[i] = obj; else list.unshift(obj) }
        else list.unshift(obj)
        await save({ photos: list }); notify("已保存"); render()
      } catch (e) { notify(e.message, "error") }
    })
  }

  /* -------------------- 清单 -------------------- */
  function wishes(c) {
    var rows = data.wishes.map(function (w, i) {
      var st = w.done ? '<span class="badge badge-success-lighten">已完成</span>' : '<span class="badge badge-danger-lighten">未完成</span>'
      var preview = w.image ? '<img src="' + esc(w.image) + '" height="40" style="border-radius:6px">' : "暂无图片"
      return "<tr><td><div class='SerialNumber'>" + (i + 1) + "</div></td><td>" + esc(w.text) + "</td><td>" + st + "</td><td>" + preview + "</td><td><button class='btn btn-secondary btn-rounded btn-sm' data-edit='" + esc(w.id) + "'>修改</button> <button class='btn btn-danger btn-rounded btn-sm' data-del='" + esc(w.id) + "'>删除</button></td></tr>"
    }).join("") || '<tr><td colspan="5" class="lg-empty">暂无清单</td></tr>'
    c.html(
      '<div class="row"><div class="col-12"><div class="card"><div class="card-body">' +
        '<h4 class="header-title mb-3 size_18">恋爱清单<button class="btn btn-success btn-sm right_10" data-add><i class="mdi mdi-circle-edit-outline"></i> 新增</button></h4>' +
        '<div class="table-responsive"><table class="table dt-responsive nowrap" width="100%"><thead><tr><th>序号</th><th>事件标题</th><th>完成状态</th><th>图片预览</th><th style="width:150px">操作</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
        '<div id="lg-editor"></div></div></div></div></div>'
    )
    c.find("[data-add]").on("click", function () { wishForm(null) })
    c.find("[data-edit]").on("click", function () { wishForm(findById(data.wishes, this.getAttribute("data-edit"))) })
    c.find("[data-del]").on("click", async function () {
      if (!confirm("确定删除该清单？")) return
      try { await save({ wishes: data.wishes.filter(function (x) { return x.id !== this.getAttribute("data-del") }.bind(this)) }); notify("已删除"); render() } catch (e) { notify(e.message, "error") }
    })
  }
  function wishForm(item) {
    var w = item || { id: "", text: "", image: "", done: false }
    $("#lg-editor").html(
      '<div class="card mt-3"><div class="card-body"><h4 class="header-title mb-3">' + (item ? "修改清单" : "新增清单") + '</h4><form id="f-wish">' +
      '<input type="hidden" name="id" value="' + esc(w.id) + '">' +
      field("事件内容", "text", w.text) +
      field("完成状态", "done", String(w.done), { type: "select", options: [["false", "未完成"], ["true", "已完成"]] }) +
      field("图片URL（可选）", "image", w.image) +
      fileField("或上传图片", "imageFile") +
      '<div class="form-group mb-3 text_right"><button class="btn btn-primary" type="submit">' + (item ? "保存修改" : "新增") + '</button> <button class="btn btn-secondary" type="button" id="cancel-wish">取消</button></div></form></div></div>'
    )
    $("#cancel-wish").on("click", function () { $("#lg-editor").empty() })
    $("#f-wish").on("submit", async function (e) {
      e.preventDefault()
      var v = formVals(this)
      v.done = v.done === "true"
      if (!v.text) return notify("事件内容不能为空", "error")
      var file = this.imageFile.files[0]
      try {
        if (file) v.image = await uploadFile(file)
        var list = data.wishes.slice()
        var obj = { id: v.id || uuid(), text: v.text, image: v.image || "", done: v.done }
        if (v.id) { var i = list.findIndex(function (x) { return x.id === v.id }); if (i >= 0) list[i] = obj; else list.unshift(obj) }
        else list.unshift(obj)
        await save({ wishes: list }); notify("已保存"); render()
      } catch (e) { notify(e.message, "error") }
    })
  }

  /* -------------------- 留言管理 -------------------- */
  function messages(c) {
    var ms = data.messageSettings
    var rows = data.messages.map(function (m, i) {
      return "<tr><td><div class='SerialNumber'>" + (i + 1) + "</div></td><td><div class='textHide'>" + esc(m.text) + "</div></td><td><small class='text-muted'>" + esc(fmt(m.createdAt)) + "<div class='color'>" + esc(timeTran(m.createdAt)) + "</div></small></td><td><h5><span class='badge badge-success-lighten'><i class='mdi mdi-account-circle mr-1'></i>" + esc(m.name) + "</span></h5></td><td>" + esc(m.qq) + "</td><td><h5><span class='badge badge-danger-lighten'>" + esc(m.ip || "127.0.0.1") + "</span></h5><i>" + esc(m.city || "未知") + "</i></td><td><button class='btn btn-danger btn-rounded btn-sm' data-del='" + esc(m.id) + "'>删除</button></td></tr>"
    }).join("") || '<tr><td colspan="7" class="lg-empty">暂无留言</td></tr>'
    c.html(
      '<div class="row"><div class="col-12"><div class="card"><div class="card-body">' +
        '<h4 class="header-title mb-3 size_18">留言管理 <button class="btn btn-secondary btn-sm margin_left">共<b>' + data.messages.length + "</b>条</button></h4>" +
        '<div class="table-responsive"><table class="table dt-responsive nowrap" width="100%"><thead><tr><th>序号</th><th>留言内容</th><th>Date</th><th>Name</th><th>QQ</th><th>IP</th><th>操作</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
        "</div></div></div></div>" +
        '<div class="row"><div class="col-12"><div class="card"><div class="card-body"><h4 class="header-title mb-3">前端留言页配置</h4><form id="f-msgset">' +
        field("显示最新N条留言", "displayLimit", ms.displayLimit, { type: "number" }) +
        field("拦截违禁词（空格/逗号分隔）", "blockedWords", ms.blockedWords, { type: "textarea", rows: 3 }) +
        field("拦截非法字符", "blockedCharacters", ms.blockedCharacters, { type: "textarea", rows: 3 }) +
        '<div class="form-group mb-3 text_right"><button class="btn btn-primary" type="submit">提交修改</button></div></form></div></div></div></div>'
    )
    c.find("[data-del]").on("click", async function () {
      if (!confirm("确定删除该留言？")) return
      try { await save({ messages: data.messages.filter(function (x) { return x.id !== this.getAttribute("data-del") }.bind(this)) }); notify("已删除"); render() } catch (e) { notify(e.message, "error") }
    })
    $("#f-msgset").on("submit", async function (e) {
      e.preventDefault()
      var v = formVals(this)
      v.displayLimit = Number(v.displayLimit) || 100
      try { await save({ messageSettings: v }); notify("已保存"); render() } catch (e) { notify(e.message, "error") }
    })
  }

  /* -------------------- 关于页面（BotUI 对话配置） -------------------- */
  function about(c) {
    var a = data.about
    var fields =
      field("对话标题", "title", a.title) + field("对话模块背景图片地址", "background", a.background) + fileField("或上传背景图", "backgroundFile") +
      field("对话1文本", "info1", a.info1) + field("对话2文本", "info2", a.info2) + field("对话3文本", "info3", a.info3) +
      field("对话1按钮确认文本", "btn1", a.btn1) + field("对话1按钮取消文本", "btn2", a.btn2) +
      '<hr><h5 class="text-center">对话模块 2</h5>' +
      field("对话2-1", "infox1", a.infox1) + field("对话2-2", "infox2", a.infox2) + field("对话2-3", "infox3", a.infox3) + field("对话2-4", "infox4", a.infox4) + field("对话2-5", "infox5", a.infox5) + field("对话2-6", "infox6", a.infox6) + field("对话2按钮文本", "btnx2", a.btnx2) +
      '<hr><h5 class="text-center">对话模块 3</h5>' +
      field("对话3-1", "infof1", a.infof1) + field("对话3-2", "infof2", a.infof2) + field("对话3-3", "infof3", a.infof3) + field("对话3-4", "infof4", a.infof4) + field("对话3按钮文本", "btnf3", a.btnf3) +
      '<hr><h5 class="text-center">对话模块 4</h5>' +
      field("对话4-1", "infod1", a.infod1) + field("对话4-2", "infod2", a.infod2) + field("对话4-3", "infod3", a.infod3) + field("对话4-4", "infod4", a.infod4) + field("对话4-5", "infod5", a.infod5)
    c.html('<div class="row"><div class="col-12"><div class="card"><div class="card-body"><h4 class="header-title mb-3">关于页面 BotUI 对话配置</h4><form id="f-about">' + fields + '<div class="form-group mb-3 text_right"><button class="btn btn-primary" type="submit">提交修改</button></div></form></div></div></div></div>')
    $("#f-about").on("submit", async function (e) {
      e.preventDefault()
      var v = formVals(this)
      var file = this.backgroundFile.files[0]
      try {
        if (file) v.background = await uploadFile(file)
        await save({ about: Object.assign({}, data.about, v) })
        notify("已保存"); render()
      } catch (e) { notify(e.message, "error") }
    })
  }

  /* -------------------- IP 封禁 -------------------- */
  function ips(c) {
    var rows = data.blockedIps.map(function (x, i) {
      return "<tr><td><div class='SerialNumber'>" + (i + 1) + "</div></td><td>" + esc(x.location || "—") + "</td><td><small class='text-muted'>" + esc(x.createdAt || "") + "</small></td><td><h5><span class='badge badge-success-lighten'>" + esc(x.note || "") + "</span></h5></td><td><h5><span class='badge badge-danger-lighten'>" + esc(x.ip || "—") + "</span></h5></td><td><button class='btn btn-danger btn-rounded btn-sm' data-del='" + esc(x.id) + "'>删除</button></td></tr>"
    }).join("") || '<tr><td colspan="6" class="lg-empty">暂无封禁IP</td></tr>'
    c.html(
      '<div class="row"><div class="col-12"><div class="card"><div class="card-body">' +
        '<h4 class="header-title mb-3 size_18">IP封禁管理</h4>' +
        '<div class="table-responsive"><table class="table dt-responsive nowrap" width="100%"><thead><tr><th>序号</th><th>IP归属地</th><th>Date</th><th>备注</th><th>IP</th><th style="width:125px">操作</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
        "</div></div></div></div>" +
        '<div class="row"><div class="col-lg-12"><div class="card"><div class="card-body"><h4 class="header-title mb-3">新增封禁IP</h4><form id="f-ip">' +
        field("IP地址", "ip", "") + field("信息备注", "note", "") +
        '<div class="form-group mb-3 text_right"><button class="btn btn-primary" type="submit">提交添加</button></div></form></div></div></div></div>'
    )
    c.find("[data-del]").on("click", async function () {
      if (!confirm("确定删除该封禁IP？")) return
      try { await save({ blockedIps: data.blockedIps.filter(function (x) { return x.id !== this.getAttribute("data-del") }.bind(this)) }); notify("已删除"); render() } catch (e) { notify(e.message, "error") }
    })
    $("#f-ip").on("submit", async function (e) {
      e.preventDefault()
      var v = formVals(this)
      if (!v.ip) return notify("请输入IP", "error")
      var list = data.blockedIps.slice()
      list.unshift({ id: uuid(), ip: v.ip, note: v.note, location: "手动添加", createdAt: new Date().toISOString() })
      try { await save({ blockedIps: list }); notify("已添加"); render() } catch (e) { notify(e.message, "error") }
    })
  }

  /* -------------------- 非法访问 -------------------- */
  function warnings(c) {
    var rows = data.accessWarnings.map(function (x, i) {
      return "<tr><td><div class='SerialNumber'>" + (i + 1) + "</div></td><td>" + esc(x.ip || "—") + "</td><td>" + esc(x.location || "—") + "</td><td>" + esc(x.path || "—") + "</td><td><small class='text-muted'>" + esc(x.createdAt || "") + "</small></td></tr>"
    }).join("") || '<tr><td colspan="5" class="lg-empty">暂无非法访问记录</td></tr>'
    c.html(
      '<div class="row"><div class="col-12"><div class="card"><div class="card-body">' +
        '<h4 class="header-title mb-3 size_18">非法访问记录<button class="btn btn-danger btn-sm margin_left" id="clear-warn">清空</button></h4>' +
        '<div class="table-responsive"><table class="table dt-responsive nowrap" width="100%"><thead><tr><th>序号</th><th>IP</th><th>归属地</th><th>路径</th><th>时间</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
        "</div></div></div></div>"
    )
    $("#clear-warn").on("click", async function () {
      if (!confirm("确定清空全部非法访问记录？")) return
      try { await save({ accessWarnings: [] }); notify("已清空"); render() } catch (e) { notify(e.message, "error") }
    })
  }

  /* -------------------- 关于 Like Girl（静态） -------------------- */
  function info(c) {
    c.html(
      '<div class="row"><div class="col-lg-12"><div class="card"><div class="card-body text-center">' +
        '<img src="/admin/assets/images/help-icon.svg" height="90"><h3 class="mt-3">Like_Girl v5.2.1-Stable</h3>' +
        '<p class="mb-3">愿得一心人 白头不相离</p>' +
        '<p>本站为 <b>LikeGirl CE</b> 的 EdgeOne Makers/Pages 无服务器适配版，存储使用 @edgeone/pages-blob。</p>' +
        '<p>原项目作者 Ki.，社区维护 ShiFengShuA，EdgeOne 适配层见 NOTICE。</p>' +
        '<p><a class="btn btn-outline-primary btn-sm" href="https://gitee.com/kiCode111/like-girl-v5.2.0" target="_blank">原项目地址</a> ' +
        '<a class="btn btn-outline-primary btn-sm" href="https://github.com/fanxing724/LikeGirl-edgeone" target="_blank">EdgeOne 仓库</a></p>' +
        "</div></div></div></div>"
    )
  }

  /* -------------------- 辅助 -------------------- */
  function findById(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]
    return null
  }

  /* -------------------- 启动 -------------------- */
  function getRoute() {
    var h = (location.hash || "#dashboard").slice(1)
    return ["dashboard", "settings", "messages", "stories", "photos", "wishes", "about", "ips", "warnings", "info"].indexOf(h) >= 0 ? h : "dashboard"
  }
  async function boot() {
    if (!token) return renderLogin()
    try {
      await loadData()
      route = getRoute()
      render()
    } catch (e) {
      if (e.message.indexOf("会话") >= 0) {
        token = ""
        sessionStorage.removeItem(TOKEN_KEY)
        renderLogin()
      } else notify(e.message, "error")
    }
  }
  window.addEventListener("hashchange", function () { route = getRoute(); if (data) render() })
  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && document.body.classList.contains("lg-menu-open")) {
      document.querySelector(".lg-menu-backdrop").click()
      document.querySelector(".lg-menu-toggle").focus()
    }
  })
  boot()
})()
