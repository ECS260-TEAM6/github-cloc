const path = require('path');
const fs = require('fs');
const readline = require('readline');
const simpleGit = require('simple-git');
const exec = require("child_process").execSync;

const git = simpleGit();
const map = new Map();

async function fromBuildLogDir(startPath) {
    var files = fs.readdirSync(startPath);
    for (var i = 0; i < files.length; i++) {
        var dirName = path.join(startPath, files[i]);
        await fromDir(dirName);
    };
}

async function fromDir(dirPath) {
    const filePath = `${dirPath}/buildlog-data-travis.csv`;
    const outPath = `${dirPath}/buildlog-data-travis-cloc.csv`;

    if (!fs.existsSync(filePath)) {
        return;
    }

    const dirName = path.basename(dirPath);
    const [account, proj] = dirName.split("@");
    const projPath = `${dirPath}/${proj}`;
    await git.clone(`https://github.com/${account}/${proj}`, projPath);

    await processLineByLine(filePath, outPath, projPath);
};

async function processLineByLine(fPath, outPath, projPath) {
    const rStream = fs.createReadStream(fPath);

    const rl = readline.createInterface({
        input: rStream,
        crlfDelay: Infinity
    });
    let lineCount = 0;
    for await (const line of rl) {
        if (lineCount == 0) {
            lineCount++;
            continue;
        }
        await processLine(line, outPath, projPath);
    }
}

async function processLine(line, outPath, projPath) {
    console.log(`Line from file: ${line}`);

    // [login, project, language, watchers]
    const items = line.split(',');
    const commit = items[3];

    if (map.has(commit)) {
        items.push(map.get(commit));
        fs.appendFileSync(outPath, `${items.join(',')}\n`);
    } else {
        const gitPath = `${projPath}/.git`;
        exec(`git --git-dir=${gitPath} checkout ${commit}`);
    }

    if (isEnabled != '-1' && (
        desiredLang == lang)) {
        fs.appendFileSync(outFile, `${items.slice(0, 2).join(' ')}\n`);
    }
}

var args = process.argv.slice(2);
const startP = args[0];
fromBuildLogDir(startP);