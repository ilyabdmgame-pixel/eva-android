// Android can update its WebView separately from its OS. These primitives
// cover the stock Chromium 83 engine in the Android 11 emulator.
(function() {
  'use strict';
  function provide(owner,name,fn){
    if(!owner[name])Object.defineProperty(owner,name,{value:fn,writable:true,configurable:true});
  }
  provide(Object,'hasOwn',function(obj,key){return Object.prototype.hasOwnProperty.call(obj,key);});
  function at(index){const i=Math.trunc(Number(index)||0);return this[i<0?this.length+i:i];}
  provide(Array.prototype,'at',at);provide(String.prototype,'at',at);
  provide(Array.prototype,'findLast',function(fn,arg){for(let i=this.length-1;i>=0;i--)if(fn.call(arg,this[i],i,this))return this[i];});
  for(const owner of [Element.prototype,DocumentFragment.prototype]){
    provide(owner,'replaceChildren',function(...children){while(this.firstChild)this.removeChild(this.firstChild);this.append(...children);});
  }
  if(window.crypto&&!crypto.randomUUID)provide(crypto,'randomUUID',function(){
    const a=crypto.getRandomValues(new Uint8Array(16));a[6]=(a[6]&15)|64;a[8]=(a[8]&63)|128;
    const s=Array.from(a,n=>n.toString(16).padStart(2,'0')).join('');
    return [s.slice(0,8),s.slice(8,12),s.slice(12,16),s.slice(16,20),s.slice(20)].join('-');
  });
})();
