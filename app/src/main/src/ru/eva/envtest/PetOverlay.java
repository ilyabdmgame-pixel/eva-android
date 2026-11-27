package ru.eva.envtest;

import android.app.KeyguardManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.Point;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.Rect;
import android.graphics.RectF;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.hardware.display.DisplayManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.provider.Settings;
import android.view.Gravity;
import android.view.Choreographer;
import android.view.Display;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.view.WindowMetrics;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.io.InputStream;

final class PetOverlay {
    static final String OPEN_CHAT="ru.eva.envtest.OPEN_PET_CHAT";
    static final String COMPOSER_ANCHOR="petComposerAnchor";
    static final String STOP="ru.eva.envtest.STOP_PET";
    private static final String PREFS="eva_pet";
    private static final String[] FRAMES={
        "idle","wave","curious","sit","walk_0","walk_1","walk_2","walk_3","climb","peek","land","smile","point","lean","stretch","doze","climb_a","climb_b","grab","fall",
        "pocket","book_take","book_read","book_page","book_close","book_store",
        "cup_hold","cup_raise","cup_sip","cup_lower","wink","yawn",
        "walk_4","walk_5","walk_6","walk_7",
        "crawl_down","crawl_a","crawl_b","crawl_up","ladder_hold","ladder_a","ladder_b","ladder_high",
        "mantle_hang","mantle_pull","mantle_knee","mantle_stand",
        "mantle_00","mantle_01","mantle_02","mantle_03","mantle_04","mantle_05",
        "mantle_06","mantle_07","mantle_08","mantle_09","mantle_10","mantle_11",
        "walk_8","walk_9","walk_10","walk_11"
    };
    private static final String[] GENERATED_BANKS={"spring","reach_book","reach_tea","seat_swing",
        "rope_grip","crawl_step","lean","rise","gait","crawl_fold","gait_mid"};
    private static final int FRAME_WIDTH=402, FRAME_HEIGHT=540;
    private static final class Frame {
        final Bitmap bitmap;
        final Rect area;
        Frame(Bitmap bitmap,Rect area){
            this.bitmap=bitmap;
            this.area=area;
        }
    }

    private final Context context,windowContext;
    private EvaPresence.Curve greetCurve,lookCurve,settleCurve;

    private final WindowManager windows;
    private final DisplayManager displays;
    private final SensorManager sensors;
    private final Sensor gravitySensor;
    private final PetGravity gravity=new PetGravity();
    private final PetLadder ladder;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final ExecutorService artLoader=Executors.newSingleThreadExecutor();
    private final PowerManager power;
    private final KeyguardManager keyguard;
    private final PetMotion.Pose pose=new PetMotion.Pose();
    private final PetIdle idle=new PetIdle(new Random());
    private final PetSeat seat=new PetSeat(new Random());
    private final PetStories stories=new PetStories(new Random());
    private boolean storyLineShown;
    private final PetPlay games=new PetPlay(new Random());
    private final PetPlay.Pose gamePose=new PetPlay.Pose();
    private final PetMood mood=new PetMood();
    private final PetToys toys;
    private final PetPrank prank;
    private long lastPetTouch;
    private boolean interruptedBook;
    private PetPlayArt playArt;
    private PetAirArt airArt;
    private PetPlay.Act game;
    private List<PetHomeMap.Box> toyTerrain=Collections.emptyList();
    private long gameTime,nextGameAt,checkTerrainAt;
    private PetLadderMotion ascent;
    private final PetLadderMotion.Sample ladderPose=new PetLadderMotion.Sample();
    private Frame[] rearFrames;
    private final Choreographer choreographer=Choreographer.getInstance();
    private final Choreographer.FrameCallback tick=this::onFrame;
    private final Runnable next=this::nextBehavior;
    private final Runnable hold=this::holdPose;
    private final Runnable windowRefresh=this::refreshWindowTerrain;
    private final Runnable appCheck=this::refreshAppScene;
    private PetAppScene appScene;
    private int appPolicy=PetAppProfiles.AUTO,appVisits;
    private boolean parked,appHidden,appParkingMove,imePassthrough,imeInset;
    private long nextAppGesture,dodgeUntil,lastDodgeInput;

    private List<PetWindows.Edge> windowEdges=Collections.emptyList();
    private List<PetHomeMap.Box> windowTerrain=Collections.emptyList();
    private final Runnable retryLanding=()->finishDrop(this.left);
    private final Runnable showAfterUnlock=this::sync;
    private final Runnable resize=this::applyDisplayChange;
    private final SensorEventListener gravityListener=new SensorEventListener() {
        @Override public void onSensorChanged(SensorEvent event){
            if(event.values.length<3||sprite==null)return;
            gravity.read(event.values[0],event.values[1],event.values[2],event.sensor.getType()==Sensor.TYPE_ACCELEROMETER);
            long now=SystemClock.uptimeMillis();
            if(now<ignoreGravityUntil)return;
            int direction=gravity.direction(rotation,now);
            if(touched||parked||appHidden||composerVisible||direction==physicalDown)return;
            physicalDown=direction;
            fallWithTilt();
        }
        @Override public void onAccuracyChanged(Sensor sensor,int accuracy){}
    };
    private final DisplayManager.DisplayListener displayListener=new DisplayManager.DisplayListener() {
        @Override public void onDisplayAdded(int id) {}
        @Override public void onDisplayRemoved(int id) {}
        @Override public void onDisplayChanged(int id) {
            if(id==Display.DEFAULT_DISPLAY)configurationChanged();
        }
    };
    private final BroadcastReceiver displayEvents=new BroadcastReceiver() {
        @Override public void onReceive(Context c,Intent i) {
            String action=i.getAction();
            if(Intent.ACTION_POWER_CONNECTED.equals(action)||Intent.ACTION_POWER_DISCONNECTED.equals(action)||
                Intent.ACTION_BATTERY_LOW.equals(action)){
                if(!isInitialStickyBroadcast())powerEvent(action);
                return;
            }
            if(Intent.ACTION_SCREEN_OFF.equals(action)) {
                handler.removeCallbacks(showAfterUnlock);
                remove();
            } else {
                handler.removeCallbacks(showAfterUnlock);
                handler.postDelayed(showAfterUnlock,200);
            }
        }
    };

    private Sprite sprite;
    private boolean turningIntoWalk;
    private Frame[] frames;
    private Bitmap hangingBitmap,chairBitmap,watchBitmap;
    private final PetChair chair=new PetChair();
    private Runnable afterPacking;
    private final Runnable finishPacking=this::finishChairPacking;
    private void finishChairPacking(){
        Runnable resume=afterPacking;
        afterPacking=null;
        if(resume!=null&&sprite!=null&&!touched)resume.run();
    }
    private WindowManager.LayoutParams layout;
    private boolean suspended, receiverRegistered, dragging, touched, held, left, atLeft, motionEnabled;
    private int maxX, maxY, x, y, rotation, crossStart, crossEnd, crossStartY, targetX, targetY;
    private int worldWidth,worldHeight,bodyWidth,bodyHeight;
    private PetPlacement surface;
    private PetHomeMap.Route homeRoute;
    private PetHomeMap.Box platform,dropTarget;
    private PetHomeMap.Box loweringFrom;
    private PetClimb.Track climbTrack;
    private PetRopeMotion ropeDescent;
    private PetHomeMap.Box leftPlatform;
    private int perchPhase;
    private boolean perchLeft;
    private List<PetHomeMap.Box> plannedHome;
    private final Runnable homeAdvance=this::advanceHome;
    private int homeStep,homeTurn,contentOriginX,contentOriginY;
    private long homeSatAt,homeCheckAt,homeMissingSince,landingMissingSince;
    private static final int HOME_RECHECK_MS=260,HOME_GRACE_MS=900;
    private boolean homeTried,originReady,loadingArt,artFailed,destroyed;
    private long perchedAt;
    private final int[] origin=new int[2];
    private float downX,downY,rawOriginX,rawOriginY,fingerX,fingerY;
    private final PetHoodHold hood=new PetHoodHold();
    private int mode, motionTime;
    private int rotationRetries;
    private int physicalDown=PetGravity.DOWN;
    private PetTurn turnInAir;
    private float bodyAngle,drawCenterX,drawCenterY;
    private float landingImpact=1;
    private long ignoreGravityUntil;
    private boolean preferSeat=true;
    private long began, lastFrameNanos;

    PetOverlay(Context context) {
        this.context=context;
        displays=(DisplayManager)context.getSystemService(Context.DISPLAY_SERVICE);
        sensors=(SensorManager)context.getSystemService(Context.SENSOR_SERVICE);
        Sensor systemGravity=sensors==null?null:sensors.getDefaultSensor(Sensor.TYPE_GRAVITY);
        gravitySensor=systemGravity!=null?systemGravity:sensors==null?null:sensors.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        Display display=displays.getDisplay(Display.DEFAULT_DISPLAY);
        windowContext=Build.VERSION.SDK_INT>=30&&display!=null?
            context.createDisplayContext(display).createWindowContext(WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,null):context;
        windows=(WindowManager)windowContext.getSystemService(Context.WINDOW_SERVICE);
        ladder=new PetLadder(windowContext,windows);
        toys=new PetToys(windowContext,windows);
        prank=new PetPrank(windowContext,windows);
        lastPetTouch=SystemClock.uptimeMillis();
        power=(PowerManager)context.getSystemService(Context.POWER_SERVICE);
        keyguard=(KeyguardManager)context.getSystemService(Context.KEYGUARD_SERVICE);
        IntentFilter filter=new IntentFilter();
        filter.addAction(Intent.ACTION_POWER_CONNECTED);
        filter.addAction(Intent.ACTION_POWER_DISCONNECTED);
        filter.addAction(Intent.ACTION_BATTERY_LOW);
        filter.addAction(Intent.ACTION_SCREEN_OFF);
        filter.addAction(Intent.ACTION_SCREEN_ON);
        filter.addAction(Intent.ACTION_USER_PRESENT);
        if(Build.VERSION.SDK_INT>=33)context.registerReceiver(displayEvents,filter,Context.RECEIVER_NOT_EXPORTED);
        else context.registerReceiver(displayEvents,filter);
        receiverRegistered=true;
        displays.registerDisplayListener(displayListener,handler);
    }

    static boolean enabled(Context c) {
        return c.getSharedPreferences(PREFS,0).getBoolean("enabled",false);
    }

    static void setEnabled(Context c,boolean enabled) {
        c.getSharedPreferences(PREFS,0).edit().putBoolean("enabled",enabled).apply();
    }

    static boolean anchorsEnabled(Context c) {
        return c.getSharedPreferences(PREFS,0).getBoolean("anchors",false);
    }

    static void setAnchorsEnabled(Context c,boolean enabled) {
        c.getSharedPreferences(PREFS,0).edit().putBoolean("anchors",enabled).apply();
    }

    private boolean composerVisible;
    void setPresentation(PetAppPolicy.Presentation presentation) {
        boolean wasComposerVisible=composerVisible;
        composerVisible=presentation==PetAppPolicy.Presentation.ANCHORED_COMPOSER;
        suspended=presentation==PetAppPolicy.Presentation.HIDDEN;
        sync();
        if(sprite==null)return;
        if(composerVisible){
            handler.removeCallbacks(next);
            choreographer.removeFrameCallback(tick);
        }else if(wasComposerVisible)returnToFloor();
    }

    void sync() {
        if(!enabled(context)||!Settings.canDrawOverlays(context)||suspended||ru.eva.life.Home.visible()
            ||!power.isInteractive()||keyguard.isKeyguardLocked()) {
            remove();
            return;
        }
        if(sprite!=null)return;
        if(frames==null){prepareFrames();return;}
        motionEnabled=Settings.Global.getFloat(context.getContentResolver(),Settings.Global.ANIMATOR_DURATION_SCALE,1f)>0;
        try {
            sprite=new Sprite();
            int type=Build.VERSION.SDK_INT>=26?WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY:
                WindowManager.LayoutParams.TYPE_PHONE;
            physicalDown=PetGravity.DOWN;
            bodyAngle=0;
            turnInAir=null;
            layout=new WindowManager.LayoutParams(dp(94),dp(126),type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL|
                    WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                PixelFormat.TRANSLUCENT);
            layout.gravity=Gravity.TOP|Gravity.LEFT;
            // Physics supplies every visible position, including the first release frame.
            if(Build.VERSION.SDK_INT>=34)layout.setCanPlayMoveAnimation(false);
            layout.setTitle("Ева на экране");
            originReady=false;
            measureBounds();
            sizeBodyForDisplay();
            setBodyBounds();
            atLeft=rotation==android.view.Surface.ROTATION_270||
                rotation==android.view.Surface.ROTATION_180;
            x=atLeft?0:maxX;
            y=maxY;
            surface=null;
            homeTried=false;
            nextGameAt=SystemClock.uptimeMillis()+3800;
            platform=dropTarget=null;
            layout.x=x;
            layout.y=y;
            pose.frame=PetMotion.IDLE;
            pose.nextFrame=-1;
            pose.shiftX=motionEnabled?(atLeft?-1:1):0;
            pose.shiftY=0;
            pose.angle=0;
            pose.mirrored=false;
            ladder.attach();
            sprite.setOnApplyWindowInsetsListener((view,insets)->{
                if(Build.VERSION.SDK_INT>=30){
                    imeInset=insets.isVisible(android.view.WindowInsets.Type.ime());
                    updateImeInteraction(imeInset||EvaAccessibility.petImeVisible());
                }
                return insets;
            });
            windows.addView(sprite,layout);
            EvaAccessibility.setPetWindowsListener(this::windowsChanged);
            if(anchorsEnabled(context))handler.postDelayed(appCheck,350);
            if(motionEnabled&&gravitySensor!=null){
                gravity.resetDirection();
                ignoreGravityUntil=SystemClock.uptimeMillis()+550;
                sensors.registerListener(gravityListener,gravitySensor,SensorManager.SENSOR_DELAY_UI,handler);
            }
            Sprite shown=sprite;
            shown.post(()->{
                if(sprite!=shown||touched)return;
                PetHomeMap.Box dock=PetHomeMap.dockAt(readHome(),x,layout.width,layout.height,maxY);
                if(dock!=null){
                    platform=dock;
                    perchPhase=0;
                    position(x,PetHomeMap.standY(dock,layout.height));
                }
                if(sprite==shown&&motionEnabled)play(PetMotion.ENTER_SIDE,!atLeft);
                windowsChanged();
            });
        } catch(RuntimeException e) {
            android.util.Log.w("EvaPet","Could not display pet",e);
            remove();
        }
    }

    void configurationChanged() {
        if(sprite==null)return;
        rotationRetries=0;
        handler.removeCallbacks(resize);
        handler.postDelayed(resize,48);
    }

    private void applyDisplayChange() {
        if(sprite==null)return;
        int oldMaxX=maxX,oldMaxY=maxY,oldRotation=rotation;
        int oldWorldWidth=worldWidth,oldWorldHeight=worldHeight;
        int oldOriginX=contentOriginX,oldOriginY=contentOriginY;
        boolean oldOriginReady=originReady;
        int oldW=layout.width,oldH=layout.height;
        float centerX=x+(turnInAir==null&&!held?oldW/2f:drawCenterX);
        float centerY=y+(turnInAir==null&&!held?oldH/2f:drawCenterY);
        long elapsed=SystemClock.uptimeMillis()-began;
        boolean entering=!held&&mode==PetMotion.ENTER_SIDE&&elapsed<motionTime;
        boolean airborne=held||mode==PetMotion.GRAVITY_FALL||mode==PetMotion.SHORT_DROP||
            (mode==PetMotion.HOP&&elapsed>=PetMotion.TAKEOFF_MS&&elapsed<motionTime-PetMotion.TOUCHDOWN_MS);
        measureBounds();
        int turn=(rotation-oldRotation)&3;
        boolean oldWide=oldWorldWidth>oldWorldHeight;
        boolean newWide=worldWidth>worldHeight;
        if((turn&1)!=0&&oldWide==newWide&&rotationRetries++<5){
            worldWidth=oldWorldWidth;worldHeight=oldWorldHeight;
            maxX=oldMaxX;maxY=oldMaxY;rotation=oldRotation;
            contentOriginX=oldOriginX;contentOriginY=oldOriginY;originReady=oldOriginReady;
            handler.postDelayed(resize,48);
            return;
        }
        if(oldWorldWidth==worldWidth&&oldWorldHeight==worldHeight&&oldRotation==rotation&&
                oldOriginX==contentOriginX&&oldOriginY==contentOriginY)return;
        resetChair();
        parked=appParkingMove=false;
        hideSupportMap();
        sizeBodyForDisplay();
        ignoreGravityUntil=SystemClock.uptimeMillis()+650;
        gravity.resetDirection();
        physicalDown=PetGravity.DOWN;

        choreographer.removeFrameCallback(tick);
        handler.removeCallbacks(next);
        handler.removeCallbacks(hold);
        boolean faceLeft=pose.mirrored;
        touched=dragging=held=false;
        clearHome();
        platform=dropTarget=null;
        leftPlatform=null;
        surface=null;
        if(Build.VERSION.SDK_INT<30)originReady=false;
        windowEdges=Collections.emptyList();
        windowTerrain=Collections.emptyList();
        windowsChanged();
        homeTried=false;
        if(entering){
            turnInAir=null;
            bodyAngle=0;
            atLeft=rotation==android.view.Surface.ROTATION_270||rotation==android.view.Surface.ROTATION_180;
            boolean resized=setBodyBounds();
            position(atLeft?0:maxX,maxY,resized);
            if(sprite!=null)play(PetMotion.ENTER_SIDE,!atLeft);
            return;
        }
        if(motionEnabled&&(turnInAir!=null||Math.abs(bodyAngle)>.1f||(turn!=0&&airborne))){
            PetMotion.Position center=PetMotion.rotatePosition(Math.round(centerX),Math.round(centerY),
                0,0,oldWorldWidth,oldWorldHeight,0,0,worldWidth,worldHeight,turn);
            startAirTurn(center.x,center.y,bodyAngle-(turn==3?-90:turn*90),faceLeft);
            return;
        }
        boolean resized=setBodyBounds();
        PetMotion.Position rotated=PetMotion.rotatePosition(x,y,oldW,oldH,oldMaxX,oldMaxY,
            bodyWidth,bodyHeight,maxX,maxY,turn);
        position(rotated.x,rotated.y,resized);
        if(sprite==null)return;
        if(!motionEnabled||y<maxY)returnToFloor();
        else play(PetMotion.LOOK_AROUND,faceLeft);
    }

    void destroy() {
        destroyed=true;
        displays.unregisterDisplayListener(displayListener);
        artLoader.shutdownNow();
        handler.removeCallbacksAndMessages(null);
        remove();
        if(receiverRegistered)context.unregisterReceiver(displayEvents);
        receiverRegistered=false;
        frames=null;
        rearFrames=null;
        chairBitmap=watchBitmap=null;
        playArt=null;
    }

    private void measureBounds() {
        Display display=displays.getDisplay(Display.DEFAULT_DISPLAY);
        rotation=(display==null?windows.getDefaultDisplay():display).getRotation();
        int width,height;
        if(Build.VERSION.SDK_INT>=30) {
            WindowMetrics metrics=windows.getCurrentWindowMetrics();
            Rect bounds=metrics.getBounds();
            // Use the same visible bar frame as this top-left overlay window.
            android.graphics.Insets insets=metrics.getWindowInsets().getInsets(
                WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout());
            width=bounds.width()-insets.left-insets.right;
            height=bounds.height()-insets.top-insets.bottom;
            contentOriginX=bounds.left+insets.left;
            contentOriginY=bounds.top+insets.top;
            originReady=true;
        } else {
            Point size=new Point();
            windows.getDefaultDisplay().getSize(size);
            width=size.x;
            height=size.y;
        }
        worldWidth=width;
        worldHeight=height;
        updateTravelBounds();
    }

    private void updateTravelBounds(){
        maxX=Math.max(0,worldWidth-layout.width);
        maxY=Math.max(0,worldHeight-layout.height);
    }

    private void sizeBodyForDisplay(){
        int normalHeight=dp(126);
        // Keep scale constant throughout an orientation, including IME animation.
        bodyHeight=worldWidth>worldHeight?Math.max(1,Math.min(normalHeight,worldHeight/3)):normalHeight;
        bodyWidth=Math.max(1,Math.round(dp(94)*(bodyHeight/(float)normalHeight)));
    }

    private boolean setBodyBounds(){
        boolean sideways=PetGravity.sideways(physicalDown);
        int width=sideways?bodyHeight:bodyWidth,height=sideways?bodyWidth:bodyHeight;
        return setBodyBounds(width,height);
    }

    private boolean setBodyBounds(int width,int height){
        if(layout.width==width&&layout.height==height)return false;
        layout.width=width;
        layout.height=height;
        updateTravelBounds();
        return true;
    }

    private int dp(float value) {
        return Math.round(value*density());
    }

    private void prepareFrames(){
        if(loadingArt||artFailed||destroyed)return;
        loadingArt=true;
        artLoader.execute(()->{
            try{
                Frame[] back=new Frame[PetLadderMotion.LAST_KEY+1];
                Frame[] atlas=loadFrames(back);
                Frame contact=atlas[PetAir.CONTACT];
                PetAirArt flight=new PetAirArt(contact.bitmap,contact.area);
                Frame fall=atlas[PetMotion.FALL];
                Rect r=fall.area;
                float[] mesh=new float[(PetHoodHold.COLS+1)*(PetHoodHold.ROWS+1)*2];
                PetHoodHold.hoodMesh(mesh,r.left,r.top,r.width(),r.height());
                Bitmap hanging=Bitmap.createBitmap(FRAME_WIDTH,FRAME_HEIGHT,Bitmap.Config.ARGB_8888);
                new Canvas(hanging).drawBitmapMesh(fall.bitmap,PetHoodHold.COLS,PetHoodHold.ROWS,
                    mesh,0,null,0,new Paint(Paint.FILTER_BITMAP_FLAG));
                hanging.prepareToDraw();
                Bitmap chairArt=loadFullSprite("chair");
                Bitmap watchArt=loadFullSprite("watch_seat");
                PetPlayArt art=new PetPlayArt(context.getAssets());
                handler.post(()->{
                    if(destroyed)return;
                    loadingArt=false;
                    hangingBitmap=hanging;
                    chairBitmap=chairArt;
                    watchBitmap=watchArt;
                    frames=atlas;
                    airArt=flight;
                    rearFrames=back;
                    playArt=art;
                    sync();
                });
            }catch(IOException|RuntimeException error){
                android.util.Log.w("EvaPet","Could not load avatar art",error);
                handler.post(()->{loadingArt=false;artFailed=true;});
            }
        });
    }

    private Bitmap loadFullSprite(String name)throws IOException{
        try(InputStream in=context.getAssets().open("eva-pet/"+name+".png")){
            Bitmap art=BitmapFactory.decodeStream(in);
            if(art==null||art.getWidth()!=FRAME_WIDTH||art.getHeight()!=FRAME_HEIGHT)
                throw new IOException("Incorrect sprite size: "+name);
            art.prepareToDraw();
            return art;
        }
    }

    private Frame[] loadFrames(Frame[] back) throws IOException {
        Map<String,Rect> positions=new HashMap<>();
        try(BufferedReader reader=new BufferedReader(new InputStreamReader(
                context.getAssets().open("eva-pet/frames.tsv"),StandardCharsets.US_ASCII))){
            for(String line;(line=reader.readLine())!=null;){
                String[] parts=line.split("\t");
                if(parts.length!=5)throw new IOException("Invalid frame table");
                int left=Integer.parseInt(parts[1]),top=Integer.parseInt(parts[2]);
                int width=Integer.parseInt(parts[3]),height=Integer.parseInt(parts[4]);
                if(left<0||top<0||width<=0||height<=0||width>FRAME_WIDTH-left||height>FRAME_HEIGHT-top)
                    throw new IOException("Frame exceeds viewport");
                if(positions.put(parts[0],new Rect(left,top,left+width,top+height))!=null)
                    throw new IOException("Duplicate frame");
            }
        }
        Frame[] decoded=new Frame[PetMotion.POSE_COUNT];
        int i=0;
        for(String frame:FRAMES)decoded[i++]=loadFrame(frame,positions);
        for(String bank:GENERATED_BANKS){
            int count=bank.equals("rope_grip")?PetMotion.ROPE_GRIPS:PetMotion.GENERATED_FRAMES;
            loadBank(decoded,i,bank,0,count,positions);
            i+=count;
        }
        loadBank(decoded,PetMotion.WALK_PIVOT,"walk_pivot",0,PetMotion.WALK_PIVOTS,positions);
        loadBank(decoded,PetMotion.MANTLE_BETWEEN,"mantle_mid",0,PetMotion.MANTLE_INBETWEENS,positions);
        decoded[PetMotion.ROPE_EDGE]=decoded[PetMotion.MANTLE_LAST];
        loadBank(decoded,PetMotion.ROPE_EDGE,"rope_edge",1,PetMotion.ROPE_EDGE_KEYS,positions);
        int last=PetMotion.ROPE_KEYS-1;
        decoded[PetMotion.ROPE_MOUNT]=decoded[PetMotion.ROPE_EDGE+PetMotion.ROPE_EDGE_KEYS-1];
        loadBank(decoded,PetMotion.ROPE_MOUNT,"rope_mount",1,last,positions);
        decoded[PetMotion.ROPE_MOUNT+last]=decoded[PetMotion.ROPE_GRIP];
        decoded[PetMotion.ROPE_RELEASE]=decoded[PetMotion.ROPE_GRIP];
        loadBank(decoded,PetMotion.ROPE_RELEASE,"rope_release",1,PetMotion.ROPE_KEYS,positions);
        decoded[PetMotion.ROPE_BRAKE]=decoded[PetMotion.ROPE_GRIP];
        loadBank(decoded,PetMotion.ROPE_BRAKE,"rope_brake",1,last,positions);
        decoded[PetMotion.ROPE_BRAKE+last]=decoded[PetMotion.ROPE_GRIP];
        decoded[PetMotion.ROPE_RECOVER]=decoded[PetMotion.ROPE_RELEASE+last];
        loadBank(decoded,PetMotion.ROPE_RECOVER,"rope_recover",1,last,positions);
        decoded[PetMotion.ROPE_RECOVER+last]=decoded[PetMotion.SPRING];
        for(int key=0;key<back.length;key++)back[key]=loadFrame("rear_"+(key<10?"0":"")+key,positions);
        return decoded;
    }

    private void loadBank(Frame[] atlas,int base,String bank,int first,int end,Map<String,Rect> positions) throws IOException {
        for(int k=first;k<end;k++)atlas[base+k]=loadFrame(bank+(k<10?"_0":"_")+k,positions);
    }

    private Frame loadFrame(String name,Map<String,Rect> positions) throws IOException {
        Rect bounds=positions.get(name);
        if(bounds==null)throw new IOException("Missing frame "+name);
        try(InputStream file=context.getAssets().open("eva-pet/"+name+".png")){
            Bitmap bitmap=BitmapFactory.decodeStream(file);
            if(bitmap==null||bitmap.getWidth()!=bounds.width()||bitmap.getHeight()!=bounds.height())
                throw new IOException("Incorrect size for "+name);
            return new Frame(bitmap,bounds);
        }
    }

    private Frame artwork(){
        return frames[pose.nextFrame<0||pose.blend<.5f?pose.frame:pose.nextFrame];
    }

    private void remove() {
        resetChair();
        hideSupportMap();
        handler.removeCallbacks(appCheck);
        parked=appHidden=appParkingMove=imePassthrough=imeInset=false;
        dodgeUntil=0;
        appScene=null;
        EvaAccessibility.setPetWindowsListener(null);
        handler.removeCallbacks(windowRefresh);
        windowEdges=Collections.emptyList();
        windowTerrain=Collections.emptyList();
        ladder.detach();
        if(gravitySensor!=null)sensors.unregisterListener(gravityListener);
        handler.removeCallbacks(resize);
        choreographer.removeFrameCallback(tick);
        handler.removeCallbacks(next);
        handler.removeCallbacks(hold);
        touched=false;
        stopGame();
        clearHome();
        surface=null;
        platform=dropTarget=null;
        leftPlatform=null;
        if(sprite!=null) {
            try { if(sprite.isAttachedToWindow())windows.removeViewImmediate(sprite); }
            catch(IllegalArgumentException ignored) {}
            sprite=null;
        }
    }

    private void position(int newX,int newY) {
        position(newX,newY,false);
    }

    private void position(int newX,int newY,boolean resized) {
        x=(int)PetMotion.clamp(newX,0,maxX);
        y=(int)PetMotion.clamp(newY,0,maxY);
        if(!resized&&layout.x==x&&layout.y==y)return;
        layout.x=x;
        layout.y=y;
        try { windows.updateViewLayout(sprite,layout); }
        catch(RuntimeException e) { remove(); }
    }

    private boolean supportedSeat(boolean mirrored){
        if(surface!=null&&surface.seated&&Math.abs(surface.x-x)<=dp(3)&&Math.abs(surface.y-y)<=dp(3))return true;
        PetHomeMap.Box route=homeRoute==null?null:homeRoute.support;
        if(hipOn(route,mirrored)||hipOn(platform,mirrored))return true;
        for(PetHomeMap.Box box:windowTerrain)if(hipOn(box,mirrored))return true;
        if(parked&&appScene!=null){
            if(appScene.home){
                for(PetHomeMap.Box box:readHome())if(hipOn(box,mirrored))return true;
            }else{
                if(hipOn(appScene.editor,mirrored)||hipOn(appScene.keyboard,mirrored))return true;
                for(Rect b:appScene.buttons)if(hipOn(b,mirrored))return true;
            }
        }
        return false;
    }

    private boolean hipOn(PetHomeMap.Box box,boolean mirrored){
        return box!=null&&PetChair.hipOn(box.l,box.t,box.r,x,y,bodyWidth,bodyHeight,mirrored,dp(4));
    }

    private boolean hipOn(Rect box,boolean mirrored){
        return !box.isEmpty()&&PetChair.hipOn(box.left-contentOriginX,box.top-contentOriginY,
            box.right-contentOriginX,x,y,bodyWidth,bodyHeight,mirrored,dp(4));
    }

    private void setSeatChair(boolean mirrored){
        boolean needed=parked&&editingInApp()||!supportedSeat(mirrored);
        if(needed!=chair.deployed){
            chair.set(needed,SystemClock.uptimeMillis(),motionEnabled);
            sprite.invalidate();
        }
    }

    private void resetChair(){
        handler.removeCallbacks(finishPacking);
        afterPacking=null;
        chair.set(false,SystemClock.uptimeMillis(),false);
    }

    private boolean packBefore(Runnable resume){
        long now=SystemClock.uptimeMillis();
        if(afterPacking!=null){afterPacking=resume;return true;}
        if(!motionEnabled||!chair.deployed)return false;
        float phase=chair.phase(now);
        chair.set(false,now,true);
        if(phase<=0)return false;
        afterPacking=resume;
        handler.postDelayed(finishPacking,(long)Math.ceil(phase*PetChair.CLOSE_DURATION));
        sprite.invalidate();
        return true;
    }

    private void seatedRest(boolean direction){
        setSeatChair(direction);
        seat.begin();
        play(PetMotion.SEATED_PEEK,direction,seat.duration);
    }

    private void sitOn(PetHomeMap.Box support,boolean direction){
        crossStartY=y;
        targetX=x;
        targetY=support.t-Math.round(layout.height*PetPlacement.SEAT_CONTACT);
        play(PetMotion.PERCH_SIT,direction);
    }

    private void play(int animation,boolean direction) {
        play(animation,direction,PetMotion.duration(animation));
    }

    private void play(int animation,boolean direction,int duration) {
        if(animation!=PetMotion.SEATED_PEEK)resetChair();
        if(animation!=PetMotion.PLAY)stopGame();
        choreographer.removeFrameCallback(tick);
        handler.removeCallbacks(next);
        if(animation==PetMotion.LANDING){
            landingImpact=mode==PetMotion.GRAVITY_FALL?
                PetMotion.clamp(.42f+(y-crossStartY)/(float)dp(152),.42f,1):.57f;
        }
        turningIntoWalk=(animation==PetMotion.CROSS||animation==PetMotion.HOME_WALK)&&PetMotion.frontForWalk(pose);
        if(turningIntoWalk)duration+=PetMotion.WALK_PIVOT_MS;
        mode=animation;
        motionTime=duration;
        left=direction;
        began=SystemClock.uptimeMillis();
        mood.beginMotion(began);
        lastFrameNanos=0;
        update();
    }

    private void onFrame(long frameTimeNanos){
        if(sprite==null||touched||composerVisible)return;
        long slot=frameTimeNanos/PetMotion.FRAME_NANOS;
        if(lastFrameNanos!=0&&lastFrameNanos/PetMotion.FRAME_NANOS==slot){
            choreographer.postFrameCallback(tick);
            return;
        }
        lastFrameNanos=frameTimeNanos;
        update();
    }

    private void update() {
        if(sprite==null||touched)return;
        long now=SystemClock.uptimeMillis();
        boolean usingHome=homeRoute!=null||(dropTarget!=null&&!dropTarget.window())||
            (platform!=null&&!platform.window())||loweringFrom!=null||
            mode==PetMotion.ROPE_REACH||mode==PetMotion.ROPE_DOWN;
        if(usingHome&&now>=homeCheckAt){
            homeCheckAt=now+HOME_RECHECK_MS;
            PetHomeMap.Box contact=loweringFrom!=null?loweringFrom:
                homeRoute!=null&&(mode==PetMotion.LADDER_UP||mode==PetMotion.MANTLE_UP||mode==PetMotion.SEATED_PEEK)?homeRoute.support:
                mode==PetMotion.SEATED_PEEK&&platform!=null&&!platform.window()?platform:null;
            boolean hasContact=contact==null?EvaAccessibility.petHomeActive():homeSupports(contact);
            if(!anchorsEnabled(context)||contactExpired(hasContact,now)){returnToFloor();return;}
        }
        if(mode==PetMotion.SEATED_PEEK&&surface!=null&&now>=homeCheckAt){
            homeCheckAt=now+HOME_RECHECK_MS;
            if(!surface.sameSurface(findSurface(true),dp(8))){returnToFloor();return;}
        }
        if(mode==PetMotion.GRAVITY_FALL&&dropTarget==null&&targetY==maxY&&anchorsEnabled(context)&&now>=nextFallProbe){
            nextFallProbe=now+100;
            PetHomeMap.Box recovered=PetHomeMap.landing(groundForLanding(),x,y,layout.width,layout.height,maxY,0,leftPlatform);
            if(recovered!=null){
                dropTarget=recovered;
                moveTo(x,PetHomeMap.standY(recovered,layout.height),PetMotion.GRAVITY_FALL);
                return;
            }
        }
        int fromY=y;
        long time=now-began;
        int duration=motionTime;
        int crawlCycles=mode==PetMotion.CRAWLING?PetMotion.crawlCycles(targetX-crossStart,bodyWidth):0;
        PetMotion.sample(pose,mode,time,duration,left,crawlCycles);
        if(mode==PetMotion.SEATED_PEEK){
            seat.sample(time);
            if(seat.activity==PetSeat.Activity.DOZE)pose.frame=PetMotion.SEAT_SWING;
        }
        if(mode==PetMotion.PLAY&&prank.active()){
            if(!appAllowsPlay()||appScene==null||!appScene.home||prank.interrupted(EvaAccessibility.petLastInteraction())){
                stopGame();
                pose.frame=PetMotion.IDLE;sprite.invalidate();schedule(1200);
                return;
            }
            PetTrickTiming.gesture(gamePose,time);
            prank.update(time,gamePose);
            mood.face=PetMood.Face.WRY;mood.weight=PetTrickTiming.window(time,700,1300,5200,6300);
            if(time>2700&&time<2900)mood.prank(prank.isLabel(),now);
        }else if(mode==PetMotion.PLAY&&game!=null)updateGame(time);
        else if(mode==PetMotion.SEATED_PEEK&&seat.activity!=null)mood.seated(seat,time);
        else mood.motion(mode,PetMotion.poseTime(time),landingImpact);
        if(PetGesture.handled(mode))PetGesture.sample(gamePose,mode,PetMotion.poseTime(time),duration,mood);
        if(mode==PetMotion.LANDING)PetMotion.sampleLanding(pose,Math.min(time,duration),duration,landingImpact);
        float progress=PetMotion.clamp(time/(float)duration,0,1);
        int walkDuration=turningIntoWalk?duration-PetMotion.WALK_PIVOT_MS:duration;
        float walkProgress=turningIntoWalk?PetMotion.clamp((time-PetMotion.WALK_PIVOT_MS)/(float)walkDuration,0,1):progress;
        if(mode==PetMotion.CROSS) {
            float travel=(crossEnd-crossStart)*PetMotion.walkTravel(walkProgress,walkDuration);
            groundStride(Math.abs(travel),Math.abs(crossEnd-crossStart),time);
            position(Math.round(crossStart+travel),
                Math.round(crossStartY+(maxY-crossStartY)*PetMotion.ease(walkProgress)));
        } else if(mode==PetMotion.ENTER_SIDE||mode==PetMotion.LEAVE_SIDE){
            float outside=Math.abs(pose.shiftX);
            float travel=mode==PetMotion.ENTER_SIDE?1-outside:outside;
            groundStride(bodyWidth*travel,bodyWidth,time);
        } else if(mode==PetMotion.HOP){
            float air=PetMotion.airborne(time,duration);
            int flight=duration-PetMotion.TAKEOFF_MS-PetMotion.TOUCHDOWN_MS;
            position(Math.round(crossStart+(targetX-crossStart)*air),
                PetPhysics.jumpY(crossStartY,targetY,air,flight,density()));
        } else if(mode==PetMotion.TILT_FALL){
            if(turnInAir!=null){
                bodyAngle=turnInAir.angle(time,duration);
                placeTurningBody(turnInAir.x(progress),turnInAir.y(progress),false);
            }
        } else if(mode==PetMotion.GRAVITY_FALL||mode==PetMotion.ROPE_REACH||mode==PetMotion.SHORT_DROP){
            position(crossStart,PetPhysics.fallY(crossStartY,targetY,progress));
        } else if(mode==PetMotion.PERCH_STAND||mode==PetMotion.PERCH_SIT){
            boolean sitting=mode==PetMotion.PERCH_SIT;
            float contact=PetMotion.riseContact(PetMotion.standingAmount(progress,sitting));
            pose.shiftY=(530f-artwork().area.bottom)/540f*contact;
            position(targetX,Math.round(crossStartY+(targetY-crossStartY)*(sitting?1-contact:contact)));
        } else if(mode==PetMotion.ROPE_DOWN&&ropeDescent!=null){
            ropeDescent.sample(pose,time);
            position(ropeDescent.x,ropeDescent.y);
            ladder.loadRope(y+(pose.shiftY+artwork().area.bottom/540f)*bodyHeight,ropeDescent.swing);
        } else if(mode==PetMotion.MANTLE_DOWN&&climbTrack!=null&&ropeDescent!=null){
            float sampled=time>=duration?1:PetMotion.poseTime(time)/(float)duration;
            ropeDescent.sampleEdge(pose,climbTrack,progress,sampled);
            position(ropeDescent.x,ropeDescent.y);
        } else if((mode==PetMotion.MANTLE_UP||mode==PetMotion.MANTLE_DOWN)&&climbTrack!=null){
            PetClimb.Track track=climbTrack;
            float frameClock=track.clock(progress);
            float sampledClock=track.clock(PetMotion.clamp(PetMotion.poseTime(time)/(float)duration,0,1));
            float frame=PetMotion.mantleSample(sampledClock);
            pose.frame=PetMotion.mantleArtwork(frame);
            pose.shiftX=(PetClimb.handX(frameClock,left)-PetClimb.handX(frame,left))/402f;
            pose.shiftY=(PetMotion.mantleContactAt(frameClock)-PetMotion.mantleContactAt(frame))/540f;
            PetMotion.Position point=track.position(progress);
            position(point.x,point.y);
        } else if(mode==PetMotion.LADDER_UP&&ascent!=null){
            ascent.sample(ladderPose,time,duration);
            position(ladderPose.x,ladderPose.y);
        } else if(mode==PetMotion.PLACE_LADDER&&ascent!=null){
            ladderPose.mesh=false;
            ladderPose.insetY=0;
            ladderPose.key=Math.round(PetLadderMotion.REAR_KEY*PetMotion.ease(progress));
        } else if(mode==PetMotion.CRAWLING||mode==PetMotion.HOME_WALK){
            float travel=mode==PetMotion.CRAWLING?PetMotion.crawlTravel(progress,duration):progress;
            float ease=mode==PetMotion.HOME_WALK?
                PetMotion.walkTravel(walkProgress,walkDuration):PetMotion.travel(travel);
            if(mode==PetMotion.HOME_WALK)
                groundStride(Math.abs((targetX-crossStart)*ease),Math.abs(targetX-crossStart),time);
            position(Math.round(crossStart+(targetX-crossStart)*ease),
                Math.round(crossStartY+(targetY-crossStartY)*ease));
        }
        if(sprite==null)return;
        if(!appParkingMove&&y>fromY&&!windowTerrain.isEmpty()&&physicalDown==PetGravity.DOWN&&
            (mode==PetMotion.HOP||mode==PetMotion.GRAVITY_FALL||mode==PetMotion.SHORT_DROP)){
            PetHomeMap.Box hit=PetHomeMap.landing(windowTerrain,x,fromY,layout.width,layout.height,maxY,0,null);
            if(hit!=null&&PetHomeMap.standY(hit,layout.height)<=y){
                standOnWindow(hit,x);
                return;
            }
        }
        sprite.invalidate();
        if(time>=duration)completeAnimation();
        else if(mode==PetMotion.SEATED_PEEK)choreographer.postFrameCallbackDelayed(tick,25);
        else choreographer.postFrameCallback(tick);
    }

    private void groundStride(float distance,float total,long time){
        if(turningIntoWalk)PetMotion.depart(pose,time,distance,total,bodyWidth);
        else PetMotion.groundStride(pose,distance,bodyWidth,PetMotion.strideStart(total,bodyWidth));
    }

    private void completeAnimation() {
        if(appParkingMove){
            appParkingMove=false;
            displayAppRest();
            return;
        }

        if(homeRoute!=null&&homeSatAt==0){
            if(homeStep<homeRoute.steps.size()){
                int pause=PetMotion.beforeRouteStep(homeRoute.steps.get(homeStep).mode);
                if(mode==PetMotion.HOP)pause=Math.max(pause,340);
                if(pause>0){
                    handler.postDelayed(homeAdvance,pause);
                    return;
                }
            }
            advanceHome();
            return;
        }
        if(dropTarget!=null&&(mode==PetMotion.HOP||mode==PetMotion.ROPE_DOWN||mode==PetMotion.GRAVITY_FALL||mode==PetMotion.SHORT_DROP)){
            finishDrop(left);
            return;
        }
        switch(mode) {
            case PetMotion.LEAVE_SIDE:
                atLeft=!atLeft;
                position(atLeft?0:maxX,maxY);
                if(sprite!=null)play(PetMotion.ENTER_SIDE,!atLeft);
                break;
            case PetMotion.CROSS:
                atLeft=left;
                schedule(260);
                break;
            case PetMotion.TILT_FALL:
                finishAirTurn();
                break;
            case PetMotion.PLAY:
                if(appAllowsPlay()&&stories.advance()){
                    startAct(stories.act(),left,false);
                    return;
                }
                stopGame();
                schedule(1100);
                break;
            case PetMotion.ROPE_SETTLE:
                pose.frame=PetMotion.SPRING;
                schedule(450);
                break;
            case PetMotion.GRAVITY_FALL:
            case PetMotion.ROPE_DOWN:
                finishDrop(left);
                break;
            case PetMotion.SHORT_DROP:
                ladder.hide();
                play(PetMotion.LANDING,left);
                break;
            case PetMotion.ROPE_REACH:
            case PetMotion.MANTLE_DOWN:
                climbTrack=null;
                if(ropeDescent!=null)play(PetMotion.ROPE_DOWN,left,ropeDescent.duration);
                else finishDrop(left);
                break;
            case PetMotion.HOP:
                if(surface==null&&y==maxY){
                    schedule(900);
                    break;
                }
                if(surface==null||!surface.sameSurface(findSurface(surface.seated),dp(8))){
                    returnToFloor();
                    break;
                }
                perchedAt=SystemClock.uptimeMillis();
                settle();
                break;
            case PetMotion.LANDING:
                schedule(platform==null?2600:1800);
                break;
            case PetMotion.HOME_WALK:
            case PetMotion.PERCH_STAND:
            case PetMotion.PERCH_SIT:
            case PetMotion.PERCH_LOOK:
            case PetMotion.SEATED_PEEK:
                schedule(450);
                break;
            case PetMotion.IDLE_BOOK:
            case PetMotion.IDLE_TEA:
            case PetMotion.IDLE_WINK:
            case PetMotion.IDLE_YAWN:
                schedule(4900);
                break;
            case PetMotion.EDGE_LEAN:
            case PetMotion.ENTER_SIDE:
            case PetMotion.LOOK_AROUND:
                schedule(600);
                break;
            case PetMotion.ENTER_BOTTOM:
                schedule(4300);
                break;
            default:
                schedule(7400);
        }
    }

    private void schedule(long delay) {
        handler.removeCallbacks(next);
        if(motionEnabled&&sprite!=null)handler.postDelayed(next,delay);
    }

    private void nextBehavior() {
        if(sprite==null||touched)return;
        if(!Settings.canDrawOverlays(context)||keyguard.isKeyguardLocked()||!power.isInteractive()) {
            remove();
            return;
        }
        if(mode==PetMotion.SEATED_PEEK&&!parked&&packBefore(next))return;
        if(appBehavior())return;
        if(physicalDown!=PetGravity.DOWN){schedule(2100);return;}
        if(pendingWorkGesture!=0&&appAllowsPlay()&&platform==null&&homeRoute==null&&surface==null&&y==maxY){
            int notice=pendingWorkGesture;
            pendingWorkGesture=0;
            play(notice==1?PetMotion.GREET:PetMotion.EDGE_LEAN,pose.mirrored);
            return;
        }
        if(startPrank())return;
        if(mode==PetMotion.CROSS){play(PetMotion.EDGE_LEAN,atLeft);return;}
        if(homeRoute!=null){
            if(!homeSupports(homeRoute.support))waitForHomeContact();
            else if(mode!=PetMotion.SEATED_PEEK)seatedRest(pose.mirrored);
            else leaveSeat();
            return;
        }
        if(platform!=null){
            if(platform.window())onWindowPlatform();else continueOnPlatform();
            return;
        }
        if(surface!=null){
            long elapsed=SystemClock.uptimeMillis()-perchedAt;
            if(mode==PetMotion.SEATED_PEEK||elapsed>4200||!surface.sameSurface(findSurface(surface.seated),dp(8)))
                returnToFloor();
            else settle();
            return;
        }
        if(y!=maxY){returnToFloor();return;}
        if(maxX==0){play(PetMotion.LOOK_AROUND,false);return;}
        if(gameReady()){playGame(false);return;}
        if(!homeTried){
            homeTried=true;
            if(beginHome())return;
        }
        switch(idle.next()){
            case BOOK: play(PetMotion.IDLE_BOOK,false);break;
            case TEA: play(PetMotion.IDLE_TEA,false);break;
            case WINK: play(PetMotion.IDLE_WINK,false);break;
            case YAWN: play(PetMotion.IDLE_YAWN,false);break;
            case STRETCH: play(PetMotion.STRETCHING,false);break;
            case JUMP:
                startHop(x,maxY,PetPhysics.jumpTimeForRise(dp(24),density()),pose.mirrored);
                break;
            case CLIMB:
                if(!beginHome()){
                    if(x==0||x==maxX)play(PetMotion.EDGE_LEAN,x==0);
                    else walkAcross();
                }
                break;
            case SURFACE:
                if(beginHome())break;
                PetPlacement candidate=findSurface(preferSeat);
                if(candidate==null)candidate=findSurface(!preferSeat);
                preferSeat=!preferSeat;
                if(candidate!=null){
                    surface=candidate;
                        if(candidate.seated&&y-candidate.y<=dp(76))moveTo(candidate.x,candidate.y,PetMotion.HOP);
                        else {surface=null;walkAcross();}
                }else walkAcross();
                break;
            case EXIT:
                if(x==0||x==maxX){
                    atLeft=x==0;
                    play(PetMotion.LEAVE_SIDE,!atLeft);
                }else walkAcross();
                break;
            case WALK:
                walkAcross();
                break;
            default:
                throw new AssertionError("Unknown idle behavior");
        }
    }

    private boolean appAllowsPlay(){
        return !parked&&!appHidden&&appPolicy==PetAppProfiles.AUTO&&
            (appScene==null||!appScene.editing&&!appScene.video);
    }

    private void refreshAppScene(){
        handler.removeCallbacks(appCheck);
        if(sprite==null||suspended||composerVisible||!anchorsEnabled(context))return;
        PetAppScene previous=appScene;
        appScene=EvaAccessibility.petAppScene();
        if(appScene!=null)PetAppProfiles.seen(appScene.app);
        appPolicy=appScene==null?PetAppProfiles.AUTO:PetAppProfiles.get(context,appScene.app);
        if(!touched){
            boolean editing=editingInApp();
            int[] keyboardTarget=editing?appScene.keyboardParking(contentOriginX,contentOriginY,worldWidth,worldHeight,
                bodyWidth,bodyHeight,x,windowEdges):null;
            boolean hidden=appPolicy==PetAppProfiles.HIDE||editing&&keyboardTarget==null;
            if(hidden!=appHidden){
                appHidden=hidden;
                sprite.setVisibility(hidden?View.INVISIBLE:View.VISIBLE);
                if(hidden)interruptAppMotion();
                else if(!parked)returnFromAppMode();
            }
            if(!hidden){
                boolean watch=watchingPlayer();
                long now=SystemClock.uptimeMillis();
                long input=EvaAccessibility.petLastInteraction();
                if(previous==null||appScene==null||!previous.app.equals(appScene.app))dodgeUntil=0;
                if(appScene!=null&&!appScene.home&&input!=lastDodgeInput&&now-input<1900&&
                    !appParkingMove){
                    android.graphics.Rect occupied=new android.graphics.Rect(contentOriginX+x,contentOriginY+y,
                        contentOriginX+x+bodyWidth,contentOriginY+y+bodyHeight);
                    for(android.graphics.Rect button:appScene.buttons){
                        if(android.graphics.Rect.intersects(occupied,button)){lastDodgeInput=input;dodgeUntil=now+2700;break;}
                    }
                }
                boolean rest=appScene!=null&&(watch||editing||appPolicy==PetAppProfiles.QUIET||
                    !appScene.home&&now<dodgeUntil);
                if(rest){
                    int[] target=editing?keyboardTarget:appScene.parking(contentOriginX,contentOriginY,worldWidth,worldHeight,
                        bodyWidth,bodyHeight,watch,x);
                    boolean settledOnChair=editing&&parked&&!appParkingMove&&chair.deployed&&x==target[0];
                    if(settledOnChair&&y!=target[1])position(x,target[1]);
                    else if(!parked||(!appParkingMove&&(Math.abs(x-target[0])>dp(4)||Math.abs(y-target[1])>(editing?0:dp(4))))
                        ||appParkingMove&&(target[0]!=targetX||target[1]!=targetY))parkApp(target);
                    else if(!appParkingMove&&afterPacking==null){
                        if(appNeedsSeat()!=(mode==PetMotion.SEATED_PEEK)){
                            if(!packBefore(this::displayAppRest))displayAppRest();
                        }else if(appNeedsSeat()){
                            updateAppSeatDirection();
                            setSeatChair(pose.mirrored);
                            sprite.invalidate();
                        }
                    }
                }else if(parked){
                    returnFromAppMode();
                }else if(appScene!=null&&!appScene.home&&previous!=null&&!appScene.app.equals(previous.app)){
                    nextAppGesture=0;
                }
            }
        }
        if(sprite!=null)handler.postDelayed(appCheck,parked?2400:4400);
    }

    private void interruptAppMotion(){
        resetChair();
        handler.removeCallbacks(next);
        choreographer.removeFrameCallback(tick);
        clearHome();
        stopGame();
        platform=dropTarget=leftPlatform=null;
        surface=null;
        turnInAir=null;
        physicalDown=PetGravity.DOWN;
        bodyAngle=0;
        appParkingMove=false;
        if(setBodyBounds())position(x,y,true);
    }

    private void returnFromAppMode(){
        if(sprite==null||packBefore(this::returnFromAppMode))return;
        parked=false;
        interruptAppMotion();
        // A pause should end when a film/app closes, including with reduced motion.
        returnToFloor();
    }

    private void parkApp(int[] destination){
        if(packBefore(()->parkApp(destination)))return;
        parked=true;
        interruptAppMotion();
        if(sprite==null)return;
        if(!motionEnabled||x==destination[0]&&y==destination[1]){
            position(destination[0],destination[1]);
            displayAppRest();
            return;
        }
        crossStart=x;crossStartY=y;
        targetX=destination[0];targetY=destination[1];
        appParkingMove=true;
        if(editingInApp()&&Math.abs(targetY-y)>dp(10)){
            int flight=Math.min(670,PetPhysics.jumpTime(targetY-y,Math.abs(targetX-x),density()));
            play(PetMotion.HOP,targetX==x?pose.mirrored:targetX<x,
                PetMotion.TAKEOFF_MS+flight+PetMotion.TOUCHDOWN_MS);
            return;
        }
        play(PetMotion.HOME_WALK,targetX<x,Math.max(330,Math.min(1200,
            Math.round((float)Math.hypot(targetX-x,targetY-y)/density()*2.3f))));
    }

    private boolean editingInApp(){
        return appScene!=null&&appScene.editing;
    }

    private boolean watchingPlayer(){
        return appScene!=null&&!editingInApp()&&(appScene.video||appPolicy==PetAppProfiles.WATCH);
    }

    private void updateAppSeatDirection(){
        int lookX=appScene==null||appScene.player.isEmpty()?contentOriginX+worldWidth/2:appScene.player.centerX();
        pose.mirrored=lookX<contentOriginX+x+bodyWidth/2;
    }

    private boolean appNeedsSeat(){
        return editingInApp()||watchingPlayer()||appPolicy==PetAppProfiles.QUIET;
    }

    private void displayAppRest(){
        if(sprite==null)return;
        boolean sit=appNeedsSeat();
        mode=sit?PetMotion.SEATED_PEEK:PetMotion.LOOK_AROUND;
        pose.frame=sit?PetMotion.SEAT_SWING:PetMotion.IDLE;
        pose.seatedPivot=sit;
        pose.nextFrame=-1;pose.shiftX=pose.shiftY=pose.angle=0;
        updateAppSeatDirection();
        mood.clear();
        if(sit)setSeatChair(pose.mirrored);else resetChair();
        sprite.invalidate();
    }

    private boolean appBehavior(){
        if(parked||appHidden)return true;
        if(appScene==null||appScene.home||physicalDown!=PetGravity.DOWN||!motionEnabled||
            homeRoute!=null||turnInAir!=null||dropTarget!=null||SystemClock.uptimeMillis()<nextAppGesture)return false;
        if(platform==null&&y!=maxY)return false;
        if(platform!=null&&!platform.window())return false;
        android.graphics.Rect button=appScene.nearbyButton(contentOriginX+x+bodyWidth/2,
            contentOriginY+y+bodyHeight/2,bodyWidth,bodyHeight);
        nextAppGesture=SystemClock.uptimeMillis()+9000;
        if(button!=null&&(appVisits++&1)==0){
            // Leave the preceding procedural gesture before selecting a painted pose.
            mode=PetMotion.PERCH_LOOK;
            pose.airPhase=-1;
            pose.frame=PetMotion.POINT;pose.nextFrame=-1;
            pose.shiftX=pose.shiftY=pose.angle=0;pose.mirrored=button.centerX()<contentOriginX+x+bodyWidth/2;
            mood.clear();sprite.invalidate();schedule(2100);
        }else{
            int dest=platform==null?(x>maxX/2?0:maxX):PetWindowGround.walkGoal(platform,x,layout.width,maxX);
            if(Math.abs(dest-x)<dp(10))return false;
            int step=Math.min(Math.abs(dest-x),dp(84));
            moveTo(x+(dest<x?-step:step),y,PetMotion.CRAWLING);
        }
        return true;
    }

    private void walkAcross(){
        crossStart=x;
        crossStartY=y;
        boolean toLeft=x>maxX/2;
        crossEnd=toLeft?0:maxX;
        play(PetMotion.CROSS,toLeft,PetMotion.displacementTime(PetMotion.CROSS,(crossEnd-crossStart)/density()));
    }

    private boolean gameReady(){return playArt!=null&&SystemClock.uptimeMillis()>=nextGameAt;}

    private boolean startPrank(){
        long now=SystemClock.uptimeMillis(),input=Math.max(lastPetTouch,EvaAccessibility.petLastInteraction());
        if(appScene==null||!appScene.home||!appAllowsPlay()||!motionEnabled||!anchorsEnabled(context)||
            now-input<PetTrickTiming.IDLE_MS||homeRoute!=null&&homeSatAt==0||surface!=null||
            platform==null&&homeRoute==null&&y!=maxY||!EvaAccessibility.petHomeActive()||readHome().isEmpty())return false;
        if(!prank.start(now,input,EvaAccessibility.petPrankTiles(),contentOriginX,contentOriginY,
                x,y,layout.width,layout.height,worldWidth,worldHeight))return false;
        play(PetMotion.PLAY,prank.left,PetTrickTiming.DURATION);
        return true;
    }

    private void playGame(boolean edge){
        playGame(edge,false);
    }

    private void playGame(boolean edge,boolean prompted){
        stopGame();
        boolean story=!prompted&&appAllowsPlay()&&stories.start(SystemClock.uptimeMillis());
        PetPlay.Act act=story?stories.act():games.next(edge);
        boolean faceLeft=edge&&!act.ball()&&act!=PetPlay.Act.PLANE?perchLeft:x>maxX/2;
        startAct(act,faceLeft,prompted);
    }

    private void startAct(PetPlay.Act act,boolean faceLeft,boolean prompted){
        toys.reset();
        game=act;
        gameTime=0;
        toyTerrain=Collections.emptyList();
        storyLineShown=false;
        mood.scene(prompted);
        checkTerrainAt=0;
        nextGameAt=SystemClock.uptimeMillis()+game.duration+11500;
        play(PetMotion.PLAY,faceLeft,game.duration);
    }

    private void stopGame(){
        prank.stop();
        if(stories.active!=null){
            if(stories.line().equals(mood.quip))mood.clear();
            stories.cancel();
        }
        if(game==null)return;
        game=null;
        toyTerrain=Collections.emptyList();
        toys.reset();
        mood.endGame();
    }

    private void updateGame(long elapsed){
        gameTime=elapsed;
        PetPlay.sample(gamePose,game,elapsed);
        if(game.ball()&&elapsed>=checkTerrainAt){
            checkTerrainAt=elapsed+800;
            toyTerrain=groundForLanding();
        }
        if(game.release!=0&&elapsed>=game.release){
            float localX=gamePose.worldHandX(),localY=gamePose.worldHandY();
            toys.update(game,playArt,elapsed,x+layout.width*(left?1-localX/402:localX/402),y+layout.height*localY/540,
                x+layout.width/2f,y+layout.height*PetHomeMap.SOLE_CONTACT,left,
                worldWidth,worldHeight,density(),toyTerrain);
            if(game==PetPlay.Act.DRIBBLE)gamePose.kick=toys.kickPose(PetMotion.poseTime(elapsed));
        }
        if(stories.active!=null&&!storyLineShown&&elapsed>=stories.lineAt())
            storyLineShown=mood.sayLine(stories.line(),SystemClock.uptimeMillis());
        toys.expression(mood,game,PetMotion.poseTime(elapsed),stories.active==null);
        if(mood.face==PetMood.Face.WRY)gamePose.lean-=2*mood.weight;
        else if(mood.face==PetMood.Face.SURPRISED){
            gamePose.lean-=3*mood.weight;
            gamePose.sink+=3*mood.weight;
        }
    }

    private void windowsChanged(){
        if(sprite==null||!sprite.isAttachedToWindow())return;
        handler.removeCallbacks(windowRefresh);
        handler.post(windowRefresh);
    }

    private void updateImeInteraction(boolean ime){
        if(sprite==null||layout==null||imePassthrough==ime)return;
        imePassthrough=ime;
        if(ime){
            layout.flags|=WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE;
            float maximum=.8f;
            if(Build.VERSION.SDK_INT>=31){
                android.hardware.input.InputManager input=context.getSystemService(android.hardware.input.InputManager.class);
                if(input!=null)maximum=input.getMaximumObscuringOpacityForTouch();
            }
            layout.alpha=Math.min(.76f,maximum);
            hideSupportMap();
        }else{
            layout.flags&=~WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE;
            layout.alpha=1;
        }
        if(sprite.isAttachedToWindow())position(x,y,true);
    }

    private void refreshWindowTerrain(){
        if(sprite==null||sprite.getWidth()==0||layout==null)return;
        if(!originReady){
            sprite.getLocationOnScreen(origin);
            contentOriginX=origin[0]-x;
            contentOriginY=origin[1]-y;
            originReady=true;
        }
        List<PetWindows.Edge> exposed=EvaAccessibility.petWindows(
            Display.DEFAULT_DISPLAY,contentOriginX,contentOriginY,worldWidth,worldHeight,
            Math.max(2,Math.round(bodyWidth*.2f)));
        boolean ime=imeInset||EvaAccessibility.petImeVisible();
        boolean keyboardChanged=ime!=imePassthrough;
        updateImeInteraction(ime);
        if(sprite==null)return;
        boolean anchors=anchorsEnabled(context);
        List<PetWindows.Edge> edges=anchors?exposed:Collections.emptyList();
        boolean terrainChanged=!edges.equals(windowEdges);
        if(anchors&&(keyboardChanged||terrainChanged)){
            handler.removeCallbacks(appCheck);
            handler.postDelayed(appCheck,160);
        }
        if(android.util.Log.isLoggable("EvaPetBounds",android.util.Log.DEBUG)){
            android.util.Log.d("EvaPetBounds","rot="+rotation+" viewport="+contentOriginX+","+contentOriginY+
                " "+worldWidth+"x"+worldHeight+" down="+physicalDown+" edges="+edges.size()+
                " firstTop="+(edges.isEmpty()?-1:edges.get(0).t)+" foot="+
                (contentOriginY+y+Math.round(layout.height*PetHomeMap.SOLE_CONTACT)));
        }
        if(!terrainChanged)return;
        windowEdges=edges;
        List<PetHomeMap.Box> previousTerrain=windowTerrain;
        windowTerrain=PetWindowGround.local(edges,contentOriginX,contentOriginY);
        if(touched||parked||appHidden||composerVisible||physicalDown!=PetGravity.DOWN||turnInAir!=null)return;

        PetHomeMap.Box under=PetWindowGround.covering(windowTerrain,x,y,layout.width,layout.height);
        if(platform!=null&&platform.window()){
            PetHomeMap.Box tracked=PetWindowGround.track(previousTerrain,windowTerrain,platform,x,layout.width);
            if(tracked!=null&&PetHomeMap.standY(tracked,layout.height)<0)tracked=null;
            if(under!=null&&tracked!=null&&under.windowId!=tracked.windowId&&under.t<tracked.t){
                standOnWindow(under,x);
            }else if(tracked==null){
                if(under!=null)standOnWindow(under,x);else returnToFloor();
            }else if(!tracked.same(platform,0)){
                int carriedX=PetWindowGround.carryX(platform,tracked,x,layout.width,maxX);
                int standY=PetHomeMap.standY(tracked,layout.height);
                if(mode==PetMotion.HOME_WALK){
                    crossStart=PetWindowGround.carryX(platform,tracked,crossStart,layout.width,maxX);
                    targetX=PetWindowGround.carryX(platform,tracked,targetX,layout.width,maxX);
                    crossStartY=targetY=standY;
                }
                int carriedY=standY;
                if(mode==PetMotion.SEATED_PEEK){
                    carriedY=tracked.t-Math.round(layout.height*PetPlacement.SEAT_CONTACT);
                    if(carriedY>maxY){standOnWindow(tracked,carriedX);return;}
                }else if(mode==PetMotion.PERCH_STAND||mode==PetMotion.PERCH_SIT){
                    int dy=tracked.t-platform.t;
                    targetX=carriedX;crossStartY+=dy;targetY+=dy;carriedY=y+dy;
                    if(carriedY>maxY||targetY>maxY){standOnWindow(tracked,carriedX);return;}
                }
                platform=tracked;
                checkTerrainAt=0;
                position(carriedX,carriedY);
            }
        }else if(under!=null){
            standOnWindow(under,x);
        }else if(mode==PetMotion.GRAVITY_FALL||dropTarget!=null&&dropTarget.window()){
            returnToFloor();
        }
    }

    private void standOnWindow(PetHomeMap.Box support,int horizontal){
        clearHome();
        surface=null;
        leftPlatform=dropTarget=null;
        platform=support;
        perchPhase=0;
        position(horizontal,PetHomeMap.standY(support,layout.height));
        if(sprite==null)return;
        if(motionEnabled)play(PetMotion.LANDING,pose.mirrored);
        else {
            pose.frame=PetMotion.IDLE;pose.nextFrame=-1;pose.shiftX=pose.shiftY=0;
            sprite.invalidate();
        }
    }

    private void onWindowPlatform(){
        if(!anchorsEnabled(context)){returnToFloor();return;}
        if(mode==PetMotion.PERCH_SIT){seatedRest(left);return;}
        if(mode==PetMotion.SEATED_PEEK){
            moveTo(x,PetHomeMap.standY(platform,layout.height),PetMotion.PERCH_STAND);
            return;
        }
        int phase=perchPhase++%3;
        if(phase==0){
            int end=PetWindowGround.walkGoal(platform,x,layout.width,maxX);
            if(Math.abs(x-end)>dp(12)){moveTo(end,y,PetMotion.HOME_WALK);return;}
        }
        perchLeft=x+layout.width/2-platform.l<=platform.r-(x+layout.width/2);
        int sittingY=platform.t-Math.round(layout.height*PetPlacement.SEAT_CONTACT);
        if(phase==2&&sittingY>=0&&sittingY<=maxY){
            sitOn(platform,perchLeft);
            return;
        }
        if(phase==1)play(PetMotion.PERCH_LOOK,perchLeft);
        else if(gameReady())playGame(true);
        else play(PetMotion.IDLE_TEA,pose.mirrored);
    }

    private List<PetHomeMap.Box> groundForLanding(){
        List<PetHomeMap.Box> home=readHome();
        if(!anchorsEnabled(context)||windowTerrain.isEmpty())return home;
        if(home.isEmpty())return windowTerrain;
        List<PetHomeMap.Box> ground=new ArrayList<>(windowTerrain);
        ground.addAll(home);
        return ground;
    }

    private List<PetHomeMap.Box> readHome(){
        if(!anchorsEnabled(context)||sprite==null)return new ArrayList<>();
        try{
            List<PetHomeMap.Box> raw=EvaAccessibility.petHome();
            if(raw==null)return new ArrayList<>();
            if(!originReady){
                sprite.getLocationOnScreen(origin);
                contentOriginX=origin[0]-x;
                contentOriginY=origin[1]-y;
                originReady=true;
            }
            int left=contentOriginX,top=contentOriginY,width=maxX+layout.width,height=maxY+layout.height;
            List<PetHomeMap.Box> local=new ArrayList<>();
            for(PetHomeMap.Box box:raw){
                int l=Math.max(0,box.l-left),t=Math.max(0,box.t-top);
                int r=Math.min(width,box.r-left),b=Math.min(height,box.b-top);
                if(r>l&&b>t)local.add(new PetHomeMap.Box(box.kind,l,t,r,b));
            }
            String measured=PetHomeMap.encode(local,width,height);
            android.content.SharedPreferences memory=context.getSharedPreferences("eva_home_layout",0);
            String key=rotation==0?"honor_home":"honor_home_rotation_"+rotation;
            String remembered=memory.getString(key,"");
            if(!measured.equals(remembered)){
                memory.edit().putString(key,measured).apply();
                remembered=measured;
            }
            List<PetHomeMap.Box> result=PetHomeMap.decode(remembered,width,height);
            String manualKey=PetLearnedEdges.key(rotation,EvaAccessibility.measuredHomePage());
            if(manualKey!=null){
                List<PetHomeMap.Box> learned=PetHomeMap.decode(memory.getString(manualKey,""),width,height);
                for(PetHomeMap.Box edge:learned)
                    if(!PetLearnedEdges.duplicate(result,edge,dp(4)))result.add(edge);
            }
            return result;
        }catch(RuntimeException e){
            android.util.Log.d("EvaPet","Home geometry unavailable",e);
            return new ArrayList<>();
        }
    }

    private PetMapView mapView;
    private int mapAttempts;
    private final Runnable showSupportMap=this::displaySupportMap;

    void requestSupportMap(){
        // The chat Activity finishes first so the captured page is the caller's.
        handler.removeCallbacks(showSupportMap);
        mapAttempts=0;
        handler.postDelayed(showSupportMap,250);
    }

    private void hideSupportMap(){
        if(mapView!=null){
            try{windows.removeViewImmediate(mapView);}catch(IllegalArgumentException ignored){}
            mapView=null;
        }
    }

    private void displaySupportMap(){
        if(destroyed||keyguard.isKeyguardLocked()||!power.isInteractive())return;
        if(sprite==null||suspended||!sprite.isAttachedToWindow()){
            if(++mapAttempts<12)handler.postDelayed(showSupportMap,150);
            return;
        }
        hideSupportMap();
        if(!anchorsEnabled(context)||!EvaAccessibility.enabled()){
            android.widget.Toast.makeText(context,"Включи опоры и службу Евы в специальных возможностях",android.widget.Toast.LENGTH_LONG).show();return;
        }
        final int turn=rotation,width=worldWidth,height=worldHeight;
        List<PetHomeMap.Box> all=readHome();
        final String pageKey=PetLearnedEdges.key(turn,EvaAccessibility.measuredHomePage());
        android.content.SharedPreferences memory=context.getSharedPreferences("eva_home_layout",0);
        List<PetHomeMap.Box> manual=PetHomeMap.decode(pageKey==null?"":memory.getString(pageKey,""),width,height);
        List<PetHomeMap.Box> outlines=new ArrayList<>(windowTerrain);
        for(PetHomeMap.Box edge:all)if(!PetLearnedEdges.duplicate(manual,edge,dp(4)))outlines.add(edge);
        mapView=new PetMapView(windowContext,outlines,manual,pageKey!=null,
            Math.max(dp(20),Math.round(bodyWidth*.18f)),new PetMapView.Actions(){
                public void close(){hideSupportMap();}
                public boolean current(){
                    return rotation==turn&&worldWidth==width&&worldHeight==height&&pageKey!=null;
                }
                private void commit(String encoded){
                    memory.edit().putString(pageKey,encoded).apply();
                    homeCheckAt=0;
                }
                public void save(List<PetHomeMap.Box> edges){
                    String encoded=PetLearnedEdges.encode(edges,width,height);
                    int page=EvaAccessibility.currentWorkspacePage();
                    if(pageKey.equals(PetLearnedEdges.key(turn,page))){
                        commit(encoded);return;
                    }
                    // A touchable map can conceal the workspace's accessibility node.
                    // Recheck after dismissing it, before applying the edit.
                    hideSupportMap();
                    handler.postDelayed(()->{
                        boolean restored=!destroyed&&current()&&pageKey.equals(PetLearnedEdges.key(turn,EvaAccessibility.currentWorkspacePage()));
                        if(restored)commit(encoded);
                        android.widget.Toast.makeText(context,restored?"Карта опор сохранена":"Страница изменилась. Открой карту ещё раз",
                            android.widget.Toast.LENGTH_SHORT).show();
                    },200);
                }
            });
        int type=Build.VERSION.SDK_INT>=26?WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY:WindowManager.LayoutParams.TYPE_PHONE;
        WindowManager.LayoutParams params=new WindowManager.LayoutParams(width,height,type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,PixelFormat.TRANSLUCENT);
        params.gravity=Gravity.TOP|Gravity.LEFT;params.setTitle("Карта опор Евы");
        try{windows.addView(mapView,params);}catch(RuntimeException unavailable){mapView=null;}
    }

    private boolean beginHome(){
        List<PetHomeMap.Box> measured=readHome();
        PetHomeMap.Route planned=PetHomeMap.plan(measured,x,layout.width,layout.height,maxX,maxY,homeTurn++);
        if(planned==null)return false;
        beginRoute(planned,measured);
        return true;
    }

    private void beginRoute(PetHomeMap.Route planned,List<PetHomeMap.Box> measured){
        homeRoute=planned;
        plannedHome=measured;
        homeStep=0;
        homeSatAt=0;
        homeCheckAt=0;
        advanceHome();
    }

    private boolean homeSupports(PetHomeMap.Box target){
        for(PetHomeMap.Box box:target.window()?windowTerrain:readHome())if(target.same(box,dp(5)))return true;
        return false;
    }

    private boolean contactExpired(boolean visible,long now){
        if(visible){homeMissingSince=0;return false;}
        if(homeMissingSince==0)homeMissingSince=now;
        return now-homeMissingSince>=HOME_GRACE_MS;
    }

    private void waitForHomeContact(){
        if(!anchorsEnabled(context)||contactExpired(false,SystemClock.uptimeMillis()))returnToFloor();
        else schedule(HOME_RECHECK_MS);
    }

    private void leaveSeat(){
        PetHomeMap.Box support=homeRoute.support;
        List<PetHomeMap.Box> boxes=readHome();
        int w=layout.width,h=layout.height,stand=PetHomeMap.standY(support,h);
        boolean higher=stand>=0&&(PetHomeMap.jumpHigher(boxes,support,x,stand,w,h,maxX,density(),leftPlatform)!=null||
            PetHomeMap.climbHigher(boxes,support,x,stand,w,h,maxX,leftPlatform)!=null);
        if(higher||!lowerFromSeat(support,homeRoute.left,boxes))standOnPlatform(support);
    }

    private boolean lowerFromSeat(PetHomeMap.Box support,boolean direction,List<PetHomeMap.Box> boxes){
        int w=layout.width,h=layout.height;
        PetHomeMap.Descent route=PetHomeMap.descent(boxes,support,x,y,w,h,maxX,maxY,direction,dp(4));
        if(route==null||route.support==null){
            PetHomeMap.Descent other=PetHomeMap.descent(boxes,support,x,y,w,h,maxX,maxY,!direction,dp(4));
            if(route==null||(other!=null&&other.support!=null))route=other;
        }
        if(route==null||(route.support==null&&PetHomeMap.hasNearbyLowerSupport(boxes,support,w,h)))return false;
        int sole=route.bottom+Math.round(h*PetHomeMap.SOLE_CONTACT);
        clearHome();
        if(route.usesRope()&&!ladder.showRope(route.track.edge,support.t,sole,route.track.left))return false;
        platform=null;
        leftPlatform=loweringFrom=support;
        dropTarget=route.support;
        climbTrack=route.track;
        ropeDescent=route.usesRope()?new PetRopeMotion(route.track.edge,support.t,route.bottom,w,h,route.track.left):null;
        play(PetMotion.MANTLE_DOWN,route.track.left,route.track.duration());
        return true;
    }

    private void standOnPlatform(PetHomeMap.Box support){
        clearHome();
        platform=support;
        perchPhase=0;
        int stand=PetHomeMap.standY(support,layout.height);
        if(stand<0){
            perchPhase=2;
            perchLeft=x<maxX/2;
            schedule(450);
        }else moveTo(x,stand,PetMotion.PERCH_STAND);
    }

    private void continueOnPlatform(){
        List<PetHomeMap.Box> boxes=readHome();
        PetHomeMap.Box support=platform;
        boolean valid=false;
        for(PetHomeMap.Box box:boxes)if(support.same(box,dp(5))){valid=true;break;}
        if(!valid){waitForHomeContact();return;}
        homeMissingSince=0;
        int w=layout.width,h=layout.height;
        if(perchPhase==0){
            PetHomeMap.Box avoid=leftPlatform;
            PetHomeMap.Jump jump=PetHomeMap.jumpHigher(boxes,support,x,y,w,h,maxX,density(),avoid);
            if(jump!=null){
                platform=null;
                dropTarget=jump.support;
                startHop(jump.x,jump.y,jump.flight,jump.x<x);
                return;
            }
            PetHomeMap.Route climb=PetHomeMap.climbHigher(boxes,support,x,y,w,h,maxX,avoid);
            if(climb!=null){
                platform=null;
                beginRoute(climb,boxes);
                return;
            }
            if(support.kind==PetHomeMap.DOCK){
                leftPlatform=null;
                if(gameReady()){playGame(false);return;}
                play(idle.next()==PetIdle.Activity.TEA?PetMotion.IDLE_TEA:PetMotion.IDLE_BOOK,false);
                return;
            }
            int leftX=Math.max(0,support.l-Math.round(w*.26f));
            int rightX=Math.min(maxX,support.r-Math.round(w*.74f));
            perchLeft=Math.abs(x-leftX)<=Math.abs(x-rightX);
            int edgeX=perchLeft?leftX:rightX;
            int center=edgeX+w/2,footing=Math.round(w*.08f);
            perchPhase=1;
            if(center-footing>=support.l&&center+footing<=support.r&&Math.abs(edgeX-x)>dp(3)){
                moveTo(edgeX,y,PetMotion.HOME_WALK);
                return;
            }
        }
        if(perchPhase<2){
            perchPhase=2;
            if(gameReady()){playGame(true);return;}
            play(PetMotion.PERCH_LOOK,perchLeft);
            return;
        }
        if(perchPhase==2&&PetHomeMap.standY(support,h)>=0&&support.t-Math.round(h*PetPlacement.SEAT_CONTACT)<=maxY){
            perchPhase=3;
            sitOn(support,!perchLeft);
            return;
        }
        if(perchPhase==3&&mode==PetMotion.PERCH_SIT){
            seatedRest(pose.mirrored);
            return;
        }
        if(!lowerFromSeat(support,pose.mirrored,boxes))schedule(2200);
    }

    private void advanceHome(){
        if(sprite==null||homeRoute==null)return;
        if(!PetHomeMap.sameLayout(plannedHome,readHome(),dp(5))){
            boolean onFloor=y==maxY;
            clearHome();
            if(onFloor){homeTried=false;schedule(700);}
            else returnToFloor();
            return;
        }
        if(homeStep==homeRoute.steps.size()){
            ascent=null;
            ladder.hide();
            climbTrack=null;
            homeSatAt=SystemClock.uptimeMillis();
            pose.shiftX=pose.shiftY=0;
            pose.mirrored=homeRoute.left;
            pose.nextFrame=-1;
            pose.frame=PetMotion.MANTLE_LAST;
            sprite.invalidate();
            schedule(1400);
            return;
        }
        PetHomeMap.Step step=homeRoute.steps.get(homeStep++);
        switch(step.mode){
            case PetHomeMap.WALK: moveTo(step.x,step.y,PetMotion.HOME_WALK);break;
            case PetHomeMap.CRAWL: moveTo(step.x,step.y,PetMotion.CRAWLING);break;
            case PetHomeMap.JUMP: moveTo(step.x,step.y,PetMotion.HOP,step.rise);break;
            case PetHomeMap.PLACE:
                ascent=homeRoute.ascent;
                if(ladder.show(ascent))play(PetMotion.PLACE_LADDER,homeRoute.left);
                else returnToFloor();
                break;
            case PetHomeMap.LADDER:
                if(ascent!=null)moveTo(step.x,step.y,PetMotion.LADDER_UP);
                else returnToFloor();
                break;
            case PetHomeMap.MANTLE: moveTo(step.x,step.y,PetMotion.MANTLE_UP);break;
            default: throw new AssertionError("Unknown home movement");
        }
    }

    private void clearHome(){
        clearHome(false);
    }

    private void clearHome(boolean retrieveRope){
        handler.removeCallbacks(homeAdvance);
        handler.removeCallbacks(retryLanding);
        homeRoute=null;
        ascent=null;
        climbTrack=null;
        loweringFrom=null;
        ropeDescent=null;
        plannedHome=null;
        homeSatAt=0;
        homeMissingSince=landingMissingSince=0;
        if(retrieveRope)ladder.retrieveRope();else ladder.hide();
    }

    private PetPlacement findSurface(boolean seat){
        if(!anchorsEnabled(context)||sprite==null)return null;
        try{
            EvaAccessibility.PetSurface from=EvaAccessibility.petSurface(seat);
            if(from==null)return null;
            sprite.getLocationOnScreen(origin);
            int left=origin[0]-x,top=origin[1]-y;
            Rect r=from.bounds;
            return PetPlacement.onSurface(from.key,from.seated,r.left-left,r.top-top,
                r.right-left,r.bottom-top,layout.width,layout.height,maxX,maxY,x);
        }catch(RuntimeException error){
            android.util.Log.d("EvaPet","Panel geometry unavailable",error);
            return null;
        }
    }

    private float density(){
        return windowContext.getResources().getDisplayMetrics().density;
    }

    private void moveTo(int x,int y,int animation){
        moveTo(x,y,animation,0);
    }

    private void moveTo(int x,int y,int animation,int obstacleRise){
        crossStart=this.x;
        crossStartY=this.y;
        targetX=x;
        targetY=y;
        int duration=PetMotion.duration(animation);
        boolean mirror=x<this.x;
        if(animation==PetMotion.GRAVITY_FALL){
            duration=PetPhysics.fallTime(y-this.y,density(),gravity.strength(rotation));
            mirror=pose.mirrored;
        }else if(animation==PetMotion.PERCH_STAND){
            mirror=pose.mirrored;
        }else if(animation==PetMotion.HOP){
            duration=obstacleRise>0?PetPhysics.jumpTimeForRise(obstacleRise,density()):
                PetPhysics.jumpTime(y-this.y,Math.abs(x-this.x),density());
            duration+=PetMotion.TAKEOFF_MS+PetMotion.TOUCHDOWN_MS;
        }else if(animation==PetMotion.HOME_WALK){
            duration=PetMotion.displacementTime(animation,(x-this.x)/density());
        }else if(animation==PetMotion.CRAWLING){
            int cycles=PetMotion.crawlCycles(x-this.x,bodyWidth);
            duration=Math.max(PetMotion.displacementTime(animation,(x-this.x)/density()),
                2*PetMotion.CRAWL_FOLD_MS+cycles*1250);
        }else if(animation==PetMotion.LADDER_UP){
            duration=ascent.duration(density());
        }
        if(homeRoute!=null&&(animation==PetMotion.LADDER_UP||animation==PetMotion.MANTLE_UP))mirror=homeRoute.left;
        if(homeRoute!=null&&animation==PetMotion.MANTLE_UP){
            PetHomeMap.Box support=homeRoute.support;
            int h=layout.height,edge=mirror?support.r:support.l;
            float first=PetMotion.mantleStart((support.t-this.y)*540f/h);
            climbTrack=new PetClimb.Track(this.x,this.y,x,y,edge,layout.width,mirror,first,11);
            duration=climbTrack.duration();
        }
        play(animation,mirror,duration);
    }

    private void startHop(int x,int y,int flight,boolean mirror){
        crossStart=this.x;
        crossStartY=this.y;
        targetX=x;
        targetY=y;
        play(PetMotion.HOP,mirror,flight+PetMotion.TAKEOFF_MS+PetMotion.TOUCHDOWN_MS);
    }

    private void settle(){
        pose.shiftX=pose.shiftY=0;
        pose.mirrored=surface.left;
        if(surface.seated){seatedRest(surface.left);return;}
        pose.nextFrame=-1;
        pose.frame=PetMotion.POINT;
        sprite.invalidate();
        schedule(1400);
    }

    private void finishDrop(boolean faceLeft){
        PetHomeMap.Box target=dropTarget;
        if(target!=null&&!homeSupports(target)){
            long now=SystemClock.uptimeMillis();
            if(loweringFrom!=null&&anchorsEnabled(context)){
                if(landingMissingSince==0)landingMissingSince=now;
                if(now-landingMissingSince<HOME_GRACE_MS){
                    handler.postDelayed(retryLanding,HOME_RECHECK_MS);
                    return;
                }
            }
            returnToFloor();
            return;
        }
        dropTarget=null;
        boolean released=mode==PetMotion.ROPE_DOWN&&ropeDescent!=null;
        clearHome(released);
        platform=target;
        perchPhase=0;
        if(released)play(PetMotion.ROPE_SETTLE,faceLeft);
        else if(mode==PetMotion.HOP)schedule(1400);
        else play(PetMotion.LANDING,faceLeft);
    }

    private void fallWithTilt(){
        clearHome();
        surface=null;
        platform=dropTarget=null;
        startAirTurn(x+(turnInAir==null?layout.width/2f:drawCenterX),
            y+(turnInAir==null?layout.height/2f:drawCenterY),bodyAngle,pose.mirrored);
    }

    private void startAirTurn(float centerX,float centerY,float angle,boolean faceLeft){
        boolean side=PetGravity.sideways(physicalDown);
        int w=side?bodyHeight:bodyWidth,h=side?bodyWidth:bodyHeight;
        int right=Math.max(0,worldWidth-w),floor=Math.max(0,worldHeight-h);
        int startX=Math.round(PetMotion.clamp(centerX-w/2f,0,right));
        int startY=Math.round(PetMotion.clamp(centerY-h/2f,0,floor));
        PetMotion.Position target;
        if(physicalDown==PetGravity.DOWN){
            dropTarget=PetHomeMap.landing(groundForLanding(),startX,startY,w,h,floor,0,leftPlatform);
            target=new PetMotion.Position(startX,dropTarget==null?floor:PetHomeMap.standY(dropTarget,h));
        }else target=gravity.destination(physicalDown,rotation,startX,startY,right,floor);
        turnInAir=new PetTurn(centerX,centerY,target.x+w/2f,target.y+h/2f,angle,physicalDown);
        bodyAngle=angle;
        int diagonal=(int)Math.ceil(Math.hypot(bodyWidth,bodyHeight));
        boolean resized=setBodyBounds(Math.min(worldWidth,diagonal),Math.min(worldHeight,diagonal));
        placeTurningBody(centerX,centerY,resized);
        if(sprite==null)return;
        int distance=Math.round((float)Math.hypot(turnInAir.toX-centerX,turnInAir.toY-centerY));
        play(PetMotion.TILT_FALL,faceLeft,Math.max(PetTurn.MIN_DURATION,
            PetPhysics.fallTime(distance,density(),gravity.screenStrength(rotation))));
    }

    private void placeTurningBody(float centerX,float centerY,boolean resized){
        int windowX=Math.round(PetMotion.clamp(centerX-layout.width/2f,0,maxX));
        int windowY=Math.round(PetMotion.clamp(centerY-layout.height/2f,0,maxY));
        drawCenterX=centerX-windowX;
        drawCenterY=centerY-windowY;
        position(windowX,windowY,resized);
    }

    private void finishAirTurn(){
        PetTurn completed=turnInAir;
        if(completed==null)return;
        turnInAir=null;
        bodyAngle=PetGravity.bodyAngle(physicalDown);
        boolean resized=setBodyBounds();
        position(Math.round(completed.toX-layout.width/2f),Math.round(completed.toY-layout.height/2f),resized);
        if(sprite==null)return;
        if(physicalDown==PetGravity.DOWN){
            PetHomeMap.Box inside=PetWindowGround.covering(windowTerrain,x,y,layout.width,layout.height);
            if(inside==null)finishDrop(left);
            else standOnWindow(inside,x);
        }else schedule(2100);
    }

    private void returnToFloor(){
        resetChair();
        clearHome();
        surface=null;
        platform=dropTarget=null;
        if((physicalDown!=PetGravity.DOWN||turnInAir!=null)&&motionEnabled){fallWithTilt();return;}
        PetHomeMap.Box ground=PetHomeMap.landing(groundForLanding(),x,y,layout.width,layout.height,maxY,0,leftPlatform);
        if(!motionEnabled){
            platform=ground;
            position(x,ground==null?maxY:PetHomeMap.standY(ground,layout.height));
            pose.frame=PetMotion.IDLE;
            pose.nextFrame=-1;
            pose.shiftX=pose.shiftY=0;
            if(sprite!=null)sprite.invalidate();
        }else if(y<maxY){
            dropTarget=ground;
            int floor=dropTarget==null?maxY:PetHomeMap.standY(dropTarget,layout.height);
            if(floor==y)finishDrop(pose.mirrored);
            else moveTo(x,floor,PetMotion.GRAVITY_FALL);
        }
        else play(PetMotion.LOOK_AROUND,pose.mirrored);
    }

    private long nextFallProbe;
    private void releaseDrag(){
        nextFallProbe=0;
        if((physicalDown!=PetGravity.DOWN||turnInAir!=null)&&motionEnabled){fallWithTilt();return;}
        PetHomeMap.Box inside=PetWindowGround.covering(windowTerrain,x,y,layout.width,layout.height);
        if(inside!=null){standOnWindow(inside,x);return;}
        List<PetHomeMap.Box> ground=groundForLanding();
        if(ground.isEmpty()&&anchorsEnabled(context))ground=pickupGround;
        PetHomeMap.Box support=PetHomeMap.landing(ground,x,y,layout.width,layout.height,maxY,0,null);
        if(support==null){returnToFloor();return;}
        int landingY=PetHomeMap.standY(support,layout.height);
        if(!motionEnabled||y>=landingY){
            platform=support;
            perchPhase=0;
            position(x,landingY);
            if(sprite==null)return;
            if(motionEnabled)play(PetMotion.LANDING,pose.mirrored);
            else {pose.frame=PetMotion.IDLE;sprite.invalidate();}
        }else {
            dropTarget=support;
            moveTo(x,landingY,PetMotion.GRAVITY_FALL);
        }
    }

    private List<PetHomeMap.Box> pickupGround=Collections.emptyList();

    private void holdPose() {
        if(sprite==null||!touched||held)return;
        pickupGround=groundForLanding();
        float centerX=x+(turnInAir==null?layout.width/2f:drawCenterX);
        float centerY=y+(turnInAir==null?layout.height/2f:drawCenterY);
        turnInAir=null;
        bodyAngle=PetGravity.bodyAngle(physicalDown);
        hood.offset(bodyWidth,bodyHeight,bodyAngle,pose.mirrored);
        mood.pickedUp(interruptedBook,SystemClock.uptimeMillis());
        hood.start(SystemClock.uptimeMillis(),centerX+hood.offsetX,centerY+hood.offsetY,fingerX,fingerY);
        held=true;
        pose.frame=PetMotion.FALL;
        pose.nextFrame=-1;
        // Keep the gesture's surface stationary. Relayout during drawing costs a
        // window transaction and can deliver the previous position to the compositor.
        boolean resized=setBodyBounds(worldWidth,worldHeight);
        drawCenterX=centerX;
        drawCenterY=centerY;
        position(0,0,resized);
        if(sprite!=null)sprite.invalidate();
    }

    private boolean updateHeldCenter(){
        boolean moving=hood.advance(SystemClock.uptimeMillis(),fingerX,fingerY,bodyAngle,bodyHeight,motionEnabled,pose.mirrored);
        hood.offset(bodyWidth,bodyHeight,bodyAngle+hood.swing,pose.mirrored);
        drawCenterX=hood.pinX-hood.offsetX;
        drawCenterY=hood.pinY-hood.offsetY;
        return moving;
    }

    private void releaseHood(){
        updateHeldCenter();
        float cx=x+drawCenterX,cy=y+drawCenterY;
        held=dragging=false;
        boolean resized=setBodyBounds();
        position(Math.round(cx-layout.width/2f),Math.round(cy-layout.height/2f),resized);
        if(sprite!=null)releaseDrag();
        pickupGround=Collections.emptyList();
    }

    private int pendingWorkGesture;
    private boolean lastWorkWaiting;
    private long workSignalUntil;
    private static final String[] PLUGGED_LINES={
        "Кормушка в розетке. Обед!", "О, макаронина с током.", "Хвост приставили. Мурчу.",
        "В меню сегодня электричество.", "Подали суп из электронов.", "Тапки к батарее. Греемся."
    };
    private static final String[] UNPLUGGED_LINES={
        "Отнял вилку посреди обеда.", "Всё, гуляем без поводка.", "Эй, я корочку тока оставила!",
        "Ужин дёрнули за хвост.", "Ну всё, розетка, созвонимся.", "Десерт из розетки отменили."
    };
    private static final String[] LOW_LINES={
        "До розетки доползу сама.", "Кабель зови. Я задышала реже.", "Крошки заряда с ладошки ем.",
        "Заряда с гулькин тапок.", "Розетка, моргни, если рядом.", "Кому последний электрон?"
    };
    private long nextPowerRemark;
    private static final String[][] POWER_LINES={PLUGGED_LINES,UNPLUGGED_LINES,LOW_LINES};
    private final int[] powerLineIndex=new int[POWER_LINES.length];
    private void powerEvent(String action){
        long now=SystemClock.uptimeMillis();
        if(sprite==null||touched||game!=null||prank.active()||!power.isInteractive()||
            keyguard.isKeyguardLocked()||!appAllowsPlay()||now<nextPowerRemark)return;
        int event=Intent.ACTION_POWER_CONNECTED.equals(action)?0:
            Intent.ACTION_POWER_DISCONNECTED.equals(action)?1:2;
        String[] lines=POWER_LINES[event];
        if(mood.sayLine(lines[powerLineIndex[event]],now)){
            powerLineIndex[event]=(powerLineIndex[event]+1)%lines.length;
            nextPowerRemark=now+20000;
            sprite.invalidate();
        }
    }

    void workNotice(boolean waiting){
        lastWorkWaiting=waiting;
        pendingWorkGesture=waiting?2:1;
        workSignalUntil=SystemClock.uptimeMillis()+6000;
        if(sprite!=null){
            sprite.invalidate();
            sprite.postInvalidateDelayed(6001);
        }
    }

    private void chat() {
        pendingWorkGesture=0;
        workSignalUntil=0;
        if(sprite==null||keyguard.isKeyguardLocked())return;
        int[] location=new int[2];sprite.getLocationOnScreen(location);
        Rect anchor=new Rect(location[0],location[1],location[0]+sprite.getWidth(),location[1]+sprite.getHeight());
        Intent i=new Intent(context,MainActivity.class).setAction(OPEN_CHAT)
            .putExtra(COMPOSER_ANCHOR,anchor)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        try { context.startActivity(i); }
        catch(RuntimeException e) { android.util.Log.w("EvaPet","Could not open chat",e); }
    }

    private final class Sprite extends View {
        final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG);
        final RectF dest=new RectF();
        final PetMotion.Pose chairPose=new PetMotion.Pose();
        final PorterDuffXfermode addFrames=new PorterDuffXfermode(PorterDuff.Mode.ADD);
        final float[] rearMesh=new float[(PetLadderMotion.COLS+1)*(PetLadderMotion.ROWS+1)*2];

        private void drawFrame(Canvas canvas,Frame frame,float w,float h,float opacity){
            Rect area=frame.area;
            dest.set(area.left*w/FRAME_WIDTH,area.top*h/FRAME_HEIGHT,area.right*w/FRAME_WIDTH,area.bottom*h/FRAME_HEIGHT);
            paint.setAlpha(Math.round(255*opacity));
            canvas.drawBitmap(frame.bitmap,null,dest,paint);
            paint.setAlpha(255);
        }

        // Bend only the trouser legs to hold each planted shoe between artwork samples.
        private static final int GAIT_ROWS=12;
        private final float[] gaitMesh=new float[(GAIT_ROWS+1)*4];
        private void drawGait(Canvas canvas,Frame frame,float w,float h,float footX){
            Rect area=frame.area;
            for(int row=0;row<=GAIT_ROWS;row++){
                float y=area.top+area.height()*row/(float)GAIT_ROWS;
                float shift=PetMotion.gaitOffsetAt(y,footX);
                int i=row*4;
                gaitMesh[i]=area.left+shift;
                gaitMesh[i+1]=y;
                gaitMesh[i+2]=area.right+shift;
                gaitMesh[i+3]=y;
            }
            canvas.save();
            canvas.scale(w/FRAME_WIDTH,h/FRAME_HEIGHT);
            canvas.drawBitmapMesh(frame.bitmap,1,GAIT_ROWS,gaitMesh,0,null,0,paint);
            canvas.restore();
        }

        private void drawCel(Canvas canvas,Frame frame,float w,float h,float alpha,boolean gait,float footX){
            if(gait){
                paint.setAlpha(Math.round(255*alpha));
                drawGait(canvas,frame,w,h,footX);
                paint.setAlpha(255);
            }else drawFrame(canvas,frame,w,h,alpha);
        }

        private void drawPose(Canvas canvas,Frame frame,PetMotion.Pose sample,float w,float h,float opacity){
            boolean gait=PetMotion.gaitFrame(sample.frame);
            float mix=sample.nearbyWeight;
            if(!motionEnabled||touched||sample.frame!=sample.blendOrigin||sample.nextFrame>=0||
                sample.nearbyFrame<0||sample.nearbyFrame==sample.frame||mix<.015f){
                drawCel(canvas,frame,w,h,opacity,gait,sample.gaitFootX);
                return;
            }
            // Add weighted premultiplied pixels in isolation so edge overlap keeps its expected opacity.
            int layer=canvas.saveLayer(0,0,w,h,null);
            drawCel(canvas,frame,w,h,opacity*(1-mix),gait,sample.gaitFootX);
            paint.setXfermode(addFrames);
            drawCel(canvas,frames[sample.nearbyFrame],w,h,opacity*mix,gait,sample.nearbyFootX);
            paint.setXfermode(null);
            canvas.restoreToCount(layer);
        }

        private void drawRear(Canvas canvas,Frame frame){
            canvas.save();
            canvas.scale(bodyWidth/(float)FRAME_WIDTH,bodyHeight/(float)FRAME_HEIGHT);
            Rect area=frame.area;
            if(!ladderPose.mesh){
                canvas.save();
                canvas.translate(0,ladderPose.insetY);
                canvas.drawBitmap(frame.bitmap,null,area,paint);
                canvas.restore();
            }else{
                int i=0;
                for(int row=0;row<=PetLadderMotion.ROWS;row++){
                    float sy=area.top+area.height()*row/(float)PetLadderMotion.ROWS;
                    for(int col=0;col<=PetLadderMotion.COLS;col++){
                        float sx=area.left+area.width()*col/(float)PetLadderMotion.COLS;
                        PetLadderMotion.vertex(sx,sy,ladderPose,rearMesh,i);i+=2;
                    }
                }
                canvas.drawBitmapMesh(frame.bitmap,PetLadderMotion.COLS,PetLadderMotion.ROWS,rearMesh,0,null,0,paint);
            }
            if(pose.mirrored)canvas.scale(-1,1,201,0);
            playArt.caption(canvas,mood);
            canvas.restore();
        }
        private int dragPointer;
        final int slop=ViewConfiguration.get(windowContext).getScaledTouchSlop();

        Sprite() {
            super(windowContext);
            setClickable(true);
            setContentDescription("Ева. Открыть чат");
            setFilterTouchesWhenObscured(true);
        }

        @Override public WindowInsets onApplyWindowInsets(WindowInsets insets) {
            // An immersive player can change the available floor without a rotation.
            if(Build.VERSION.SDK_INT>=30&&sprite==this)PetOverlay.this.configurationChanged();
            return super.onApplyWindowInsets(insets);
        }

        @Override protected void onConfigurationChanged(android.content.res.Configuration config) {
            super.onConfigurationChanged(config);
            PetOverlay.this.configurationChanged();
        }

        private final float[] watchMesh=new float[20];
        private void drawWatching(Canvas canvas,long now){
            // A shallow breath through the shoulders; the hips and feet stay planted.
            float breath=motionEnabled?(float)Math.sin((now%5200)*2*Math.PI/5200):0;
            for(int row=0;row<5;row++){
                float y=FRAME_HEIGHT*row/4f;
                float rise=Math.max(0,1-y/(FRAME_HEIGHT*PetPlacement.SEAT_CONTACT))*2*breath;
                int i=row*4;
                watchMesh[i]=0;watchMesh[i+1]=y-rise;
                watchMesh[i+2]=FRAME_WIDTH;watchMesh[i+3]=y-rise;
            }
            canvas.drawBitmapMesh(watchBitmap,1,4,watchMesh,0,null,0,paint);
            if(motionEnabled)postInvalidateDelayed(125);
        }

        private final Paint signalPaint=new Paint(Paint.ANTI_ALIAS_FLAG);
        @Override public void draw(Canvas canvas){
            super.draw(canvas);
            long remaining=workSignalUntil-SystemClock.uptimeMillis();
            if(remaining<=0||touched||!appAllowsPlay())return;
            float r=dp(9),cx=getWidth()*.72f,cy=Math.max(r,getHeight()*.18f);
            signalPaint.setColor(0xff284443);
            canvas.drawCircle(cx,cy,r,signalPaint);
            signalPaint.setColor(0xffe3fff0);
            signalPaint.setTextAlign(Paint.Align.CENTER);
            signalPaint.setTextSize(r*1.45f);
            canvas.drawText(lastWorkWaiting?"?":"✓",cx,cy-(signalPaint.ascent()+signalPaint.descent())/2,signalPaint);
        }

        @Override protected void onDraw(Canvas canvas) {
            long captionDelay=mood.updateCaption(SystemClock.uptimeMillis());
            if(captionDelay>0)postInvalidateDelayed(captionDelay);
            float w=bodyWidth,h=bodyHeight;
            if(touched&&held){
                boolean moving=updateHeldCenter();
                float angle=bodyAngle+hood.swing;
                canvas.save();
                canvas.translate(drawCenterX,drawCenterY);
                canvas.rotate(angle);
                canvas.scale(pose.mirrored?-w/FRAME_WIDTH:w/FRAME_WIDTH,h/FRAME_HEIGHT);
                canvas.translate(-FRAME_WIDTH/2f,-FRAME_HEIGHT/2f);
                dest.set(0,0,FRAME_WIDTH,FRAME_HEIGHT);
                canvas.drawBitmap(hangingBitmap,null,dest,paint);
                if(mood.quip!=null){
                    if(pose.mirrored)canvas.scale(-1f,1f,201,0);
                    playArt.caption(canvas,mood);
                }
                canvas.restore();
                if(moving)postInvalidateOnAnimation();
                return;
            }
            canvas.save();
            canvas.translate(turnInAir==null?getWidth()/2f:drawCenterX,
                turnInAir==null?getHeight()/2f:drawCenterY);
            canvas.rotate(bodyAngle);
            canvas.translate(-w/2f,-h/2f);
            canvas.translate(w*pose.shiftX,h*pose.shiftY);
            if(pose.angle!=0)canvas.rotate(pose.angle,w/2f,h*(pose.seatedPivot?PetPlacement.SEAT_CONTACT:PetHomeMap.SOLE_CONTACT));
            if(motionEnabled&&!touched&&!parked){
                if(greetCurve==null){
                    greetCurve=EvaPresence.curve(context,"acknowledge");
                    lookCurve=EvaPresence.curve(context,"consider");
                    settleCurve=EvaPresence.curve(context,"settle");
                }
                EvaPresence.Curve motion=mode==PetMotion.GREET?greetCurve:
                    mode==PetMotion.LOOK_AROUND?lookCurve:mode==PetMotion.LANDING?settleCurve:null;
                if(motion!=null){
                    long elapsed=SystemClock.uptimeMillis()-began;
                    if(mode==PetMotion.LANDING)elapsed-=Math.max(0,motionTime-motion.duration);
                    float amount=motion.amount(elapsed), sole=h*PetHomeMap.SOLE_CONTACT;
                    canvas.rotate(amount*motion.angle*(pose.mirrored?-1:1),w/2,sole);
                    canvas.scale(1f,1f-amount*Math.abs(motion.displacement),w/2,sole);
                }
            }
            if(pose.mirrored)canvas.scale(-1f,1f,w/2,h);
            if(!touched&&ascent!=null&&(mode==PetMotion.PLACE_LADDER||mode==PetMotion.LADDER_UP)){
                drawRear(canvas,rearFrames[ladderPose.key]);
                canvas.restore();
                return;
            }
            if(prank.active()||game!=null||(!touched&&PetGesture.handled(mode))){
                canvas.scale(w/FRAME_WIDTH,h/FRAME_HEIGHT);
                if(stories.active!=null)playArt.storySet(canvas,stories,gameTime);
                playArt.draw(canvas,game,gamePose,gameTime,mood);
                if(pose.mirrored)canvas.scale(-1f,1f,201,0);
                playArt.caption(canvas,mood);
                canvas.restore();
                return;
            }
            long now=SystemClock.uptimeMillis();
            float phase=chair.phase(now);
            boolean staging=mode==PetMotion.SEATED_PEEK&&!touched&&
                (afterPacking!=null||chair.deployed&&phase<1);
            boolean viewing=parked&&!appParkingMove&&!touched&&mode==PetMotion.SEATED_PEEK&&watchingPlayer();
            if(!staging&&parked&&!appParkingMove&&mode==PetMotion.SEATED_PEEK&&motionEnabled&&!viewing&&!editingInApp()){
                long swing=(chair.deployed?chair.seatedFor(now):now)%7200;
                PetMotion.inBetween(pose,PetMotion.SEAT_SWING,PetMotion.GENERATED_FRAMES,
                    (1-(float)Math.cos(2*Math.PI*swing/7200))*4);
                postInvalidateDelayed(67);
            }
            if(mode==PetMotion.SEATED_PEEK&&!touched&&(phase>0||staging)){
                float open=PetChair.unfolding(phase);
                if(open>0){
                    canvas.save();
                    canvas.scale(w/FRAME_WIDTH,h/FRAME_HEIGHT);
                    // The folded chair comes from her hip; full extension matches the painted contact points.
                    canvas.translate(40*(1-open),-52*(1-open));
                    canvas.rotate(-14*(1-open),170,374);
                    canvas.scale(.12f+.88f*open,.18f+.82f*open,170,374);
                    dest.set(0,0,FRAME_WIDTH,FRAME_HEIGHT);
                    paint.setAlpha(Math.round(255*PetMotion.ease(phase/.13f)));
                    canvas.drawBitmap(chairBitmap,null,dest,paint);
                    paint.setAlpha(255);
                    canvas.restore();
                }
                if(staging||!chair.deployed)postInvalidateOnAnimation();
            }
            float sitting=PetChair.sitting(phase);
            if(staging)PetMotion.inBetween(chairPose,PetMotion.RISE_FRAME,PetMotion.GENERATED_FRAMES,
                (PetMotion.GENERATED_FRAMES-1)*(1-sitting));
            Frame frame=staging?frames[chairPose.frame]:artwork();
            if(viewing){
                float turned=staging?PetMotion.ease((sitting-.65f)/.35f):1;
                if(turned<1)drawPose(canvas,frame,chairPose,w,h,1-turned);
                if(turned>0){
                    paint.setAlpha(Math.round(255*turned));
                    canvas.scale(w/FRAME_WIDTH,h/FRAME_HEIGHT);
                    drawWatching(canvas,now);
                }
                paint.setAlpha(255);
                canvas.restore();
                return;
            }
            if(staging){
                float settled=PetChair.seatedBlend(sitting);
                if(settled<1)drawPose(canvas,frame,chairPose,w,h,1-settled);
                if(settled>0)drawPose(canvas,artwork(),pose,w,h,settled);
                canvas.restore();
                return;
            }
            Rect area=frame.area;
            if(!touched&&pose.frame==PetAir.CONTACT&&pose.airPhase>=0&&airArt!=null){
                canvas.scale(w/FRAME_WIDTH,h/FRAME_HEIGHT);
                airArt.draw(canvas,paint,pose.airPhase,pose.airAmplitude);
                if(pose.mirrored)canvas.scale(-1f,1f,201,0);
                playArt.caption(canvas,mood);
                canvas.restore();
                return;
            }
            if(!touched&&!parked&&!staging&&mode==PetMotion.SEATED_PEEK&&seat.activity!=null){
                canvas.scale(w/FRAME_WIDTH,h/FRAME_HEIGHT);
                playArt.seated.draw(canvas,frame.bitmap,area,seat);
                if(pose.mirrored)canvas.scale(-1f,1f,201,0);
                playArt.caption(canvas,mood);
                canvas.restore();
                return;
            }
            drawPose(canvas,frame,pose,w,h,1);
            if(!touched&&(mood.face!=PetMood.Face.NEUTRAL||mood.quip!=null)){
                canvas.scale(w/FRAME_WIDTH,h/FRAME_HEIGHT);
                playArt.bodyFace(canvas,pose.frame,mood);
                if(pose.mirrored)canvas.scale(-1f,1f,201,0);
                playArt.caption(canvas,mood);
            }
            canvas.restore();
        }

        @Override public boolean performClick() {
            super.performClick();
            chat();
            return true;
        }

        private void trackFinger(MotionEvent event,int index){
            // For older Android releases raw coordinates are available for index zero.
            fingerX=event.getRawX()+(event.getX(index)-event.getX())-rawOriginX;
            fingerY=event.getRawY()+(event.getY(index)-event.getY())-rawOriginY;
        }

        @Override public boolean onTouchEvent(MotionEvent e) {
            if(composerVisible)return e.getActionMasked()!=MotionEvent.ACTION_UP||performClick();
            switch(e.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    lastPetTouch=SystemClock.uptimeMillis();
                    interruptedBook=!parked&&mode==PetMotion.SEATED_PEEK&&seat.activity==PetSeat.Activity.BOOK&&seat.reveal>.1f;
                    touched=true;
                    resetChair();
                    parked=appParkingMove=false;
                    dragging=held=false;
                    dragPointer=e.getPointerId(0);
                    downX=e.getRawX();
                    downY=e.getRawY();
                    rawOriginX=downX-e.getX()-x;
                    rawOriginY=downY-e.getY()-y;
                    fingerX=downX-rawOriginX;
                    fingerY=downY-rawOriginY;
                    handler.removeCallbacks(next);
                    choreographer.removeFrameCallback(tick);
                    stopGame();
                    mood.clear();
                    clearHome();
                    surface=null;
                    platform=dropTarget=null;
                    pose.shiftX=pose.shiftY=0;
                    pose.angle=0;
                    pose.frame=PetMotion.CURIOUS;
                    pose.nextFrame=-1;
                    invalidate();
                    handler.postDelayed(hold,ViewConfiguration.getLongPressTimeout());
                    return true;
                case MotionEvent.ACTION_MOVE:
                    if(!touched)return true;
                    int index=e.findPointerIndex(dragPointer);
                    if(index<0)return true;
                    trackFinger(e,index);
                    float dx=fingerX-(downX-rawOriginX),dy=fingerY-(downY-rawOriginY);
                    if(!dragging&&dx*dx+dy*dy>slop*slop) {
                        dragging=true;
                        handler.removeCallbacks(hold);
                        holdPose();
                    }
                    if(held)invalidate();
                    return true;
                case MotionEvent.ACTION_POINTER_UP:
                    if(e.getPointerId(e.getActionIndex())!=dragPointer)return true;
                    // Release with the original finger, even if another finger is down.
                case MotionEvent.ACTION_UP:
                case MotionEvent.ACTION_CANCEL:
                    if(!touched)return true;
                    handler.removeCallbacks(hold);
                    // UP and CANCEL end the gesture; the last MOVE owns the release position.
                    touched=false;
                    if(e.getActionMasked()==MotionEvent.ACTION_UP&&!dragging&&!held)return performClick();
                    if(held)releaseHood();
                    else {
                        pose.frame=PetMotion.IDLE;
                        invalidate();
                        schedule(3300);
                    }
                    return true;
                default:
                    return true;
            }
        }
    }
}
