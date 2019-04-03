'use strict';

{
  class Emitter {
    constructor() {
      this.events = {};
    }
    on(name, callback) {
      this.events[name] = this.events[name] || [];
      this.events[name].push(callback);
    }
    emit(name, ...data) {
      (this.events[name] || []).forEach(c => {
        c(...data);
      });
    }
  }

  window.addEventListener('beforeunload', () => speechSynthesis.cancel());

  const LAZY = Symbol();
  const CALC = Symbol();
  const BIULD = Symbol();

  class SimpleTTS extends Emitter {
    constructor(options = {
      separator: '\n!\n',
      delay: 100,
      maxlength: 160
    }) {
      super();
      this.SEPARATOR = options.separator; // this is used to combine multiple sections on local voice case
      this.DELAY = options.delay; // delay between sections
      this.MAXLENGTH = options.maxlength; // max possible length for each section

      this.postponed = []; // functions that need to be called when voices are ready
      this.sections = [];
      this.local = true;
      this.dead = false;
      this.offset = 0;
      this.state = 'stop';
      // for local voices, use separator to detect when a new section is played
      this.on('instance-boundary', e => {
        if (e.charIndex && e.target.text.substr(e.charIndex - 1, 3) === this.SEPARATOR) {
          this.offset += 1;
          this.emit('section', this.offset);
        }
      });
      // for remote voices use end event to detect when a new section is played
      this.on('instance-end', () => {
        if (this.local === false) {
          if (this.sections.length > this.offset + 1 && this.dead === false) {
            this.offset += 1;
            this.instance.text = this.sections[this.offset].textContent;
            this[LAZY](() => this.speak());
          }
          else {
            this.emit('end');
          }
        }
        else {
          this.emit('end');
        }
      });
      this.on('instance-start', () => this.emit('section', this.offset));

      this.voices = speechSynthesis.getVoices();
      if (this.voices.length === 0) {
        speechSynthesis.addEventListener('voiceschanged', () => {
          this.voices = speechSynthesis.getVoices();
          this.postponed.forEach(c => c());
        });
      }
    }
    [LAZY](callback, timeout = this.DELAY) {
      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(callback, timeout);
    }
    ready() {
      return this.voices.length ? Promise.resolve() : new Promise(resolve => this.postponed.push(resolve));
    }
    create() {
      const instance = new SpeechSynthesisUtterance();
      instance.onstart = () => this.emit('instance-start');
      instance.onresume = () => this.emit('instance-resume');
      instance.onpause = () => this.emit('instance-pause');
      instance.onboundary = e => this.emit('instance-boundary', e);
      instance.onend = () => this.emit('instance-end');
      this.instance = instance;
    }
    voice(voice) {
      this.local = voice.localService;
      this.instance.voice = voice;
    }
    stop() {
      this.state = 'stop';
      window.clearTimeout(this.timer);
      // already playing
      const speaking = speechSynthesis.speaking;
      if (speaking) {
        this.dead = true;
        speechSynthesis.cancel();
        if (/Firefox/.test(navigator.userAgent)) {
          speechSynthesis.pause();
          speechSynthesis.resume();
        }
      }
    }
    start(offset = 0) {
      this.state = 'play';
      this.offset = offset;
      this.stop();
      if (this.dead) {
        console.warn('speechSynthesis was already playing. Force reset');
      }
      // initiate
      if (this.local) {
        this.instance.text = this.sections.slice(offset).map(e => e.textContent).join(this.SEPARATOR);
      }
      else {
        this.instance.text = this.sections[offset].textContent;
      }
      this.dead = false;
      this.speak();
    }
    speak() {
      this.state = 'play';
      speechSynthesis.speak(this.instance);
    }
    resume() {
      this.state = 'play';
      speechSynthesis.resume();
      // bug; remote voice does not trigger resume event
      if (this.local === false) {
        this.emit('instance-resume');
      }
    }
    pause() {
      this.state = 'pause';
      // bug; remote voice does not trigger pause event
      if (this.local === false) {
        this.emit('instance-pause');
      }
      speechSynthesis.pause();
    }
  }
  class Parser extends SimpleTTS {
    feed(...parents) {
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
      parents.forEach(page => texts(page));
      const sections = [];
      while (nodes.length) {
        const node = nodes.shift();
        const e = node.parentElement;
        sections.unshift(e);
        nodes = nodes.filter(n => e.contains(n) === false);
      }
      // split by dot
      for (const section of sections) {
        if (section.textContent.length < this.MAXLENGTH) {
          this.sections.push(section);
        }
        else {
          const parts = section.textContent.split(/\./g).filter(a => a);
          const combined = [];
          let length = 0;
          let cache = [];
          for (const part of parts) {
            if (length > this.MAXLENGTH) {
              combined.push(cache.join('. '));
              cache = [part.trim()];
              length = part.length;
            }
            else {
              cache.push(part.trim());
              length += part.length;
            }
          }
          if (cache.length !== 0) {
            combined.push(cache.join('. '));
          }
          for (const content of combined) {
            this.sections.push({
              target: section,
              textContent: content
            });
          }
        }
      }
    }
  }
  class Styling extends Parser {
    constructor() {
      super();

      const cleanup = () => {
        const e = document.querySelector('.tts-speaking');
        if (e) {
          e.classList.remove('tts-speaking');
        }
      };
      this.on('section', n => {
        cleanup();
        (this.sections[n].target || this.sections[n]).classList.add('tts-speaking');
      });
      this.on('instance-start', () => this.emit('status', 'play'));
      this.on('instance-resume', () => this.emit('status', 'play'));
      this.on('instance-pause', () => this.emit('status', 'pause'));
      this.on('end', () => this.emit('status', 'stop'));
      this.on('end', cleanup);
    }
  }
  class Navigate extends Styling {
    [CALC](direction = 'forward') {
      const offset = this.offset;
      let jump = 1;
      if (direction === 'forward' && this.sections[offset].target) {
        const target = this.sections[offset].target;
        for (const section of this.sections.slice(offset + 1)) {
          if (section.target !== target) {
            break;
          }
          else {
            jump += 1;
          }
        }
      }
      if (direction === 'backward' && this.sections[offset].target) {
        const target = this.sections[offset].target;
        for (const section of this.sections.slice(0, offset).reverse()) {
          if (section.target !== target) {
            break;
          }
          else {
            jump += 1;
          }
        }
      }
      if (direction === 'backward' && offset - jump > 0 && this.sections[offset - jump].target) {
        const target = this.sections[offset - jump].target;
        for (const section of this.sections.slice(0, offset - jump).reverse()) {
          if (section.target !== target) {
            break;
          }
          else {
            jump += 1;
          }
        }
      }
      return jump;
    }
    validate(direction = 'forward') {
      const offset = this.offset;
      const jump = this[CALC](direction);
      if (
        (direction === 'forward' && offset + jump < this.sections.length) ||
        (direction === 'backward' && offset - jump >= 0)
      ) {
        return offset + (direction === 'forward' ? jump : -1 * jump);
      }
      throw Error('out of range');
    }
    navigate(direction = 'forward', offset) {
      try {
        offset = typeof offset === 'undefined' ? this.validate(direction) : offset;
        const voice = this.instance.voice;
        this.stop();
        this.create();
        if (voice) {
          this.voice(voice);
        }
        this.offset = offset;
        this[LAZY](() => this.start(this.offset));
      }
      catch (e) {
        console.warn('navigate request ignored');
      }
    }
  }
  class Intractive extends Navigate {
    [BIULD](parent) {
      parent.classList.add('tts');

      const label = document.createElement('label');
      const select = document.createElement('select');
      select.addEventListener('change', () => {
        const parts = select.value.split('/');
        [label.dataset.value, label.title] = parts;
        localStorage.setItem('tts-selected', select.value);
        if (this.instance) {
          this.voice(select.selectedOptions[0].voice);
          if (speechSynthesis.speaking && speechSynthesis.paused === false) {
            this.navigate(undefined, this.offset);
          }
        }
      });
      label.appendChild(select);
      parent.appendChild(label);

      const stop = document.createElement('input');
      stop.type = 'button';
      stop.disabled = true;
      const previous = stop.cloneNode();
      const play = stop.cloneNode();
      const next = stop.cloneNode();
      previous.classList.add('previous');
      previous.addEventListener('click', () => this.navigate('backward'));
      parent.appendChild(previous);
      play.classList.add('play');

      play.addEventListener('click', () => {
        if (speechSynthesis.speaking === false) {
          this.create();
          this.start();
        }
        else if (this.state === 'pause') {
          this.resume();
        }
        else {
          this.pause();
        }
      });
      parent.appendChild(play);
      next.classList.add('next');
      next.addEventListener('click', () => this.navigate('forward'));
      parent.appendChild(next);
      stop.classList.add('stop');
      stop.addEventListener('click', () => this.stop());
      parent.appendChild(stop);

      this.ready().then(() => {
        play.disabled = false;

        let value;
        const langs = {};
        for (const o of this.voices) {
          langs[o.lang] = langs[o.lang] || [];
          langs[o.lang].push(o);
        }
        for (const [lang, os] of Object.entries(langs)) {
          const optgroup = document.createElement('optgroup');
          optgroup.label = lang;
          os.forEach(o => {
            const option = document.createElement('option');
            option.textContent = o.name;
            option.value = lang + '/' + o.name;
            option.voice = o;
            if (o.default) {
              value = option.value;
            }
            optgroup.appendChild(option);
          });
          select.appendChild(optgroup);
        }

        select.value = localStorage.getItem('tts-selected') || value || select.options[0].value;
        select.dispatchEvent(new Event('change'));
      });

      const calc = () => {
        try {
          this.validate('forward');
          next.disabled = false;
        }
        catch (e) {
          next.disabled = true;
        }
        try {
          this.validate('backward');
          previous.disabled = false;
        }
        catch (e) {
          previous.disabled = true;
        }
      };
      this.on('end', () => {
        stop.disabled = true;
        next.disabled = true;
        previous.disabled = true;
      });
      this.on('status', s => {
        if (s === 'stop' || s === 'pause') {
          play.classList.remove('pause');
          stop.disabled = s === 'stop' ? true : false;
          next.disabled = true;
          previous.disabled = true;
        }
        else {
          play.classList.add('pause');
          stop.disabled = false;
          calc();
        }
      });

      this.buttons = {
        select,
        previous,
        play,
        next,
        stop
      };
    }
    attach(parent) {
      this[BIULD](parent);
    }
    create() {
      super.create();
      const selected = this.buttons.select.selectedOptions[0];
      if (selected) {
        this.voice(selected.voice);
      }
    }
  }

  window.TTS = Intractive;
}
