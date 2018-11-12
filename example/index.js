/* globals TTS */
'use strict';

var tts = new TTS({});
tts
  .build(document.getElementById('tts'))
  .on('speaking', index => console.log('line', index + 1))
  .on('start', () => console.log('start'))
  .on('resume', () => console.log('resume'))
  .on('pause', () => console.log('pause'))
  .on('ready', () => console.log('ready'))
  .on('end', () => console.log('end'))
  .on('destroyed', () => console.log('destroyed'))
  .prepare(document.querySelectorAll('p'))
  .init();
