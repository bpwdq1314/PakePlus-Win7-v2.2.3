const fs = require('fs-extra')
const path = require('path')
const png2icons = require('png2icons')
const sharp = require('sharp')
const ppconfig = require('./ppconfig.json')

// update package.json build productName
const updatePackage = async (appName, showName, version, id) => {
    const packageJson = await fs.readJson(
        path.join(__dirname, '../', 'package.json')
    )
    packageJson.name = appName
    // update productName
    packageJson.build.productName = showName
    // update id
    packageJson.build.appId = id
    // update version
    packageJson.version = version
    await fs.writeJson(path.join(__dirname, '../', 'package.json'), packageJson)
}

// update config.json
const updateConfig = async (windows, desktop) => {
    const configJson = { ...windows, ...desktop }
    await fs.writeJson(
        path.join(__dirname, '../', 'src-electron', 'config.json'),
        configJson
    )
    console.log('config.json updated', configJson)
}

// update renderer.js DEFAULT_HOME_URL
const updateRendererJs = async (url) => {
    const rendererJs = await fs.readFile(
        path.join(__dirname, '../', 'renderer.js'),
        'utf8'
    )
    const newRendererJs = rendererJs.replace(
        /const DEFAULT_HOME_URL = '.*?'/, // 匹配任意url地址，需要使用正则表达式
        `const DEFAULT_HOME_URL = '${url}'`
    )
    console.log('newRendererJs:', newRendererJs)
    await fs.writeFile(
        path.join(__dirname, '../', 'renderer.js'),
        newRendererJs
    )
    console.log('renderer.js updated')
}

// update main.js defaultExitPassword
const updateMainJs = async (password) => {
    const mainJs = await fs.readFile(
        path.join(__dirname, '../', 'main.js'),
        'utf8'
    )
    console.log('mainJs:', mainJs)
    const newMainJs = mainJs.replace(
        /const defaultExitPassword = '.*?'/,
        `const defaultExitPassword = '${password}'`
    )
    console.log('newMainJs:', newMainJs)
    await fs.writeFile(path.join(__dirname, '../', 'main.js'), newMainJs)
    console.log('main.js updated')
}

// 给图片添加圆角并添加 padding
const createIcon = async (inputPath, tempOutputPath, icnsOutputPath) => {
    sharp(inputPath)
        .resize({
            // 确保图片尺寸一致
            width: 1024,
            height: 1024,
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .composite([
            // rx ry是圆角半径
            {
                input: Buffer.from(
                    `<svg>
         <rect x="0" y="0" width="1024" height="1024" rx="250" ry="250" />
       </svg>`
                ),
                blend: 'dest-in',
            },
        ])
        // top/bottom/left/right 是 padding
        .extend({
            top: 120,
            bottom: 120,
            left: 120,
            right: 120,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .toFile(tempOutputPath)
        .then(() => {
            console.log(
                'Image processing complete with rounded corners and padding.'
            )

            // 读取处理后的 PNG 文件
            fs.readFile(tempOutputPath, (err, data) => {
                if (err) {
                    console.error('Error reading processed PNG file:', err)
                    return
                }

                // 转换 PNG 到 ICNS 格式
                const icnsBuffer = png2icons.createICNS(data, 1, 0)
                if (icnsBuffer) {
                    fs.writeFile(icnsOutputPath, icnsBuffer, (writeErr) => {
                        if (writeErr) {
                            console.error('Error writing ICNS file:', writeErr)
                        } else {
                            console.log(
                                'ICNS file created successfully:',
                                icnsOutputPath
                            )
                            // 删除临时文件
                            fs.remove(tempOutputPath)
                        }
                    })
                } else {
                    console.error('Failed to convert PNG to ICNS.')
                }
            })
        })
        .catch((err) => {
            console.error('Error during image processing:', err)
        })
}

// set github env
const setGithubEnv = (name, showName, version, pubBody) => {
    console.log('setGithubEnv......')
    const envPath = process.env.GITHUB_ENV
    if (!envPath) {
        console.error('GITHUB_ENV is not defined')
        return
    }
    // 判断 showName 是否包含中文字符
    let rename = false
    if (showName.match(/[\u4e00-\u9fa5]/)) {
        rename = true
    }
    try {
        const entries = {
            NAME: name,
            RENAME: rename ? 'true' : 'false',
            VERSION: version,
            PUBBODY: pubBody,
        }
        for (const [key, value] of Object.entries(entries)) {
            if (value !== undefined) {
                fs.appendFileSync(envPath, `${key}=${value}\n`)
            }
        }
        console.log('✅ Environment variables written to GITHUB_ENV')
        // 查看env 变量
        console.log(fs.readFileSync(envPath, 'utf-8'))
    } catch (err) {
        console.error('❌ Failed to parse config or write to GITHUB_ENV:', err)
    }
    console.log('setGithubEnv success')
}

// Main execution
const main = async () => {
    console.log('🚀 worker start')
    const { name, showName, version, id, url, pubBody } = ppconfig.desktop
    console.log('name:', name)
    console.log('version:', version)
    console.log('id:', id)
    console.log('url:', url)
    // console.log('password:', password)
    await updatePackage(name, showName, version, id)
    // update config.json
    await updateConfig(ppconfig.more.windows, ppconfig.desktop)
    // create mac icon
    const iconPath = path.join(__dirname, '../', 'app-icon.png')
    const tempPath = path.join(__dirname, '../', 'processed-image.png')
    const icnsPath = path.join(__dirname, '../', 'icons', 'icon.icns')
    await createIcon(iconPath, tempPath, icnsPath)
    // 设置github env
    setGithubEnv(name, showName, version, pubBody)
    console.log('🚀 worker end')
}

// run worker
main()
