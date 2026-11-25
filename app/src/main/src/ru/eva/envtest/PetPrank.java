package ru.eva.envtest;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.RectF;
import android.os.Build;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import java.util.List;

/** A temporary, non-touchable animation above the launcher's own intact tiles. */
final class PetPrank {
    private final Context context;
    private final WindowManager windows;
    private Scene view;
    private long again,interaction;
    private boolean preferLabel;
    boolean left;

    PetPrank(Context context,WindowManager windows){this.context=context;this.windows=windows;}
    boolean isLabel(){return view!=null&&view.tile.label();}
    boolean active(){return view!=null;}
    boolean interrupted(long lastInput){return active()&&lastInput>interaction;}

    boolean start(long now,long lastInput,List<PetLauncherCutout> tiles,int originX,int originY,
                  int x,int y,int w,int h,int screenW,int screenH){
        if(view!=null||lastInput<=0||now-lastInput<PetTrickTiming.IDLE_MS||now<again)return false;
        PetLauncherCutout best=null;
        double score=Double.POSITIVE_INFINITY;
        for(PetLauncherCutout tile:tiles){
            float dx=tile.bounds.centerX()-originX-(x+w*.5f);
            float dy=tile.bounds.centerY()-originY-(y+h*.55f);
            double distance=Math.hypot(dx,dy);
            if(distance>h*1.2f)continue;
            double cost=distance+(tile.label()==preferLabel?0:h*.65);
            if(cost<score){best=tile;score=cost;}
        }
        if(best==null)return false;
        Rect target=new Rect(best.bounds);target.offset(-originX,-originY);
        left=target.centerX()<x+w*.5f;
        Rect area=new Rect(x,y,x+w,y+h);
        area.union(target);area.inset(-8,-8);
        if(!area.intersect(0,0,screenW,screenH))return false;
        target.offset(-area.left,-area.top);
        Scene scene=new Scene(best,target,x-area.left,y-area.top,w,h);
        int type=Build.VERSION.SDK_INT>=26?WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY:WindowManager.LayoutParams.TYPE_PHONE;
        WindowManager.LayoutParams params=new WindowManager.LayoutParams(area.width(),area.height(),type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE|
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,PixelFormat.TRANSLUCENT);
        params.gravity=Gravity.TOP|Gravity.LEFT;params.x=area.left;params.y=area.top;
        params.alpha=.77f;params.setTitle("Реквизит Евы");
        try{windows.addView(scene,params);}
        catch(RuntimeException unavailable){again=now+5000;return false;}
        view=scene;interaction=lastInput;preferLabel=!best.label();
        again=now+PetTrickTiming.COOLDOWN_MS;
        return true;
    }
    void update(long elapsed,PetPlay.Pose pose){
        if(view!=null){view.elapsed=elapsed;view.handX=pose.worldHandX();view.handY=pose.worldHandY();view.invalidate();}
    }
    void stop(){
        if(view==null)return;
        try{if(view.isAttachedToWindow())windows.removeViewImmediate(view);}
        catch(IllegalArgumentException ignored){}
        view=null;
    }

    private final class Scene extends View {
        final PetLauncherCutout tile;
        final Rect target,source=new Rect();
        final RectF dst=new RectF();
        final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG);
        final int avatarX,avatarY,avatarW,avatarH;
        float handX,handY;
        long elapsed;
        Scene(PetLauncherCutout tile,Rect target,int x,int y,int w,int h){
            super(context);this.tile=tile;this.target=target;avatarX=x;avatarY=y;avatarW=w;avatarH=h;
            setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);
        }
        private void patch(Canvas canvas,float alpha){
            paint.setAlpha(Math.round(255*alpha));canvas.drawBitmap(tile.background,null,target,paint);paint.setAlpha(255);
        }
        @Override protected void onDraw(Canvas c){
            float t=PetMotion.poseTime(elapsed);
            if(tile.label()){
                float f=PetTrickTiming.swapped(t);
                if(f<=0)return;
                patch(c,Math.min(1,4*f));
                int[] edges=tile.letterEdges;
                // Exchange the two central neighboring glyphs. Others keep their baseline.
                int first=(edges.length/2-1)/2;
                float stepA=edges[first*2+3]-edges[first*2+1];
                float stepB=edges[first*2]-edges[first*2+2];
                for(int n=0;n<edges.length/2;n++){
                    int l=edges[n*2],r=edges[n*2+1];
                    source.set(l,0,r,tile.art.getHeight());
                    float lift=(n==first?-1:n==first+1?1:0)*(float)Math.sin(Math.PI*f)*target.height()*.19f;
                    float x=target.left+l+(n==first?stepA:n==first+1?stepB:0)*f;
                    dst.set(x,target.top+lift,x+r-l,target.bottom+lift);
                    c.drawBitmap(tile.art,source,dst,paint);
                }
            }else{
                float lift=PetTrickTiming.lifted(t),tuck=PetTrickTiming.tucked(t);
                if(lift<=0)return;
                patch(c,Math.min(1,lift*4));
                float hx=avatarX+avatarW*(left?1-handX/402:handX/402);
                float hy=avatarY+avatarH*handY/540;
                float pocketX=avatarX+avatarW*(left?.44f:.56f),pocketY=avatarY+avatarH*.58f;
                float cx=PetTrickTiming.mix(target.exactCenterX(),PetTrickTiming.mix(hx,pocketX,tuck),lift);
                float cy=PetTrickTiming.mix(target.exactCenterY(),PetTrickTiming.mix(hy,pocketY,tuck),lift)
                    -(float)Math.sin(Math.PI*lift)*avatarH*.12f;
                float half=target.width()*.5f*PetTrickTiming.mix(1,.34f,lift)*(1-tuck);
                dst.set(cx-half,cy-half,cx+half,cy+half);
                if(half>.5f){c.save();c.rotate((left?-1:1)*lift*(1-tuck)*13,cx,cy);c.drawBitmap(tile.art,null,dst,paint);c.restore();}
            }
        }
    }
}
