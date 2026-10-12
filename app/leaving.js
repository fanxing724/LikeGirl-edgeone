/* 留言板（复刻 leaving.php）：列表 + QQ 昵称获取 + 提交校验 */
(function () {
  "use strict"
  window.LG = window.LG || {}
  window.LG.pageTitle = "留言板"

  function renderList(data) {
    var esc = window.LG.esc
    var timeTran = window.LG.timeTran
    var fmt = window.LG.fmtDateTime
    var anim = data.site.animation ? "animated fadeInUp delay-03s" : ""
    var limit = data.messageSettings.displayLimit
    var total = data.messages.length // 公开接口已截断为 displayLimit
    document.getElementById("leav-title").textContent = data.site.deci2
    document.getElementById("leav-count").innerHTML =
      '已收到 <b>' + total + '</b> 条祝福留言<i class="jiequ">（显示最新 ' + limit + ' 条）</i>'
    var host = document.getElementById("message-list")
    if (!total) {
      host.innerHTML = '<div class="leavform"><div class="textinfo" style="padding:30px;color:#999;text-align:center">成为第一个留言的人吧～</div></div>'
      return
    }
    host.innerHTML = data.messages
      .map(function (m, i) {
        var avatar = m.avatar || "https://q1.qlogo.cn/g?b=qq&nk=1234567&s=100"
        var city = m.city || "未知"
        return (
          '<div class="leavform ' + anim + '"><div class="textinfo">' +
          '<div class="MsgTopInfo"><i class="time" data-tip="' + esc(fmt(m.createdAt)) + '" data-tip-position="top">' +
          esc(timeTran(m.createdAt)) + ' <b class="yuan"></b>' + esc(city) + "</i></div>" +
          '<div class="user_info"><img src="' + esc(avatar) + '"><div class="head_content">' +
          '<div class="level">访客 <b>#' + (i + 1) + "</b></div>" +
          '<span class="name">' + esc(m.name) + "</span></div></div>" +
          '<div class="text">' + esc(m.text) + "</div></div></div>"
        )
      })
      .join("")
  }

  function loadingName() {
    if (window.jQuery && window.jQuery.loading) {
      window.jQuery("body").loading({
        loadingWidth: 240, title: "获取昵称头像中", name: "test", discription: "请稍等片刻",
        direction: "column", type: "origin", originDivWidth: 40, originDivHeight: 40,
        originWidth: 6, originHeight: 6, smallLoading: false, loadingMaskBg: "rgba(0,0,0,0.2)",
      })
    }
  }
  function removeLoading() {
    if (window.jQuery && window.jQuery.removeLoading) window.jQuery.removeLoading("test")
  }

  function bindForm() {
    var $ = window.jQuery
    if (!$) return
    // QQ 失焦获取昵称头像
    $("#QQ").on("blur", function () {
      var qq = $("#QQ").val()
      if (!qq) return
      $.ajax({
        url: "https://api.cenguigui.cn/api/qq/name.php?qq=" + encodeURIComponent(qq),
        type: "GET", timeout: 5000, dataType: "json",
        statusCode: {
          500: function () {
            loadingName()
            setTimeout(function () { removeLoading(); toastr && toastr.warning("获取QQ头像失败 API请求超时 请联系小站管理员！", "Like_Girl") }, 2000)
          },
        },
        success: function (res) {
          if (res.code == 500) { removeLoading(); toastr.warning(res.msg, "Like_Girl") }
          else if (res.code == 200) {
            loadingName()
            $("#nickname").val(res.data.name)
            $("#qq-avatar").attr("src", res.data.imgurl)
            setTimeout(function () { removeLoading(); toastr.success("获取昵称头像成功", "Like_Girl") }, 1200)
          }
        },
        error: function (xhr, status) {
          removeLoading()
          // API 失败时，用 QQ 号直接生成头像，昵称留空让用户手填
          $("#qq-avatar").attr("src", "https://q1.qlogo.cn/g?b=qq&nk=" + encodeURIComponent(qq) + "&s=100")
          toastr && toastr.error("昵称接口暂不可用，请手动填写昵称", "Like_Girl")
        },
      })
    })

    // 提交留言
    $("#leavingPost").on("click", function () {
      var qq = $("input[name='qq']").val().trim()
      var name = $("input[name='name']").val().trim()
      var text = $("textarea[name='text']").val().trim()
      if (!qq) { toastr.warning("请填写QQ号码！", "Like_Girl"); return }
      if (!/^[1-9][0-9]{5,14}$/.test(qq)) {
        toastr.warning("您的QQ号码格式错误<br/>请输入由6位以上数字组成的QQ号码！", "Like_Girl"); return
      }
      if (qq == "123456" || qq == "100000" || qq == "1234567") {
        toastr.warning("我想也许这并不是您的QQ号码...", "Like_Girl"); return
      }
      if (!name) { toastr.warning("请填写您的昵称！", "Like_Girl"); return }
      if (!text) { toastr.warning("请填写您要留言的内容！", "Like_Girl"); return }
      if (text.length <= 2) { toastr.warning("请填写两个字符以上的内容！", "Like_Girl"); return }
      if (/^[0-9]+$/.test(text)) { toastr.warning("内容为纯数字 已被拦截！", "Like_Girl"); return }

      var $btn = $("#leavingPost")
      $btn.text("留言提交中...").prop("disabled", true)
      $.ajax({
        url: "/api/messages", type: "POST", dataType: "json",
        contentType: "application/json",
        data: JSON.stringify({ qq: qq, name: name, text: text }),
        success: function (res) {
          if (res && res.ok) {
            toastr.success("留言提交成功 请刷新本页查看！", "Like_Girl")
            $btn.text("留言成功")
            $("textarea[name='text']").val("")
            // 重新拉取数据刷新列表
            window.LG.fetchData(true).then(function (data) { renderList(data) })
          }
        },
        error: function (xhr) {
          var msg = "网络错误 请稍后重试！"
          try { var j = JSON.parse(xhr.responseText); if (j && j.error) msg = j.error } catch (e) {}
          toastr.error(msg, "Like_Girl")
          $btn.html('提交留言 <svg style="width:1.3em;height:1.3em;" class="icon" viewBox="0 0 1024 1024"><path d="M620.8 179.2c12.8 12.8 6.4 32-6.4 44.8-19.2 6.4-38.4 6.4-44.8-12.8-44.8-70.4-128-115.2-217.6-115.2-140.8 0-256 115.2-256 256 0 89.6 44.8 166.4 115.2 217.6 19.2 6.4 19.2 25.6 12.8 38.4-12.8 19.2-32 19.2-44.8 12.8C89.6 563.2 32 460.8 32 352c0-179.2 140.8-320 320-320 108.8 0 211.2 57.6 268.8 147.2zM326.4 332.8l243.2 601.6 83.2-243.2c6.4-19.2 19.2-32 38.4-38.4L934.4 576 326.4 332.8z" fill="#ffffff"></path></svg>').prop("disabled", false)
        },
      })
    })

    // 消息按钮滚动到留言区
    $("#MessageBtn").on("click", function () {
      var top = $("#MessageArea").offset().top
      if ($(window).scrollTop() !== top) $("html,body").animate({ scrollTop: top }, 800)
    })
  }

  window.LG.onReady = function (data) {
    renderList(data)
    bindForm()
  }
})()
