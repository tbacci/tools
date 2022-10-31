#!/usr/bin/env node
const fs = require('fs');
const { spawn } = require("child_process");
const { program } = require('commander');
const YAML = require('yaml')
const Table = require('cli-table/lib');
const {Docker} = require('node-docker-api');
const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const fuzzy = require('fuzzy');
const clc = require("cli-color");

let services = []
let dockerContainers = [];

async function loadDockerContainers() {
    dockerContainers = await docker.container.list()
}

function loadServices () {
    if(fs.existsSync('docker-compose.yml')) {
        const file = fs.readFileSync('./docker-compose.yml', 'utf8')
        const dockerCompose = YAML.parse(file)
        services = dockerCompose.services
    }
    if(fs.existsSync('docker-compose.dev.yml')) {
        const file = fs.readFileSync('./docker-compose.dev.yml', 'utf8')
        const dockerCompose = YAML.parse(file)
        services = {...services, ...dockerCompose.services}
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
    for(const serviceId in services) {
        const service = services[serviceId]
        const regExp = new RegExp(serviceId)
        const mathContainers = dockerContainers.filter(container => container.data.Names[0].match(regExp))
        if(mathContainers.length > 0) {
            for (container of mathContainers) {
                const name = container.data.Names[0].replace('/', '')
                const state = container.data.State
                const displayName = name.indexOf('bernard-minet') !== -1 ? clc.yellow(name) : name
                const displayState = state === 'running' ? clc.green(state) : clc.red(state)
                table.push([displayName, displayState, container.data.Image, container.id.slice(0,12)])
            }
        }
        else {
            table.push([clc.red(serviceId), clc.red('exited'), service.image])
        }
        // dockerContainers.map(container => console.log(container.data.Names))
    }
    console.log(table.toString());
}

async function start() {
    await init()
    if(services.length <= 0) {
        console.log('No docker-compose.yml found in current directory')
        return 1
    }

    for(const serviceId in services) {
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
    spawn('make', ['docker-stop'], { stdio: 'inherit' })
}

async function go(where) {
    await init()
    if(!where) {
        console.log('missing <where> argument')
        return 1
    }
    let containers = [];
    for(const serviceId in services) {
        const regExp = new RegExp(serviceId)
        containers = [...containers, ...dockerContainers.filter(container => container.data.Names[0].match(regExp))]
    }
    let running = false
    let whereContainer = fuzzy.filter(where, containers.map(container => container.data.Names[0])).shift()
    if(whereContainer){
        running = true
        const container = dockerContainers.find(container => container.data.Names[0] === whereContainer.original)
        spawn('docker', ['exec', '-ti', container.id, 'sh'], { stdio: 'inherit' });
    }
    // Not found on running containers, searching on dockerfiles
    whereContainer = fuzzy.filter(where, Object.keys(services)).shift()
    if(whereContainer) {
        running = true
        const envFile = fs.existsSync('docker-compose.env') ? '--env-file=docker-compose.env' : ''
        spawn('docker', ['compose', envFile, 'run', '--rm', '-ti', whereContainer.original, 'sh'], { stdio: 'inherit' });
    }
    if(!running) {
        console.log('No matching containers found')
        return 1
    }
}

program
    .version('1.0.0')
    .argument('<command>')
    .addHelpText('after', `
Commands : 
    cm start        start all containers from current directory via make docker-run
    cm stop         stop all containers from current directory via make docker-stop
    cm status       display containers status from current directory
    cm go <fuzzy>   search matching container from current directory & connect to it
`).showHelpAfterError()

program.parse();


const command = program.args[0];

switch (command){
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
}

