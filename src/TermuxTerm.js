const TermuxTerm = {
    /**
     * Starts the AXS environment by writing init scripts and executing the sandbox.
     * @param {boolean} [installing=false] - Whether AXS is being started during installation.
     * @param {Function} [logger=console.log] - Function to log standard output.
     * @param {Function} [err_logger=console.error] - Function to log errors.
     * @returns {Promise<boolean>} - Returns true if installation completes with exit code 0, void if not installing
     */
    async startAxs(installing = false, logger = console.log, err_logger = console.error) {
        const filesDir = `${await new Promise((resolve, reject) => {
            system.getFilesDir(resolve, reject);
        })}/termux`;

        if (installing) {
            return new Promise((resolve, reject) => {

                readAsset("init.sh", async (content) => {
                    system.writeText(`${filesDir}/init.sh`, content, logger, err_logger);
                });

                readAsset("init-sandbox.sh", (content) => {
                    system.writeText(`${filesDir}/init-sandbox.sh`, content, logger, err_logger);

                    Executor.start("sh", (type, data) => {
                        logger(`${type} ${data}`);

                        // Check for exit code during installation
                        if (type === "exit") {
                            resolve(data === "0");
                        }
                    }).then(async (uuid) => {
                        await Executor.write(uuid, `source ${filesDir}/init-sandbox.sh ${installing ? "--installing" : ""}; exit`);
                    }).catch((error) => {
                        err_logger("Failed to start AXS:", error);
                        resolve(false);
                    });
                });


            });
        } else {

            readAsset("init.sh", async (content) => {
                system.writeText(`${filesDir}/init.sh`, content, logger, err_logger);
            });

            readAsset("init-sandbox.sh", (content) => {
                system.writeText(`${filesDir}/init-sandbox.sh`, content, logger, err_logger);

                Executor.start("sh", (type, data) => {
                    logger(`${type} ${data}`);
                }).then(async (uuid) => {
                    await Executor.write(uuid, `source ${filesDir}/init-sandbox.sh ${installing ? "--installing" : ""}; exit`);
                });
            });


        }
    },

    /**
     * Stops the AXS process by forcefully killing it.
     * @returns {Promise<void>}
     */
    async stopAxs() {
        await Executor.execute(`kill -KILL $(cat $PREFIX/termux/pid)`);
    },

    /**
     * Checks if the AXS process is currently running.
     * @returns {Promise<boolean>} - `true` if AXS is running, `false` otherwise.
     */
    async isAxsRunning() {
        const filesDir = `${await new Promise((resolve, reject) => {
            system.getFilesDir(resolve, reject);
        })}/termux`;

        const pidExists = await new Promise((resolve, reject) => {
            system.fileExists(`${filesDir}/pid`, false, (result) => {
                resolve(result == 1);
            }, reject);
        });

        if (!pidExists) return false;

        const result = await Executor.BackgroundExecutor.execute(`kill -0 $(cat $PREFIX/termux/pid) 2>/dev/null && echo "true" || echo "false"`);
        return String(result).toLowerCase() === "true";
    },

    /**
     * Installs termux by downloading binaries and extracting the root filesystem.
     * Also sets up additional dependencies for F-Droid variant.
     * @param {Function} [logger=console.log] - Function to log standard output.
     * @param {Function} [err_logger=console.error] - Function to log errors.
     * @returns {Promise<boolean>} - Returns true if installation completes with exit code 0
     */
    async install(logger = console.log, err_logger = console.error) {
        if (!(await this.isSupported())) return false;

        try {
            //cleanup before insatll
            await this.uninstall();
        } catch (e) {
            //supress error
        }

        const filesDir = `${await new Promise((resolve, reject) => {
            system.getFilesDir(resolve, reject);
        })}/termux`;

        const arch = await new Promise((resolve, reject) => {
            system.getArch(resolve, reject);
        });

        try {
            //let rootfsUrl;
            //let axsUrl;
            let prootUrl;
            let libTalloc;
            let libproot = null;
            let libproot32 = null;

            if (arch === "arm64-v8a") {
                libproot = "https://raw.githubusercontent.com/Acode-Foundation/Acode/main/src/plugins/proot/libs/arm64/libproot.so";
                libproot32 = "https://raw.githubusercontent.com/Acode-Foundation/Acode/main/src/plugins/proot/libs/arm64/libproot32.so";
                libTalloc = "https://raw.githubusercontent.com/Acode-Foundation/Acode/main/src/plugins/proot/libs/arm64/libtalloc.so";
                prootUrl = "https://raw.githubusercontent.com/Acode-Foundation/Acode/main/src/plugins/proot/libs/arm64/libproot-xed.so";
                //axsUrl = `${window.Termux.baseUrl}/axs-musl-android-arm64`
                //rootfsUrl = `${window.Termux.baseUrl}/rootfs.tar`;
            } /*else if (arch === "armeabi-v7a") {
                libproot = "https://raw.githubusercontent.com/Acode-Foundation/Acode/main/src/plugins/proot/libs/arm32/libproot.so";
                libTalloc = "https://raw.githubusercontent.com/Acode-Foundation/Acode/main/src/plugins/proot/libs/arm32/libtalloc.so";
                prootUrl = "https://raw.githubusercontent.com/Acode-Foundation/Acode/main/src/plugins/proot/libs/arm32/libproot-xed.so";
                axsUrl = `https://github.com/bajrangCoder/acodex_server/releases/latest/download/axs-musl-android-armv7`;
                //termuxUrl = 
            }else if (arch === "x86_64") {
                libproot = "https://raw.githubusercontent.com/Acode-Foundation/Acode/main/src/plugins/proot/libs/x64/libproot.so";
                libproot32 = "https://raw.githubusercontent.com/Acode-Foundation/Acode/main/src/plugins/proot/libs/x64/libproot32.so";
                libTalloc = "https://raw.githubusercontent.com/Acode-Foundation/Acode/main/src/plugins/proot/libs/x64/libtalloc.so";
                prootUrl = "https://raw.githubusercontent.com/Acode-Foundation/Acode/main/src/plugins/proot/libs/x64/libproot-xed.so";
                axsUrl = `https://github.com/bajrangCoder/acodex_server/releases/latest/download/axs-musl-android-x86_64`;
                //termuxUrl = 
            }*/ else {
                err_logger(`Unsupported architecture: ${arch}`)
                throw new Error(`Unsupported architecture: ${arch}`);
            }


            logger("⬇️  Installing sandbox filesystem...");


            window.resolveLocalFileSystemURL(`${window.Termux.baseUrl}/rootfs.tar`, function (fileEntry) {

                window.resolveLocalFileSystemURL(cordova.file.dataDirectory, function (dirEntry) {

                    fileEntry.copyTo(
                        dirEntry,
                        "rootfs.tar",
                        function (newFileEntry) {
                            console.log("Copied successfully:", newFileEntry.toURL());
                        },
                        function (err) {
                            console.error("Copy failed:", err);
                        }
                    );

                }, console.error);

            }, console.error);

            /*await new Promise((resolve, reject) => {
                cordova.plugin.http.downloadFile(
                    rootfsUrl, {}, {},
                    cordova.file.dataDirectory + "rootfs.tar",
                    resolve, reject
                );
            });*/

            logger("⬇️  Installing axs...");


            window.resolveLocalFileSystemURL(`${window.Termux.baseUrl}/axs-musl-android-arm64`, function (fileEntry) {

                window.resolveLocalFileSystemURL(cordova.file.dataDirectory, function (dirEntry) {

                    fileEntry.copyTo(
                        dirEntry,
                        "axs",
                        function (newFileEntry) {
                            console.log("Copied successfully:", newFileEntry.toURL());
                        },
                        function (err) {
                            console.error("Copy failed:", err);
                        }
                    );

                }, console.error);

            }, console.error);

            /*await new Promise((resolve, reject) => {
                cordova.plugin.http.downloadFile(
                    axsUrl, {}, {},
                    cordova.file.dataDirectory + "axs",
                    resolve, reject
                );
            });*/

            const isFdroid = await Executor.execute("echo $FDROID");
            if (isFdroid === "true") {
                logger("🐧  F-Droid flavor detected, downloading additional files...");
                logger("⬇️  Downloading compatibility layer...");
                await new Promise((resolve, reject) => {
                    cordova.plugin.http.downloadFile(
                        prootUrl, {}, {},
                        cordova.file.dataDirectory + "libproot-xed.so",
                        resolve, reject
                    );
                });

                logger("⬇️  Downloading supporting library...");
                await new Promise((resolve, reject) => {
                    cordova.plugin.http.downloadFile(
                        libTalloc, {}, {},
                        cordova.file.dataDirectory + "libtalloc.so.2",
                        resolve, reject
                    );
                });

                if (libproot != null) {
                    await new Promise((resolve, reject) => {
                        cordova.plugin.http.downloadFile(
                            libproot, {}, {},
                            cordova.file.dataDirectory + "libproot.so",
                            resolve, reject
                        );
                    });
                }

                if (libproot32 != null) {
                    await new Promise((resolve, reject) => {
                        cordova.plugin.http.downloadFile(
                            libproot32, {}, {},
                            cordova.file.dataDirectory + "libproot32.so",
                            resolve, reject
                        );
                    });
                }

            }

            logger("✅  All downloads completed");

            logger("📁  Setting up directories...");

            const rootfsDir = `${filesDir}/rootfs`;

            try {
                await new Promise((resolve, reject) => {
                    system.mkdirs(`${filesDir}/.downloaded`, resolve, reject);
                });

                await new Promise((resolve, reject) => {
                    system.mkdirs(rootfsDir, resolve, reject);
                });
            } catch (e) {
                console.error(e)
            }

            logger("📦  Extracting sandbox filesystem...");
            await Executor.execute(`cd ${rootfsDir} && tar -xf ${filesDir}/../rootfs.tar`);

            logger("✅  Extraction complete");
            await new Promise((resolve, reject) => {
                system.mkdirs(`${filesDir}/.extracted`, resolve, reject);
            });

            logger("⚙️  Updating sandbox enviroment...");
            const installResult = await this.startAxs(true, logger, err_logger);
            return installResult;

        } catch (e) {
            err_logger("Installation failed:", e);
            console.error("Installation failed:", e);
            return false;
        }
    },

    /**
     * Checks if termux is already installed.
     * @returns {Promise<boolean>} - Returns true if all required files and directories exist.
     */
    isInstalled() {

        return new Promise(async (resolve, reject) => {
            const filesDir = `${await new Promise((resolve, reject) => {
                system.getFilesDir(resolve, reject);
            })}/termux`;

            const termuxExists = await new Promise((resolve, reject) => {
                system.fileExists(`${filesDir}`, false, (result) => {
                    resolve(result == 1);
                }, reject);
            });

            const downloaded = termuxExists && await new Promise((resolve, reject) => {
                system.fileExists(`${filesDir}/.downloaded`, false, (result) => {
                    resolve(result == 1);
                }, reject);
            });

            const extracted = termuxExists && await new Promise((resolve, reject) => {
                system.fileExists(`${filesDir}/.extracted`, false, (result) => {
                    resolve(result == 1);
                }, reject);
            });

            const configured = termuxExists && await new Promise((resolve, reject) => {
                system.fileExists(`${filesDir}/.configured`, false, (result) => {
                    resolve(result == 1);
                }, reject);
            });

            resolve(termuxExists && downloaded && extracted && configured);
        });
    },

    /**
     * Checks if the current device architecture is supported.
     * @returns {Promise<boolean>} - `true` if architecture is supported, otherwise `false`.
     */
    isSupported() {
        return new Promise((resolve, reject) => {
            system.getArch((arch) => {
                resolve(["arm64-v8a", "armeabi-v7a", "x86_64"].includes(arch));
            }, reject);
        });
    },
    /**
     * Creates a backup of the termux Linux installation
     * @async
     * @function backup
     * @description Creates a compressed tar archive of the termux installation
     * @returns {Promise<string>} Promise that resolves to the file URI of the created backup file (aterm_backup.tar)
     * @throws {string} Rejects with "termux is not installed." if termux is not currently installed
     * @throws {string} Rejects with command output if backup creation fails
     * @example
     * try {
     *   const backupPath = await backup();
     *   console.log(`Backup created at: ${backupPath}`);
     * } catch (error) {
     *   console.error(`Backup failed: ${error}`);
     * }
     */
    backup() {
        return new Promise(async (resolve, reject) => {
            if (!await this.isInstalled()) {
                reject("termux is not installed.");
                return;
            }

            const cmd = `
            set -e

            INCLUDE_FILES="termux .downloaded .extracted axs"
            if [ "$FDROID" = "true" ]; then
                INCLUDE_FILES="$INCLUDE_FILES libtalloc.so.2 libproot-xed.so"
            fi

            EXCLUDE="--exclude=termux/data --exclude=termux/system --exclude=termux/vendor --exclude=termux/sdcard --exclude=termux/storage --exclude=termux/public"

            tar -cf "$PREFIX/termux/aterm_backup.tar" -C "$PREFIX/termux" $EXCLUDE $INCLUDE_FILES
            echo "ok"
            `;

            const result = await Executor.execute(cmd);
            if (result === "ok") {
                resolve(cordova.file.dataDirectory + "aterm_backup.tar");
            } else {
                reject(result);
            }
        });
    },
    /**
     * Restores termux Linux installation from a backup file
     * @async
     * @function restore
     * @description Restores the termux installation from a previously created backup file (aterm_backup.tar).
     * This function stops any running termux processes, removes existing installation files, and extracts
     * the backup to restore the previous state. The backup file must exist in the expected location.
     * @returns {Promise<string>} Promise that resolves to "ok" when restoration completes successfully
     * @throws {string} Rejects with "Backup File does not exist" if aterm_backup.tar is not found
     * @throws {string} Rejects with command output if restoration fails
     * @example
     * try {
     *   await restore();
     *   console.log("termux installation restored successfully");
     * } catch (error) {
     *   console.error(`Restore failed: ${error}`);
     * }
     */
    restore() {
        return new Promise(async (resolve, reject) => {
            if (await this.isAxsRunning()) {
                await this.stopAxs();
            }

            const cmd = `
            sleep 2

            INCLUDE_FILES="$PREFIX/termux/termux $PREFIX/termux/.downloaded $PREFIX/termux/.extracted $PREFIX/termux/axs"

            if [ "$FDROID" = "true" ]; then
                INCLUDE_FILES="$INCLUDE_FILES $PREFIX/termux/libtalloc.so.2 $PREFIX/termux/libproot-xed.so"
            fi

            for item in $INCLUDE_FILES; do
                rm -rf -- "$item"
            done

            tar -xf "$PREFIX/termux/aterm_backup.bin" -C "$PREFIX/termux"
            echo "ok"
            `;

            const result = await Executor.execute(cmd);
            if (result === "ok") {
                resolve(result);
            } else {
                reject(result);
            }
        });
    },
    /**
     * Uninstalls the termux Linux installation
     * @async
     * @function uninstall
     * @description Completely removes the termux Linux installation from the device by deleting all
     * termux-related files and directories. This function stops any running termux processes before
     * removal. NOTE: This does not perform cleanup of $PREFIX/termux
     * @returns {Promise<string>} Promise that resolves to "ok" when uninstallation completes successfully
     * @throws {string} Rejects with command output if uninstallation fails
     * @example
     * try {
     *   await uninstall();
     *   console.log("termux installation removed successfully");
     * } catch (error) {
     *   console.error(`Uninstall failed: ${error}`);
     * }
     */
    uninstall() {
        return new Promise(async (resolve, reject) => {
            if (await this.isAxsRunning()) {
                await this.stopAxs();
            }

            const cmd = `
            set -e

            INCLUDE_FILES="$PREFIX/termux/termux $PREFIX/termux/.downloaded $PREFIX/termux/.extracted $PREFIX/termux/axs"

            if [ "$FDROID" = "true" ]; then
                INCLUDE_FILES="$INCLUDE_FILES $PREFIX/termux/libtalloc.so.2 $PREFIX/termux/libproot-xed.so"
            fi

            for item in $INCLUDE_FILES; do
                rm -rf -- "$item"
            done

            echo "ok"
            `;
            const result = await Executor.execute(cmd);
            if (result === "ok") {
                resolve(result);
            } else {
                reject(result);
            }
        });
    }
};


function readAsset(assetPath, callback) {
    const assetUrl = window.Termux.baseUrl + assetPath;

    window.resolveLocalFileSystemURL(assetUrl, fileEntry => {
        fileEntry.file(file => {
            const reader = new FileReader();
            reader.onloadend = () => callback(reader.result);
            reader.readAsText(file);
        }, console.error);
    }, console.error);
}


export default TermuxTerm;