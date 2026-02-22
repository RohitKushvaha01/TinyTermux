import plugin from '../plugin.json';
import TermuxTerm from "./TermuxTerm";

class AcodePlugin {

  async init() {
    // plugin initialisation 
    const original = window.Terminal;
    const replica = TermuxTerm;

    const forwarded = {};

    Object.keys(original).forEach((key) => {
      if (typeof original[key] === "function") {
        forwarded[key] = function (...args) {
          if (typeof replica[key] !== "function") {
            throw new Error(`Replica missing method: ${key}`);
          }

          // preserve proper `this`
          return replica[key].apply(replica, args);
        };
      } else {
        // forward non-function properties too
        forwarded[key] = original[key];
      }
    });

    window.Terminal = forwarded;
  }

  async destroy() {
    // plugin clean up
    //acode.require("toast")("Requires restart")
  }
}

if (window.acode) {
  const acodePlugin = new AcodePlugin();
  acode.setPluginInit(plugin.id, async (baseUrl, $page, { cacheFileUrl, cacheFile }) => {
    if (!baseUrl.endsWith('/')) {
      baseUrl += '/';
    }
    acodePlugin.baseUrl = baseUrl;
    window.Termux = window.Termux || {};
    window.Termux.baseUrl = baseUrl;;
    await acodePlugin.init($page, cacheFile, cacheFileUrl);
  });
  acode.setPluginUnmount(plugin.id, () => {
    acodePlugin.destroy();
  });
}
