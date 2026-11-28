package ru.eva.envtest;
import android.speech.*;
import android.content.*;
import android.content.pm.*;
import android.os.*;
public final class EvaRecognitionService extends RecognitionService {
 private SpeechRecognizer delegate;
 protected void onStartListening(Intent intent,Callback callback){
  if(delegate!=null){delegate.destroy();delegate=null;}
  PackageManager pm=getPackageManager();Intent action=new Intent(RecognitionService.SERVICE_INTERFACE);
  ServiceInfo choice=external(pm.resolveService(action,0));
  if(choice==null)for(ResolveInfo item:pm.queryIntentServices(action,0)){
   ServiceInfo entry=external(item);if(entry==null)continue;
   if(choice==null)choice=entry;
   if((entry.applicationInfo.flags&ApplicationInfo.FLAG_SYSTEM)!=0){choice=entry;break;}
  }
  if(choice==null){try{callback.error(SpeechRecognizer.ERROR_CLIENT);}catch(RemoteException ignored){}return;}
  delegate=SpeechRecognizer.createSpeechRecognizer(this,new ComponentName(choice.packageName,choice.name));
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
 private ServiceInfo external(ResolveInfo result){
  ServiceInfo s=result==null?null:result.serviceInfo;
  return s!=null&&s.exported&&!s.packageName.equals(getPackageName())&&
      "android.permission.BIND_SPEECH_RECOGNITION_SERVICE".equals(s.permission)?s:null;
 }
 protected void onStopListening(Callback c){if(delegate!=null)delegate.stopListening();}
 protected void onCancel(Callback c){if(delegate!=null){delegate.cancel();delegate.destroy();delegate=null;}}
 public void onDestroy(){if(delegate!=null)delegate.destroy();super.onDestroy();}
}
