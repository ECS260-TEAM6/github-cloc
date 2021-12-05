const path = require('path');
const fs = require('fs');
const readline = require('readline');
const simpleGit = require('simple-git');
const exec = require("child_process").execSync;

const git = simpleGit();
const map = new Map();

const args = process.argv.slice(2);
const startP = args[0];
const lang = args[1];

const cloneBasePath = `${require('os').homedir()}/projects`;

async function fromBuildLogDir(startPath) {
    const files = fs.readdirSync(startPath);
    for (const i = 0; i < files.length; i++) {
        const dirName = path.join(startPath, files[i]);
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
    const projPath = `${cloneBasePath}/${proj}`;
    await git.clone(`https://github.com/${account}/${proj}`, projPath);

    await processLineByLine(filePath, outPath, projPath);
};

async function processLineByLine(fPath, outPath, projPath) {
    const rStream = fs.createReadStream(fPath);

    var i;
    var count = 0;
    require('fs').createReadStream(fPath)
        .on('data', function (chunk) {
            for (i = 0; i < chunk.length; ++i)
                if (chunk[i] == 10) count++;
        })
        .on('end', function () {
            console.log(count);
        });

    var dist = Math.floor((count - 1) / 4);

    const rl = readline.createInterface({
        input: rStream,
        crlfDelay: Infinity
    });
    let lineCount = -1;
    for await (const line of rl) {
        if (lineCount == -1) {
            lineCount++;
            continue;
        }
        if (lineCount % dist == 0) {
            await processLine(line, outPath, projPath);
        }
    }
}

async function processLine(line, outPath, projPath) {
    console.log(`Line from file: ${line}`);

    // [login, project, language, watchers]
    const items = line.split(',');
    const commit = items[3];

    if (map.has(commit)) {
        items.push(map.get(commit));
    } else {
        const gitPath = `${projPath}/.git`;
        exec(`git --git-dir=${gitPath} checkout -f ${commit}`);
        const res = exec(`cloc ${projPath} | grep -i ${lang}`).toString();
        var linesOfCode = res.match(/\S+/g)[4];
        items.push(linesOfCode);
        map.set(commit, linesOfCode);
    }
    fs.appendFileSync(outPath, `${items.join(',')}\n`);
}


fromBuildLogDir(startP);