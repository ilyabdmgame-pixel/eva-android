package ru.eva.envtest;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.service.voice.VoiceInteractionService;
import org.vosk.Model;
import org.vosk.Recognizer;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/** Opt-in offline wake phrase detector. Audio is not saved or sent to the network. */
public final class EvaVoiceService extends VoiceInteractionService {
 private static volatile EvaVoiceService instance;
 private static volatile boolean chatActive;
 private static volatile long resumeAfter;
 private volatile boolean alive;
 private volatile Thread worker;
 private final Handler main=new Handler(Looper.getMainLooper());
 public static boolean enabled(Context c){return c.getSharedPreferences("eva_wake",0).getBoolean("enabled",false);}
 public static void setEnabled(Context c,boolean on){c.getSharedPreferences("eva_wake",0).edit().putBoolean("enabled",on).apply();EvaVoiceService s=instance;if(s!=null&&on)s.startWorker();}
 public static void setChatActive(boolean on){if(!on&&chatActive)resumeAfter=android.os.SystemClock.elapsedRealtime()+5000;chatActive=on;}
 @Override public void onReady(){super.onReady();instance=this;alive=true;if(enabled(this))startWorker();}
 @Override public void onShutdown(){alive=false;instance=null;super.onShutdown();}
 @Override public void onDestroy(){alive=false;instance=null;super.onDestroy();}
 private synchronized void startWorker(){if(worker!=null&&worker.isAlive())return;worker=new Thread(this::runDetector,"eva-wake");worker.start();}
 private File prepareModel() throws Exception{
  File base=new File(getFilesDir(),"wake-model"),model=new File(base,"vosk-model-small-ru-0.22"),marker=new File(model,".ready");if(marker.isFile())return model;
  base.mkdirs();String root=base.getCanonicalPath()+File.separator;long count=0;
  try(InputStream in=getAssets().open("vosk-ru-small.zip");ZipInputStream zip=new ZipInputStream(in)){ZipEntry e;byte[] bytes=new byte[32768];while((e=zip.getNextEntry())!=null){File out=new File(base,e.getName());if(!out.getCanonicalPath().startsWith(root))throw new java.io.IOException("Bad model path");if(e.isDirectory()){out.mkdirs();continue;}File parent=out.getParentFile();if(parent!=null)parent.mkdirs();try(FileOutputStream f=new FileOutputStream(out)){int n;while((n=zip.read(bytes))!=-1){count+=n;if(count>200L*1024*1024)throw new java.io.IOException("Model too large");f.write(bytes,0,n);}}}}
  if(!new File(model,"am/final.mdl").isFile())throw new java.io.IOException("Model missing");marker.createNewFile();return model;
 }
 private void status(String text){getSharedPreferences("eva_wake",0).edit().putString("status",text).apply();}
 private void runDetector(){Model model=null;try{
  status("Подготовка локальной модели…");model=new Model(prepareModel().getAbsolutePath());
  while(alive&&enabled(this)){
   if(chatActive){status("Голосовой диалог открыт");Thread.sleep(500);continue;}if(android.os.SystemClock.elapsedRealtime()<resumeAfter){Thread.sleep(300);continue;}
   if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){status("Нет разрешения на микрофон");Thread.sleep(3000);continue;}
   int size=Math.max(AudioRecord.getMinBufferSize(16000,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT),8000);
   if(size<=0)throw new java.io.IOException("Микрофон недоступен");
   AudioRecord audio=new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION,16000,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT,size*2);
   try(Recognizer rec=new Recognizer(model,16000)){rec.setWords(true);rec.setEndpointerDelays(5f,0.15f,10f);
    if(audio.getState()!=AudioRecord.STATE_INITIALIZED)throw new java.io.IOException("Микрофон недоступен");audio.startRecording();if(audio.getRecordingState()!=AudioRecord.RECORDSTATE_RECORDING)throw new java.io.IOException("Запись не началась");status("Ожидаю слово «Ева» локально");short[] buf=new short[1600];boolean hit=false;
    while(alive&&enabled(this)&&!chatActive){int n=audio.read(buf,0,buf.length);if(n<=0)throw new java.io.IOException("Ошибка микрофона");boolean done=rec.acceptWaveForm(buf,n);if(done){JSONObject result=new JSONObject(rec.getResult());org.json.JSONArray words=result.optJSONArray("result");if(words!=null&&words.length()==1){JSONObject word=words.optJSONObject(0);if(word!=null&&"ева".equals(word.optString("word").toLowerCase(Locale.ROOT))){double confidence=word.optDouble("conf",0);if(confidence>=0.55)hit=true;else status("Слышала имя, но не уверена. Скажи ещё раз");}}}if(hit)break;}
    if(hit&&alive&&enabled(this)){chatActive=true;status("Открываю голосовой разговор");main.postDelayed(()->{try{if(alive&&enabled(this))showSession(new Bundle(),0);else chatActive=false;}catch(Exception e){chatActive=false;status("Не удалось открыть голосовое окно");}},150);}
   }finally{try{audio.stop();}catch(Exception ignored){}audio.release();}
  }
 }catch(Exception|LinkageError e){status("Ошибка фонового распознавания: "+e.getClass().getSimpleName());}finally{if(model!=null)model.close();if(!enabled(this))status("Выключено");worker=null;}}
}
