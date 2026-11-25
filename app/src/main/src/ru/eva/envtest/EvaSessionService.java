package ru.eva.envtest;
import android.os.Bundle;
import android.content.Intent;
import android.service.voice.*;
public final class EvaSessionService extends VoiceInteractionSessionService {
 public VoiceInteractionSession onNewSession(Bundle args){return new VoiceInteractionSession(this){
  @Override public void onShow(Bundle args,int flags){super.onShow(args,flags);if(android.os.Build.VERSION.SDK_INT>=26)setUiEnabled(false);Intent i=new Intent(EvaSessionService.this,MainActivity.class);i.setAction(Intent.ACTION_ASSIST);i.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);if(android.os.Build.VERSION.SDK_INT>=26)startAssistantActivity(i);else startVoiceActivity(i);hide();}
 };}
}
