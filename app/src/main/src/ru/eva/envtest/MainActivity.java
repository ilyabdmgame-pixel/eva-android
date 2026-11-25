package ru.eva.envtest;
import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.BroadcastReceiver;
import android.content.IntentFilter;
import android.content.Context;
import android.provider.Settings;
import android.os.Handler;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.*;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import java.util.Locale;
import org.json.JSONObject;
import java.util.ArrayList;
import android.widget.*;
import android.graphics.Color;
import android.graphics.Rect;
import ru.eva.life.Home;
import java.util.regex.Pattern;
import android.util.Base64;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.ServerSocket;
import java.net.Socket;
import java.io.OutputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.security.KeyFactory;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;

public final class MainActivity extends Activity implements CodexService.Listener {
  private static final PetAppPolicy.ChatVisibility visibleChats=new PetAppPolicy.ChatVisibility();
  private WebView web;
  private boolean assistantVoice=false, petChat=false, resumed=false, pendingPetPermission=false;
  private boolean petComposerDetails;
  private Rect petAnchor;
  private final Rect petVisibleFrame=new Rect();
  private int petEditorBottom;
  private CheckBox petFeature;
  private String petUi;
  private ValueCallback<Uri[]> fileCallback;
  private PermissionRequest pendingMic;
  private SpeechRecognizer recognizer;
  private TextToSpeech nativeTts;
  private boolean nativeTtsReady=false;
  private boolean nativeStartPending=false;
  private boolean wakeStartPending=false;
  private boolean editorActive=false;
  private String recognitionLanguage="ru-RU";
  private static final int FILES=102, MIC=103, TERMUX_PERMISSION=104;
  private CodexService service; private boolean bound, assistantPending, pageReady; private String loadedUrl="";
  private final android.content.ServiceConnection connection=new android.content.ServiceConnection(){
    public void onServiceConnected(android.content.ComponentName n,android.os.IBinder b){service=((CodexService.LocalBinder)b).get();service.attach(MainActivity.this);syncPet();}
    public void onServiceDisconnected(android.content.ComponentName n){service=null;showWelcome("Связь со средой потеряна");}
  };
  public void changed(){if(service==null)return;if(!service.url.isEmpty()){if(!service.url.equals(loadedUrl)){loadedUrl=service.url;showWeb(loadedUrl);}}else showWelcome(service.status);}
  @Override public void onCreate(Bundle b){super.onCreate(b);updateLaunchMode(getIntent());if(isAssist(getIntent()))EvaVoiceService.setChatActive(true);enableFullscreen();getWindow().getDecorView().getViewTreeObserver().addOnGlobalLayoutListener(this::updatePetEditorBounds);getWindow().setStatusBarColor(Color.rgb(21,25,35));setupNativeTts();assistantPending=isAssist(getIntent());startBackend();}
  private boolean isAssist(Intent i){return Intent.ACTION_ASSIST.equals(i.getAction())||Intent.ACTION_VOICE_COMMAND.equals(i.getAction());}
  private boolean petComposer(){return petChat&&petAnchor!=null;}
  static PetAppPolicy.Presentation petPresentation(){return visibleChats.presentation();}
  private void syncPet(){
    visibleChats.changeMode(this,petComposer());
    CodexService.refreshPet();
  }
  private void updateLaunchMode(Intent i){
    boolean assistant=isAssist(i);
    petChat=PetOverlay.OPEN_CHAT.equals(i.getAction());
    petAnchor=petChat?i.getParcelableExtra(PetOverlay.COMPOSER_ANCHOR):null;
    petComposerDetails=false;
    petEditorBottom=0;
    assistantVoice=assistant;
    assistantPending=assistant;
  }
  private boolean usesSmallComposer(){return petComposer()||assistantVoice;}
  private void updatePetEditorBounds(){
    if(!usesSmallComposer()||!editorActive)return;
    getWindow().getDecorView().getWindowVisibleDisplayFrame(petVisibleFrame);
    int bottom=petVisibleFrame.bottom;
    if(Build.VERSION.SDK_INT>=30){
      android.view.WindowMetrics metrics=getWindowManager().getCurrentWindowMetrics();
      int keyboard=metrics.getWindowInsets().getInsets(android.view.WindowInsets.Type.ime()).bottom;
      if(keyboard>0)bottom=Math.min(bottom,metrics.getBounds().bottom-keyboard);
    }
    if(bottom>0&&bottom!=petEditorBottom){
      petEditorBottom=bottom;
      enableFullscreen();
    }
  }
  private void placePetComposer(android.view.WindowManager.LayoutParams lp,android.util.DisplayMetrics dm){
    int gap=Math.round(8*dm.density);
    Rect area=new Rect(0,0,dm.widthPixels,dm.heightPixels);
    if(Build.VERSION.SDK_INT>=30){
      android.view.WindowMetrics metrics=getWindowManager().getMaximumWindowMetrics();
      area.set(metrics.getBounds());
      android.graphics.Insets insets=metrics.getWindowInsets().getInsetsIgnoringVisibility(
          android.view.WindowInsets.Type.systemBars()|android.view.WindowInsets.Type.displayCutout());
      area.set(area.left+insets.left,area.top+insets.top,area.right-insets.right,area.bottom-insets.bottom);
    }
    boolean keyboardBounds=editorActive&&petEditorBottom>area.top&&petEditorBottom<area.bottom;
    if(keyboardBounds)area.bottom=petEditorBottom;
    lp.width=Math.max(1,Math.min(area.width()-2*gap,Math.round(338*dm.density)));
    int heightLimit=editorActive&&!keyboardBounds?Math.round(area.height()*.4f):area.height()-2*gap;
    lp.height=Math.max(1,Math.min(heightLimit,Math.round((petComposerDetails?232:112)*dm.density)));
    lp.gravity=android.view.Gravity.TOP|android.view.Gravity.LEFT;
    int center=petAnchor==null?area.centerX():petAnchor.centerX();
    int left=center-lp.width/2-area.left;
    lp.x=area.left+Math.max(gap,Math.min(area.width()-lp.width-gap,left));
    int ideal=area.height()-lp.height-gap;
    if(petAnchor!=null){
      int below=petAnchor.bottom-area.top+gap,above=petAnchor.top-area.top-lp.height-gap;
      ideal=below+lp.height<=area.height()-gap?below:above;
    }
    if(editorActive&&!keyboardBounds)ideal=gap;
    lp.y=area.top+Math.max(gap,Math.min(area.height()-lp.height-gap,ideal));
  }
  private void enableFullscreen(){
    if(petChat||assistantVoice){
      android.util.DisplayMetrics dm=getResources().getDisplayMetrics();
      android.view.WindowManager.LayoutParams lp=getWindow().getAttributes();
      if(usesSmallComposer()){
        getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL);
        getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_DIM_BEHIND);
        placePetComposer(lp,dm);
      }else{
        getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL);
        lp.gravity=android.view.Gravity.BOTTOM|android.view.Gravity.CENTER_HORIZONTAL;
        lp.width=Math.max(1,Math.min(dm.widthPixels-Math.round(20*dm.density),Math.round(440*dm.density)));
        lp.height=Math.max(1,Math.min((int)(dm.heightPixels*(editorActive?.82f:.56f)),
            Math.round((editorActive?720:490)*dm.density)));
        lp.x=0;lp.y=Math.round(10*dm.density);
      }
      getWindow().setAttributes(lp);
      getWindow().getDecorView().setSystemUiVisibility(0);
      getWindow().setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
      return;
    }
    getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL);
    getWindow().setLayout(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT);
    getWindow().getDecorView().setSystemUiVisibility(android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        |android.view.View.SYSTEM_UI_FLAG_FULLSCREEN|android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
        |android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE|android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        |android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
  }
  @Override public void onWindowFocusChanged(boolean hasFocus){super.onWindowFocusChanged(hasFocus);if(hasFocus&&!editorActive)enableFullscreen();}
  @Override public void onConfigurationChanged(android.content.res.Configuration configuration){
    super.onConfigurationChanged(configuration);
    enableFullscreen();
  }
  @Override protected void onNewIntent(Intent i){
    super.onNewIntent(i);
    if(resumed&&petComposer()&&PetOverlay.OPEN_CHAT.equals(i.getAction())&&i.hasExtra(PetOverlay.COMPOSER_ANCHOR)){
      closePetChat();return;
    }
    if(assistantVoice&&!isAssist(i)&&web!=null)web.evaluateJavascript("window.evaStopAssistant?.()",null);
    setIntent(i);updateLaunchMode(i);
    if(usesSmallComposer()){
      editorActive=false;
      if(web!=null)web.evaluateJavascript("if(document.activeElement?.matches('input,textarea'))document.activeElement.blur()",null);
    }
    EvaVoiceService.setChatActive(isAssist(i));enableFullscreen();
    syncPet();if(service!=null)changed();startAssistantIfReady();
  }
  private void startAssistantIfReady(){
    if(!pageReady||web==null)return;
    boolean themed=petChat||assistantVoice;
    web.evaluateJavascript("document.documentElement.classList.toggle('eva-pet-root',"+themed+
        ");document.body.classList.toggle('eva-pet-chat',"+themed+
        ");document.body.classList.toggle('eva-voice-session',"+assistantVoice+
        ");document.body.classList.toggle('eva-pet-compose',"+usesSmallComposer()+
        ");document.body.classList.toggle('eva-pet-compose-details',"+(usesSmallComposer()&&petComposerDetails)+
        ");window.evaPetComposer?.("+usesSmallComposer()+", "+themed+");window.evaPetWorkCards?.("+petChat+")",null);
    if(assistantPending){assistantPending=false;web.evaluateJavascript("window.evaStartAssistant?.()",null);}
  }
  private void startBackend(){if(bound){if(service!=null)changed();return;}showWelcome("Запускаю Еву…");Intent i=new Intent(this,CodexService.class);startService(i);bound=bindService(i,connection,BIND_AUTO_CREATE);}
  private void showWelcome(String explanation){LinearLayout layout=new LinearLayout(this);layout.setOrientation(1);layout.setGravity(android.view.Gravity.CENTER);layout.setPadding(40,80,40,40);layout.setBackgroundColor(Color.rgb(20,25,35));TextView title=new TextView(this);title.setText("Ева");title.setTextSize(28);title.setTextColor(Color.rgb(151,222,199));title.setGravity(android.view.Gravity.CENTER);layout.addView(title);TextView info=new TextView(this);info.setText(explanation);info.setTextSize(16);info.setTextColor(Color.LTGRAY);info.setGravity(android.view.Gravity.CENTER);LinearLayout.LayoutParams textParams=new LinearLayout.LayoutParams(-2,-2);textParams.setMargins(0,20,0,28);layout.addView(info,textParams);if(explanation.contains("Запуска")||explanation.contains("Подготавли")||explanation.contains("Перенош")){android.widget.ProgressBar progress=new android.widget.ProgressBar(this);layout.addView(progress,new LinearLayout.LayoutParams(56,56));}setContentView(layout);layout.setAlpha(0f);layout.animate().alpha(1f).setDuration(450).start();}
  private void showWeb(String url){pageReady=false;if(web!=null){web.destroy();web=null;}web=new WebView(this);web.setBackgroundColor(Color.TRANSPARENT);web.getSettings().setJavaScriptEnabled(true);web.getSettings().setMediaPlaybackRequiresUserGesture(false);web.getSettings().setDomStorageEnabled(true);WebView.setWebContentsDebuggingEnabled((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE)!=0);web.getSettings().setAllowFileAccess(false);web.getSettings().setAllowContentAccess(true);web.addJavascriptInterface(new NativeVoiceBridge(),"NativeVoice");web.addJavascriptInterface(new EvaBridge(),"EvaApp");web.addJavascriptInterface(new NativePhoneBridge(),"NativePhone");web.setWebViewClient(new WebViewClient(){@Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest request){
    Uri target=request.getUrl();
    if(sameLocalOrigin(url,target.toString())){
      String asset=null;
      String path=target.getPath();
      if("/eva-composer.css".equals(path)||"/art/theme-icons.png".equals(path)){
        String shared="/eva-composer.css".equals(path)?"home/composer.css":"home/art/theme-icons.png";
        try{return new WebResourceResponse(shared.endsWith(".css")?"text/css":"image/png",
            shared.endsWith(".css")?"UTF-8":null,getAssets().open(shared));}
        catch(java.io.IOException error){android.util.Log.w("EvaPet","Missing shared composer asset",error);}
      }
      if("/eva-pet-ui.css".equals(path))asset="ui.css";
      else if("/eva-pet-game/ball.png".equals(path))asset="play_ball.png";
      else if("/eva-pet-game/camera.png".equals(path))asset="play_camera.png";
      else if("/eva-pet-game/plane.png".equals(path))asset="play_plane.png";
      if(asset!=null){
        boolean css=asset.endsWith(".css");
        try{return new WebResourceResponse(css?"text/css":"image/png",css?"UTF-8":null,getAssets().open("eva-pet/"+asset));}
        catch(java.io.IOException error){android.util.Log.w("EvaPet","Missing mini-chat asset "+asset,error);}
      }
    }
    return super.shouldInterceptRequest(v,request);
  }@Override public void onPageFinished(WebView v,String loaded){super.onPageFinished(v,loaded);if(v!=web||!sameLocalOrigin(url,loaded))return;pageReady=true;installPetUi();startAssistantIfReady();}@Override public boolean shouldOverrideUrlLoading(WebView v,String target){Uri u=Uri.parse(target);if(("http".equals(u.getScheme())||"https".equals(u.getScheme()))&&!("127.0.0.1".equals(u.getHost())&&u.getPort()==Uri.parse(url).getPort())){try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception ignored){}return true;}return !"http".equals(u.getScheme())||!"127.0.0.1".equals(u.getHost())||u.getPort()!=Uri.parse(url).getPort();}@Override public void onReceivedError(WebView v,WebResourceRequest request,WebResourceError error){if(request.isForMainFrame())startBackend();}});
  web.setWebChromeClient(new WebChromeClient(){@Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> cb,FileChooserParams params){if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=cb;try{Intent choose=new Intent(Intent.ACTION_OPEN_DOCUMENT);choose.addCategory(Intent.CATEGORY_OPENABLE);choose.setType("*/*");choose.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true);startActivityForResult(choose,FILES);return true;}catch(Exception e){fileCallback=null;return false;}}@Override public void onPermissionRequest(PermissionRequest req){runOnUiThread(()->{Uri origin=req.getOrigin();if(!"http".equals(origin.getScheme())||!"127.0.0.1".equals(origin.getHost())||origin.getPort()!=Uri.parse(url).getPort()){req.deny();return;}if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED){req.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});}else{pendingMic=req;requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},MIC);}});}});setContentView(web);web.loadUrl(url);}
  @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){super.onRequestPermissionsResult(request,permissions,results);if(request==105){if(phoneId==null)return;if(results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED)performPhone();else{String id=phoneId;phoneId=null;phoneReply(id,null,"Android не предоставил разрешение");}return;}if(request==MIC){boolean allowed=results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED;if(wakeStartPending){wakeStartPending=false;if(allowed)EvaVoiceService.setEnabled(this,true);else getSharedPreferences("eva_wake",0).edit().putString("status","Нет разрешения на микрофон").apply();}if(pendingMic!=null){if(allowed)pendingMic.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});else pendingMic.deny();pendingMic=null;}if(nativeStartPending){nativeStartPending=false;if(allowed)startNativeRecognition();else sendRecognitionFinish("not-allowed");}}}
  @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==106){String id=photoId;photoId=null;if(id==null)return;if(result!=RESULT_OK||data==null||data.getExtras()==null){phoneReply(id,null,"Снимок отменён или не получен");return;}Object image=data.getExtras().get("data");if(!(image instanceof android.graphics.Bitmap)){phoneReply(id,null,"Приложение камеры не вернуло снимок");return;}try{ByteArrayOutputStream bytes=new ByteArrayOutputStream();((android.graphics.Bitmap)image).compress(android.graphics.Bitmap.CompressFormat.JPEG,90,bytes);phoneReply(id,Base64.encodeToString(bytes.toByteArray(),Base64.NO_WRAP),null);}catch(Exception e){phoneReply(id,null,"Не удалось сохранить снимок");}return;}if(request!=FILES||fileCallback==null)return;Uri[] values=null;if(result==RESULT_OK&&data!=null){if(data.getClipData()!=null){int n=data.getClipData().getItemCount();values=new Uri[n];for(int j=0;j<n;j++)values[j]=data.getClipData().getItemAt(j).getUri();}else if(data.getData()!=null)values=new Uri[]{data.getData()};}fileCallback.onReceiveValue(values);fileCallback=null;}
  private void runJs(String js){if(web!=null)web.post(()->{if(web!=null)web.evaluateJavascript(js,null);});}
  private void sendRecognitionResult(Bundle results,boolean finalResult){if(results==null)return;ArrayList<String> lines=results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);if(lines!=null&&!lines.isEmpty())runJs("window.__nativeRecognitionResult&&window.__nativeRecognitionResult("+JSONObject.quote(lines.get(0))+","+(finalResult?"true":"false")+")");}
  private void sendRecognitionFinish(String error){runJs("window.__nativeRecognitionFinish&&window.__nativeRecognitionFinish("+(error==null?"null":JSONObject.quote(error))+")");}
  private void setupNativeTts(){nativeTts=new TextToSpeech(this,status->{nativeTtsReady=status==TextToSpeech.SUCCESS;if(nativeTtsReady){nativeTts.setLanguage(new Locale("ru","RU"));nativeTts.setOnUtteranceProgressListener(new UtteranceProgressListener(){public void onStart(String id){runJs("window.__nativeSpeechStart&&window.__nativeSpeechStart("+JSONObject.quote(id)+")");}public void onDone(String id){runJs("window.__nativeSpeechFinish&&window.__nativeSpeechFinish("+JSONObject.quote(id)+",null)");}public void onError(String id){runJs("window.__nativeSpeechFinish&&window.__nativeSpeechFinish("+JSONObject.quote(id)+",'synthesis-failed')");}});}});}
  private void startNativeRecognition(){if(!SpeechRecognizer.isRecognitionAvailable(this)){sendRecognitionFinish("service-not-allowed");return;}if(recognizer!=null){recognizer.destroy();recognizer=null;}recognizer=SpeechRecognizer.createSpeechRecognizer(this);recognizer.setRecognitionListener(new RecognitionListener(){
    public void onReadyForSpeech(Bundle x){} public void onBeginningOfSpeech(){} public void onRmsChanged(float x){} public void onBufferReceived(byte[] x){} public void onEndOfSpeech(){} public void onEvent(int x,Bundle y){}
    public void onPartialResults(Bundle x){sendRecognitionResult(x,false);} public void onResults(Bundle x){sendRecognitionResult(x,true);sendRecognitionFinish(null);if(recognizer!=null){recognizer.destroy();recognizer=null;}}
    public void onError(int error){String reason=error==SpeechRecognizer.ERROR_NO_MATCH||error==SpeechRecognizer.ERROR_SPEECH_TIMEOUT?"no-speech":error==SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS?"not-allowed":error==SpeechRecognizer.ERROR_CLIENT?"aborted":"network";sendRecognitionFinish(reason);if(recognizer!=null){recognizer.destroy();recognizer=null;}}
  });Intent intent=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE,recognitionLanguage);intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS,true);recognizer.startListening(intent);}
  private String phoneId,phoneAction,phoneArgs,photoId;
  private static String lastScreenshotRequest;
  private void phoneReply(String id, Object value, String error){try{JSONObject result=new JSONObject();if(error!=null)result.put("error",error);else result.put("result",value);runJs("window.__phoneResult&&window.__phoneResult("+JSONObject.quote(id)+","+JSONObject.quote(result.toString())+")");}catch(Exception ignored){}}
  public final class NativePhoneBridge {
    @JavascriptInterface public void accessibilitySettings(){runOnUiThread(()->startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)));}
    @JavascriptInterface public void run(String id,String action,String args){runOnUiThread(()->{if(phoneId!=null){phoneReply(id,null,"Другое действие с телефоном ещё выполняется");return;}phoneId=id;phoneAction=action;phoneArgs=args;String permission="contacts".equals(action)?Manifest.permission.READ_CONTACTS:"call".equals(action)?Manifest.permission.CALL_PHONE:("torch".equals(action)||"photo".equals(action))?Manifest.permission.CAMERA:null;if(permission!=null&&checkSelfPermission(permission)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{permission},105);return;}performPhone();});}
  }
  private void performPhone(){String id=phoneId,action=phoneAction,args=phoneArgs;phoneId=null;try{org.json.JSONArray a=new org.json.JSONArray(args);Object result;
    if("photo".equals(action)){String side=a.length()>0?a.getString(0):"back";if(!side.equals("back")&&!side.equals("front"))throw new Exception("Укажите back или front");if(photoId!=null)throw new Exception("Камера уже открыта");Intent camera=new Intent("android.media.action.IMAGE_CAPTURE");camera.putExtra("android.intent.extras.CAMERA_FACING",side.equals("front")?1:0);camera.putExtra("android.intent.extra.USE_FRONT_CAMERA",side.equals("front"));photoId=id;try{startActivityForResult(camera,106);}catch(Exception e){photoId=null;throw e;}return;}
    else if("battery".equals(action)){Intent b=registerReceiver(null,new IntentFilter(Intent.ACTION_BATTERY_CHANGED));if(b==null)throw new Exception("Нет данных батареи");int level=b.getIntExtra("level",-1),scale=b.getIntExtra("scale",-1);JSONObject v=new JSONObject();v.put("percentage",scale>0?Math.round(level*100.0/scale):-1);v.put("charging",b.getIntExtra("plugged",0)!=0);result=v;}
    else if("clipboard".equals(action)){android.content.ClipboardManager cb=(android.content.ClipboardManager)getSystemService(CLIPBOARD_SERVICE);android.content.ClipData data=cb.getPrimaryClip();result=data!=null&&data.getItemCount()>0?String.valueOf(data.getItemAt(0).coerceToText(MainActivity.this)):"";}
    else if("cameras".equals(action)){android.hardware.camera2.CameraManager mgr=(android.hardware.camera2.CameraManager)getSystemService(CAMERA_SERVICE);org.json.JSONArray cameras=new org.json.JSONArray();for(String camera:mgr.getCameraIdList()){android.hardware.camera2.CameraCharacteristics chars=mgr.getCameraCharacteristics(camera);Integer face=chars.get(android.hardware.camera2.CameraCharacteristics.LENS_FACING);JSONObject item=new JSONObject();item.put("id",camera);item.put("facing",face!=null&&face==android.hardware.camera2.CameraCharacteristics.LENS_FACING_FRONT?"front":"back");cameras.put(item);}result=cameras;}
    else if("open-app".equals(action)){String pkg=a.getString(0);if(!pkg.matches("[a-zA-Z][a-zA-Z0-9_]*(\\.[a-zA-Z][a-zA-Z0-9_]*)+"))throw new Exception("Укажите точное имя пакета приложения");Intent launch=getPackageManager().getLaunchIntentForPackage(pkg);if(launch==null)throw new Exception("Приложение не найдено или его нельзя открыть");startActivity(launch);result="Запрос на открытие приложения передан Android.";}
    else if("accessibility-settings".equals(action)){startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));result="Открыты настройки специальных возможностей. Включите Еву вручную.";}
    else if("accessibility-status".equals(action)){result=EvaAccessibility.status(this);}
    else if("screenshot".equals(action)){
      if(a.length()!=0)throw new IllegalArgumentException("Снимок экрана не принимает параметры");
      if(id.equals(lastScreenshotRequest))return;
      lastScreenshotRequest=id;
      EvaAccessibility.screenshot(this,(image,error)->runOnUiThread(()->phoneReply(id,image,error)));
      return;
    }
    else if("screen".equals(action)){result=EvaAccessibility.screen(this);}
    else if("click".equals(action)){result=EvaAccessibility.click(this,a.getString(0));}
    else if("open-url".equals(action)){Uri link=Uri.parse(a.getString(0));if(!"http".equals(link.getScheme())&&!"https".equals(link.getScheme()))throw new Exception("Поддерживаются только ссылки http и https");startActivity(new Intent(Intent.ACTION_VIEW,link));result="Запрос на открытие ссылки передан Android.";}
    else if("contacts".equals(action)){String query=a.length()>0?a.getString(0).trim():"";if(query.isEmpty())throw new Exception("Укажите имя");org.json.JSONArray found=new org.json.JSONArray();android.database.Cursor c=getContentResolver().query(android.provider.ContactsContract.CommonDataKinds.Phone.CONTENT_URI,new String[]{android.provider.ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,android.provider.ContactsContract.CommonDataKinds.Phone.NUMBER},null,null,null);if(c==null)throw new Exception("Не удалось прочитать контакты");try{while(c.moveToNext()){String name=c.getString(0),number=c.getString(1);if(name!=null&&name.toLowerCase(new Locale("ru")).contains(query.toLowerCase(new Locale("ru")))){JSONObject item=new JSONObject();item.put("name",name);item.put("number",number);found.put(item);}}}finally{c.close();}result=found;}
    else if("call".equals(action)){String number=a.getString(0);if(!number.matches("\\+?[0-9][0-9 ()-]{2,30}"))throw new Exception("Неверный номер");startActivity(new Intent(Intent.ACTION_CALL,Uri.parse("tel:"+Uri.encode(number))));result="Запрос на звонок передан Android.";}
    else if("vibrate".equals(action)){long duration=a.getLong(0);if(duration<1||duration>2000)throw new Exception("Длительность вибрации должна быть от 1 до 2000 мс");android.os.Vibrator vibrator=(android.os.Vibrator)getSystemService(VIBRATOR_SERVICE);if(vibrator==null||!vibrator.hasVibrator())throw new Exception("Вибрация недоступна");vibrator.vibrate(duration);result="Команда вибрации передана Android.";}
    else if("torch".equals(action)){String state=a.getString(0);if(!state.equals("on")&&!state.equals("off"))throw new Exception("Укажите on или off");android.hardware.camera2.CameraManager mgr=(android.hardware.camera2.CameraManager)getSystemService(CAMERA_SERVICE);String found=null;for(String camera:mgr.getCameraIdList()){android.hardware.camera2.CameraCharacteristics chars=mgr.getCameraCharacteristics(camera);Boolean flash=chars.get(android.hardware.camera2.CameraCharacteristics.FLASH_INFO_AVAILABLE);Integer facing=chars.get(android.hardware.camera2.CameraCharacteristics.LENS_FACING);if(Boolean.TRUE.equals(flash)&&facing!=null&&facing==android.hardware.camera2.CameraCharacteristics.LENS_FACING_BACK){found=camera;break;}}if(found==null)throw new Exception("Фонарик не найден");mgr.setTorchMode(found,state.equals("on"));result="Команда фонарику передана Android.";}
    else if("volume".equals(action)){android.media.AudioManager mgr=(android.media.AudioManager)getSystemService(AUDIO_SERVICE);String[] names={"alarm","music","notification","ring","system","call"};int[] streams={android.media.AudioManager.STREAM_ALARM,android.media.AudioManager.STREAM_MUSIC,android.media.AudioManager.STREAM_NOTIFICATION,android.media.AudioManager.STREAM_RING,android.media.AudioManager.STREAM_SYSTEM,android.media.AudioManager.STREAM_VOICE_CALL};if(a.length()==0){JSONObject volumes=new JSONObject();for(int i=0;i<names.length;i++){JSONObject v=new JSONObject();v.put("volume",mgr.getStreamVolume(streams[i]));v.put("max_volume",mgr.getStreamMaxVolume(streams[i]));volumes.put(names[i],v);}result=volumes;}else{if(a.length()!=2)throw new Exception("Укажите канал и уровень");String name=a.getString(0);int stream=-1;for(int i=0;i<names.length;i++)if(names[i].equals(name))stream=streams[i];int level=Integer.parseInt(a.getString(1));if(stream<0||level<0||level>mgr.getStreamMaxVolume(stream))throw new Exception("Неверный канал или уровень");mgr.setStreamVolume(stream,level,0);result="Громкость изменена.";}}
    else throw new Exception("Действие не поддерживается");phoneReply(id,result,null);
  }catch(Exception e){phoneReply(id,null,e.getMessage()==null?"Ошибка Android":e.getMessage());}}
  private static boolean sameLocalOrigin(String base,String target){
    Uri origin=Uri.parse(base),page=Uri.parse(target);
    return "http".equals(page.getScheme())&&"127.0.0.1".equals(page.getHost())&&page.getPort()==origin.getPort();
  }
  private void installPetUi(){
    if(petUi==null)try(InputStream input=getAssets().open("eva-pet/ui.js")){
      ByteArrayOutputStream output=new ByteArrayOutputStream();
      byte[] buffer=new byte[4096];
      for(int count;(count=input.read(buffer))!=-1;)output.write(buffer,0,count);
      petUi=output.toString("UTF-8");
    }catch(java.io.IOException error){
      android.util.Log.w("EvaPet","Could not load chat controls",error);
      return;
    }
    web.evaluateJavascript(petUi,null);
  }
  private void showPetSettings(){
    int padding=Math.round(20*getResources().getDisplayMetrics().density);
    LinearLayout options=new LinearLayout(this);
    options.setOrientation(LinearLayout.VERTICAL);options.setPadding(padding,padding/2,padding,0);
    CheckBox desktop=new CheckBox(this);desktop.setText("Тема рабочего стола");
    desktop.setChecked(Home.enabled(this));options.addView(desktop);
    CheckBox pet=new CheckBox(this);pet.setText("Питомец поверх приложений");
    pet.setChecked(PetOverlay.enabled(this)&&Settings.canDrawOverlays(this));options.addView(pet);
    petFeature=pet;
    Button defaultHome=new Button(this);defaultHome.setText("Выбрать главный экран Android");
    defaultHome.setEnabled(desktop.isChecked());options.addView(defaultHome);
    defaultHome.setOnClickListener(v->{
      try{startActivity(new Intent(Settings.ACTION_HOME_SETTINGS));}
      catch(android.content.ActivityNotFoundException error){Toast.makeText(this,"Настройки главного экрана недоступны",Toast.LENGTH_SHORT).show();}
    });
    desktop.setOnClickListener(v->{
      boolean enabled=desktop.isChecked();Home.setEnabled(this,enabled);defaultHome.setEnabled(enabled);
      if(web!=null)web.evaluateJavascript("document.getElementById('home-open').hidden="+!enabled,null);
    });
    pet.setOnClickListener(v->{
      if(!pet.isChecked()||Settings.canDrawOverlays(this)){
        PetOverlay.setEnabled(this,pet.isChecked());syncPet();return;
      }
      pet.setChecked(false);pendingPetPermission=true;
      try{startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,Uri.parse("package:"+getPackageName())));}
      catch(android.content.ActivityNotFoundException error){
        pendingPetPermission=false;
        Toast.makeText(this,"Настройки показа поверх приложений недоступны",Toast.LENGTH_LONG).show();
      }
    });
    android.app.AlertDialog dialog=new android.app.AlertDialog.Builder(this).setTitle("Рабочий стол и питомец")
        .setView(options).setNeutralButton("Опоры питомца",(d,w)->showPetAnchors())
        .setPositiveButton("Готово",null).create();
    dialog.setOnDismissListener(d->petFeature=null);
    dialog.show();
  }
  private void showPetAnchors(){
    boolean enabled=PetOverlay.anchorsEnabled(this);
    new android.app.AlertDialog.Builder(this).setTitle("Опоры для аватара")
      .setMessage("Ева запоминает границы элементов рабочего стола HONOR. На Android 14 и новее сверяет их со снимком лаунчера в памяти и сохраняет карту прямоугольников. В приложениях опорой могут служить верх клавиатуры, край диалога и выдвижная нижняя панель. Ева получает их координаты, пока они видны.")
      .setNegativeButton("Закрыть",null)
      .setNeutralButton("В приложениях",(dialog,which)->showAppProfiles())
      .setPositiveButton(enabled&&EvaAccessibility.enabled()?"Выключить опоры":"Включить опоры",(dialog,which)->{
        if(enabled&&EvaAccessibility.enabled()){PetOverlay.setAnchorsEnabled(this,false);return;}
        PetOverlay.setAnchorsEnabled(this,true);
        if(!EvaAccessibility.enabled())try{startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));}
        catch(android.content.ActivityNotFoundException error){Toast.makeText(this,"Настройки специальных возможностей недоступны",Toast.LENGTH_SHORT).show();}
      }).show();
  }
  private void showAppProfiles(){
    java.util.List<String> apps=new java.util.ArrayList<>(PetAppProfiles.apps(this));
    if(apps.isEmpty()){
      new android.app.AlertDialog.Builder(this).setTitle("Ева в приложениях")
        .setMessage("Включи опоры и открой нужное приложение. Коснись Евы и выбери шестерёнку в мини-чате.")
        .setPositiveButton("Опоры",(d,w)->showPetAnchors()).setNegativeButton("Закрыть",null).show();
      return;
    }
    if(apps.size()==1||petChat&&!PetAppProfiles.recent().isEmpty()){
      chooseAppProfile(apps.get(0));return;
    }
    String[] labels=new String[apps.size()];
    for(int i=0;i<labels.length;i++)labels[i]=PetAppProfiles.label(this,apps.get(i));
    new android.app.AlertDialog.Builder(this).setTitle("Ева в приложениях")
      .setItems(labels,(d,i)->chooseAppProfile(apps.get(i))).setNegativeButton("Закрыть",null).show();
  }
  private void chooseAppProfile(String app){
    new android.app.AlertDialog.Builder(this).setTitle(PetAppProfiles.label(this,app))
      .setSingleChoiceItems(PetAppProfiles.LABELS,PetAppProfiles.get(this,app),(d,i)->{
        PetAppProfiles.set(this,app,i);d.dismiss();
        if(petChat)closePetChat();
      }).setNegativeButton("Отмена",null).show();
  }

  private void closePetChat(){
    if(!petChat&&!assistantVoice)return;
    if(recognizer!=null){recognizer.cancel();recognizer.destroy();recognizer=null;sendRecognitionFinish("aborted");}
    if(nativeTts!=null)nativeTts.stop();
    if(web!=null)web.evaluateJavascript("if(typeof stopVoice==='function')stopVoice();if(typeof conversation==='boolean'&&conversation)document.getElementById('conversation')?.click()",null);
    finish();
  }
  public final class EvaBridge {
    @JavascriptInterface public void openHome(){
      runOnUiThread(()->{if(Home.enabled(MainActivity.this))Home.openDefaultHome(MainActivity.this);});
    }
    @JavascriptInterface public boolean homeEnabled(){return Home.enabled(MainActivity.this);}
    @JavascriptInterface public void openPetResult(String path){runOnUiThread(()->{
      if(!resumed||!petChat)return;
      try{PetResultFile.view(MainActivity.this,path);}
      catch(Exception e){Toast.makeText(MainActivity.this,"Не удалось открыть файл результата",Toast.LENGTH_SHORT).show();}
    });}
    @JavascriptInterface public void petAppProfile(){runOnUiThread(()->{if(resumed)showAppProfiles();});}
    @JavascriptInterface public void petMap(){runOnUiThread(()->{
      if(!petChat||!resumed||service==null)return;
      service.openPetMap();
      closePetChat();
    });}
    @JavascriptInterface public void petSettings(){runOnUiThread(()->{if(resumed&&!petChat)showPetSettings();});}
    @JavascriptInterface public void closePetChat(){runOnUiThread(MainActivity.this::closePetChat);}
    @JavascriptInterface public void petComposerDetails(){runOnUiThread(()->{
      if(!usesSmallComposer()||!resumed||petComposerDetails)return;
      petComposerDetails=true;enableFullscreen();startAssistantIfReady();
    });}
    @JavascriptInterface public void expandPetChat(){runOnUiThread(()->{
      if(!petChat&&!assistantVoice)return;
      if(assistantVoice){
        if(web!=null)web.evaluateJavascript("window.evaStopAssistant?.()",null);
        EvaVoiceService.setChatActive(false);
      }
      setIntent(new Intent(MainActivity.this,MainActivity.class));
      updateLaunchMode(getIntent());
      enableFullscreen();
      syncPet();
      startAssistantIfReady();
    });}

    @JavascriptInterface public void voiceSettings(){runOnUiThread(()->{try{startActivity(new Intent("com.android.settings.TTS_SETTINGS"));}catch(Exception e){Toast.makeText(MainActivity.this,"Настройки голоса Android недоступны",Toast.LENGTH_LONG).show();}});}
    @JavascriptInterface public void filePermission(){runOnUiThread(()->{if(checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{Manifest.permission.READ_EXTERNAL_STORAGE,Manifest.permission.WRITE_EXTERNAL_STORAGE},107);});}
    @JavascriptInterface public boolean hasFilePermission(){return checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)==PackageManager.PERMISSION_GRANTED;}
  }
  public final class NativeVoiceBridge {
    @JavascriptInterface public void setEditing(boolean editing){runOnUiThread(()->{
      editorActive=editing;
      if(usesSmallComposer()){if(!editing)petEditorBottom=0;enableFullscreen();return;}
      if(petChat)enableFullscreen();
      if(editing){
        getWindow().getDecorView().setSystemUiVisibility(android.view.View.SYSTEM_UI_FLAG_VISIBLE);
        getWindow().setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
      }else enableFullscreen();
    });}
    @JavascriptInterface public void setVoiceChatActive(boolean active){EvaVoiceService.setChatActive(active);}
    @JavascriptInterface public boolean wakeEnabled(){return EvaVoiceService.enabled(MainActivity.this);}
    @JavascriptInterface public String wakeStatus(){return getSharedPreferences("eva_wake",0).getString("status","Выключено");}
    @JavascriptInterface public void setWakeEnabled(boolean enabled){runOnUiThread(()->{if(enabled&&checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){wakeStartPending=true;requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},MIC);}else EvaVoiceService.setEnabled(MainActivity.this,enabled);});}
    @JavascriptInterface public void startRecognition(String lang){runOnUiThread(()->{recognitionLanguage="ru-RU";if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED)startNativeRecognition();else{nativeStartPending=true;requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},MIC);}});}
    @JavascriptInterface public void speak(String text,float pitch,float rate,String id){runOnUiThread(()->{if(!nativeTtsReady||nativeTts==null){runJs("window.__nativeSpeechFinish&&window.__nativeSpeechFinish("+JSONObject.quote(id)+",'synthesis-unavailable')");return;}nativeTts.setPitch(Math.max(0.5f,Math.min(2f,pitch)));nativeTts.setSpeechRate(Math.max(0.5f,Math.min(2f,rate)));if(nativeTts.speak(text,TextToSpeech.QUEUE_FLUSH,null,id)==TextToSpeech.ERROR)runJs("window.__nativeSpeechFinish&&window.__nativeSpeechFinish("+JSONObject.quote(id)+",'synthesis-failed')");});}
    @JavascriptInterface public void stopSpeech(){runOnUiThread(()->{if(nativeTts!=null)nativeTts.stop();});}
    @JavascriptInterface public void stopRecognition(){runOnUiThread(()->{if(recognizer!=null)recognizer.stopListening();});}
  }
  @Override protected void onStart(){
    super.onStart();
    visibleChats.show(this,petComposer());
    CodexService.refreshPet();
  }
  @Override protected void onResume(){
    super.onResume();
    resumed=true;
    if(pendingPetPermission){
      pendingPetPermission=false;
      if(Settings.canDrawOverlays(this))PetOverlay.setEnabled(this,true);
    }
    if(petFeature!=null)petFeature.setChecked(PetOverlay.enabled(this)&&Settings.canDrawOverlays(this));
    syncPet();
    if(isAssist(getIntent()))EvaVoiceService.setChatActive(true);
  }
  @Override protected void onStop(){
    resumed=false;
    visibleChats.hide(this);
    CodexService.refreshPet();
    super.onStop();
  }
  @Override protected void onDestroy(){if(assistantVoice||petChat)EvaVoiceService.setChatActive(false);if(service!=null)service.detach(this);if(bound)unbindService(connection);if(nativeTts!=null){nativeTts.shutdown();nativeTts=null;}if(recognizer!=null){recognizer.destroy();recognizer=null;}if(web!=null){web.destroy();web=null;}super.onDestroy();}
  @Override public void onBackPressed(){
    if(petChat&&pageReady&&web!=null){
      WebView current=web;
      current.evaluateJavascript("window.evaPetGameBack?.() === true",handled->{
        if(current==web&&petChat&&!"true".equals(handled))closePetChat();
      });
    }else if(petChat||assistantVoice)closePetChat();
    else if(web!=null&&web.canGoBack())web.goBack();
    else super.onBackPressed();
  }
}
