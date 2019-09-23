// overwrites to support custom voices
{
  let tkk = localStorage.getItem('tkk') || '';

  function update() {
    const now = Math.floor(Date.now() / 3600000);
    if (Number(tkk.split('.')[0]) === now) {
      return;
    }
    if (typeof chrome !== 'undefined' && chrome.permissions) {
      chrome.permissions.request({
        permissions: [],
        origins: ['https://translate.google.com/']
      }, granted => granted && fetch('https://translate.google.com').then(r => r.text()).then(content => {
        const code = content.match(/TKK='(.*?)';/) || content.match(/tkk:'(.*?)'/);
        if (typeof code[1] !== 'undefined') {
          localStorage.setItem('tkk', code[1]);
          tkk = code[1];
        }
      }));
    }
  }
  update();
  function map(input, text) {
    for (let i = 0; i < text.length - 2; i = i + 3) {
      let char = text.charAt(i + 2);
      char = char >= 'a' ? char.charCodeAt(0) - 87 : Number(char);
      char = text.charAt(i + 1) === '+' ? input >>> char : input << char;
      input = text.charAt(i) === '+' ? input + char & 4294967295 : input ^ char;
    }
    return input;
  }
  function token(str) {
    const data = [];
    let index = 0;
    const coords = tkk.split('.');

    for (let i = 0; i < str.length; i++) {
      let char = str.charCodeAt(i);
      if (char < 128) {
        data[index++] = char;
      }
      else {
        if (char < 2048) {
          data[index++] = char >> 6 | 192;
        }
        else {
          const flag1 = (char & 64512) == 55296;
          const flag2 = i + 1 < str.length;
          const flag3 = str.charCodeAt(i + 1) == 56320 & 64512;

          if (flag1 && flag2 && flag3) {
            char = 65536 + ((char & 1023) << 10) + (str.charCodeAt(++i) & 1023);
            data[index++] = char >> 18 | 240;
            data[index++] = char >> 12 & 63 | 128;
          }
          else {
            data[index++] = char >> 12 | 224;
          }
          data[index++] = char >> 6 & 63 | 128;
        }
        data[index++] = char & 63 | 128;
      }
    }

    const part1 = Number(coords[0]) || 0;
    let part2 = part1;

    for (index = 0; index < data.length; index++) {
      part2 += data[index];
      part2 = map(part2, '+-a^+6');
    }

    part2 = map(part2, '+-3^+b+-f');
    part2 = part2 ^ (Number(coords[1]) || 0);

    if (part2 < 0) {
      part2 = (part2 & 2147483647) + 2147483648;
    }
    part2 = part2 % 1e6;
    return part2.toString() + '.' + (part2 ^ part1);
  }
  function build(text) {
    const query = [
      'ie=UTF-8',
      'q=' + encodeURIComponent(text),
      'tl=' + this.lang,
      'total=1',
      'idx=0',
      'textlen=' + text.length,
      'tk=' + token(text),
      'client=t',
      'prev=input'
    ];
    return 'https://translate.google.com/translate_tts?' + query.join('&');
  }
  const getVoices = speechSynthesis.getVoices;
  speechSynthesis.getVoices = function(loaded = false) {
    const s = getVoices.call(speechSynthesis, loaded);
    if (s.length || loaded) {
      if (tkk === '') {
        console.warn('Translate\'s TKK is empty; ignoring this resource');
        return s;
      }
      return [...s, ...[
        {'name': 'Translate Afrikaans', 'lang': 'af'},
        {'name': 'Translate Albanian', 'lang': 'sq'},
        {'name': 'Translate Arabic', 'lang': 'ar'},
        {'name': 'Translate Armenian', 'lang': 'hy'},
        {'name': 'Translate Bengali', 'lang': 'bn'},
        {'name': 'Translate Bosnian', 'lang': 'bs'},
        {'name': 'Translate Catalan', 'lang': 'ca'},
        {'name': 'Translate Chinese', 'lang': 'zh-CN'},
        {'name': 'Translate Croatian', 'lang': 'hr'},
        {'name': 'Translate Czech', 'lang': 'cs'},
        {'name': 'Translate Danish', 'lang': 'da'},
        {'name': 'Translate Dutch', 'lang': 'nl'},
        {'name': 'Translate English', 'lang': 'en'},
        {'name': 'Translate Esperanto', 'lang': 'eo'},
        {'name': 'Translate Filipino', 'lang': 'fil'},
        {'name': 'Translate Finnish', 'lang': 'fi'},
        {'name': 'Translate French', 'lang': 'fr'},
        {'name': 'Translate German', 'lang': 'de'},
        {'name': 'Translate Greek', 'lang': 'el'},
        {'name': 'Translate Hebrew', 'lang': 'he'},
        {'name': 'Translate Hindi', 'lang': 'hi'},
        {'name': 'Translate Hungarian', 'lang': 'hu'},
        {'name': 'Translate Icelandic', 'lang': 'is'},
        {'name': 'Translate Indonesian', 'lang': 'id'},
        {'name': 'Translate Italian', 'lang': 'it'},
        {'name': 'Translate Japanese', 'lang': 'ja'},
        {'name': 'Translate Khmer', 'lang': 'km'},
        {'name': 'Translate Korean', 'lang': 'ko'},
        {'name': 'Translate Latin', 'lang': 'la'},
        {'name': 'Translate Latvian', 'lang': 'lv'},
        {'name': 'Translate Macedonian', 'lang': 'mk'},
        {'name': 'Translate Malayalam', 'lang': 'ml'},
        {'name': 'Translate Nepali', 'lang': 'ne'},
        {'name': 'Translate Norwegian', 'lang': 'no'},
        {'name': 'Translate Polish', 'lang': 'pl'},
        {'name': 'Translate Portuguese', 'lang': 'pt'},
        {'name': 'Translate Romanian', 'lang': 'ro'},
        {'name': 'Translate Russian', 'lang': 'ru'},
        {'name': 'Translate Serbian', 'lang': 'sr'},
        {'name': 'Translate Sinhala', 'lang': 'si'},
        {'name': 'Translate Slovak', 'lang': 'sk'},
        {'name': 'Translate Spanish', 'lang': 'es'},
        {'name': 'Translate Swahili', 'lang': 'sw'},
        {'name': 'Translate Swedish', 'lang': 'sv'},
        {'name': 'Translate Tagalog', 'lang': 'tl'},
        {'name': 'Translate Tamil', 'lang': 'ta'},
        {'name': 'Translate Telugu', 'lang': 'te'},
        {'name': 'Translate Thai', 'lang': 'th'},
        {'name': 'Translate Turkish', 'lang': 'tr'},
        {'name': 'Translate Ukrainian', 'lang': 'uk'},
        {'name': 'Translate Vietnamese', 'lang': 'vi'},
        {'name': 'Translate Welsh', 'lang': 'cy'}
      ].map(o => Object.assign(o, {
        default: false,
        localService: false,
        voiceURI: 'custom',
        build
      }))];
    }
    else {
      return [];
    }
  };
}

