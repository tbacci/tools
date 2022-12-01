#!/usr/bin/env node
const fs = require('fs');
const {spawn, exec} = require("child_process");
const {program} = require('commander');
const YAML = require('yaml')
const Table = require('cli-table/lib');
const {Docker} = require('node-docker-api');
const docker = new Docker({socketPath: '/var/run/docker.sock'});
const fuzzy = require('fuzzy');
const clc = require("cli-color");
const diff = require('diff');

let services = []
let dockerContainers = [];

function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

function mergeDeep(target, source) {
    let output = Object.assign({}, target);
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target))
                    Object.assign(output, {[key]: source[key]});
                else
                    output[key] = mergeDeep(target[key], source[key]);
            } else {
                Object.assign(output, {[key]: source[key]});
            }
        });
    }
    return output;
}

async function loadDockerContainers() {
    dockerContainers = await docker.container.list()
}

function loadServices() {
    if (fs.existsSync('docker-compose.yml')) {
        const file = fs.readFileSync('./docker-compose.yml', 'utf8')
        const dockerCompose = YAML.parse(file)
        services = dockerCompose.services
    }
    if (fs.existsSync('docker-compose.dev.yml')) {
        const file = fs.readFileSync('./docker-compose.dev.yml', 'utf8')
        const dockerCompose = YAML.parse(file)
        services = mergeDeep(services, dockerCompose.services)
    }
}

async function init() {
    await loadDockerContainers()
    loadServices()
}

async function status() {
    await init()
    const table = new Table({
        head: ['NAME', 'STATE', 'IMAGE', 'ID'],
        chars: {
            'top': '',
            'top-mid': '',
            'top-left': '',
            'top-right': '',
            'bottom': '',
            'bottom-mid': '',
            'bottom-left': '',
            'bottom-right': '',
            'left': '',
            'left-mid': '',
            'mid': '',
            'mid-mid': '',
            'right': '',
            'right-mid': '',
            'middle': ' '
        },
    });
    for (const serviceId in services) {
        const service = services[serviceId]
        const regExp = new RegExp(serviceId)
        const mathContainers = dockerContainers.filter(container => container.data.Names[0].match(regExp))
        if (mathContainers.length > 0) {
            for (container of mathContainers) {
                const name = container.data.Names[0].replace('/', '')
                const state = container.data.State
                const displayName = name.indexOf('bernard-minet') !== -1 ? clc.yellow(name) : name
                const displayState = state === 'running' ? clc.green(state) : clc.red(state)
                table.push([displayName, displayState, container.data.Image, container.id.slice(0, 12)])
            }
        } else {
            if (service.image) {
                table.push([clc.red(serviceId), clc.red('exited'), service.image])
            }
        }
        // dockerContainers.map(container => console.log(container.data.Names))
    }
    console.log(table.toString());
}

async function start() {
    await init()
    if (services.length <= 0) {
        console.log('No docker-compose.yml found in current directory')
        return 1
    }

    for (const serviceId in services) {
        const regExp = new RegExp(serviceId)
        const mathContainers = dockerContainers.filter(container => container.data.Names[0].match(regExp))
        if (mathContainers.length > 0) {
            for (container of mathContainers) {
                const name = container.data.Names[0].replace('/', '')
                const displayName = name.indexOf('bernard-minet') !== -1 ? clc.yellow(name) : name
                console.log('Found running container ' + displayName + ' for ' + serviceId + ' stopping...')
                await container.stop()
            }
        }
    }

    console.log("\nExecuting make docker-run\n")

    spawn('make', ['docker-run'], {
        // 'inherit' will use the parent process stdio
        stdio: 'inherit'
    })

}

function stop() {
    spawn('make', ['docker-stop'], {stdio: 'inherit'})
}

async function go(where) {
    await init()
    if (!where) {
        console.log('missing <where> argument')
        return 1
    }

    let containers = [];
    for (const serviceId in services) {
        const regExp = new RegExp(serviceId)
        containers = [...containers, ...dockerContainers.filter(container => container.data.Names[0].match(regExp))]
    }

    let whereContainer = fuzzy.filter(where, containers.map(container => container.data.Names[0])).shift()
    if (whereContainer) {
        const container = dockerContainers.find(container => container.data.Names[0] === whereContainer.original)
        spawn('docker', ['exec', '-ti', container.id, '/bin/bash'], {stdio: 'inherit'});
        return
    }
    // Not found on running containers, searching on dockerfiles
    whereContainer = fuzzy.filter(where, Object.keys(services)).shift()
    if (whereContainer) {
        const envFile = fs.existsSync('docker-compose.env') ? '--env-file=docker-compose.env' : ''
        // console.log(whereContainer.original)
        // return
        spawn('docker', ['compose', envFile, 'run', '--rm', '-ti', whereContainer.original, '/bin/bash'], {stdio: 'inherit'});
        return
    }
    console.log('No matching containers found')
    return 1
}

async function log(where) {
    const writeLog = (txt, xterm) => {
        txt = txt.replaceAll('WARNING', clc.bgXterm(237).xterm(216)('WARNING'))
        txt = txt.replaceAll('ERROR', clc.bgXterm(196).xterm(88)('ERROR'))
        txt = txt.replaceAll('CRITICAL', clc.bgXterm(196).xterm(88)('CRITICAL'))
        process.stdout.write(clc.xterm(xterm)(txt))
    }
    await init()
    const colors = [200, 82, 45, 226];
    let colorIndex = 0

    if(where) {
        let containers = [];
        for (const serviceId in services) {
            const regExp = new RegExp(serviceId)
            containers = [...containers, ...dockerContainers.filter(container => container.data.Names[0].match(regExp))]
        }
        const fuzzyResult = fuzzy.filter(where, containers.map(container => container.data.Names[0])).shift()

        if(!fuzzyResult){
            console.log('No matching container found');
            return 1
        }

        const whereContainer = containers.find(container => container.data.Names[0] === fuzzyResult.original)
        if (whereContainer) {
            await whereContainer.logs({
                follow: true,
                stdout: true,
                stderr: true
            }).then(stream => {
                stream.on('data', info =>
                {
                    const output = info.toString('utf-8').split("\n").map(line => line.slice(8)).join("\n")
                    writeLog(clc.xterm(colors[colorIndex])(where.toUpperCase() + ': ') + output, 231)
                }
            )
                stream.on('error', err => {
                    const output = err.toString('utf-8').split("\n").map(line => line.slice(8)).join("\n")
                    writeLog(clc.xterm(colors[colorIndex])(where.toUpperCase() + ': ') + output, 196)
                })
            })
        }
    } else {
        let containers = [];
        for (const serviceId in services) {
            const regExp = new RegExp(serviceId)
            const mathContainers = dockerContainers.filter(container => container.data.Names[0].match(regExp))
            if (mathContainers.length > 0) {
                containers = [...containers, ...mathContainers]
            }
        }


        for(container of containers){
            console.log(clc.xterm(colors[colorIndex])('COULEUR') + colors[colorIndex])
            const nameToCompare = containers.find(c => c.data.Names[0] !== container.data.Names[0]).data.Names[0].replace('_', '-')
            const name = diff.diffWords(container.data.Names[0].replace('_', '-'), nameToCompare)[1].value.split('_')[0]
            await container.logs({
                follow: true,
                stdout: true,
                stderr: true
            }).then(stream => {
                const color = colors[colorIndex]
                stream.on('data', info => {
                    const output = info.toString('utf-8').split("\n").map(line => line.slice(8)).join("\n")
                    writeLog(clc.xterm(color)(name.toUpperCase() + ': ') + output, 231)
                })
                stream.on('error', err => {
                    const output = err.toString('utf-8').split("\n").map(line => line.slice(8)).join("\n")
                    writeLog(clc.xterm(color)(name.toUpperCase() + ': ') + output, 196)
                })
            })

            colorIndex++
        }
    }

    return
}

program
    .version('1.0.0')
    .argument('<command>')
    .addHelpText('after', `
Commands : 
    cm start                   start all containers from current directory via make docker-run
    cm stop                    stop all containers from current directory via make docker-stop
    cm status                  display containers status from current directory
    cm go <fuzzy>              search matching container from current directory & connect to it
    cm log <optional: fuzzy>   display log for selected or all containers
`).showHelpAfterError()

program.parse();


const command = program.args[0];

switch (command) {
    case 'status':
        status()
        break
    case 'start':
        start()
        break
    case 'stop':
        stop()
        break
    case 'go':
        go(program.args[1])
        break
    case 'log':
        log(program.args[1])
        break
}

