package ru.eva.envtest;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.Shader;
import android.os.Build;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;

final class PetLadder {
    private final Context context;
    private final WindowManager manager;
    private final float density;
    private AidView view;
    private WindowManager.LayoutParams params;
    private PetLadderMotion track;
    // Pixel registration in drawable-nodpi/eva_rope.png. The hook rests on the
    // ledge at row 17. The body tile repeats at its native pitch on the grip axis.
    private static final int CORD_WIDTH=90, GRIP_AXIS=72, LEDGE_Y=17, CAP_HEIGHT=104, TILE_HEIGHT=112;
    private static final Rect CAP=new Rect(0,0,CORD_WIDTH,CAP_HEIGHT);
    private static final Rect TIP=new Rect(0,CAP_HEIGHT+TILE_HEIGHT,CORD_WIDTH,257);
    private final float cordScale;
    private final Paint ink=new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG);
    private final Paint braid=new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG);
    private final RectF drawRect=new RectF();
    private Bitmap cord;
    private float cordX,cordY,pinchY,looseOffset;
    private boolean shelfOnLeft;
    private long deployedAt,recoilStarted;
    private int unrollMs;

    PetLadder(Context context,WindowManager manager){
        this.context=context;this.manager=manager;
        density=context.getResources().getDisplayMetrics().density;
        cordScale=3.3f*density/20f;
    }

    // Attach before the character so every rung stays behind her hands and torso.
    void attach(){
        if(view!=null)return;
        int type=Build.VERSION.SDK_INT>=26?WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY:WindowManager.LayoutParams.TYPE_PHONE;
        params=new WindowManager.LayoutParams(1,1,type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,
            PixelFormat.TRANSLUCENT);
        params.gravity=Gravity.TOP|Gravity.LEFT;
        params.alpha=.72f;
        params.setTitle("Опора Евы");
        AidView aid=new AidView(context);
        aid.setVisibility(View.INVISIBLE);
        manager.addView(aid,params);
        view=aid;
    }

    boolean show(PetLadderMotion track){
        this.track=track;
        int pad=Math.max(1,Math.round(2*density));
        return showAt(track.center-track.halfSpan-pad,track.top-pad,
            2*(track.halfSpan+pad)+1,track.bottom-track.top+2*pad+1,"Лестница Евы");
    }

    boolean showRope(int anchorX,int top,int bottom,boolean shelfOnLeft){
        if(view==null||bottom-top<10*density)return false;
        if(cord==null){
            int id=context.getResources().getIdentifier("eva_rope","drawable",context.getPackageName());
            if(id==0)return false;
            cord=BitmapFactory.decodeResource(context.getResources(),id);
            if(cord==null)return false;
            cord.setHasMipMap(true);
            Bitmap tile=Bitmap.createBitmap(cord,0,CAP_HEIGHT,CORD_WIDTH,TILE_HEIGHT);
            tile.setHasMipMap(true);
            braid.setShader(new BitmapShader(tile,Shader.TileMode.CLAMP,Shader.TileMode.REPEAT));
        }
        this.shelfOnLeft=shelfOnLeft;
        looseOffset=0;
        int swayMargin=Math.round(2.5f*density);
        int x=Math.max(0,(int)Math.floor(anchorX-swayMargin-(shelfOnLeft?GRIP_AXIS:CORD_WIDTH-GRIP_AXIS)*cordScale));
        int y=Math.max(0,(int)Math.floor(top-LEDGE_Y*cordScale));
        int width=(int)Math.ceil(anchorX+(shelfOnLeft?CORD_WIDTH-GRIP_AXIS:GRIP_AXIS)*cordScale)+swayMargin-x;
        cordX=anchorX-x;
        cordY=top-y-LEDGE_Y*cordScale;
        // The free end drops while Eva is still turning over the lip.
        unrollMs=Math.max(180,Math.min(550,Math.round(23f*(float)Math.sqrt((bottom-top)/density))));
        deployedAt=SystemClock.uptimeMillis();
        track=null;
        return showAt(x,y,width,bottom-y,"Верёвка Евы");
    }

    private boolean showAt(int x,int y,int w,int h,String name){
        if(view==null||x<0||y<0||h<=0)return false;
        recoilStarted=0;
        ink.setAlpha(255);braid.setAlpha(255);
        params.x=x;params.y=y;params.width=w;params.height=h;
        params.setTitle(name);
        try{
            manager.updateViewLayout(view,params);
            view.setVisibility(View.VISIBLE);
            view.invalidate();
            return true;
        }catch(RuntimeException error){
            android.util.Log.w("EvaPet","Could not display the climbing aid",error);
            hide();return false;
        }
    }

    void loadRope(float shoeY,float swing){
        if(view==null||cord==null||track!=null)return;
        float offset=Math.round(swing*2.4f*density*2)/(2*cordScale);
        float pin=Math.max(CAP_HEIGHT,(shoeY-params.y-cordY)/cordScale);
        if(looseOffset==offset&&(offset==0||Math.abs(pin-pinchY)<1))return;
        looseOffset=offset;pinchY=pin;
        view.invalidate();
    }

    void retrieveRope(){
        if(view==null||view.getVisibility()!=View.VISIBLE||track!=null||cord==null){hide();return;}
        looseOffset=0;
        recoilStarted=SystemClock.uptimeMillis();
        view.postInvalidateOnAnimation();
    }

    void hide(){if(view!=null)view.setVisibility(View.INVISIBLE);track=null;recoilStarted=0;}

    void detach(){
        hide();
        if(view==null)return;
        try{if(view.isAttachedToWindow())manager.removeViewImmediate(view);}
        catch(IllegalArgumentException ignored){}
        view=null;
    }

    private final class AidView extends View {
        private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
        AidView(Context c){super(c);paint.setStrokeCap(Paint.Cap.ROUND);}
        @Override protected void onDraw(Canvas c){
            if(track==null){
                if(cord!=null)drawCord(c);
                return;
            }
            float x=track.center-track.halfSpan-params.x,end=x+2*track.halfSpan;
            float top=track.top-params.y,bottom=track.bottom-params.y;
            stroke(c,x,top,x,bottom,3.2f,0xff634634);
            stroke(c,end,top,end,bottom,3.2f,0xff634634);
            stroke(c,x,top,x,bottom,1.5f,0xffb58a6b);
            stroke(c,end,top,end,bottom,1.5f,0xffb58a6b);
            for(int i=0;i<=track.rungs;i++){
                float y=track.rung(i)-params.y;
                stroke(c,x,y,end,y,2.3f,0xff7d543b);
                stroke(c,x,y-density*.30f,end,y-density*.30f,1.35f,0xffdab593);
            }
        }
        private void drawCord(Canvas c){
            float full=(getHeight()-cordY)/cordScale;
            float start=Math.min(full,CAP_HEIGHT+TIP.height());
            long now=SystemClock.uptimeMillis();
            boolean retracting=recoilStarted!=0;
            float t=retracting?PetMotion.clamp((now-recoilStarted)/(unrollMs+180f),0,1):
                PetMotion.clamp((now-deployedAt)/(float)unrollMs,0,1);
            if(retracting&&t>=1){hide();return;}
            float extent=retracting?1-PetMotion.ease(t/.85f):PetMotion.ease(t);
            if(retracting){
                int opacity=Math.round(255*(1-PetMotion.ease((t-.8f)/.2f)));
                ink.setAlpha(opacity);braid.setAlpha(opacity);
            }
            float end=start+(full-start)*extent;
            float tipTop=Math.max(CAP_HEIGHT,end-TIP.height());
            int saved=c.save();
            c.translate(cordX,cordY);
            c.scale(shelfOnLeft?cordScale:-cordScale,cordScale);
            c.translate(-GRIP_AXIS,0);
            drawRect.set(CAP);
            c.drawBitmap(cord,CAP,drawRect,ink);
            float pin=looseOffset==0?tipTop:Math.min(pinchY,tipTop);
            drawBraid(c,CAP_HEIGHT,pin,0,0);
            float free=tipTop-pin;
            float tipOffset=looseOffset*Math.min(1,free/50f);
            if(free>0){
                float from=pin,dx=0;
                for(int i=1;i<=4;i++){
                    float fraction=i*.25f,to=pin+free*fraction,next=tipOffset*fraction*fraction;
                    drawBraid(c,from,to,dx,next);
                    from=to;dx=next;
                }
            }
            if(end>tipTop){
                drawRect.set(tipOffset,tipTop,CORD_WIDTH+tipOffset,end);
                c.drawBitmap(cord,TIP,drawRect,ink);
            }
            c.restoreToCount(saved);
            if(t<1f)postInvalidateOnAnimation();
        }
        private void drawBraid(Canvas canvas,float from,float to,float dx,float endX){
            if(to<=from)return;
            int saved=canvas.save();
            canvas.translate(dx,from);
            canvas.skew((endX-dx)/(to-from),0);
            canvas.translate(0,CAP_HEIGHT-from);
            canvas.drawRect(0,from-CAP_HEIGHT,CORD_WIDTH,to-CAP_HEIGHT,braid);
            canvas.restoreToCount(saved);
        }
        private void stroke(Canvas c,float x,float y,float ex,float ey,float width,int color){
            paint.setColor(color);paint.setStrokeWidth(width*density);
            c.drawLine(x,y,ex,ey,paint);
        }
    }
}
