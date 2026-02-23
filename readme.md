# TinyTermux

**TinyTermux** is a lightweight implementation of Termux designed to run inside Acode.

It replaces the default Alpine-based environment with a Termux-based environment inside Acode’s terminal.

---

## ⚠️ Requirements

* ✅ **64-bit ARM (aarch64) devices only**
* ❌ Other architectures are **not supported**

You can check your device architecture by running:

```sh
uname -m
```

Expected output:

```
aarch64
```

---

## 🚧 Limitations

This plugin is still experimental. Some features may not work as expected.

* ❌ Termux-API is **not supported**
* ❌ Acode Code Runner plugins will **not work**

  * Reason: Termux uses `pkg/apt`
  * Alpine uses `apk`
* ⚠️ Not fully tested — unexpected issues may occur

---

## 📦 Usage

1. Install the plugin.
2. Open the default Acode terminal.
3. The Alpine Linux environment should now be replaced with Termux.
