#!/usr/bin/env node
const { program } = require('commander');
const fs = require('fs');

program
  .version('1.0.0')
  .argument('<directory>', 'directory to reach')
  .option('--first', 'only show the first result', false)

program.parse();

const dirToReach = program.args[0];
const allDirs = fs.readdirSync('/var/www');

const indexesOf = (arr, searchElement) => {
    var i = arr.indexOf(searchElement),
        indexes = [];
    while (i !== -1) {
        indexes.push(i);
        i = arr.indexOf(searchElement, ++i);
    }
    return indexes;
}

const calcScore = (dirToReach, dir) => {
    let directoryName = dir
    const letters = dirToReach.split('');
    let lastPos = -1
    return letters.reduce(function (score, letter) {
        const indexes = indexesOf(directoryName, letter)
        const scor = indexes.filter(index => index >= lastPos).shift()
        // console.log(directoryName, letter, '=' + lastPos, '#' +score, '+' +scor)
        // console.log(indexes)
        if(scor < 0 || scor < lastPos || score < 0 || scor === undefined) return -1
        else if(scor < score) return score
        lastPos = scor
        return score+scor
    }, 0)
}

const scores = allDirs
    .map(dir => ({score:calcScore(dirToReach, dir), dirname: dir}))
    .filter(dir => dir.score >= 0)
    .sort((a,b) => a.score - b.score)
    .map(dir => dir.dirname)

// console.log(scores)

if(program.opts().first) {
    console.log(scores.shift())
} else {
    console.log(scores.join(' '))
}

