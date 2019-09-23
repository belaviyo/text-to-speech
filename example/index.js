/* globals TTS */
'use strict';

var tts = new TTS();
tts.feed(document.getElementById('root'));
tts.attach(document.getElementById('tts'));

//tts.on('section', n => console.log('section ends', n));
// tts.on('end', () => console.log('playing session ended'));
//tts.on('status', s => console.log('status', s));

// tts.ready().then(() => console.log('ready'));

document.getElementById('start').addEventListener('click', () => {
  tts.create();
  tts.start();
});
document.getElementById('stop').addEventListener('click', () => tts.stop());
document.getElementById('resume').addEventListener('click', () => tts.resume());
document.getElementById('pause').addEventListener('click', () => tts.pause());
document.getElementById('next').addEventListener('click', () => tts.navigate('forward'));
document.getElementById('previous').addEventListener('click', () => tts.navigate('backward'));
document.getElementById('reset').addEventListener('click', () => tts.reset());
