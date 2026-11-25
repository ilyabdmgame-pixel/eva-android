package ru.eva.envtest;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.PixelFormat;
import android.os.Build;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;

import java.util.List;

final class PetToys {
    private final Context context;
    private final WindowManager windows;
    private ToyView view;
    private WindowManager.LayoutParams layout;
    private PetBall ball;
    private float originX,originY,sign;
    private int width,height,kicks,bounces;
    private long last,pulseAt,kickAt=-1;
    private boolean launched;
    private PetMood.Cue cue=PetMood.Cue.NONE;
    private long cueAt;

    PetToys(Context context,WindowManager windows){this.context=context;this.windows=windows;}

    void update(PetPlay.Act act,PetPlayArt art,long elapsed,float handX,float handY,float footX,float footY,boolean left,
            int worldWidth,int worldHeight,float density,List<PetHomeMap.Box> boxes){
        if(act.release==0||elapsed<act.release)return;
        if(!launched){
            launched=true;
            originX=handX;originY=handY;
            width=worldWidth;height=worldHeight;
            sign=left?-1:1;
            last=elapsed;
            if(act.ball()){
                boolean kick=act==PetPlay.Act.DRIBBLE;
                float speed=kick?29:238;
                float rise=kick?104:-245;
                if(!kick){
                    double score=Double.POSITIVE_INFINITY;
                    for(PetHomeMap.Box box:boxes){
                        float dx=(box.l+box.r)/2f-handX,dy=box.t-handY;
                        if(dx*sign<density*30||Math.abs(dx)>density*160||Math.abs(dy)>density*102)continue;
                        double cost=Math.hypot(dx,dy);
                        if(cost>=score)continue;
                        score=cost;
                        float flight=PetMotion.clamp(Math.abs(dx)/(238*density),.24f,.67f);
                        speed=Math.abs(dx)/flight/density;
                        rise=PetMotion.clamp(dy/flight/density-.5f*695*flight,-440,-65);
                    }
                }
                ball=new PetBall(handX,handY,sign*speed*density,rise*density,density,width,height);
            }
            show(act,art,density);
        }
        if(view==null)return;
        float age=(elapsed-act.release)/1000f;
        if(ball!=null){
            float incomingSpeed=Math.max(Math.abs(ball.vx),Math.abs(ball.vy));
            ball.step((elapsed-last)/1000f,boxes);
            if(ball.bounces!=bounces){
                bounces=ball.bounces;
                pulseAt=elapsed;
                if(ball.lastBounce!=PetMood.Cue.BOUNCE||incomingSpeed>density*185)react(ball.lastBounce,elapsed);
            }
            if(act==PetPlay.Act.DRIBBLE&&age>.16f&&kicks<3&&ball.vy>0&&
                    Math.abs(ball.x-footX)<density*43&&Math.abs(ball.y-footY)<density*28){
                ball.tap(PetMotion.clamp((footX-ball.x)*1.6f,-78*density,78*density),
                    -density*(208-9*kicks));
                kickAt=elapsed;
                kicks++;
                react(PetMood.Cue.KICK,elapsed);
            }
            view.spin=ball.spin;
            view.squash=pulseAt==0?0:1-PetMotion.clamp((elapsed-pulseAt)/135f,0,1);
            move(ball.x,ball.y);
        }else{
            float x=originX+sign*density*(155*age-15*age*age);
            float y=originY+density*(-90*age+26*age*age+8*PetPlay.sin(age));
            view.spin=sign*(age*13-12);
            if(x<-layout.width||x>width+layout.width){hide();return;}
            move(x,y);
        }
        last=elapsed;
    }

    private void show(PetPlay.Act act,PetPlayArt art,float density){
        view=new ToyView(act,art);
        int type=Build.VERSION.SDK_INT>=26?WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY:
            WindowManager.LayoutParams.TYPE_PHONE;
        int size=Math.round((act.ball()?24:28)*density);
        layout=new WindowManager.LayoutParams(size,size,type,WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|
            WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE|WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            PixelFormat.TRANSLUCENT);
        layout.gravity=Gravity.TOP|Gravity.LEFT;
        layout.alpha=.74f;
        layout.setTitle(act.ball()?"Мяч Евы":"Самолётик Евы");
        layout.x=start(ball==null?originX:ball.x,width,size);
        layout.y=start(ball==null?originY:ball.y,height,size);
        try{windows.addView(view,layout);}
        catch(RuntimeException unavailable){hide();}
    }

    private static int start(float center,int extent,int size){
        return Math.round(PetMotion.clamp(center-size/2f,0,Math.max(0,extent-size)));
    }

    private void move(float x,float y){
        int left=start(x,width,layout.width),top=start(y,height,layout.height);
        view.centerX=x-left;
        view.centerY=y-top;
        if(layout.x!=left||layout.y!=top){
            layout.x=left;layout.y=top;
            try{windows.updateViewLayout(view,layout);}
            catch(RuntimeException unavailable){hide();return;}
        }
        view.invalidate();
    }

    void hide(){
        if(view==null)return;
        try{if(view.isAttachedToWindow())windows.removeViewImmediate(view);}
        catch(IllegalArgumentException ignored){}
        view=null;
    }

    void reset(){
        hide();
        ball=null;
        launched=false;
        kicks=bounces=0;
        last=pulseAt=0;
        kickAt=-1;
        cue=PetMood.Cue.NONE;
        cueAt=0;
    }

    private void react(PetMood.Cue next,long elapsed){
        if(next!=PetMood.Cue.KICK&&cue!=PetMood.Cue.NONE&&elapsed-cueAt<770)return;
        cue=next;
        cueAt=elapsed;
    }

    void expression(PetMood mood,PetPlay.Act act,long elapsed,boolean ambientLines){
        mood.play(act,elapsed,cue,elapsed-cueAt,ambientLines);
    }

    float kickPose(long elapsed){
        long phase=elapsed-kickAt;
        return kickAt<0?0:17*PetMotion.ease(phase/95f)*(1-PetMotion.ease((phase-95)/260f));
    }

    private final class ToyView extends View {
        final PetPlayArt art;
        final boolean rolling;
        float spin,squash,centerX,centerY;

        ToyView(PetPlay.Act act,PetPlayArt art){
            super(context);
            this.art=art;
            rolling=act.ball();
            setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        }

        @Override protected void onDraw(Canvas canvas){
            float size=getWidth();
            canvas.translate(centerX,centerY);
            canvas.scale(size/64f,size/64f);
            if(rolling){
                canvas.scale(1+.15f*squash,1-.27f*squash);
                canvas.rotate(spin);
                art.ball(canvas,20);
            }else{
                canvas.scale(sign,1);
                canvas.rotate(spin);
                art.plane(canvas,20);
            }
        }
    }
}
