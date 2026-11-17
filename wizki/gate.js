const form = document.querySelector('#unlock-form');
const gate = document.querySelector('#gate');
const status = document.querySelector('#gate-status');
const urls = new Set();
const bytes = (value) => Uint8Array.from(atob(value), c => c.charCodeAt(0));
let manifestPromise;
const fetchBytes = async (path, signal) => {
  const response = await fetch(path, {signal});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
};
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (form.querySelector('button').disabled) return;
  const button = form.querySelector('button');
  const field = form.querySelector('input');
  button.disabled = true;
  gate.classList.add('loading');
  status.classList.remove('error');
  status.textContent = 'Otwieranie podglądu…';
  let opened = false;
  try {
    if (!crypto.subtle) throw new Error('SECURE_CONTEXT');
    manifestPromise ??= fetch('manifest.json').then(r => {
      if (!r.ok) throw new Error('NETWORK');
      return r.json();
    }).catch(e => {manifestPromise = undefined; throw e;});
    const manifest = await manifestPromise;
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(field.value), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({name:'PBKDF2',salt:bytes(manifest.salt),iterations:manifest.iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);
    const decrypt = async (file, signal) => {
      const data = await fetchBytes(file, signal);
      return crypto.subtle.decrypt({name:'AES-GCM',iv:data.slice(0,12),additionalData:new TextEncoder().encode(file)},key,data.slice(12));
    };
    let payload;
    try {
      payload = JSON.parse(new TextDecoder().decode(await decrypt(manifest.app)));
    } catch (error) {
      if (error.name === 'OperationError') throw new Error('PASSWORD');
      throw error;
    }
    field.value = '';
    const cache = new Map();
    const asset = (file, type) => {
      if (!cache.has(file)) cache.set(file, decrypt(file).then(buffer => {
        const url = URL.createObjectURL(new Blob([buffer], {type}));
        urls.add(url);
        return url;
      }).catch(error => {cache.delete(file); throw error;}));
      return cache.get(file);
    };
    const room = document.querySelector('#room');
    const style = document.createElement('style');
    style.textContent = payload.css;
    document.head.append(style);
    room.innerHTML = payload.html;
    const moduleURL = URL.createObjectURL(new Blob([payload.js], {type:'text/javascript'}));
    urls.add(moduleURL);
    const {default: start} = await import(moduleURL);
    await start({asset, data:payload.data, relock:() => location.reload()});
    room.hidden = false;
    gate.hidden = true;
    document.title = 'chivas';
    document.querySelector('#room-title').focus({preventScroll:true});
    opened = true;
  } catch (error) {
    status.classList.add('error');
    status.textContent = error.message === 'PASSWORD' ? 'Nieprawidłowe hasło. Spróbuj ponownie.' : error.message === 'SECURE_CONTEXT' ? 'Otwórz stronę przez HTTPS, aby wejść.' : 'Nie udało się otworzyć podglądu. Sprawdź połączenie i spróbuj ponownie.';
    if (error.message === 'PASSWORD') {field.value = ''; field.focus();}
    if (!opened) document.querySelector('#room').innerHTML = '';
  } finally {
    button.disabled = false;
    gate.classList.remove('loading');
  }
});
window.addEventListener('pagehide', () => {for (const url of urls) URL.revokeObjectURL(url);});
