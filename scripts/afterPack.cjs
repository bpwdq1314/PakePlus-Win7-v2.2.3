const fs = require('fs')
const path = require('path')

/**
 * electron-builder afterPack hook.
 * 清理无用文件：map、调试符号、LICENSE、WebGL 相关和 resources.pak 等。
 *
 * @param {import('electron-builder').AfterPackContext} context
 */
module.exports = async function afterPack(context) {
    const appDir = context.appOutDir

    const removeFileSafe = (filePath) => {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath)
            }
        } catch {
            // ignore
        }
    }

    const removeDirSafe = (dirPath) => {
        try {
            if (fs.existsSync(dirPath)) {
                fs.rmSync(dirPath, { recursive: true, force: true })
            }
        } catch {
            // ignore
        }
    }

    // 删除根目录下一些常见调试和 LICENSE 文件
    ;[
        'LICENSE',
        'LICENSES.chromium.html',
        'LICENSE.electron.txt',
        'version',
    ].forEach((name) => removeFileSafe(path.join(appDir, name)))

    const resourcesDir = path.join(appDir, 'resources')

    // 删除 resources.pak 以及其它多余的 pak / bin
    if (fs.existsSync(resourcesDir)) {
        const entries = fs.readdirSync(resourcesDir)
        for (const entry of entries) {
            const full = path.join(resourcesDir, entry)
            if (
                entry === 'resources.pak' ||
                entry.endsWith('.bin') ||
                (entry.endsWith('.pak') && entry !== 'app.asar')
            ) {
                removeFileSafe(full)
            }
        }
    }

    // 删除 WebGL 相关二进制（swiftshader 等）
    removeDirSafe(path.join(appDir, 'swiftshader'))
    removeFileSafe(path.join(appDir, 'vk_swiftshader_icd.json'))

    // 递归删除 .map / 调试符号文件
    const walkAndClean = (dir) => {
        if (!fs.existsSync(dir)) return
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
            const full = path.join(dir, entry.name)
            if (entry.isDirectory()) {
                walkAndClean(full)
            } else {
                if (
                    full.endsWith('.map') ||
                    full.endsWith('.pdb') ||
                    full.endsWith('.dSYM') ||
                    full.endsWith('.log')
                ) {
                    removeFileSafe(full)
                }
            }
        }
    }

    walkAndClean(appDir)
}
