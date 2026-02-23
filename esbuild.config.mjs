import * as esbuild from "esbuild";
import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";
import JavaScriptObfuscator from "javascript-obfuscator";

// CLI flags
const isServe = process.argv.includes("--serve");
const disableObfuscation = false

// Function to pack the ZIP file
function packZip() {
  exec("node pack-zip.js", (err, stdout, stderr) => {
    if (err) {
      console.error("Error packing zip:", err);
      return;
    }
    console.log(stdout.trim());
  });
}

// Plugin: bundle → obfuscate → zip
const obfuscateThenZipPlugin = {
  name: "obfuscate-then-zip",
  setup(build) {
    build.onEnd(async (result) => {
      if (result.errors.length) {
        console.warn("Build had errors; skipping obfuscation/zip.");
        return;
      }

      try {
        const distDir = "dist";
        const filePath = path.join(distDir, "main.js");
        let code = await fs.readFile(filePath, "utf8");

        if (!disableObfuscation) {
          const obfuscated = JavaScriptObfuscator.obfuscate(code, {
            compact: true,
            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 0.75,
            deadCodeInjection: true,
            deadCodeInjectionThreshold: 0.4,
            identifierNamesGenerator: "hexadecimal",
            stringArray: true,
            stringArrayEncoding: ["rc4"],
            stringArrayThreshold: 0.75,
          }).getObfuscatedCode();

          await fs.writeFile(filePath, obfuscated);
          console.log("Obfuscation complete.");
        } else {
          console.log("Obfuscation skipped.");
        }

        packZip();
      } catch (e) {
        console.error("Error during obfuscate/zip plugin:", e);
      }
    });
  },
};

// Base build configuration
let buildConfig = {
  entryPoints: ["src/main.js"],
  bundle: true,
  minify: !disableObfuscation,
  logLevel: "info",
  color: true,
  outdir: "dist",
  plugins: [obfuscateThenZipPlugin],
};

(async function () {
  if (isServe) {
    console.log("Starting development server...");

    const ctx = await esbuild.context(buildConfig);
    await ctx.watch();
    const { host, port } = await ctx.serve({
      servedir: ".",
      port: 3000,
    });

    console.log(`Serving at http://${host}:${port}`);
  } else {
    console.log("Building for production...");
    await esbuild.build(buildConfig);
    console.log("Production build complete.");
  }
})();