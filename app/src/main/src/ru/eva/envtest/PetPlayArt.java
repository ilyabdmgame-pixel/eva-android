package ru.eva.envtest;

import android.content.res.AssetManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;

import java.io.IOException;
import java.io.InputStream;

final class PetPlayArt {
    private final Bitmap torso,far,near,farForearm,nearForearm,farLeg,nearLeg;
    private final Bitmap ball,plane,leaf,camera,broom,torch,cigarette,smoke,headphones,note,glint,dust,beam,bloom;
    private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG);
    private final Paint caption=new Paint(Paint.ANTI_ALIAS_FLAG);
    private String captionText,captionTop,captionBottom;
    private static final float CAPTION_WIDTH=378;
    private final Bitmap[] expressions=new Bitmap[PetMood.Face.values().length];
    private final RectF rectangle=new RectF();
    private final PetLimbArt limbs=new PetLimbArt();
    final PetSeatedArt seated;

    PetPlayArt(AssetManager assets) throws IOException{
        torso=load(assets,"torso");
        far=load(assets,"far");
        near=load(assets,"near");
        farForearm=load(assets,"far_forearm");
        nearForearm=load(assets,"near_forearm");
        farLeg=load(assets,"far_leg");
        nearLeg=load(assets,"near_leg");
        ball=load(assets,"ball");
        plane=load(assets,"plane");
        leaf=load(assets,"leaf");
        camera=load(assets,"camera");
        broom=load(assets,"broom");
        torch=load(assets,"torch");
        cigarette=load(assets,"cigarette");
        smoke=load(assets,"smoke");
        seated=new PetSeatedArt(load(assets,"seated"),cigarette,smoke);
        headphones=load(assets,"headphones");
        note=load(assets,"note");
        glint=load(assets,"glint");
        dust=load(assets,"dust");
        beam=load(assets,"beam");
        bloom=load(assets,"bloom");
        expressions[PetMood.Face.FOCUS.ordinal()]=load(assets,"face_focus");
        expressions[PetMood.Face.CURIOUS.ordinal()]=load(assets,"face_curious");
        expressions[PetMood.Face.WRY.ordinal()]=load(assets,"face_wry");
        expressions[PetMood.Face.PLEASED.ordinal()]=load(assets,"face_pleased");
        expressions[PetMood.Face.SURPRISED.ordinal()]=load(assets,"face_surprised");
        expressions[PetMood.Face.BUFFERING.ordinal()]=load(assets,"face_buffering");
        expressions[PetMood.Face.SMUG.ordinal()]=load(assets,"face_smug");
        expressions[PetMood.Face.SUS.ordinal()]=load(assets,"face_sus");
        expressions[PetMood.Face.BLINK.ordinal()]=load(assets,"face_blink");
        caption.setTypeface(Typeface.create("sans-serif-medium",Typeface.BOLD));
        caption.setTextAlign(Paint.Align.CENTER);
        caption.setTextSize(42);
        caption.setStrokeWidth(7);
        caption.setStrokeJoin(Paint.Join.ROUND);
    }

    private static Bitmap load(AssetManager assets,String name) throws IOException{
        try(InputStream stream=assets.open("eva-pet/play_"+name+".png")){
            Bitmap bitmap=BitmapFactory.decodeStream(stream);
            if(bitmap==null)throw new IOException("Invalid play layer: "+name);
            return bitmap;
        }
    }

    void draw(Canvas canvas,PetPlay.Act act,PetPlay.Pose pose,long elapsed,PetMood mood){
        limbs.leg(canvas,farLeg,false,pose,paint);
        limbs.leg(canvas,nearLeg,true,pose,paint);
        canvas.save();
        canvas.translate(pose.shift,pose.sink);
        canvas.rotate(pose.lean,PetRig.PELVIS_X,PetRig.PELVIS_Y);
        canvas.scale(1,pose.bodyDepth,PetRig.PELVIS_X,PetRig.PELVIS_Y);
        limbs.arm(canvas,far,farForearm,false,pose,paint);
        canvas.drawBitmap(torso,0,0,paint);
        if(pose.wink){
            canvas.save();
            canvas.clipRect(168,101,200,138);
            face(canvas,mood);
            canvas.restore();
        }else face(canvas,mood);
        if(act==PetPlay.Act.BROOM_GUITAR){
            // The far hand grips the handle; the near hand passes over the bristles.
            canvas.save();
            canvas.translate(pose.farHandX(),pose.farHandY());
            canvas.rotate(pose.propAngle);
            sprite(canvas,broom,-24,-8,24,152,pose.reveal);
            canvas.restore();
        }
        if(act==PetPlay.Act.HEADPHONE_CHECK)sprite(canvas,headphones,147,64,253,155,pose.accent);
        limbs.arm(canvas,near,nearForearm,true,pose,paint);
        if(act==null){canvas.restore();return;}
        float x=pose.handX(),y=pose.handY();
        float held=pose.reveal;
        if(held>.02f){
            canvas.save();
            canvas.translate(x,y);
            canvas.scale(held,held);
            drawHeld(canvas,act,pose);
            canvas.restore();
        }
        if(act==PetPlay.Act.LEAF&&elapsed<1000){
            float pickup=PetMotion.ease((elapsed-510)/490f);
            canvas.save();
            canvas.translate(271+(x-271)*pickup,520+(y-520)*pickup);
            canvas.scale(1-held,1-held);
            drawLeaf(canvas);
            canvas.restore();
        }
        effects(canvas,act,pose.accent,elapsed,x,y);
        canvas.restore();
    }

    void storySet(Canvas canvas,PetStories story,long time){
        float appear=PetMotion.ease(time/450f);
        float fade=PetMotion.ease((story.act().duration-time)/420f);
        float visible=appear*fade;
        switch(story.active){
            case LEAF_CASE:
            case ASH_ALIBI:
                // The subsequent LEAF action picks its leaf up at this exact mark.
                if(story.beat==(story.active==PetStories.Story.LEAF_CASE?0:1)){
                    canvas.save();
                    canvas.rotate(-23,271,520);
                    sprite(canvas,leaf,256,491,286,522,visible);
                    canvas.restore();
                }
                break;
            case DUST_DIG:
                // The plane peeks out on the first sweep, then catches the torch.
                if(story.beat<2){
                    float reveal=story.beat==0?PetMotion.ease((time-1100)/1550f):1;
                    sprite(canvas,plane,244,501,304,526,visible*reveal);
                }
                break;
            case NIGHT_CLUB:
                if(story.beat==0){
                    float pulse=1-(time%1000)/1000f;
                    sprite(canvas,note,262,468+29*pulse,279,493+29*pulse,visible*pulse);
                }
                break;
            default:break;
        }
    }

    private void face(Canvas canvas,PetMood mood){
        Bitmap sprite=expressions[mood.face.ordinal()];
        if(sprite!=null)sprite(canvas,sprite,170,104,231,151,mood.weight);
    }

    void bodyFace(Canvas canvas,int frame,PetMood mood){
        float bend,lean;
        if(frame>=PetMotion.SPRING&&frame<PetMotion.SPRING+PetMotion.GENERATED_FRAMES){
            bend=(frame-PetMotion.SPRING)/(float)(PetMotion.GENERATED_FRAMES-1);
            lean=0;
        }else if(frame>=PetMotion.LEAN_FRAME&&frame<PetMotion.LEAN_FRAME+PetMotion.GENERATED_FRAMES){
            lean=(frame-PetMotion.LEAN_FRAME)/(float)(PetMotion.GENERATED_FRAMES-1);
            bend=.33f*lean;
        }else return;
        canvas.save();
        canvas.translate(-5*bend-4*lean,17*bend+4*lean);
        canvas.rotate(3*bend+12*lean,201,301);
        face(canvas,mood);
        canvas.restore();
    }

    void caption(Canvas canvas,PetMood mood){
        if(mood.quip==null||mood.quipWeight<=.01f)return;
        if(!mood.quip.equals(captionText))layoutCaption(mood.quip);
        float first=captionBottom==null?44:37;
        caption.setStyle(Paint.Style.STROKE);
        caption.setColor((Math.round(240*mood.quipWeight)<<24)|0x291e26);
        drawCaptionLines(canvas,first);
        caption.setStyle(Paint.Style.FILL);
        caption.setColor((Math.round(255*mood.quipWeight)<<24)|0xffeed4);
        drawCaptionLines(canvas,first);
    }

    private void drawCaptionLines(Canvas canvas,float first){
        canvas.drawText(captionTop,201,first,caption);
        if(captionBottom!=null)canvas.drawText(captionBottom,201,first+caption.getTextSize(),caption);
    }

    private void layoutCaption(String text){
        captionText=captionTop=text;
        captionBottom=null;
        caption.setTextSize(42);
        float width=caption.measureText(text);
        if(width<=CAPTION_WIDTH)return;
        for(int gap=text.indexOf(' ');gap>=0;gap=text.indexOf(' ',gap+1)){
            float span=Math.max(caption.measureText(text,0,gap),caption.measureText(text,gap+1,text.length()));
            if(span>=width)continue;
            width=span;
            captionTop=text.substring(0,gap);
            captionBottom=text.substring(gap+1);
        }
        if(width>CAPTION_WIDTH)caption.setTextSize(42*CAPTION_WIDTH/width);
    }

    private void drawHeld(Canvas c,PetPlay.Act act,PetPlay.Pose pose){
        switch(act){
            case BALL_SPIN:
                c.translate(4,-24);
                c.rotate(pose.propAngle);
                ball(c,21);
                break;
            case LEAF_FAN:
                c.rotate(pose.propAngle);
                sprite(c,leaf,-18,-50,21,2,1);
                break;
            case CAMERA_REVIEW:
                c.rotate(pose.propAngle);
                sprite(c,camera,0,-29,53,6,1);
                break;
            case PLANE_TEST:
                c.rotate(pose.propAngle);
                plane(c,33);
                break;
            case TORCH_SIGNAL:
                c.rotate(165);
                sprite(c,beam,-42,14,42,140,pose.accent*.63f);
                sprite(c,torch,-8,-18,8,26,1);
                break;
            case THROW:
            case DRIBBLE:
                ball(c,31);
                break;
            case PLANE:
                plane(c,37);
                break;
            case SMOKE:
                c.rotate(10);
                sprite(c,bloom,11,-9,28,8,.35f);
                sprite(c,cigarette,-23,-6,19,2,1);
                break;
            case LEAF:
                drawLeaf(c);
                break;
            case CAMERA:
                sprite(c,camera,-27,-34,27,2,1);
                break;
            case DUST:
                c.rotate(-19);
                sprite(c,broom,-24,-8,24,152,1);
                break;
            case FLASHLIGHT:
                c.rotate(-20);
                sprite(c,beam,-57,15,56,187,.36f);
                sprite(c,torch,-8,-18,8,26,1);
                break;
            default:
                break;
        }
    }

    private void drawLeaf(Canvas c){
        c.rotate(-23);
        sprite(c,leaf,-15,-29,15,2,1);
    }

    private void effects(Canvas c,PetPlay.Act act,float strength,long time,float handX,float handY){
        if(strength<=.01f)return;
        switch(act){
            case CAMERA:
                float height=handY-16;
                sprite(c,bloom,handX-47,height-47,handX+47,height+47,.47f*strength);
                sprite(c,glint,handX-25,height-25,handX+25,height+25,strength);
                break;
            case SMOKE:
                for(int i=0;i<3;i++){
                    float t=(time-2140-i*340)/1330f;
                    if(t<=0||t>=1)continue;
                    float width=12+39*t, smokeHeight=19+71*t;
                    float x=200-74*t-width*.42f;
                    float bottom=143-68*t;
                    float opacity=PetMotion.ease(t/.13f)*(1-PetMotion.ease((t-.48f)/.52f));
                    sprite(c,smoke,x,bottom-smokeHeight,x+width,bottom,opacity*strength*.53f);
                }
                break;
            case DANCE:
            case BROOM_GUITAR:
                if(act==PetPlay.Act.DANCE)sprite(c,headphones,147,64,253,155,strength);
                for(int i=0;i<3;i++){
                    float t=((time+410*i)%1520)/1520f;
                    float x=277+21*i+7*PetPlay.sin(t*2),y=166-94*t;
                    sprite(c,note,x-6,y-18,x+9,y+3,strength*(1-t));
                }
                break;
            case DUST:
                for(int i=0;i<5;i++){
                    float t=((time+i*169)%940)/940f;
                    float x=handX+26+i*9+28*t,y=517-45*t,r=4+i%3+5*t;
                    sprite(c,dust,x-r,y-r,x+r,y+r,(1-t)*strength*.56f);
                }
                break;
            default:
                break;
        }
    }

    void ball(Canvas c,float radius){
        sprite(c,ball,-radius,-radius,radius,radius,1);
    }

    void plane(Canvas c,float radius){
        float height=radius*plane.getHeight()/plane.getWidth();
        sprite(c,plane,-radius,-height,radius,height,1);
    }

    private void sprite(Canvas c,Bitmap bitmap,float left,float top,float right,float bottom,float alpha){
        rectangle.set(left,top,right,bottom);
        paint.setAlpha(Math.round(255*PetMotion.clamp(alpha,0,1)));
        c.drawBitmap(bitmap,null,rectangle,paint);
        paint.setAlpha(255);
    }
}
