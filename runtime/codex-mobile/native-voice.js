'use strict';
// Native Android fallback for WebViews without the Web Speech recognition API.
if(window.NativeVoice&&!window.SpeechRecognition&&!window.webkitSpeechRecognition){
  let active=null;
  window.__nativeRecognitionResult=(text,isFinal)=>{if(!active||typeof text!=='string')return;const alternative={transcript:text};const result=[alternative];result.isFinal=!!isFinal;if(active.onresult)active.onresult({resultIndex:0,results:[result]})};
  window.__nativeRecognitionFinish=error=>{const current=active;if(!current)return;active=null;if(error&&current.onerror)current.onerror({error});if(current.onend)current.onend()};
  window.SpeechRecognition=class{constructor(){this.lang='ru-RU';this.interimResults=false;this.continuous=false}start(){if(active)throw new Error('Микрофон уже используется');active=this;try{window.NativeVoice.startRecognition(this.lang)}catch(e){active=null;throw e}}stop(){if(active===this)window.NativeVoice.stopRecognition()}};
}
// Android's speech service is used directly inside the installed app.
if(window.NativeVoice){
  let activeSpeech=null,nextSpeech=0;
  window.__NativeUtterance=class{constructor(text){this.text=text;this.lang='ru-RU';this.pitch=1;this.rate=1}};
  window.__nativeSpeechStart=id=>{if(activeSpeech&&activeSpeech.id===id&&activeSpeech.utterance.onstart)activeSpeech.utterance.onstart()};
  window.__nativeSpeechFinish=(id,error)=>{if(!activeSpeech||activeSpeech.id!==id)return;const u=activeSpeech.utterance;activeSpeech=null;if(error){if(u.onerror)u.onerror({error})}else if(u.onend)u.onend()};
  window.__nativeSpeechSynth={getVoices:()=>[],addEventListener:()=>{},speak(u){const id=String(++nextSpeech);activeSpeech={id,utterance:u};window.NativeVoice.speak(u.text,Number(u.pitch)||1,Number(u.rate)||1,id)},cancel(){activeSpeech=null;window.NativeVoice.stopSpeech()}};
}
