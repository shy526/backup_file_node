#!/usr/bin/env node

const chalk = require("chalk");
const shell = require("shelljs");
const path = require("path");
const fs = require('fs');
const zip = require("zip-local");
const https = require('https');

const run = function () {
    let banner = chalk.green('文件' + chalk.blue.underline.bold('备份') + '工具')
    console.log(banner);
    if (process.argv.length <= 2) {
        console.log(chalk.red("没有指定配置文件,应指定如下格式的文件:"))
        configBanner("没有")
        return;
    }
    let backup = null;
    let configPath = process.argv[2];
    if (fs.existsSync(configPath)) {
        let buffer = fs.readFileSync(configPath);
        backup = JSON.parse(buffer.toString());
        try {
            if (!Array.isArray(backup.backupFiles) || !backup.local
            ||!backup.userName||!backup.repo||!backup.token) {
                configBanner(backup)
                return
            }
            let errorFlag = false;
            backup.backupFiles.forEach(item => {
                try {
                    if (!item.name || !item.backupTime || !item.path) {
                        configBanner2(item);
                        errorFlag = true;
                    }
                } catch (err) {
                    errorFlag = true;
                    configBanner2(item);

                }
            })
            if (errorFlag) return;

        } catch (err) {
            configBanner(backup);
            return
        }

    } else {
        console.log(chalk.red(`没有该文件:${configPath}`));
        return;
    }
    backup.backupFiles.forEach(item=>{
        item["local"]=backup.local
        item["token"]=backup.token
        item["userName"]=backup.userName
        item["repo"]=backup.repo
    })
    let second=1000 * 60
    addListener(backup.backupFiles)
    setInterval(() => {
        backup.backupFiles.forEach(item => {
            backupFile(item, "time",true)
        })

    },second*30)
}();
function addListener(backFiles) {
    if (backFiles && Array.isArray(backFiles)) {
        backFiles.forEach(item => {
            fs.watch(item.path, (eventType, filename) => {
                if (eventType == "rename") {
                    //不监听改名事件
                    return;
                }
                item.backupTime = new Date().getTime();
                backupFile(item, "watch",true)
            })
        })
    }
}


function backupFile(item, stamp,putRepoFlag) {
    let backupPath = item.path;
    let targetPath = path.join(item.local, item.name, stamp)
    if (fs.existsSync(backupPath)) {
        if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath)
            console.log(`创建目标目录:${targetPath}`)
        }
        let pathParse = path.parse(backupPath);
        let nowTime = new Date().toLocaleString().replace(/:/g, "-");
        let zipName = `${pathParse.name}-${nowTime}-${stamp}.zip`;
        let outZip = path.join(targetPath, zipName);
        zip.sync.zip(backupPath).compress().save(outZip);
        deleteBackupOut(targetPath)
        if (putRepoFlag){
            putRepo(item,path.join(item.name,stamp,zipName),outZip)
        }
        console.log(backupPath + "====>" + outZip)
    } else {
        console.log(`文件不存在:${backupPath}`)
    }

}

function deleteBackupOut(targetPath) {
    let files = fs.readdirSync(targetPath);
    if (files.length > 5) {
        let min = 253381363200000;
        let deleteFile = "";
        files.forEach(item => {
            let deletePath = path.join(targetPath, item);
            let stats = fs.statSync(deletePath);
            if (stats.birthtimeMs < min) {
                deleteFile = deletePath
                min = stats.birthtimeMs;
            }
        })
        fs.unlink(deleteFile, (err) => {
            err ? console.log(`${err}删除备份异常=>${deleteFile}`) : console.log(`删除备份=>${deleteFile}`)
        });
    }
}


function configBanner(message) {

    let banner = chalk.red(`模版:
    {
    "backupFiles": [
                    { 
                        "name":  "唯一的名称",
                        "path": "需要备份的名称",
                        "backupTime": -1
                    },
                     { 
                        "name": "唯一的名称",
                        "path": "需要备份的名称",
                        "backupTime": -1
                    },
              ],
    "local": "本地备份路径",
    "token": "github令牌",
    "userName": "github用户名",
    "repo":"github仓库"
    }
    你的:
    ${message}`);

    console.log(banner)
}

function configBanner2(messsage) {
    console.log(chalk.red(`模版:
    { 
                        "name":  "唯一的名称",
                        "path": "需要备份的名称",
                        "backupTime": -1
                    }
                    你的:
                    ${message}`))

}


function putRepo(item,cpath,localPath) {
    cpath=encodeURI(cpath.replace(/\\/g,"/"))
    let option = {
        hostname: 'api.github.com',
        path: `/repos/${item.userName}/${item.repo}/contents/${cpath}`,
        headers: {
            'Authorization': `token ${item.token}`,
            "User-Agent": "backup"
             },
        method: 'PUT',
       };
    const req = https.request(option, (res) => {
        if (res.statusCode==201){
            console.log(`${localPath} ====> https://${option.hostname}${option.path}`)
        }
    }).on('error', (e) => {
        console.error(e);
    })
    let data = fs.readFileSync(localPath);
    let body = {"message": `backupFile ${cpath}`,
        "content": data.toString('base64')};
    req.write(JSON.stringify(body))
        req.end();

}



