// Pre-emptively define fetch to prevent dependencies from trying to polyfill/override it
(function() {
  if (typeof window.fetch === 'function') {
    var originalFetch = window.fetch;
    try {
      var descriptor = Object.getOwnPropertyDescriptor(window, 'fetch');
      if (descriptor && !descriptor.writable && !descriptor.configurable) {
        return;
      }
      Object.defineProperty(window, 'fetch', {
        value: originalFetch,
        configurable: false,
        writable: false
      });
    } catch (e) {
      // Swallow - if we can't lock it, the app still works
    }
  }
})();
