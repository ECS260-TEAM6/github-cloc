const path = require('path');
const fs = require('fs');
const readline = require('readline');
const simpleGit = require('simple-git');
const csvtojsonV2 = require("csvtojson");
const { Parser } = require('json2csv');
const exec = require("child_process").execSync;

const git = simpleGit();
const map = new Map();

const args = process.argv.slice(2);
const startP = args[0];
const lang = args[1];

const cloneBasePath = `${require('os').homedir()}/projects`;

async function fromBuildLogDir(startPath) {
    const files = fs.readdirSync(startPath);
    for (let i = 0; i < files.length; i++) {
        const dirName = path.join(startPath, files[i]);
        try {
            await fromDir(dirName);
        } catch (e) {
            console.log(e);
        }
        await new Promise(resolve => setTimeout(resolve, 30000));
    };
}

async function fromDir(dirPath) {
    const filePath = `${dirPath}/buildlog-data-travis.csv`;
    const repoDataPath = `${dirPath}/repo-data-travis.csv`;
    const outPath = `${dirPath}/buildlog-data-travis-cloc.csv`;

    if (!fs.existsSync(filePath)) {
        return;
    }

    const dirName = path.basename(dirPath);
    const [account, proj] = dirName.split("@");
    const projPath = `${cloneBasePath}/${proj}`;
    await git.clone(`https://github.com/${account}/${proj}`, projPath);

    await processLineByLine(filePath, repoDataPath, outPath, projPath);
};

async function processLineByLine(fPath, repoDataPath, outPath, projPath) {
    const rStream = fs.createReadStream(fPath);

    const repoDataArr = await csvtojsonV2().fromFile(repoDataPath);
    const buildLogArr = await csvtojsonV2().fromFile(fPath);

    // Collect all the commits that are in master or main branch
    const commitsMaster = new Set();
    const filteredDat = repoDataArr.filter(dat => {
        const lowerCaseBranch = dat.branch.toLowerCase();
        return lowerCaseBranch == 'master' ||
            lowerCaseBranch == 'main';
    });
    filteredDat.forEach(data => {
        commitsMaster.add(data.commit);
    });

    const filteredBuildLogData = buildLogArr.filter(logDat => {
        return commitsMaster.has(logDat.tr_original_commit);
    })

    // the repository should have at least 5 builds.
    if (!filteredBuildLogData || filteredBuildLogData.length < 5) {
        return;
    }

    filteredBuildLogData.forEach(filteredData => {
        filteredData.loc = -1;
    })

    const count = filteredBuildLogData.length;
    const dist = Math.floor(count / 20);

    fs.appendFileSync(outPath, `${Object.getOwnPropertyNames(filteredBuildLogData[0]).join(',')}\n`);
    if (dist <= 0) {
        for (let i = 0; i < filteredBuildLogData.length; i++) {
            await processBuildLogDat(filteredBuildLogData[i], outPath, projPath);
        }
    }
    else {
        for (let i = 0; i < 20 && i * dist < filteredBuildLogData.length; i++) {
            await processBuildLogDat(filteredBuildLogData[i * dist], outPath, projPath);
        }
    }
}

async function processBuildLogDat(buildLogDat, outPath, projPath) {
    console.log(`Line from file: ${buildLogDat}`);
    try {
        if (map.has(buildLogDat.tr_original_commit)) {
            buildLogDat.loc = map.get(buildLogDat.tr_original_commit);
        } else {
            exec(`git checkout ${buildLogDat.tr_original_commit}`,
                { cwd: projPath });
            const res = exec(`cloc ${projPath} | grep -i ${lang}`).toString();
            var linesOfCode = res.match(/\S+/g)[4];
            buildLogDat.loc = linesOfCode;
            map.set(buildLogDat.tr_original_commit, linesOfCode);
        }
        fs.appendFileSync(outPath,
            `${Object
                .getOwnPropertyNames(buildLogDat)
                .map(prop => buildLogDat[prop])
                .join(',')}\n`);
    } catch (e) {
        console.log(e);
    }
}

fromBuildLogDir(startP);