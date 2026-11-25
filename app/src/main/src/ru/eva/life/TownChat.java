package ru.eva.life;

import android.Manifest;
import android.content.*;
import android.content.pm.*;
import android.os.*;
import android.speech.*;
import android.speech.tts.*;
import org.json.*;
import java.util.*;

final class TownChat {
 static final int MIC_PERMISSION=742;
 private final Home home;
 private final Handler handler=new Handler(Looper.getMainLooper());
 private final Messenger inbox;
 private Messenger channel;
 private boolean active,bound,askingMic;
 private long pollAt;
 private SpeechRecognizer mic;
 private TextToSpeech tts;
 private boolean ttsReady;
 private String utterance="";
 TownChat(Home activity){
  home=activity;
  inbox=new Messenger(new Handler(Looper.getMainLooper(),m->{
   try{
    JSONObject data=new JSONObject(m.getData().getString("json","{}"));
    if("state".equals(data.optString("op")))pollAt=0;
    if(active){
     home.townEvent(data);
     if(data.optBoolean("open"))home.startActivity(new Intent(home,ru.eva.envtest.MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP));
    }
   }catch(Exception e){error("open","Не удалось открыть полный чат.");}return true;
  }));
 }
 private void event(String op,String key,String value){
  try{home.townEvent(new JSONObject().put("op",op).put(key,value));}catch(JSONException ignored){}
 }
 private void error(String op,String value){event(op,"error",value);}
 private final ServiceConnection link=new ServiceConnection(){
  public void onServiceConnected(ComponentName n,IBinder b){channel=new Messenger(b);pollAt=0;request("{\"op\":\"state\"}");}
  public void onServiceDisconnected(ComponentName n){channel=null;pollAt=0;error("state","Связь с чатом прервалась.");}
 };
 void resume(){
  active=true;
  if(!bound)try{bound=home.bindService(new Intent(home,ru.eva.envtest.TownService.class),link,Context.BIND_AUTO_CREATE);}catch(RuntimeException ignored){}
 }
 void pause(){
  active=false;cancelMic();if(tts!=null)tts.stop();utterance="";
  if(bound){home.unbindService(link);bound=false;}channel=null;pollAt=0;
 }
 void destroy(){if(tts!=null)tts.shutdown();}
 void request(String raw){
  try{
   JSONObject o=new JSONObject(raw);String op=o.getString("op");
   if(!active||!op.matches("state|open|read|send|synthesize"))return;
   if(channel==null){error(op,"Чат Евы запускается. Попробуй через пару секунд.");return;}
   long now=SystemClock.elapsedRealtime();
   if(op.equals("state")){if(pollAt!=0&&now-pollAt<22000)return;pollAt=now;}
   Message m=Message.obtain();m.replyTo=inbox;Bundle b=new Bundle();b.putString("json",raw);m.setData(b);channel.send(m);
  }catch(Exception ignored){error("send","Связь прервалась. Сообщение можно повторить.");}
 }
 void microphone(){
  if(mic!=null){mic.stopListening();return;}
  if(home.checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){
   askingMic=true;home.requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},MIC_PERMISSION);return;
  }
  try{
   ComponentName provider=null;
   for(ResolveInfo match:home.getPackageManager().queryIntentServices(new Intent(RecognitionService.SERVICE_INTERFACE),0)){
    ServiceInfo s=match.serviceInfo;
    if(s!=null&&s.exported&&s.packageName.equals("com.google.android.tts"))provider=new ComponentName(s.packageName,s.name);
   }
   mic=provider==null?SpeechRecognizer.createSpeechRecognizer(home):SpeechRecognizer.createSpeechRecognizer(home,provider);
   mic.setRecognitionListener(new RecognitionListener(){
    public void onReadyForSpeech(Bundle b){event("mic","status","listening");}
    public void onResults(Bundle b){ArrayList<String> lines=b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);cancelMic();if(lines!=null&&!lines.isEmpty())event("mic","text",lines.get(0));else error("mic","Не расслышала. Попробуй ещё раз.");}
    public void onError(int code){cancelMic();error("mic",code==7||code==6?"Не расслышала. Попробуй ещё раз.":"Голосовой ввод недоступен ("+code+").");}
    public void onBeginningOfSpeech(){} public void onRmsChanged(float v){} public void onBufferReceived(byte[] b){} public void onEndOfSpeech(){} public void onPartialResults(Bundle b){} public void onEvent(int n,Bundle b){}
   });
   Intent i=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM).putExtra(RecognizerIntent.EXTRA_LANGUAGE,"ru-RU");
   mic.startListening(i);event("mic","status","listening");
  }catch(Exception e){cancelMic();error("mic","Не удалось включить микрофон.");}
 }
 void permission(boolean granted){if(!askingMic)return;askingMic=false;if(granted)handler.post(()->microphone());else error("mic","Для диктовки разреши микрофон.");}
 void cancelMic(){if(mic!=null){SpeechRecognizer current=mic;mic=null;current.cancel();current.destroy();}}
 void speak(String id,String text){
  if(!active||text.isEmpty())return;utterance=id;
  if(tts!=null){play(id,text);return;}
  tts=new TextToSpeech(home,status->{
   ttsReady=status==TextToSpeech.SUCCESS&&tts.setLanguage(new Locale("ru","RU"))>=0;
   if(utterance.equals(id)&&active)play(id,text);
  });
 }
 private void play(String id,String text){
  if(!ttsReady){event("voiceError","id",id);return;}
  tts.setOnUtteranceProgressListener(new UtteranceProgressListener(){
   public void onStart(String key){}
   public void onDone(String key){if(key.equals(id))handler.post(()->{if(utterance.equals(id))event("spoken","id",id);});}
   public void onError(String key){handler.post(()->{if(utterance.equals(id)){utterance="";tts.stop();event("voiceError","id",id);}});}
  });
  int limit=TextToSpeech.getMaxSpeechInputLength()-1;
  for(int start=0;start<text.length();){
   int end=Math.min(start+limit,text.length());
   if(end<text.length()){int word=text.lastIndexOf(' ',end);if(word>start)end=word;}
   boolean last=end==text.length();
   if(tts.speak(text.substring(start,end),start==0?TextToSpeech.QUEUE_FLUSH:TextToSpeech.QUEUE_ADD,null,last?id:id+"-"+start)==TextToSpeech.ERROR){tts.stop();event("voiceError","id",id);break;}
   start=end;
  }
 }
}
