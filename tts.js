'use strict';

speechSynthesis.onvoiceschanged = () => TTS.prototype.ready = true;
window.addEventListener('beforeunload', () => speechSynthesis.cancel());

var TTS = function({lang, pitch, rate, voice}) {
  this.id = null;
  this.queue = [];
  this.elements = {},
  this.options = {
    get lang() {
      return lang || localStorage.getItem('tts-lang');
    },
    get pitch() { // 0 to 2
      return Number(pitch || localStorage.getItem('tts-pitch') || 1);
    },
    get rate() { // 0.1 to 10
      return Number(rate || localStorage.getItem('tts-rate') || 1);
    },
    get voice() {
      return voice || localStorage.getItem('tts-voice');
    },
    get delay() {
      return '\n!\n';
      // return /Firefox/.test(navigator.userAgent) ? '\n!\n' : `[[slnc ${localStorage.getItem('tts-delay') || 300}]]`;
    }
  };
};
{
  const callbacks = {};
  TTS.prototype.on = function(name, callback) {
    callbacks[name] = callbacks[name] || [];
    callbacks[name].push(callback);
    return this;
  };
  TTS.prototype.emit = function(name, ...data) {
    (callbacks[name] || []).forEach(c => c.apply(this, data));
    return this;
  };
}

TTS.prototype.build = function(parent) {
  this.parent = parent;
  parent.classList.add('tts');

  const label = document.createElement('label');
  const select = document.createElement('select');
  select.addEventListener('change', () => {
    const parts = select.value.split('/');
    [label.dataset.value, label.title] = parts;
    localStorage.setItem('tts-lang', parts[0]);
    localStorage.setItem('tts-voice', parts[2]);
  });
  label.appendChild(select);
  label.dataset.value = 'N/A';
  if (this.options.lang) {
    select.value = label.dataset.value = this.options.lang;
  }
  parent.appendChild(label);
  this.on('ready', () => {
    const voices = speechSynthesis.getVoices().filter(o => o.localService);
    const langs = {};
    voices.forEach(o => {
      langs[o.lang] = langs[o.lang] || [];
      langs[o.lang].push(o);
    });
    Object.entries(langs).forEach(([lang, os]) => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = lang;
      os.forEach(o => {
        const option = document.createElement('option');
        option.textContent = o.name;
        option.value = lang + '/' + o.name + '/' + o.voiceURI;
        optgroup.appendChild(option);
      });
      select.appendChild(optgroup);
    });
  });

  const play = document.createElement('input');
  play.dataset.cmd = 'play';
  play.type = 'button';
  play.disabled = true;
  parent.appendChild(play);
  const stop = play.cloneNode();
  stop.dataset.cmd = 'stop';
  parent.appendChild(stop);
  const previous = play.cloneNode();
  previous.dataset.cmd = 'previous';
  parent.appendChild(previous);
  const next = play.cloneNode();
  next.dataset.cmd = 'next';
  parent.appendChild(next);
  next.onclick = previous.onclick = stop.onclick = play.onclick = e => {
    this.emit(e.target.dataset.cmd + '-clicked', this, e);
  };
  Object.assign(this.elements, {play, stop, previous, next});

  return this;
};
TTS.prototype.init = function() {
  this.on('pause', () => this.elements.play.dataset.cmd = 'play');
  this.on('end', () => this.elements.play.dataset.cmd = 'play');
  this.on('start', () => this.elements.play.dataset.cmd = 'pause');
  this.on('resume', () => this.elements.play.dataset.cmd = 'pause');
  // active element
  {
    let active = null;
    const clean = () => {
      if (active) {
        active.classList.remove('tts-speaking');
      }
    };
    this.on('speaking', index => {
      clean();
      active = this.queue[index];
      this.queue[index].classList.add('tts-speaking');
    });
    this.on('end', clean);
    this.on('stop-clicked', clean);
  }
  this.on('speaking', index => {
    this.index = index;
    this.elements.previous.disabled = index === 0;
    this.elements.next.disabled = index === this.queue.length - 1;
  });
  this.on('play-clicked', () => {
    this.speak(this.index);
  });
  this.on('pause-clicked', () => {
    speechSynthesis.pause();
  });
  this.on('stop-clicked', () => {
    speechSynthesis.cancel();

    this.index = 0;
  });
  this.on('previous-clicked', () => {
    this.index = Math.max(0, this.index - 1);
    this.speak(this.index);
  });
  this.on('next-clicked', () => {
    this.index = Math.min(this.queue.length - 1, this.index + 1);
    this.speak(this.index);
  });
  // ready
  if (!this.ready) {
    const run = () => {
      speechSynthesis.removeEventListener('voiceschanged', run);
      this.emit('ready');
    };
    speechSynthesis.addEventListener('voiceschanged', run);
  }
  else {
    this.emit('ready');
  }

  return this;
};
TTS.prototype.speak = function(offset = 0) {
  let index = 0;
  const indices = [];
  const content = this.queue.slice(offset).map(e => {
    index += e.textContent.length + this.options.delay.length;
    indices.push(index);
    return e.textContent;
  }).join(this.options.delay);

  const instance = new SpeechSynthesisUtterance(content);

  instance.onstart = () => this.emit('start');
  instance.onresume = () => this.emit('resume');
  instance.onpause = () => this.emit('pause');
  instance.onend = () => {
    if (speechSynthesis.speaking === false) {
      this.emit('end');
    }
  };
  instance.onboundary = e => {
    if (e.charIndex === 0) {
      this.emit('speaking', offset);
    }
    const index = indices.indexOf(e.charIndex);
    if (index !== -1) {
      this.emit('speaking', offset + index + 1);
    }
  };
  const speaking = speechSynthesis.speaking;
  if (speaking) {
    speechSynthesis.cancel();
    if (/Firefox/.test(navigator.userAgent)) {
      speechSynthesis.pause();
      speechSynthesis.resume();
    }
  }
  // configure
  if (this.options.voice) {
    const voice = speechSynthesis.getVoices().filter(o => o.voiceURI === this.options.voice).shift();
    if (voice) {
      instance.voice = voice;
    }
  }
  if (this.options.lang) {
    instance.lang = this.options.lang;
  }
  instance.pitch = this.options.pitch;
  instance.rate = this.options.rate;
  if (speaking || speechSynthesis.id) {
    window.clearTimeout(speechSynthesis.id);
    speechSynthesis.id = window.setTimeout(() => {
      speechSynthesis.speak(instance);
      delete speechSynthesis.id;
    }, 500);
  }
  else {
    speechSynthesis.speak(instance);
  }
};
TTS.prototype.prepare = function(elements) {
  let nodes = [];
  const texts = node => {
    for (node = node.firstChild; node; node = node.nextSibling) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.nodeValue.trim()) {
          nodes.unshift(node);
        }
      }
      else {
        texts(node);
      }
    }
  };

  [...elements].forEach(page => texts(page));

  while(nodes.length) {
    const node = nodes.shift();
    const e = node.parentElement;
    this.queue.unshift(e);
    nodes = nodes.filter(n => e.contains(n) === false);
  }
  this.elements.play.disabled = false;
  this.elements.stop.disabled = false;
  this.elements.next.disabled = this.queue.length < 2;

  return this;
};
TTS.prototype.destroy = function() {
  speechSynthesis.pause();
  speechSynthesis.cancel();
  this.queue = [];
  if (this.parent) {
    this.parent.textContent = '';
  }
  this.emit('destroyed');
};
