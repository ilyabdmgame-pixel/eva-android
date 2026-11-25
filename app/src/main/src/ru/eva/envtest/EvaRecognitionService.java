package ru.eva.envtest;
import android.speech.*;
import android.content.*;
import android.content.pm.*;
import android.os.*;
public final class EvaRecognitionService extends RecognitionService {
 private SpeechRecognizer delegate;
 protected void onStartListening(Intent intent,Callback callback){
  if(delegate!=null){delegate.destroy();delegate=null;}
  ComponentName target=null;
  for(ResolveInfo r:getPackageManager().queryIntentServices(new Intent(RecognitionService.SERVICE_INTERFACE),0)){
   if(!r.serviceInfo.packageName.equals(getPackageName())){target=new ComponentName(r.serviceInfo.packageName,r.serviceInfo.name);if(r.serviceInfo.packageName.equals("com.google.android.googlequicksearchbox"))break;}
  }
  if(target==null){try{callback.error(SpeechRecognizer.ERROR_CLIENT);}catch(RemoteException ignored){}return;}
  delegate=SpeechRecognizer.createSpeechRecognizer(this,target);
  delegate.setRecognitionListener(new RecognitionListener(){
   public void onReadyForSpeech(Bundle b){try{callback.readyForSpeech(b);}catch(RemoteException e){}}
   public void onBeginningOfSpeech(){try{callback.beginningOfSpeech();}catch(RemoteException e){}}
   public void onRmsChanged(float v){try{callback.rmsChanged(v);}catch(RemoteException e){}}
   public void onBufferReceived(byte[] b){try{callback.bufferReceived(b);}catch(RemoteException e){}}
   public void onEndOfSpeech(){try{callback.endOfSpeech();}catch(RemoteException e){}}
   public void onError(int e){try{callback.error(e);}catch(RemoteException x){}}
   public void onResults(Bundle b){try{callback.results(b);}catch(RemoteException e){}}
   public void onPartialResults(Bundle b){try{callback.partialResults(b);}catch(RemoteException e){}}
   public void onEvent(int t,Bundle b){}
  });delegate.startListening(intent);
 }
 protected void onStopListening(Callback c){if(delegate!=null)delegate.stopListening();}
 protected void onCancel(Callback c){if(delegate!=null){delegate.cancel();delegate.destroy();delegate=null;}}
 public void onDestroy(){if(delegate!=null)delegate.destroy();super.onDestroy();}
}
