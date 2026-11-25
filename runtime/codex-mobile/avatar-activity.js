'use strict';
// Map explicit Codex tool events to visual states; never inspect private output.
(function(root){
 function classify(item){if(!item||typeof item.type!=='string')return null;
  if(item.type==='webSearch')return 'search';
  if(item.type==='fileChange')return 'work';
  if(item.type==='commandExecution'){if(/music-control\.js/.test(String(item.command||'')))return 'music';const actions=Array.isArray(item.commandActions)?item.commandActions:[];if(actions.some(x=>x.type==='search'))return 'search';if(actions.some(x=>x.type==='read'||x.type==='listFiles'))return 'reading';return 'work'}
  if(item.type==='mcpToolCall'||item.type==='dynamicToolCall'){const name=(String(item.server||'')+' '+String(item.tool||'')).toLowerCase();const args=item.arguments;const source=typeof args==='string'?args:args&&typeof args==='object'?(args.source||args.code||args.input||''):'';if(typeof source==='string'&&/music-control\.js/.test(source))return 'music';if(/web|search|browse/.test(name)||(item.type==='dynamicToolCall'&&typeof source==='string'&&/tools\.(?:web__run|mcp__codex_apps__search_service_web_run)\s*\(/.test(source)))return 'search';if(/read_file|fetch_file|open_file/.test(name))return 'reading';return 'work'}
  if(item.type==='imageView')return 'reading';
  if(item.type==='imageGeneration'||item.type==='collabAgentToolCall'||item.type==='subAgentActivity')return 'work';
  return null;
 }
 classify.emotion=function(text){if(typeof text!=='string')return null;
  const clean=text.replace(/^ {0,3}(?:```|~~~)[^\n]*\n[\s\S]*?(?:^ {0,3}(?:```|~~~)[^\n]*$|(?![\s\S]))/gm,'')
    .replace(/^\s*>.*$/gm,'').replace(/`[^`\n]*`|«[^»]*»|"[^"\n]*"/g,'').trim();
  const opening=clean.replace(/[*_]/g,'').trimStart().slice(0,180);
  if(/^(?:давай серь[её]зно|поговорим серь[её]зно)(?:[,.!… ]|$)/i.test(opening))return 'serious';
  // Empathy should take priority over a stray smile elsewhere in the reply.
  if(/(?:😢|мне жаль, что|сочувствую тебе)/i.test(clean))return 'sad';
  if(/(?:🫂|я рядом|обнимаю тебя)|^(?:ох[,!… ]+|блин[,!… ]+)?(?:держись|тяжело такое слышать)(?:[,.!… ]|$)/i.test(clean))return 'warm-soft';
  if(/^(?:(?:ну|ой)[,!… ]+)?(?:вот же хитр(?:ый|ая)|хитр(?:ый|ая) какой|ты и зараза|ну ты и зараза|подловил(?:а)? меня|а ты хитр(?:ый|ая)|так, попался|ах ты ж)(?:[,.!… ]|$)/i.test(opening))return 'sly';
  if(/^(?:вот это уже интересно|о[,!… ]+вот это интересно|так[,!… ]+погоди(?:те)?|о[,!… ]+любопытно)(?:[,.!… ]|$)/i.test(opening))return 'curious';
  if(/^(?:не тут-то было|я бы поспорила|я бы тут поспорила|что-то тут не сходится|ну нет[,!… ]+погоди)(?:[,.!… ]|$)/i.test(opening))return 'skeptical';
  if(/^(?:ого|ничего себе|ни хрена себе|нихрена себе|вот это поворот)(?:[,.!… ]|$)/i.test(opening))return 'surprised';
  // Only strong cues; never infer emotion from isolated words such as "ошибка".
  if(/(?:😂|🤣|ахаха|хахаха|^ахах[,.! ]|^ха-ха[,.! ])/i.test(clean))return 'laugh';
  if(/(?:🤔|^хм[,.! ]|^подумаем[,.! ])/i.test(clean))return 'thinking-soft';
  if(/(?:🤨|^сомневаюсь[,.! ])/i.test(clean))return 'skeptical';
  if(/(?:😎|^я уверена[,.! ])/i.test(clean))return 'confident';
  if(/(?:🧐|^любопытно[,.! ]|^интересно[,.! ]|^о, вот это интересно[,.! ])/i.test(clean))return 'curious';
  if(/(?:😉|подмигиваю|подмигнула)/i.test(clean))return 'wink';
  if(/(?:😏|хитро улыбаюсь|ехидно улыбаюсь)/i.test(clean))return 'sly';
  if(/(?:😊|😳|смущаюсь|немного смущена)/i.test(clean))return 'shy';
  if(/(?:🥳|🤩|это потрясающе|обожаю эту идею)/i.test(clean))return 'excited';
  if(/(?:😒|😑|^меня это раздражает[,.! ]|^я раздражена[,.! ])/i.test(clean))return 'annoyed';
  if(/(?:🥱|😴|^я устала[,.! ]|^пора отдохнуть[,.! ])/i.test(clean))return 'tired';
  if(/(?:😌|^фух[,!. ]|^какое облегчение[,.! ])/i.test(clean))return 'relieved';
  if(/(?:😵‍💫|^я запуталась[,.! ]|^я растерялась[,.! ])/i.test(clean))return 'confused';
  if(/(?:😠|😤|я возмущена)/i.test(clean))return 'pout';
  if(/(?:😮|😲|вот это да[!. ,]|неожиданно[!. ,])/i.test(clean))return 'surprised';
  if(/(?:😄|😃|😁|ура[!. ,]|с праздником|поздравляю|рада, что|^отлично[!. ,]|^здорово[!. ,])/i.test(clean))return 'joy';
  return null;
 };
 root.classifyAvatarItem=classify;
 if(typeof module!=='undefined'&&module.exports)module.exports=classify;
})(globalThis);
