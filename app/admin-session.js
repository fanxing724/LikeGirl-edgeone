/** Shared admin transport: cookies survive reloads; Bearer supports cookie-blocked browsers. */
(function () {
  "use strict"
  var key = "lg_token"
  var token = ""
  try { token = sessionStorage.getItem(key) || "" } catch (_) {}

  function setToken(value) {
    token = typeof value === "string" ? value : ""
    try {
      if (token) sessionStorage.setItem(key, token)
      else sessionStorage.removeItem(key)
    } catch (_) { /* In-memory login still works when browser storage is disabled. */ }
  }

  async function request(path, options) {
    options = options || {}
    var currentToken = token
    var headers = new Headers(options.headers || {})
    if (currentToken) headers.set("authorization", "Bearer " + currentToken)
    var init = Object.assign({}, options, { headers: headers, credentials: "same-origin", cache: "no-store" })
    var response = await fetch("/api/" + path, init)
    // A token from an older tab/session must not hide a valid HttpOnly cookie.
    if (response.status === 401 && currentToken && token === currentToken) {
      setToken("")
      headers.delete("authorization")
      response = await fetch("/api/" + path, init)
    }
    return response
  }

  window.LGAdminSession = { request: request, setToken: setToken }
})()
