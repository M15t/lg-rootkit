const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, copyFileSync, existsSync, statSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const vm = require('node:vm');

const root = resolve(__dirname, '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const installer = read('getroot/wtfbro/payload/wtfbro.sh');
const setup = read('getroot/offline/setup.sh');
const pinnedHash = 'd10bf3c753551d7c72fb7a92b20fcd2317e502a220ac668ba8e76f6ea78b363c';
const quote = (value) => "'" + value.replaceAll("'", "'\\''") + "'";

test('repository landing page redirects to the local launcher', () => {
  const redirect = read('index.html').match(/url\s*=\s*([^" >]+)/i)[1];
  assert.equal(new URL(redirect, 'http://192.168.1.10:50000/').href,
    'http://192.168.1.10:50000/getroot/');
});

function shellFunctions(source) {
  return [...source.matchAll(/^\w+\(\)\s*\{[\s\S]*?^\}/gm)].map((m) => m[0]).join('\n');
}

function launcher(href, config = { offlinemode: false }, fetchConfig) {
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, {
      value: '', checked: false, disabled: false, hidden: true, textContent: '',
      addEventListener() {}, remove() {},
    });
    return elements.get(id);
  };
  element('whichbro').value = 'wtf';
  element('whichapp').value = 'auto';
  element('webosverion').value = '5';
  element('tvip').value = '192.168.1.20';
  const location = new URL(href);
  const context = vm.createContext({
    ...Object.fromEntries(['whichbro', 'whichapp', 'webosverion', 'tvip', 'ssltoggle',
      'debugtoggle', 'advtoggle', 'advtogglede'].map((id) => [id, element(id)])),
    document: { getElementById: element, querySelectorAll: () => [] },
    window: { location }, URL, URLSearchParams, EventTarget, CustomEvent, console,
    localStorage: { getItem: () => null },
    fetch: fetchConfig || (async () => ({ ok: true, headers: new Map([['Content-Type', 'application/json']]), json: async () => config })),
  });
  vm.runInContext(read('getroot/dualbro.js'), context);
  return { context, element };
}

for (const href of ['http://192.168.1.10:50000/', 'http://192.168.1.10:50000/getroot/',
  'http://192.168.1.10:50000/getroot/index.html?debug']) {
  test(`launcher uses its own payload server: ${href}`, async () => {
    const { context } = launcher(href);
    await new Promise(setImmediate);
    await vm.runInContext('whattouse()', context);
    const target = new URL(vm.runInContext('targetUrl', context));
    assert.equal(target.origin, new URL(href).origin);
    assert.equal(target.pathname, new URL('./wtfbro/', href).pathname);
    assert.ok(target.searchParams.has('local'));
    assert.equal(target.searchParams.has('debug'), href.includes('?debug'));
    assert.equal(new URL('./payload/wtfbro.sh', target).pathname, target.pathname + 'payload/wtfbro.sh');
  });
}

test('offline config cannot redirect the payload to another server', async () => {
  const { context } = launcher('http://192.168.1.10:50000/getroot/', {
    offlinemode: true, offlinemodeip: 'other.example:50000',
  });
  await new Promise(setImmediate);
  await vm.runInContext('whattouse()', context);
  assert.equal(new URL(vm.runInContext('targetUrl', context)).origin, 'http://192.168.1.10:50000');
});

test('connection stays disabled until configuration is loaded', () => {
  const { element } = launcher('http://192.168.1.10:50000/getroot/', {}, () => new Promise(() => {}));
  assert.equal(element('connectBtn').disabled, true);
});

test('configuration fetch errors leave connection disabled', async () => {
  const { element } = launcher('http://192.168.1.10:50000/', {}, async () => { throw new Error('offline'); });
  await new Promise(setImmediate);
  assert.equal(element('connectBtn').disabled, true);
  assert.equal(element('statusText').textContent, 'Configuration failed');
});

test('loopback serving cannot send a loopback payload URL to the TV', async () => {
  const { context, element } = launcher('http://127.0.0.1:50000/getroot/');
  await new Promise(setImmediate);
  await vm.runInContext('startConnect()', context);
  assert.match(element('log').textContent, /LAN|network address/i);
});

function payloadDownloads(search = '?local') {
  const html = read('getroot/wtfbro/index.html');
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
  const requests = [];
  const downloads = new Map();
  const elements = new Map();
  vm.runInNewContext(script, {
    document: { getElementById(id) {
      if (!elements.has(id)) elements.set(id, {});
      return elements.get(id);
    } },
    URL, URLSearchParams, console: { log() {} },
    window: {
      location: { search, href: 'http://192.168.1.10:50000/wtfbro/' + search },
      PalmServiceBridge: function () { this.call = (uri, body) => {
        const request = { uri, ...JSON.parse(body) };
        requests.push(request);
        if (request.targetFilename) downloads.set(request.targetFilename, this);
      }; },
    },
  });
  return { requests, downloads, elements };
}

test('WTFBro downloads local IPK and never downloads Telnet or a debug marker', () => {
  for (const search of ['?local', '?local&debug', '']) {
    const { requests } = payloadDownloads(search);
    assert.ok(requests.some((r) => r.targetFilename === 'hbc.ipk'));
    assert.ok(!requests.some((r) => ['telnetd', 'debug'].includes(r.targetFilename)));
    assert.ok(requests.every((r) => r.target.startsWith('http://192.168.1.10:50000/wtfbro/payload/')));
  }
});

test('duplicate download completions cannot launch before every file completes', () => {
  const { requests, downloads } = payloadDownloads();
  const files = [...downloads.keys()].reverse();
  const last = files.pop();
  for (const file of files) {
    downloads.get(file).onservicecallback({ returnValue: true, completed: true });
    downloads.get(file).onservicecallback({ returnValue: true, completed: true });
    assert.equal(requests.filter((r) => r.uri.endsWith('.jsserver/run')).length, 0);
  }
  downloads.get(last).onservicecallback(JSON.stringify({ returnValue: true, completed: true }));
  downloads.get(last).onservicecallback({ returnValue: true, completed: true });
  assert.equal(requests.filter((r) => r.uri.endsWith('.jsserver/run')).length, 1);
});

for (const [name, failure] of [
  ['returnValue false', { returnValue: false, errorText: 'download failed' }],
  ['aborted', { aborted: true }],
  ['interrupted', { interrupted: true }],
  ['failed state with completed flag', { state: 'failed', completed: true }],
  ['invalid payload', 'not JSON'],
]) {
  test(`download ${name} permanently blocks launch despite later callbacks`, () => {
    const { requests, downloads, elements } = payloadDownloads();
    downloads.get('wtfbro.sh').onservicecallback(failure);
    assert.equal(elements.get('state').textContent, 'failed');
    const failureText = elements.get('detail').textContent;
    for (const file of downloads.keys()) {
      downloads.get(file).onservicecallback({ returnValue: true, completed: true });
      downloads.get(file).onservicecallback({ returnValue: true, completed: true });
    }
    assert.equal(requests.filter((r) => r.uri.endsWith('.jsserver/run')).length, 0);
    assert.equal(elements.get('state').textContent, 'failed');
    assert.equal(elements.get('detail').textContent, failureText);
  });
}

for (const [name, response] of [
  ['SSAP error', { type: 'error', error: 'app not found' }],
  ['returnValue false', { type: 'response', payload: { returnValue: false, errorText: 'launch denied' } }],
  ['timeout', { timeout: true }],
]) {
  test(`launcher rejects ${name} and permits a successful retry`, async () => {
    const { context, element } = launcher('http://192.168.1.10:50000/');
    await new Promise(setImmediate);
    await vm.runInContext('whattouse()', context);
    context.launchResponse = response;
    vm.runInContext('bridge.request = async () => launchResponse', context);
    await assert.rejects(vm.runInContext('launchDangbro()', context));
    assert.equal(vm.runInContext('state.launchStarted', context), false);
    assert.notEqual(element('statusText').textContent, 'Connected, launch sent');
    context.launchResponse = { type: 'response', payload: { returnValue: true } };
    await vm.runInContext('launchDangbro()', context);
    assert.equal(element('statusText').textContent, 'Connected, launch sent');
    assert.equal(vm.runInContext('state.launchStarted', context), true);
  });
}

test('launcher resets launch state when its request throws', async () => {
  const { context } = launcher('http://192.168.1.10:50000/');
  await new Promise(setImmediate);
  vm.runInContext("bridge.request = async () => { throw new Error('connection closed'); }", context);
  await assert.rejects(vm.runInContext('launchDangbro()', context), /connection closed/);
  assert.equal(vm.runInContext('state.launchStarted', context), false);
});

test('registration handler displays a failed launch instead of green success', async () => {
  const { context, element } = launcher('http://192.168.1.10:50000/');
  await new Promise(setImmediate);
  vm.runInContext(`
    bridge.request = async (uri) => uri.endsWith('/listApps')
      ? { type: 'response', payload: { apps: [{ id: 'com.webos.app.voiceweb' }] } }
      : { type: 'error', error: 'app not found' };
    bridge.dispatchEvent(new CustomEvent('ssap-message', { detail: { type: 'registered' } }));
  `, context);
  await new Promise(setImmediate);
  assert.equal(element('statusText').textContent, 'Launch failed');
  assert.equal(element('statusDot').className, 'dot err');
  assert.match(element('log').textContent, /app not found/);
  assert.equal(vm.runInContext('state.launchStarted', context), false);
});

test('installer failure alerts do not open a shell', () => {
  const alert = shellFunctions(installer).match(/^show_final_alert\(\)\s*\{[\s\S]*?^\}/m)[0];
  const dir = mkdtempSync(join(tmpdir(), 'rootkit-alert-test-'));
  try {
  writeFileSync(join(dir, 'luna-send'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  const result = spawnSync('sh', ['-c', `
    log() { :; }
    start_telnet() { exit 77; }
    LOGFILE=/dev/null
    devmode_state=false
    telnetdrun=false
    ${alert}
    show_final_alert failure
  `], { encoding: 'utf8', env: { ...process.env, PATH: dir + ':' + process.env.PATH } });
  assert.equal(result.status, 0, result.stderr);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('HBC normal and failsafe Telnet are disabled before elevation', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rootkit-hbc-telnet-test-'));
  try {
    mkdirSync(join(dir, 'bin'));
    const binary = join(dir, 'bin/telnetd');
    const flag = join(dir, 'telnet-disabled');
    writeFileSync(binary, 'not an executable payload', { mode: 0o755 });
    const result = spawnSync('sh', ['-c', `${shellFunctions(installer)}
      log() { :; }
      HBC_SERVICE=${quote(join(dir, 'elevate-service'))}
      TELNET_DISABLED_FLAG=${quote(flag)}
      disable_hbc_telnet
    `], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(existsSync(flag));
    assert.equal(statSync(binary).mode & 0o111, 0);
    const main = installer.split('# ---------- main ----------')[1];
    assert.ok(main.indexOf('disable_hbc_telnet') > main.indexOf('ensure_hbc_installed'));
    assert.ok(main.indexOf('disable_hbc_telnet') < main.indexOf('run_elevation'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('missing HBC Telnet binary fails closed', () => {
  const result = spawnSync('sh', ['-c', `${shellFunctions(installer)}
    log() { :; }
    HBC_SERVICE=/nonexistent-rootkit-test/elevate-service
    TELNET_DISABLED_FLAG=/nonexistent-rootkit-test/telnet-disabled
    disable_hbc_telnet
  `], { encoding: 'utf8' });
  assert.equal(result.status, 1, result.stderr);
});

test('installer and setup pin the same release and SHA-256', () => {
  for (const source of [installer, setup]) {
    assert.match(source, /releases\/download\/v0\.7\.3\/org\.webosbrew\.hbchannel_0\.7\.3_all\.ipk/);
    assert.ok(source.includes(pinnedHash));
    assert.doesNotMatch(source, /TELNETD_URL|start_telnet\s*\(|-p 2323/);
  }
});

for (const valid of [true, false]) {
  test(`installer ${valid ? 'accepts valid' : 'rejects altered'} local IPK without network fallback`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'rootkit-hash-test-'));
    try {
      const fixture = Buffer.from('test package');
      writeFileSync(join(dir, 'hbc.ipk'), valid ? fixture : 'altered package');
      const script = join(dir, 'check.sh');
      writeFileSync(script, `${shellFunctions(installer)}
        log() { :; }
        send_toast() { :; }
        curl() { exit 77; }
        IPK_SHA256=${createHash('sha256').update(fixture).digest('hex')}
        IPK_TMP=${quote(join(dir, 'fallback.ipk'))}
        prepare_hbc_ipk
      `);
      const result = spawnSync('sh', [script], { encoding: 'utf8' });
      assert.equal(result.status, valid ? 0 : 1, result.stderr);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}

test('offline setup rejects a tampered cached IPK before serving or downloading', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rootkit-setup-test-'));
  try {
    mkdirSync(join(dir, 'offline'));
    mkdirSync(join(dir, 'wtfbro/payload'), { recursive: true });
    mkdirSync(join(dir, 'bin'));
    copyFileSync(join(root, 'getroot/offline/setup.sh'), join(dir, 'offline/setup.sh'));
    writeFileSync(join(dir, 'wtfbro/payload/hbc.ipk'), 'tampered');
    writeFileSync(join(dir, 'wtfbro/payload/telnetd'), 'unused');
    for (const command of ['curl', 'python3']) {
      writeFileSync(join(dir, 'bin', command), '#!/bin/sh\nexit 77\n', { mode: 0o755 });
    }
    const result = spawnSync('sh', [join(dir, 'offline/setup.sh')], {
      input: 'n\n192.168.1.10\n', encoding: 'utf8',
      env: { ...process.env, PATH: join(dir, 'bin') + ':' + process.env.PATH }, timeout: 3000,
    });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout + result.stderr, /SHA-256|checksum|hash/i);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

for (const mode of ['valid', 'tampered', 'http-error']) {
  test(`offline setup handles ${mode} downloads and cleans partial files`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'rootkit-download-test-'));
    try {
      const fixture = Buffer.from('test release package');
      const fixtureHash = createHash('sha256').update(fixture).digest('hex');
      mkdirSync(join(dir, 'offline'));
      mkdirSync(join(dir, 'wtfbro/payload'), { recursive: true });
      mkdirSync(join(dir, 'bin'));
      writeFileSync(join(dir, 'fixture.ipk'), mode === 'tampered' ? 'altered' : fixture);
      writeFileSync(join(dir, 'offline/setup.sh'), setup.replace(pinnedHash, fixtureHash));
      writeFileSync(join(dir, 'bin/curl'), `#!/bin/sh
        while [ "$1" != "-o" ]; do shift; done
        cp ${quote(join(dir, 'fixture.ipk'))} "$2"
        exit ${mode === 'http-error' ? 22 : 0}
      `, { mode: 0o755 });
      writeFileSync(join(dir, 'bin/python3'), `#!/bin/sh
        touch ${quote(join(dir, 'served'))}
      `, { mode: 0o755 });
      const result = spawnSync('sh', [join(dir, 'offline/setup.sh')], {
        input: 'y\n192.168.1.10\n', encoding: 'utf8',
        env: { ...process.env, PATH: join(dir, 'bin') + ':' + process.env.PATH }, timeout: 3000,
      });
      assert.equal(result.status, mode === 'valid' ? 0 : 1, result.stderr);
      assert.equal(existsSync(join(dir, 'wtfbro/payload/hbc.ipk')), mode === 'valid');
      assert.equal(existsSync(join(dir, 'served')), mode === 'valid');
      assert.ok(!existsSync(join(dir, 'wtfbro/payload/hbc.ipk.part')));
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}

test('installer stops when no SHA-256 tool is available', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rootkit-no-hasher-test-'));
  try {
    writeFileSync(join(dir, 'hbc.ipk'), 'test package');
    const script = join(dir, 'check.sh');
    writeFileSync(script, `${shellFunctions(installer)}
      log() { :; }
      command() { return 1; }
      prepare_hbc_ipk
      status=$?
      printf '%s' "$error_reason"
      exit "$status"
    `);
    const result = spawnSync('sh', [script], { encoding: 'utf8' });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /SHA-256 verification is unavailable/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
