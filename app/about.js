/* 关于页面 BotUI 对话（完整复刻 about.php 的 info1~infod5 流程） */
(function () {
  "use strict"
  window.LG = window.LG || {}
  window.LG.pageTitle = "关于本站"

  window.LG.onReady = function (data) {
    var a = data.about || {}
    var esc = window.LG.esc
    // 标题与背景
    var hint = document.getElementById("about-hint")
    if (hint) hint.innerHTML = '与 <i>' + esc(a.title) + "</i> 小站对话中..."
    var stage = document.getElementById("about-stage")
    if (stage) stage.style.background = 'url("' + String(a.background || "").replace(/"/g, "") + '") no-repeat center top'
    document.querySelector(".central").style.padding = "0"

    if (typeof window.BotUI !== "function") {
      console.error("[LikeGirl] BotUI 未加载")
      return
    }
    var botui = new window.BotUI("botui-app")

    botui.message
      .bot({ delay: 200, content: a.info1 })
      .then(function () {
        return botui.message.bot({ delay: 1000, content: a.info2 })
      })
      .then(function () {
        return botui.message.bot({ delay: 1000, content: a.info3 })
      })
      .then(function () {
        return botui.action.button({
          delay: 1500,
          action: [
            { text: a.btn1, value: "and" },
            { text: a.btn2, value: "gg" },
          ],
        })
      })
      .then(function (res) {
        if (res.value === "and") other()
        if (res.value === "gg") {
          return botui.message.bot({
            delay: 1500,
            content: " ![告辞](https://img.gejiba.com/images/4f6983d663bea83530b8ac3a8a6b9220.jpg) ",
          })
        }
      })

    function other() {
      botui.message
        .bot({ delay: 1500, content: a.infox1 })
        .then(function () { return botui.message.bot({ delay: 1500, content: a.infox2 }) })
        .then(function () { return botui.message.bot({ delay: 1500, content: a.infox3 }) })
        .then(function () { return botui.message.bot({ delay: 1500, content: a.infox4 }) })
        .then(function () { return botui.message.bot({ delay: 1500, content: a.infox5 }) })
        .then(function () { return botui.message.bot({ delay: 1500, content: a.infox6 }) })
        .then(function () {
          return botui.action.button({ delay: 1500, action: [{ text: a.btnx2, value: "next" }] })
        })
        .then(function () { return botui.message.bot({ delay: 1500, content: a.infof1 }) })
        .then(function () { return botui.message.bot({ delay: 1500, content: a.infof2 }) })
        .then(function () { return botui.message.bot({ delay: 1500, content: a.infof3 }) })
        .then(function () { return botui.message.bot({ delay: 1500, content: a.infof4 }) })
        .then(function () {
          return botui.action.button({ delay: 1500, action: [{ text: a.btnf3, value: "next" }] })
        })
        .then(function () { return botui.message.bot({ delay: 1500, content: a.infod1 }) })
        .then(function () { return botui.message.bot({ delay: 1500, content: a.infod2 }) })
        .then(function () { return botui.message.bot({ delay: 1500, content: a.infod3 }) })
        .then(function () { return botui.message.bot({ delay: 1500, content: a.infod4 }) })
        .then(function () { return botui.message.bot({ delay: 1500, content: a.infod5 }) })
        .then(function () { return botui.message.bot({ delay: 1500, content: "本次会话结束..." }) })
        .then(function () { return botui.message.bot({ delay: 1500, content: "  " }) })
    }
  }
})()
