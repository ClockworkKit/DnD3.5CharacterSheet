(function () {
  "use strict";
  let detected = false;
  let settings = {};
  function receive(event) {
    detected = true;
    settings = event.detail?.[0] || {};
    document.dispatchEvent(new CustomEvent("BarrowBridgeChanged"));
  }
  document.addEventListener("Beyond20_Loaded", receive);
  document.addEventListener("Beyond20_NewSettings", receive);
  window.BarrowBeyond20 = Object.freeze({
    get detected() { return detected; },
    get settings() { return settings; },
    send(request) {
      if (!detected) throw new Error("Enable Beyond20 for this website, then refresh the page.");
      if (request?.action !== "roll" || request.type !== "chat-message") {
        throw new Error("Unsupported roll request.");
      }
      document.dispatchEvent(new CustomEvent("Beyond20_SendMessage", {detail: [request]}));
      // This DOM API has no receipt or delivery callback. Do not claim Roll20 received it.
    }
  });
})();
