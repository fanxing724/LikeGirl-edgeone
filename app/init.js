(function () {
  "use strict"
  var form = document.getElementById("setup-form")
  var status = document.getElementById("setup-status")
  var error = document.getElementById("setup-error")
  var retry = document.getElementById("setup-retry")
  async function api(path, options) {
    var response = await fetch("/api/" + path, Object.assign({ cache: "no-store", credentials: "same-origin", headers: { "content-type": "application/json" } }, options || {}))
    var body = await response.json()
    if (!response.ok) {
      var failure = new Error(body.error || "请求失败，请重试")
      failure.code = body.code
      throw failure
    }
    return body
  }
  function showError(message) { error.textContent = message; error.hidden = false }
  async function check() {
    form.hidden = true
    error.hidden = true
    retry.hidden = true
    status.textContent = "正在检查初始化状态…"
    try {
      var state = await api("setup/status")
      if (state.initialized) { location.replace("/admin.html"); return }
      status.textContent = "小站尚未初始化，请设置管理员密码。"
      form.hidden = false
    } catch (e) {
      status.textContent = "暂时无法检查初始化状态。"
      showError(e.message)
      retry.hidden = false
    }
  }
  form.addEventListener("submit", async function (event) {
    event.preventDefault()
    error.hidden = true
    var password = form.elements.password.value
    var confirmPassword = form.elements.confirmPassword.value
    if (password !== confirmPassword) { showError("两次输入的密码不一致"); return }
    var button = form.querySelector("button")
    button.disabled = true
    button.textContent = "正在初始化…"
    try {
      await api("setup", { method: "POST", body: JSON.stringify({ password: password, confirmPassword: confirmPassword }) })
      form.reset()
      location.replace("/admin.html")
    } catch (e) {
      if (e.code === "ALREADY_INITIALIZED") { location.replace("/admin.html"); return }
      showError(e.message)
    } finally { button.disabled = false; button.textContent = "初始化后台" }
  })
  retry.addEventListener("click", check)
  check()
})()
