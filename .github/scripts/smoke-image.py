#!/usr/bin/env python3
"""Check a production image on isolated dependencies; never use development data."""
import json
import pathlib
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import uuid

image = sys.argv[1]
kind = 'media'
network = kind + '-smoke-' + uuid.uuid4().hex[:10]
containers = []


def docker(*args):
    return subprocess.check_output(['docker', *args], text=True).strip()


def start(name, *args):
    containers.append(name)
    docker('run', '-d', '--name', name, '--network', network, *args)


def wait(name, *command):
    for _ in range(60):
        if subprocess.run(['docker', 'exec', name, *command], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
            return
        time.sleep(1)
    raise RuntimeError(f'{name} startup timeout')


try:
    docker('network', 'create', network)
    broker = network + '-broker'
    start(broker, '--user', '999:999', '--tmpfs', '/var/lib/rabbitmq:uid=999,gid=999,mode=0700',
          '--network-alias', 'broker', '-e', 'RABBITMQ_DEFAULT_USER=smoke', '-e', 'RABBITMQ_DEFAULT_PASS=smoke',
          'rabbitmq:4.4.1-management@sha256:61f90c401a5b5ed2486771973ea92ad66046471eacab9c9149f1a6e091c91677')
    wait(broker, 'rabbitmq-diagnostics', '-q', 'ping')
    values = {}
    for line in pathlib.Path('code/.env.example').read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            key, value = line.split('=', 1)
            values[key] = value.strip().strip('"')
    values.update(PORT='8080', AMQP_HOSTNAME='broker', AMQP_PORT='5672',
                  AMQP_USERNAME='smoke', AMQP_PASSWORD='smoke', CART_BOOTSTRAP_ON_START='false')
    if kind != 'media':
        db = network + '-db'
        start(db, '--network-alias', 'database', '-e', f'POSTGRES_USER={kind}_srv', '-e', 'POSTGRES_PASSWORD=smoke',
              '-e', f'POSTGRES_DB={kind}_srv', 'postgres:16.16-bookworm@sha256:ce3efec6bc404f6b15ebf5d9bed6b45a9d4655aea238d7dacc3467ccb05a1175')
        wait(db, 'pg_isready', '-U', kind + '_srv')
        values.update(DATABASE_HOST='database', DATABASE_PORT='5432', DATABASE_USERNAME=kind+'_srv',
                      DATABASE_PASSWORD='smoke', DATABASE_DATABASE_NAME=kind+'_srv')
    else:
        # Verify fail-closed readiness without giving CI credentials to the dev object store.
        # Successful reads/writes against real MinIO are covered by the dev deployment acceptance.
        values.update(MINIO_ENDPOINT='127.0.0.1', MINIO_PORT='1', MINIO_ACCESS_KEY='smoke', MINIO_SECRET_KEY='isolated-smoke-key')
    with tempfile.TemporaryDirectory() as directory:
        env = pathlib.Path(directory) / '.env'
        env.write_text(''.join(f'{key}={value}\n' for key, value in values.items()))
        env.chmod(0o644)
        mount = ['--mount', f'type=bind,src={env},dst=/app/.env,readonly']
        if kind != 'media':
            migration = ['node', '--env-file=.env', 'node_modules/typeorm/cli.js', '-d', 'dist/database/data-source.js', 'migration:run']
            for _ in range(2):
                docker('run', '--rm', '--network', network, *mount, image, *migration)
        app = network + '-app'
        start(app, '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--tmpfs', '/tmp',
              '-p', '127.0.0.1::8080', *mount, image)
        host_port = json.loads(docker('inspect', app))[0]['NetworkSettings']['Ports']['8080/tcp'][0]['HostPort']
        for _ in range(90):
            try:
                with urllib.request.urlopen(f'http://127.0.0.1:{host_port}/health', timeout=2) as response:
                    if kind == 'media':
                        raise RuntimeError('Media must not report ready without object storage')
                    assert json.load(response)['status'] == 'ok'
                    break
            except urllib.error.HTTPError as error:
                if kind == 'media' and error.code == 503:
                    break
            except (OSError, ValueError):
                pass
            if docker('inspect', '--format', '{{.State.Running}}', app) != 'true':
                raise RuntimeError('Service exited during startup')
            time.sleep(1)
        else:
            raise RuntimeError('Service readiness timeout')
        assert docker('exec', app, 'id', '-u') == '1000'
        if kind != 'media':
            command = 'cart.admin.getAll' if kind == 'cart' else 'file.getAll'
            queue = values['AMQP_CART_SRV_COMMAND_QUEUE' if kind == 'cart' else 'AMQP_SERVICE_QUEUE']
            rpc = r"""
const assert = require('node:assert/strict');
const {ClientProxyFactory, Transport} = require('@nestjs/microservices');
const {firstValueFrom, timeout} = require('rxjs');
const client = ClientProxyFactory.create({transport: Transport.RMQ, options: {
  urls: [{hostname: 'broker', port: 5672, username: 'smoke', password: 'smoke'}],
  queue: process.argv[1], queueOptions: {durable: true},
}});
(async () => {
  try {
    const result = await firstValueFrom(client.send({cmd: process.argv[2]}, {}).pipe(timeout(5000)));
    assert.ok(Array.isArray(result.data));
    assert.equal(result.data.length, 0);
    console.log('Empty-database RPC read passed');
  } finally {await client.close();}
})().catch(error => {console.error(error.message); process.exitCode = 1;});
"""
            print(docker('exec', app, 'node', '-e', rpc, queue, command))
        else:
            docker('exec', app, 'node', '-e', "require('sharp')({create:{width:2,height:2,channels:3,background:'white'}}).webp().toBuffer().then(b=>{if(!b.length)process.exit(1)})")
        print(f'{kind}: production image, mounted env, non-root startup and dependency readiness passed')
except Exception:
    for name in containers:
        subprocess.run(['docker', 'logs', '--tail', '25', name], check=False)
    raise
finally:
    for name in reversed(containers):
        subprocess.run(['docker', 'rm', '-f', '-v', name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    subprocess.run(['docker', 'network', 'rm', network], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
