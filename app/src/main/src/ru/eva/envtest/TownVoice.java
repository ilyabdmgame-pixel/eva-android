package ru.eva.envtest;

import android.media.*;
import android.os.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;
import org.json.*;

final class TownVoice {
 private final TownService host;
 private final Handler main=new Handler(Looper.getMainLooper());
 private final ExecutorService worker=Executors.newSingleThreadExecutor();
 private volatile int generation;
 private MediaPlayer player;
 private volatile HttpURLConnection inFlight;
 TownVoice(TownService host){this.host=host;}
 void stop(){
  generation++;
  HttpURLConnection connection=inFlight;if(connection!=null)connection.disconnect();
  if(player!=null){player.release();player=null;}
 }
 void destroy(){stop();worker.shutdownNow();}
 void speak(JSONObject o,Messenger reply){
  stop();
  String text=o.optString("text").trim(),id=o.optString("id");
  if(text.length()==0||text.length()>65000)return;
  part(generation,o,reply,id,text,0);
 }
 private void part(int gen,JSONObject options,Messenger reply,String id,String text,int start){
  if(gen!=generation)return;
  if(start>=text.length()){signal(reply,"spoken",id);return;}
  int end=Math.min(start+550,text.length());
  if(end<text.length()){
   int stop=text.lastIndexOf(". ",end);if(stop<start+100)stop=text.lastIndexOf(' ',end);
   if(stop>start)end=stop+1;
  }
  final int next=end;
  worker.execute(()->{
   File wav=null;HttpURLConnection c=null;
   try{
    if(gen!=generation)return;
    c=host.local("/speech-silero");inFlight=c;
    c.setReadTimeout(75000);
    JSONObject body=new JSONObject().put("voice","silero-kseniya").put("text",text.substring(start,next)).put("accent",options.optBoolean("accent",true)).put("yo",options.optBoolean("yo",true));
    try(OutputStream out=c.getOutputStream()){out.write(body.toString().getBytes(StandardCharsets.UTF_8));}
    wav=File.createTempFile("town-voice-",".wav",host.getCacheDir());
    try(InputStream in=c.getInputStream();OutputStream out=new FileOutputStream(wav)){
     byte[] buf=new byte[16384];int n,total=0;while((n=in.read(buf))!=-1){if(gen!=generation||(total+=n)>16000000)throw new IOException();out.write(buf,0,n);}
    }
    final File file=wav;wav=null;
    main.post(()->{
     try{
      if(gen!=generation)return;
      MediaPlayer p=new MediaPlayer();player=p;
      p.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANT).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());
      p.setDataSource(file.getAbsolutePath());
      p.setOnPreparedListener(mp->{if(gen==generation){try{mp.setPlaybackParams(mp.getPlaybackParams().setSpeed((float)Math.max(.6,Math.min(1.8,options.optDouble("rate",1)))));}catch(RuntimeException ignored){}mp.start();}});
      p.setOnCompletionListener(mp->{if(gen==generation){mp.release();player=null;part(gen,options,reply,id,text,next);}});
      p.setOnErrorListener((mp,a,b)->{if(gen==generation){stop();signal(reply,"voiceError",id);}return true;});
      p.prepareAsync();
     }catch(Exception e){if(gen==generation){stop();signal(reply,"voiceError",id);}}finally{file.delete();}
    });
   }catch(Exception e){main.post(()->{if(gen==generation)signal(reply,"voiceError",id);});}
   finally{if(wav!=null)wav.delete();if(c!=null)c.disconnect();if(inFlight==c)inFlight=null;}
  });
 }
 private void signal(Messenger reply,String op,String id){
  try{Message m=Message.obtain();Bundle b=new Bundle();b.putString("json",new JSONObject().put("op",op).put("id",id).toString());m.setData(b);reply.send(m);}catch(Exception ignored){}
 }
}
