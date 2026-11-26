package ru.eva.envtest;

import android.app.*;
import android.content.*;
import android.os.*;
import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;

public final class TownService extends Service {
 private final ExecutorService io=Executors.newSingleThreadExecutor();
 private volatile CodexService owner;
 private boolean bound,home;
 private final TownVoice voice=new TownVoice(this);
 private final ServiceConnection connection=new ServiceConnection(){
  public void onServiceConnected(ComponentName n,IBinder b){owner=((CodexService.LocalBinder)b).get();}
  public void onServiceDisconnected(ComponentName n){owner=null;}
 };
 public void onCreate(){
  super.onCreate();File[] stale=getCacheDir().listFiles((dir,name)->name.startsWith("town-voice-")&&name.endsWith(".wav"));if(stale!=null)for(File f:stale)f.delete();
  Intent i=new Intent(this,CodexService.class);
  if(Build.VERSION.SDK_INT>=26)startForegroundService(i);else startService(i);
  bound=bindService(i,connection,BIND_AUTO_CREATE);
 }
 public IBinder onBind(Intent i){home=true;return incoming.getBinder();}
 public boolean onUnbind(Intent i){voice.stop();home=false;return false;}
 public void onDestroy(){voice.destroy();home=false;if(bound)unbindService(connection);io.shutdownNow();super.onDestroy();}
 private final Messenger incoming=new Messenger(new Handler(Looper.getMainLooper(),m->{
  final Messenger reply=m.replyTo;final String request=m.getData().getString("json","");
  if(reply==null||request.length()>160000)return true;
  try{
   JSONObject o=new JSONObject(request);String op=o.optString("op");
   if("synthesize".equals(op)){if(home)voice.speak(o,reply);return true;}
   if("stopVoice".equals(op)){voice.stop(o.optString("id"));return true;}
  }catch(JSONException ignored){return true;}
  io.execute(()->{
   JSONObject response=new JSONObject();String op="";
   try{
    JSONObject o=new JSONObject(request);op=o.getString("op");
    if(!op.matches("state|send|read"))throw new IOException();
    if(!op.equals("state"))awaitRuntime();
    response=post(o);
   }catch(Exception e){try{response.put("error","Чат ещё не на связи. Попробуй через пару секунд.");}catch(JSONException ignored){}}
   try{response.put("op",op);Message back=Message.obtain();Bundle b=new Bundle();b.putString("json",response.toString());back.setData(b);reply.send(back);}catch(Exception ignored){}
  });return true;
 }));
 private void awaitRuntime() throws InterruptedException{
  long deadline=SystemClock.elapsedRealtime()+12000;
  while(SystemClock.elapsedRealtime()<deadline){
   CodexService service=owner;
   if(service!=null&&!service.url.isEmpty())return;
   Thread.sleep(120);
  }
 }
 HttpURLConnection local(String path)throws Exception{
  CodexService service=owner;if(service==null)throw new IOException();
  URL u=new URL(service.url);
  if(!"http".equals(u.getProtocol())||!"127.0.0.1".equals(u.getHost())||u.getRef()==null)throw new IOException();
  HttpURLConnection c=(HttpURLConnection)new URL("http","127.0.0.1",u.getPort(),path).openConnection(Proxy.NO_PROXY);
  c.setInstanceFollowRedirects(false);c.setConnectTimeout(1800);c.setReadTimeout(20000);c.setRequestMethod("POST");c.setDoOutput(true);
  c.setRequestProperty("X-Codex-Token",u.getRef());c.setRequestProperty("Content-Type","application/json");return c;
 }
 private JSONObject post(JSONObject request)throws Exception{
  HttpURLConnection c=local("/town");
  try{
   try(OutputStream out=c.getOutputStream()){out.write(request.toString().getBytes(StandardCharsets.UTF_8));}
   try(InputStream in=c.getResponseCode()<400?c.getInputStream():c.getErrorStream();ByteArrayOutputStream bytes=new ByteArrayOutputStream()){
    byte[] buf=new byte[4096];int n;while((n=in.read(buf))!=-1){if(bytes.size()+n>400000)throw new IOException();bytes.write(buf,0,n);}
    return new JSONObject(bytes.toString("UTF-8"));
   }
  }finally{c.disconnect();}
 }
}
