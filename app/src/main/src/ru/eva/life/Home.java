package ru.eva.life;

import android.app.Activity;
import android.content.*;
import android.content.pm.*;
import android.graphics.*;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.view.View;
import android.view.WindowManager;
import android.webkit.*;
import android.widget.Toast;
import ru.eva.envtest.CodexService;
import ru.eva.envtest.MainActivity;
import org.json.*;
import java.io.*;
import java.util.*;

public final class Home extends Activity {
    private static final String HOST="eva-life.invalid";
    private static Home visible;
    public static boolean visible(){return visible!=null;}
    public static void openDefaultHome(Context context){
        Intent home=new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME);
        ResolveInfo selected=context.getPackageManager().resolveActivity(home,PackageManager.MATCH_DEFAULT_ONLY);
        ComponentName own=new ComponentName(context,Home.class);
        boolean active=selected!=null&&selected.activityInfo!=null&&own.equals(
            new ComponentName(selected.activityInfo.packageName,selected.activityInfo.name));
        Intent target=active?home.setComponent(own):new Intent(Settings.ACTION_HOME_SETTINGS);
        try{context.startActivity(target.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));}
        catch(android.content.ActivityNotFoundException error){
            Toast.makeText(context,"Главный экран Android недоступен",Toast.LENGTH_SHORT).show();
        }
    }
    public static boolean enabled(Context context){
        int state=context.getPackageManager().getComponentEnabledSetting(new ComponentName(context,Home.class));
        return state==PackageManager.COMPONENT_ENABLED_STATE_DEFAULT||state==PackageManager.COMPONENT_ENABLED_STATE_ENABLED;
    }
    public static void setEnabled(Context context,boolean enabled){
        context.getPackageManager().setComponentEnabledSetting(new ComponentName(context,Home.class),
            enabled?PackageManager.COMPONENT_ENABLED_STATE_ENABLED:PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
            PackageManager.DONT_KILL_APP);
        LifeService.updateSchedule(context);
    }
    private final Map<String,ResolveInfo> entries=new HashMap<>();
    private String catalog="[]";
    private WebView web;
    private boolean homeActive;
    private int batteryLevel=-1;
    private boolean batteryCharging;
    private final BroadcastReceiver battery=new BroadcastReceiver(){
        @Override public void onReceive(Context context,Intent intent){updateBattery(intent);}
    };
    private WeatherWidget weather;
    private TownChat chat;
    void townEvent(JSONObject data){if(web!=null)web.evaluateJavascript("window.townEvent?.("+data.toString()+")",null);}
    public void onRequestPermissionsResult(int code,String[] names,int[] grants){
        super.onRequestPermissionsResult(code,names,grants);
        if(code==TownChat.MIC_PERMISSION)chat.permission(grants.length>0&&grants[0]==PackageManager.PERMISSION_GRANTED);
    }
    private final CityForecast forecast=new CityForecast();
    private final java.util.concurrent.ExecutorService worker=java.util.concurrent.Executors.newSingleThreadExecutor();
    private final android.util.LruCache<String,byte[]> icons=new android.util.LruCache<String,byte[]>(1024*1024){
        protected int sizeOf(String k,byte[] b){return b.length;}
    };
    private final java.util.concurrent.atomic.AtomicBoolean catalogRefreshing=new java.util.concurrent.atomic.AtomicBoolean();

    private void refresh(){
        if(worker.isShutdown()||!catalogRefreshing.compareAndSet(false,true))return;
        worker.execute(()->{
          try{
            PackageManager pm=getPackageManager();
            List<ResolveInfo> apps=pm.queryIntentActivities(new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER),0);
            apps.sort(new ResolveInfo.DisplayNameComparator(pm));
            Map<String,ResolveInfo> fresh=new HashMap<>();JSONArray json=new JSONArray();
            for(ResolveInfo app:apps){
                ActivityInfo a=app.activityInfo;
                if(!a.exported||a.packageName.equals(getPackageName()))continue;
                String key=new ComponentName(a.packageName,a.name).flattenToString();
                if(fresh.put(key,app)!=null)continue;
                try{json.put(new JSONObject().put("key",key).put("name",app.loadLabel(pm).toString()));}catch(JSONException ignored){}
            }
            final String next=json.toString();
            boolean changed;
            synchronized(entries){
                changed=!next.equals(catalog);
                entries.clear();entries.putAll(fresh);catalog=next;
            }
            if(changed)runOnUiThread(()->{if(web!=null)web.evaluateJavascript("window.refreshApps?.()",null);});
          }finally{catalogRefreshing.set(false);}
        });
    }
    private ResolveInfo find(String key){synchronized(entries){return entries.get(key);}}
    private WebResourceResponse serve(Uri u){
        if(!"https".equals(u.getScheme())||!HOST.equals(u.getHost()))return empty();
        try{
            String p=u.getPath();
            if("/icon".equals(p)){
                String key=u.getQueryParameter("id");ResolveInfo app=find(key);if(app==null)return empty();
                byte[] bytes=icons.get(key);
                if(bytes==null){
                    Drawable d=app.loadIcon(getPackageManager()).mutate();
                    Bitmap bmp=Bitmap.createBitmap(96,96,Bitmap.Config.ARGB_8888);
                    d.setBounds(0,0,96,96);d.draw(new Canvas(bmp));ByteArrayOutputStream out=new ByteArrayOutputStream();
                    bmp.compress(Bitmap.CompressFormat.PNG,100,out);bmp.recycle();bytes=out.toByteArray();icons.put(key,bytes);
                }
                return new WebResourceResponse("image/png",null,new ByteArrayInputStream(bytes));
            }
            if(p==null||!p.matches("/[a-z0-9_./-]+")||p.contains(".."))return empty();
            String mime=p.endsWith(".html")?"text/html":p.endsWith(".css")?"text/css":(p.endsWith(".js")||p.endsWith(".mjs"))?"text/javascript":p.endsWith(".svg")?"image/svg+xml":p.endsWith(".jpg")?"image/jpeg":"image/png";
            String asset="/question-options.js".equals(p)?"eva-questions.js":"home"+p;
            return new WebResourceResponse(mime,mime.startsWith("text/")?"utf-8":null,getAssets().open(asset));
        }catch(Exception ignored){return empty();}
    }
    private WebResourceResponse empty(){return new WebResourceResponse("text/plain","utf-8",404,"Not Found",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}
    private void launch(Intent i){runOnUiThread(()->{try{startActivity(i);}catch(RuntimeException e){Toast.makeText(this,"Приложение недоступно",Toast.LENGTH_SHORT).show();refresh();}});}
    private void updateBattery(Intent status){
        if(status==null)return;
        int level=status.getIntExtra(BatteryManager.EXTRA_LEVEL,-1);
        int scale=status.getIntExtra(BatteryManager.EXTRA_SCALE,0);
        int percent=level>=0&&scale>0?Math.round(100f*level/scale):-1;
        boolean charging=status.getIntExtra(BatteryManager.EXTRA_STATUS,0)==BatteryManager.BATTERY_STATUS_CHARGING;
        if(batteryLevel==percent&&batteryCharging==charging)return;
        batteryLevel=percent;batteryCharging=charging;showBattery();
    }
    private void showBattery(){
        if(web!=null)web.evaluateJavascript("window.setHomeBattery?.("+batteryLevel+","+batteryCharging+")",null);
    }
    public final class Bridge{
        @JavascriptInterface public void worldSnapshot(String raw){TownWorld.publish(raw);}
        @JavascriptInterface public String worldTake(){return TownWorld.take();}
        @JavascriptInterface public void worldResult(String result){TownWorld.report(result);}
        @JavascriptInterface public void town(String raw){runOnUiThread(()->chat.request(raw));}
        @JavascriptInterface public void openRoomChat(boolean indicator){
            launch(new Intent(Home.this,MainActivity.class).putExtra(MainActivity.ROOM_CHAT,indicator)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP));
        }
        @JavascriptInterface public void townMic(){runOnUiThread(()->chat.microphone());}
        @JavascriptInterface public void townSpeak(String id,String text,float rate,float pitch,float volume){
            runOnUiThread(()->chat.speak(id,text,rate,pitch,volume));
        }
        @JavascriptInterface public void stopRoomVoice(String id){runOnUiThread(()->chat.stopSpeech(id));}
        @JavascriptInterface public String routines(){return LifeState.routines(Home.this).toString();}
        @JavascriptInterface public String roomActivities(){return LifeState.activities(Home.this).toString();}
        @JavascriptInterface public void finishedActivity(String key){LifeState.finishedActivity(Home.this,key);}
        @JavascriptInterface public void connectWeather(){runOnUiThread(()->weather.connect());}
        @JavascriptInterface public String cityWeather(){return forecast.read(Home.this);}
        @JavascriptInterface public void chooseForecastLocation(){runOnUiThread(()->{
            android.widget.EditText input=new android.widget.EditText(Home.this);
            input.setHint("Широта и долгота через пробел");
            input.setSingleLine(true);
            new android.app.AlertDialog.Builder(Home.this)
                .setTitle("Погода по координатам")
                .setMessage("Ева отправляет выбранные координаты в Open-Meteo для прогноза.")
                .setView(input)
                .setPositiveButton("Сохранить",(dialog,which)->{
                    try{forecast.setLocation(Home.this,CityForecast.coordinates(input.getText().toString()));}
                    catch(IllegalArgumentException error){Toast.makeText(Home.this,"Укажи две координаты через пробел",Toast.LENGTH_LONG).show();}
                })
                .setNeutralButton("Сбросить",(dialog,which)->forecast.setLocation(Home.this,""))
                .setNegativeButton("Отмена",null).show();
        });}
        @JavascriptInterface public String weatherState(){return weather.state;}
        @JavascriptInterface public String weatherLabels(){runOnUiThread(()->weather.read());return weather.labels;}
        @JavascriptInterface public String timeline(){return LifeState.read(Home.this, System.currentTimeMillis()).toString();}
        @JavascriptInterface public void note(String action,String where){LifeState.localAction(Home.this,action,where);}
        @JavascriptInterface public void enableLife(boolean on){runOnUiThread(()->{
            LifeState.setEnabled(Home.this,on);
            LifeService.updateSchedule(Home.this);
        });}
        @JavascriptInterface public String apps(){synchronized(entries){return catalog;}}
        @JavascriptInterface public void open(String key){if(find(key)!=null)launch(new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER).setComponent(ComponentName.unflattenFromString(key)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED));}
        @JavascriptInterface public boolean bootEnabled(){return getSharedPreferences("theme",0).getBoolean("boot",true);}
        @JavascriptInterface public void setBootEnabled(boolean on){getSharedPreferences("theme",0).edit().putBoolean("boot",on).apply();}
        @JavascriptInterface public void lockWallpaper(){
            worker.execute(()->{
                android.app.WallpaperManager manager=android.app.WallpaperManager.getInstance(Home.this);
                String result;
                try(InputStream image=getAssets().open("home/art/eva-lock.jpg")){
                    if(!manager.isWallpaperSupported()||!manager.isSetWallpaperAllowed())throw new SecurityException();
                    int id=manager.setStream(image,null,false,android.app.WallpaperManager.FLAG_LOCK);
                    result=id>0?"Обои блокировки применены":"Android не подтвердил смену обоев";
                }catch(IOException|RuntimeException e){result="Android не разрешил сменить обои блокировки";}
                final String message=result;
                runOnUiThread(()->Toast.makeText(Home.this,message,Toast.LENGTH_SHORT).show());
            });
        }
        @JavascriptInterface public void chooseHome(){launch(new Intent(Settings.ACTION_HOME_SETTINGS));}
        @JavascriptInterface public void eva(){launch(new Intent(Home.this,ru.eva.envtest.MainActivity.class));}
    }
    public void onCreate(Bundle b){
        super.onCreate(b);getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);getWindow().setStatusBarColor(0x00000000);getWindow().setNavigationBarColor(0x00000000);
        if(Build.VERSION.SDK_INT>=30)getWindow().setDecorFitsSystemWindows(false);
        else getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        if(Build.VERSION.SDK_INT>=28){
            WindowManager.LayoutParams params=getWindow().getAttributes();
            params.layoutInDisplayCutoutMode=Build.VERSION.SDK_INT>=30
                ?WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                :WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(params);
        }
        android.widget.FrameLayout scene=new android.widget.FrameLayout(this);
        chat=new TownChat(this);weather=new WeatherWidget(this,scene);web=new WebView(this);
        if((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE)!=0)WebView.setWebContentsDebuggingEnabled(true);web.setBackgroundColor(0xff293335);scene.addView(web);setContentView(scene);
        WebSettings w=web.getSettings();w.setJavaScriptEnabled(true);w.setDomStorageEnabled(true);w.setAllowFileAccess(false);w.setAllowContentAccess(false);w.setBlockNetworkLoads(true);
        web.setWebViewClient(new WebViewClient(){
            public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){return serve(r.getUrl());}
            public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){return true;}
            @Override public void onPageFinished(WebView v,String url){
                v.evaluateJavascript("window.refreshApps?.(); window.setHomeActive?.("+homeActive+")",null);
                showBattery();
            }
        });
        web.addJavascriptInterface(new Bridge(),"Desk");web.loadUrl("https://"+HOST+"/index.html");
    }
    protected void onStart(){
        super.onStart();visible=this;CodexService.desktopVisibilityChanged();weather.start();
        IntentFilter filter=new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
        updateBattery(Build.VERSION.SDK_INT>=33?registerReceiver(battery,filter,Context.RECEIVER_NOT_EXPORTED):registerReceiver(battery,filter));
    }
    protected void onStop(){
        unregisterReceiver(battery);
        if(visible==this){visible=null;CodexService.desktopVisibilityChanged();}
        weather.stop();super.onStop();
    }
    protected void onActivityResult(int request,int code,Intent data){
        super.onActivityResult(request,code,data);
        if(request==WeatherWidget.BIND||request==WeatherWidget.CONFIGURE)weather.result(request,code);
    }
    protected void onNewIntent(Intent i){super.onNewIntent(i);if(web!=null)web.evaluateJavascript("window.closeSheet?.()",null);}
    protected void onResume(){super.onResume();homeActive=true;chat.resume();web.onResume();web.evaluateJavascript("window.setHomeActive?.(true)",null);refresh();}
    protected void onPostResume(){super.onPostResume();LifeService.updateSchedule(this);}
    @Override public void onWindowFocusChanged(boolean focused){
        super.onWindowFocusChanged(focused);
        if(focused&&Build.VERSION.SDK_INT>=30){
            android.view.WindowInsetsController controller=getWindow().getInsetsController();
            if(controller!=null)controller.show(android.view.WindowInsets.Type.navigationBars());
        }
    }
    protected void onPause(){homeActive=false;chat.pause();web.evaluateJavascript("window.setHomeActive?.(false)",null);web.onPause();super.onPause();}
    public void onBackPressed(){web.evaluateJavascript("window.backLayout?.() || window.closeTown?.() || window.closeSheet?.()",null);}
    protected void onDestroy(){chat.destroy();worker.shutdownNow();web.destroy();web=null;super.onDestroy();}
}
