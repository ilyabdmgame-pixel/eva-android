package ru.eva.envtest;
import android.accessibilityservice.AccessibilityService;
import android.content.ComponentName;
import android.content.Context;
import android.provider.Settings;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;
import android.view.Display;
import android.util.Base64;
import android.os.Handler;
import android.os.Looper;
import android.graphics.Region;
import android.graphics.RegionIterator;
import android.util.SparseArray;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import android.os.Bundle;
import android.os.Build;
import android.graphics.Bitmap;
import android.graphics.Rect;
import android.hardware.HardwareBuffer;
import android.os.SystemClock;
import java.util.List;
import java.util.concurrent.ForkJoinPool;
import java.util.function.BiConsumer;
import java.io.ByteArrayOutputStream;

public final class EvaAccessibility extends AccessibilityService {
  private static EvaAccessibility instance;
  private static final Handler windowHandler=new Handler(Looper.getMainLooper());
  private static Runnable petWindowsListener;
  private static final Runnable reportWindows=()->{if(petWindowsListener!=null)petWindowsListener.run();};
  private final Set<Integer> unfocusedSystemWindows=new HashSet<>();
  private List<PetWindows.Edge> cachedEdges=Collections.emptyList();
  private int cachedDisplay,cachedLeft,cachedTop,cachedWidth,cachedHeight,cachedMinWidth;
  private long validUntil,lastPanelRead,lastImeRead;
  private boolean visibleIme;

  static boolean petImeVisible(){
    return instance!=null&&instance.visibleIme;
  }
  private int panelWindow=-1;
  private Rect panelHost;
  private PetWindows.Edge cachedPanel;
  private PetWindows.Edge fullIme,cachedInput;
  private String launcherPackage;
  private static long lastPetInteraction=SystemClock.uptimeMillis();
  static long petLastInteraction(){return lastPetInteraction;}
  static PetAppScene petAppScene(){
    EvaAccessibility service=instance;
    if(service==null)return null;
    try{return PetAppScene.read(service,service.launcherPackage);}
    catch(IllegalStateException|SecurityException changedWindow){return null;}
  }
  private final Runnable checkPanel=()->{if(instance==this&&petWindowsListener!=null)signalWindows();};
  private final Runnable checkIme=()->{if(instance==this&&petWindowsListener!=null)signalWindows();};

  @Override public void onServiceConnected(){
    instance=this;
    lastPetInteraction=SystemClock.uptimeMillis();
    android.content.Intent home=new android.content.Intent(android.content.Intent.ACTION_MAIN)
        .addCategory(android.content.Intent.CATEGORY_HOME);
    android.content.pm.ResolveInfo launcher=getPackageManager().resolveActivity(home,android.content.pm.PackageManager.MATCH_DEFAULT_ONLY);
    launcherPackage=launcher!=null&&launcher.activityInfo!=null?launcher.activityInfo.packageName:null;
    signalWindows();
  }
  @Override public void onAccessibilityEvent(AccessibilityEvent event){
    if(event==null)return;
    int type=event.getEventType();
    CharSequence source=event.getPackageName();
    boolean own=source!=null&&getPackageName().contentEquals(source);
    if(!own&&(type==AccessibilityEvent.TYPE_VIEW_CLICKED||type==AccessibilityEvent.TYPE_VIEW_LONG_CLICKED||
        type==AccessibilityEvent.TYPE_VIEW_FOCUSED||type==AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED||
        type==AccessibilityEvent.TYPE_VIEW_SCROLLED||type==AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED))
      lastPetInteraction=SystemClock.uptimeMillis();
    if(petWindowsListener==null)return;
    if(type==AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED){
      int changes=event.getContentChangeTypes();
      if(changes!=0&&(changes&AccessibilityEvent.CONTENT_CHANGE_TYPE_SUBTREE)==0)return;
      // Coalesce structural changes without deferring indefinitely during animation.
      if(fullIme!=null&&event.getWindowId()==fullIme.id){
        windowHandler.removeCallbacks(checkIme);
        windowHandler.postAtTime(checkIme,Math.max(SystemClock.uptimeMillis(),lastImeRead+250));
      }else if(panelWindow>=0&&event.getWindowId()==panelWindow){
        windowHandler.removeCallbacks(checkPanel);
        windowHandler.postAtTime(checkPanel,Math.max(SystemClock.uptimeMillis(),lastPanelRead+250));
      }
      return;
    }
    if(type!=AccessibilityEvent.TYPE_WINDOWS_CHANGED&&type!=AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED)return;
    if(type==AccessibilityEvent.TYPE_WINDOWS_CHANGED&&Build.VERSION.SDK_INT>=28){
      int changes=event.getWindowChanges();
      if(changes==AccessibilityEvent.WINDOWS_CHANGE_BOUNDS&&unfocusedSystemWindows.contains(event.getWindowId()))return;
      int relevant=AccessibilityEvent.WINDOWS_CHANGE_ADDED|AccessibilityEvent.WINDOWS_CHANGE_REMOVED|
          AccessibilityEvent.WINDOWS_CHANGE_BOUNDS|AccessibilityEvent.WINDOWS_CHANGE_LAYER|
          AccessibilityEvent.WINDOWS_CHANGE_FOCUSED|AccessibilityEvent.WINDOWS_CHANGE_ACTIVE|
          AccessibilityEvent.WINDOWS_CHANGE_PIP;
      if(changes!=0&&(changes&relevant)==0)return;
    }
    signalWindows();
  }
  @Override public void onInterrupt(){}
  @Override public boolean onUnbind(android.content.Intent intent){disconnected();return super.onUnbind(intent);}
  @Override public void onDestroy(){disconnected();super.onDestroy();}
  private void disconnected(){
    windowHandler.removeCallbacks(checkPanel);
    clearIme();
    if(instance==this){instance=null;signalWindows();}
  }
  static boolean enabled(){return instance!=null;}
  public static boolean openRecentApps(){
    return instance!=null&&instance.performGlobalAction(GLOBAL_ACTION_RECENTS);
  }

  private static Boolean configured(Context context){
    String services;
    try{
      services=Settings.Secure.getString(context.getContentResolver(),Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
    }catch(SecurityException unreadable){
      return null;
    }
    if(services==null)return false;
    ComponentName own=new ComponentName(context,EvaAccessibility.class);
    for(String entry:services.split(":")){
      if(own.equals(ComponentName.unflattenFromString(entry)))return true;
    }
    return false;
  }

  static JSONObject status(Context context) throws org.json.JSONException{
    Boolean configured=configured(context);
    return new JSONObject().put("package",context.getPackageName())
        .put("configured",configured==null?JSONObject.NULL:configured).put("connected",enabled());
  }

  static void screenshot(Context context,BiConsumer<String,String> reply) throws Exception {
    if(Build.VERSION.SDK_INT<30)throw new Exception("Снимки через службу Евы доступны с Android 11");
    EvaAccessibility service=requireConnection(context);
    service.takeScreenshot(Display.DEFAULT_DISPLAY,ForkJoinPool.commonPool(),new TakeScreenshotCallback(){
      @Override public void onSuccess(ScreenshotResult result){
        String image;
        try(HardwareBuffer buffer=result.getHardwareBuffer()){
          Bitmap hardware=Bitmap.wrapHardwareBuffer(buffer,result.getColorSpace());
          if(hardware==null)throw new IllegalStateException("Android вернул пустой снимок");
          try{
            Bitmap pixels=hardware.copy(Bitmap.Config.ARGB_8888,false);
            if(pixels==null)throw new IllegalStateException("Не удалось прочитать снимок");
            try{
              float scale=Math.min(1f,1920f/Math.max(pixels.getWidth(),pixels.getHeight()));
              Bitmap scaled=scale<1f?Bitmap.createScaledBitmap(pixels,
                  Math.max(1,Math.round(pixels.getWidth()*scale)),Math.max(1,Math.round(pixels.getHeight()*scale)),true):pixels;
              try{
                ByteArrayOutputStream bytes=new ByteArrayOutputStream();
                if(!scaled.compress(Bitmap.CompressFormat.JPEG,76,bytes)||bytes.size()>700000)
                  throw new IllegalStateException("Не удалось подготовить снимок");
                image=Base64.encodeToString(bytes.toByteArray(),Base64.NO_WRAP);
              }finally{if(scaled!=pixels)scaled.recycle();}
            }finally{pixels.recycle();}
          }finally{hardware.recycle();}
        }catch(RuntimeException error){reply.accept(null,"Не удалось обработать снимок экрана");return;}
        reply.accept(image,null);
      }

      @Override public void onFailure(int code){
        String error=code==ERROR_TAKE_SCREENSHOT_INTERVAL_TIME_SHORT?"Подожди секунду перед следующим снимком":
            code==ERROR_TAKE_SCREENSHOT_SECURE_WINDOW?"Android защищает это окно от снимков":
            "Android не смог сделать снимок экрана ("+code+")";
        reply.accept(null,error);
      }
    });
  }

  // Overlay and accessibility callbacks both run on the main looper.
  static void setPetWindowsListener(Runnable listener){
    windowHandler.removeCallbacks(reportWindows);
    petWindowsListener=listener;
    if(instance!=null){
      instance.validUntil=0;
      instance.clearPanel();
      instance.clearIme();
    }
  }

  private void clearPanel(){
    windowHandler.removeCallbacks(checkPanel);
    panelWindow=-1;panelHost=null;cachedPanel=null;
  }

  private void clearIme(){
    windowHandler.removeCallbacks(checkIme);
    fullIme=null;cachedInput=null;
  }

  private static void signalWindows(){
    if(instance!=null)instance.validUntil=0;
    if(petWindowsListener!=null){
      windowHandler.removeCallbacks(reportWindows);
      windowHandler.post(reportWindows);
    }
  }

  static List<PetWindows.Edge> petWindows(int displayId,int screenLeft,int screenTop,
      int width,int height,int minWidth){
    EvaAccessibility service=instance;
    if(service==null||width<=0||height<=0)return Collections.emptyList();
    long now=SystemClock.uptimeMillis();
    if(now<service.validUntil&&displayId==service.cachedDisplay&&screenLeft==service.cachedLeft&&
        screenTop==service.cachedTop&&width==service.cachedWidth&&height==service.cachedHeight&&
        minWidth==service.cachedMinWidth)return service.cachedEdges;
    service.unfocusedSystemWindows.clear();
    service.visibleIme=false;
    Rect viewport=new Rect(screenLeft,screenTop,screenLeft+width,screenTop+height);
    List<List<PetWindows.Edge>> layers=new ArrayList<>();
    try{
      if(displayId==Display.DEFAULT_DISPLAY){
        List<AccessibilityWindowInfo> windows=service.getWindows();
        try{service.readWindowLayers(windows,layers,viewport);}
        finally{recycleWindows(windows);}
      }else if(Build.VERSION.SDK_INT>=30){
        SparseArray<List<AccessibilityWindowInfo>> displays=service.getWindowsOnAllDisplays();
        try{service.readWindowLayers(displays.get(displayId),layers,viewport);}
        finally{for(int i=0;i<displays.size();i++)recycleWindows(displays.valueAt(i));}
      }
      else{service.clearPanel();service.clearIme();}
    }catch(SecurityException|IllegalStateException unavailable){layers.clear();service.visibleIme=false;service.clearPanel();service.clearIme();}
    service.cachedEdges=PetWindows.exposed(layers,screenLeft,screenTop,width,height,Math.max(1,minWidth));
    service.cachedDisplay=displayId;service.cachedLeft=screenLeft;service.cachedTop=screenTop;
    service.cachedWidth=width;service.cachedHeight=height;service.cachedMinWidth=minWidth;
    service.validUntil=now+600;
    return service.cachedEdges;
  }

  private static void recycleWindows(List<AccessibilityWindowInfo> windows){
    if(windows!=null)for(AccessibilityWindowInfo window:windows)window.recycle();
  }

  private void readWindowLayers(List<AccessibilityWindowInfo> windows,List<List<PetWindows.Edge>> layers,Rect viewport){
    if(windows==null){clearPanel();clearIme();return;}
    Rect rect=new Rect();
    boolean sawApp=false,blocksApp=false,sawFullIme=false;
    for(AccessibilityWindowInfo window:windows){
      int type=window.getType(),id=window.getId(),kind;
      if(type==AccessibilityWindowInfo.TYPE_INPUT_METHOD)kind=PetWindows.IME;
      else if(type==AccessibilityWindowInfo.TYPE_APPLICATION)kind=PetWindows.APP;
      else if(type==AccessibilityWindowInfo.TYPE_SYSTEM&&window.isFocused())kind=PetWindows.BLOCKER;
      else{
        // Android reports our non-focusable application overlay as TYPE_SYSTEM.
        // Its animated position must neither create an edge nor hide its own footing.
        unfocusedSystemWindows.add(id);
        continue;
      }
      List<PetWindows.Edge> parts=new ArrayList<>();
      if(Build.VERSION.SDK_INT>=30){
        Region shape=new Region();
        window.getRegionInScreen(shape);
        RegionIterator bands=new RegionIterator(shape);
        while(bands.next(rect))parts.add(new PetWindows.Edge(id,kind,rect.left,rect.top,rect.right,rect.bottom));
      }else{
        window.getBoundsInScreen(rect);
        if(!rect.isEmpty())parts.add(new PetWindows.Edge(id,kind,rect.left,rect.top,rect.right,rect.bottom));
      }
      if(parts.isEmpty())continue;
      if(kind==PetWindows.IME)visibleIme=true;
      if(kind==PetWindows.BLOCKER)blocksApp=true;
      if(!blocksApp&&!sawFullIme&&parts.size()==1&&PetWindows.fullLandscapeIme(parts.get(0),
          viewport.left,viewport.top,viewport.right,viewport.bottom)){
        sawFullIme=true;blocksApp=true;
        PetWindows.Edge input=keyboardBelowExtract(window,parts.get(0));
        if(input!=null)layers.add(Collections.singletonList(input));
        // The full IME window still occludes every app behind its extracted editor.
      }
      if(kind==PetWindows.APP&&!blocksApp&&!sawApp&&(window.isActive()||window.isFocused())){
        sawApp=true;
        PetWindows.Edge panel=bottomPanel(window,viewport);
        if(panel!=null){
          // Insert the panel immediately in front of its own window, below every
          // higher window. Its actual top may be split by holes in the host Region.
          List<PetWindows.Edge> sheet=new ArrayList<>();
          for(PetWindows.Edge part:parts){
            if(part.t<=panel.t&&panel.t<part.b&&part.r>panel.l&&part.l<panel.r)
              sheet.add(new PetWindows.Edge(panel.id,panel.kind,Math.max(part.l,panel.l),panel.t,
                  Math.min(part.r,panel.r),panel.b));
          }
          if(!sheet.isEmpty())layers.add(sheet);
        }
      }
      layers.add(parts);
    }
    if(!sawApp)clearPanel();
    if(!sawFullIme)clearIme();
  }

  private PetWindows.Edge keyboardBelowExtract(AccessibilityWindowInfo window,PetWindows.Edge host){
    long now=SystemClock.uptimeMillis();
    if(host.equals(fullIme)&&now-lastImeRead<250)return cachedInput;
    windowHandler.removeCallbacks(checkIme);
    fullIme=host;lastImeRead=now;cachedInput=null;
    AccessibilityNodeInfo root=Build.VERSION.SDK_INT>=33?window.getRoot(0):window.getRoot();
    if(root==null)return null;
    try{
      if(root.getWindowId()!=host.id)return null;
      PetWindows.Edge editor=imeFrame(root,"android:id/extractArea",host.id);
      if(editor!=null)cachedInput=PetWindows.extractedKeyboard(host,editor,
          imeFrame(root,"android:id/inputArea",host.id));
      if(cachedInput!=null&&petWindowsListener!=null)windowHandler.postDelayed(checkIme,900);
      return cachedInput;
    }finally{root.recycle();}
  }

  private static PetWindows.Edge imeFrame(AccessibilityNodeInfo root,String id,int window){
    List<AccessibilityNodeInfo> matches=root.findAccessibilityNodeInfosByViewId(id);
    try{
      if(matches.size()!=1)return null;
      AccessibilityNodeInfo node=matches.get(0);
      if(node.getWindowId()!=window||!node.isVisibleToUser()||node.isPassword()||
          !id.equals(node.getViewIdResourceName())||!"android.widget.FrameLayout".contentEquals(
          node.getClassName()==null?"":node.getClassName()))return null;
      Rect r=new Rect();node.getBoundsInScreen(r);
      return new PetWindows.Edge(window,PetWindows.IME,r.left,r.top,r.right,r.bottom);
    }finally{for(AccessibilityNodeInfo node:matches)node.recycle();}
  }

  private PetWindows.Edge bottomPanel(AccessibilityWindowInfo window,Rect viewport){
    int id=window.getId();
    Rect host=new Rect();
    window.getBoundsInScreen(host);
    if(!host.intersect(viewport)){clearPanel();return null;}
    long now=SystemClock.uptimeMillis();
    if(id==panelWindow&&host.equals(panelHost)&&now-lastPanelRead<250){
      windowHandler.removeCallbacks(checkPanel);
      if(petWindowsListener!=null)windowHandler.postAtTime(checkPanel,lastPanelRead+250);
      return cachedPanel;
    }
    windowHandler.removeCallbacks(checkPanel);
    panelWindow=id;panelHost=host;lastPanelRead=now;cachedPanel=null;
    AccessibilityNodeInfo root=Build.VERSION.SDK_INT>=33?window.getRoot(0):window.getRoot();
    if(root==null)return null;
    try{
      CharSequence pkg=root.getPackageName();
      if(pkg==null||root.getWindowId()!=id)return null;
      String app=pkg.toString();
      if(app.equals(HONOR_HOME)||app.equals(launcherPackage)||app.equals(getPackageName()))return null;
      Rect content=new Rect();root.getBoundsInScreen(content);
      if(!content.intersect(host))return null;
      PetWindows.Edge bounds=new PetWindows.Edge(id,PetWindows.APP,content.left,content.top,content.right,content.bottom);
      float density=getResources().getDisplayMetrics().density;
      for(String entry:PetWindows.PANEL_IDS){
        String viewId=app+":id/"+entry;
        List<AccessibilityNodeInfo> matches=root.findAccessibilityNodeInfosByViewId(viewId);
        try{
          for(AccessibilityNodeInfo node:matches){
            if(!node.isVisibleToUser()||node.isPassword()||node.getWindowId()!=id||
                !viewId.equals(node.getViewIdResourceName()))continue;
            Rect rect=new Rect();node.getBoundsInScreen(rect);
            CharSequence cls=node.getClassName();
            PetWindows.Edge found=PetWindows.panel(id,entry,cls==null?"":cls.toString(),bounds,
                rect.left,rect.top,rect.right,rect.bottom,density);
            if(found==null)continue;
            if(cachedPanel!=null){cachedPanel=null;return null;}
            cachedPanel=found;
          }
        }finally{for(AccessibilityNodeInfo node:matches)node.recycle();}
        if(cachedPanel!=null)break;
      }
      // Some views move by translation and send no final accessibility event.
      if(cachedPanel!=null&&petWindowsListener!=null)windowHandler.postDelayed(checkPanel,900);
      return cachedPanel;
    }finally{root.recycle();}
  }

  static final class PetSurface {
    final String key;
    final Rect bounds;
    final boolean seated;
    PetSurface(String key,Rect bounds,boolean seated){this.key=key;this.bounds=bounds;this.seated=seated;}
  }
  static PetSurface petSurface(boolean seat) {
    if(instance==null)return null;
    AccessibilityNodeInfo root=instance.getRootInActiveWindow();
    if(root==null)return null;
    try {
      CharSequence name=root.getPackageName();
      if(name==null)return null;
      String app=name.toString(), id;
      switch(app){
        case "com.hihonor.android.launcher": id=seat?"hotseat_container":"card_stack_view";break;
        case "com.android.chrome": if(seat)return null;id="toolbar";break;
        case "com.google.android.youtube": id=seat?"pivot_bar":"toolbar";break;
        default: return null;
      }
      String key=app+":id/"+id;
      List<AccessibilityNodeInfo> nodes=root.findAccessibilityNodeInfosByViewId(key);
      try {
        Rect candidate=null;
        for(AccessibilityNodeInfo node:nodes){
          if(!node.isVisibleToUser()||node.isPassword())continue;
          Rect bounds=new Rect();
          node.getBoundsInScreen(bounds);
          if(bounds.isEmpty())continue;
          if(candidate!=null)return null;
          candidate=bounds;
        }
        return candidate==null?null:new PetSurface(key,candidate,seat);
      }finally {for(AccessibilityNodeInfo node:nodes)node.recycle();}
    }finally{root.recycle();}
  }

  private int homePage=-1;
  static int measuredHomePage(){return instance==null?-1:instance.homePage;}

  static int currentWorkspacePage(){
    AccessibilityNodeInfo root=homeRoot();
    if(root==null)return -1;
    try{
      List<AccessibilityNodeInfo> nodes=root.findAccessibilityNodeInfosByViewId(HONOR_HOME+":id/workspace");
      try{return nodes.size()==1?PetLearnedEdges.page(nodes.get(0).getContentDescription()):-1;}
      finally{for(AccessibilityNodeInfo n:nodes)n.recycle();}
    }finally{root.recycle();}
  }

  private static final String HONOR_HOME="com.hihonor.android.launcher";
  private List<PetHomeMap.Box> capturedGeometry, visualGeometry;
  private List<PetLauncherCutout> prankTiles=Collections.emptyList();

  static List<PetLauncherCutout> petPrankTiles(){
    if(instance==null||SystemClock.uptimeMillis()-instance.lastCapture>22_000)return Collections.emptyList();
    return instance.prankTiles;
  }

  private Rect capturedBounds;
  private int capturedWindow=-1;
  private long lastCapture;
  private boolean capturing;

  // Touching the pet makes its overlay the active accessibility window. The
  // focused application remains the launcher until the user changes screens.
  private static AccessibilityNodeInfo homeRoot(){
    if(instance==null)return null;
    AccessibilityNodeInfo active=instance.getRootInActiveWindow();
    if(active!=null){
      CharSequence pkg=active.getPackageName();
      if(HONOR_HOME.contentEquals(pkg==null?"":pkg))return active;
      boolean ours=instance.getPackageName().contentEquals(pkg==null?"":pkg);
      active.recycle();
      if(!ours)return null;
    }
    List<AccessibilityWindowInfo> windows=instance.getWindows();
    try{
      for(AccessibilityWindowInfo window:windows){
        if(!window.isFocused()||window.getType()!=AccessibilityWindowInfo.TYPE_APPLICATION)continue;
        AccessibilityNodeInfo root=window.getRoot();
        if(root==null)return null;
        CharSequence pkg=root.getPackageName();
        if(HONOR_HOME.contentEquals(pkg==null?"":pkg))return root;
        root.recycle();
        break;
      }
      return null;
    }finally{recycleWindows(windows);}
  }

  static boolean petHomeActive(){
    AccessibilityNodeInfo root=homeRoot();
    if(root==null)return false;
    root.recycle();
    return true;
  }

  static List<PetHomeMap.Box> petHome() {
    if(instance!=null)instance.homePage=-1;
    if(!petHomeActive())return null;
    android.accessibilityservice.AccessibilityServiceInfo info=instance.getServiceInfo();
    if(info==null)return null;
    int flags=info.flags;
    int details=android.accessibilityservice.AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS;
    try {
      if((flags&details)==0){
        info.flags=flags|details;
        instance.setServiceInfo(info);
      }
      return readHomeTree();
    }finally{
      if((flags&details)==0&&instance!=null){
        info.flags=flags;
        instance.setServiceInfo(info);
      }
    }
  }

  private static List<PetHomeMap.Box> readHomeTree(){
    AccessibilityNodeInfo root=homeRoot();
    if(root==null)return null;
    try {
      if(!HONOR_HOME.contentEquals(root.getPackageName()==null?"":root.getPackageName()))return null;
      List<AccessibilityNodeInfo> workspaces=root.findAccessibilityNodeInfosByViewId(HONOR_HOME+":id/workspace");
      try {
        AccessibilityNodeInfo visible=null;
        for(AccessibilityNodeInfo candidate:workspaces)if(candidate.isVisibleToUser()){
          if(visible!=null)return null;
          visible=candidate;
        }
        if(visible==null)return null;
        List<PetHomeMap.Box> boxes=new ArrayList<>();
        instance.homePage=PetLearnedEdges.page(visible.getContentDescription());
        collectHome(visible,boxes,0);
        PetSurface dock=petSurface(true);
        if(dock!=null)putHomeBox(boxes,PetHomeMap.DOCK,dock.bounds);
        if(boxes.isEmpty())return instance.homePage<1?null:boxes;
        Rect window=new Rect();
        root.getBoundsInScreen(window);
        return instance.homeWithImage(root.getWindowId(),window,boxes);
      }finally {for(AccessibilityNodeInfo node:workspaces)node.recycle();}
    }finally {root.recycle();}
  }

  private List<PetHomeMap.Box> homeWithImage(int id,Rect window,List<PetHomeMap.Box> boxes){
    if(Build.VERSION.SDK_INT<34||id<0||window.isEmpty())return boxes;
    boolean matching=capturedWindow==id&&window.equals(capturedBounds)&&
      capturedGeometry!=null&&PetHomeMap.sameLayout(capturedGeometry,boxes,3);
    long now=SystemClock.uptimeMillis();
    if(!matching)prankTiles=Collections.emptyList();
    if(!capturing&&now-lastCapture>(matching?15000:1600)){
      lastCapture=now;
      capturing=true;
      int precision=Math.round(getResources().getDisplayMetrics().density*4);
      try {
        takeScreenshotOfWindow(id,ForkJoinPool.commonPool(),new TakeScreenshotCallback(){
          @Override public void onSuccess(ScreenshotResult result){
            List<PetHomeMap.Box> geometry=null;
            List<PetLauncherCutout> cutouts=Collections.emptyList();
            try(HardwareBuffer buffer=result.getHardwareBuffer()){
              Bitmap hardware=Bitmap.wrapHardwareBuffer(buffer,result.getColorSpace());
              if(hardware!=null)try{
                Bitmap pixels=hardware.copy(Bitmap.Config.ARGB_8888,false);
                if(pixels!=null)try {
                  boolean local=pixels.getWidth()==window.width()&&pixels.getHeight()==window.height();
                  geometry=PetHomeVision.refine(boxes,pixels::getPixel,local?window.left:0,local?window.top:0,
                    pixels.getWidth(),pixels.getHeight(),precision);
                  if(geometry!=null)cutouts=PetLauncherCutout.collect(pixels,local?window.left:0,local?window.top:0,geometry);
                }finally{pixels.recycle();}
              }finally{hardware.recycle();}
            }catch(RuntimeException error){android.util.Log.d("EvaPet","Launcher image could not be read",error);}
            List<PetHomeMap.Box> refined=geometry;
            List<PetLauncherCutout> collected=cutouts;
            getMainExecutor().execute(()->{
              capturing=false;
              if(instance!=EvaAccessibility.this||refined==null)return;
              capturedGeometry=boxes;
              capturedBounds=window;
              capturedWindow=id;
              visualGeometry=refined;
              prankTiles=collected;
              android.util.Log.d("EvaPet","Launcher visual geometry ready: "+refined.size()+" elements");
            });
          }
          @Override public void onFailure(int code){
            getMainExecutor().execute(()->capturing=false);
            android.util.Log.d("EvaPet","Launcher snapshot unavailable: "+code);
          }
        });
      }catch(RuntimeException error){capturing=false;android.util.Log.d("EvaPet","Launcher capture unavailable",error);}
    }
    return matching?visualGeometry:boxes;
  }

  private static void collectHome(AccessibilityNodeInfo node,List<PetHomeMap.Box> out,int depth){
    if(depth>16||out.size()>=36||!node.isVisibleToUser()||node.isPassword())return;
    String resource=node.getViewIdResourceName();
    Rect bounds=new Rect();
    node.getBoundsInScreen(bounds);
    float density=instance.getResources().getDisplayMetrics().density;
    boolean isFolder=(HONOR_HOME+":id/preview_background").equals(resource)||
      (HONOR_HOME+":id/card_folder_workspace_layout").equals(resource);
    boolean isWidget=(HONOR_HOME+":id/card_stack_view").equals(resource);
    if(isFolder||isWidget){
      putHomeBox(out,isFolder?PetHomeMap.FOLDER:PetHomeMap.WIDGET,bounds);
      return;
    }
    CharSequence cls=node.getClassName();
    boolean tileContainer="android.widget.LinearLayout".contentEquals(cls==null?"":cls)
      ||"android.widget.FrameLayout".contentEquals(cls==null?"":cls);
    if(node.isClickable()){
      PetHomeMap.Box tile=PetHomeMap.launcherTile(bounds.left,bounds.top,bounds.right,bounds.bottom,
        density,tileContainer,node.getChildCount()==0);
      if(tile!=null){
        putHomeBox(out,tile.kind,new Rect(tile.l,tile.t,tile.r,tile.b));
        return;
      }
    }
    for(int i=0;i<node.getChildCount()&&i<60&&out.size()<36;i++){
      AccessibilityNodeInfo child=node.getChild(i);
      if(child==null)continue;
      try{collectHome(child,out,depth+1);}finally{child.recycle();}
    }
  }

  private static void putHomeBox(List<PetHomeMap.Box> out,int kind,Rect r){
    if(r.isEmpty()||r.left<0||r.top<0)return;
    PetHomeMap.Box box=new PetHomeMap.Box(kind,r.left,r.top,r.right,r.bottom);
    for(PetHomeMap.Box b:out)if(b.same(box,3))return;
    out.add(box);
  }

  private static void collect(AccessibilityNodeInfo node,ArrayList<AccessibilityNodeInfo> out){if(node==null||out.size()>=300)return;out.add(node);for(int i=0;i<node.getChildCount()&&out.size()<300;i++)collect(node.getChild(i),out);}
  private static EvaAccessibility requireConnection(Context context) throws Exception {
    EvaAccessibility service=instance;
    if(service==null){
      Boolean configured=configured(context);
      if(Boolean.TRUE.equals(configured))throw new Exception("Служба этой Евы включена, но Android её не подключил");
      if(configured==null)throw new Exception("Служба Евы не подключена. Android не предоставил состояние переключателя");
      throw new Exception("Включи службу «Ева — управление экраном» для этой установки Евы");
    }
    return service;
  }

  private static ArrayList<AccessibilityNodeInfo> nodes(Context context) throws Exception {
    AccessibilityNodeInfo root=requireConnection(context).getRootInActiveWindow();
    if(root==null)throw new Exception("Служба Евы подключена. Активный экран недоступен");
    ArrayList<AccessibilityNodeInfo> list=new ArrayList<>();
    collect(root,list);
    return list;
  }
  static JSONArray screen(Context context) throws Exception {ArrayList<AccessibilityNodeInfo> list=nodes(context);JSONArray result=new JSONArray();try{for(AccessibilityNodeInfo n:list){if(!n.isVisibleToUser()||n.isPassword())continue;CharSequence label=n.getText(),desc=n.getContentDescription();if((label==null||label.length()==0)&&(desc==null||desc.length()==0))continue;JSONObject item=new JSONObject();item.put("text",label==null?"":label.toString().substring(0,Math.min(500,label.length())));item.put("description",desc==null?"":desc.toString().substring(0,Math.min(500,desc.length())));item.put("clickable",n.isClickable());if(n.getPackageName()!=null)item.put("app",n.getPackageName());result.put(item);}return result;}finally{for(AccessibilityNodeInfo n:list)n.recycle();}}
  static String click(Context context,String label) throws Exception {if(label==null||label.trim().isEmpty())throw new Exception("Укажите текст элемента");ArrayList<AccessibilityNodeInfo> list=nodes(context);try{AccessibilityNodeInfo match=null;int count=0;for(AccessibilityNodeInfo n:list){if(!n.isVisibleToUser()||n.isPassword())continue;String text=n.getText()==null?"":n.getText().toString(),desc=n.getContentDescription()==null?"":n.getContentDescription().toString();if(label.equals(text)||label.equals(desc)){match=n;count++;}}if(count!=1)throw new Exception(count==0?"Элемент не найден":"Найдено несколько элементов с таким текстом");AccessibilityNodeInfo target=AccessibilityNodeInfo.obtain(match);try{while(target!=null&&!target.isClickable()){AccessibilityNodeInfo parent=target.getParent();target.recycle();target=parent;}if(target==null||!target.performAction(AccessibilityNodeInfo.ACTION_CLICK))throw new Exception("Не удалось нажать элемент");return "Команда нажатия передана приложению.";}finally{if(target!=null)target.recycle();}}finally{for(AccessibilityNodeInfo n:list)n.recycle();}}
}
