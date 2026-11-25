package ru.eva.envtest;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.RectF;

/** Compose the seated scene in its native 402 by 540 drawing coordinates. */
final class PetSeatedArt {
    private static final Rect CUP=new Rect(0,0,40,35),BOOK=new Rect(42,0,116,50);
    private static final Rect PAGE=new Rect(120,0,150,37),LIDS=new Rect(0,50,55,81),GAZE=new Rect(56,50,111,81);
    private static final Rect BOOKMARK=new Rect(131,11,138,27);
    private static final Rect UPPER=new Rect(0,82,48,167),FORE=new Rect(49,82,97,187);
    private final Bitmap atlas,cigarette,smoke;
    private final Paint brush=new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG);
    private final RectF destination=new RectF();
    private final Matrix matrix=new Matrix();
    private final float[] from=new float[6],to=new float[6];
    private final float[] bodyMesh=new float[2*3*17];

    PetSeatedArt(Bitmap atlas,Bitmap cigarette,Bitmap smoke){
        this.atlas=atlas;this.cigarette=cigarette;this.smoke=smoke;
    }

    private void sprite(Canvas c,Bitmap ink,Rect tile,float x,float y,float w,float h,float opacity){
        destination.set(x,y,x+w,y+h);
        brush.setAlpha(Math.round(255*PetMotion.clamp(opacity,0,1)));
        c.drawBitmap(ink,tile,destination,brush);
        brush.setAlpha(255);
    }

    private void bone(Canvas c,Rect tile,float sx,float sy,float ex,float ey,
            float x,float y,float targetX,float targetY){
        float dx=ex-sx,dy=ey-sy,span=(float)Math.hypot(dx,dy);
        float tx=targetX-x,ty=targetY-y,length=Math.max(.01f,(float)Math.hypot(tx,ty));
        from[0]=sx;from[1]=sy;from[2]=ex;from[3]=ey;
        from[4]=sx-dy/span*10;from[5]=sy+dx/span*10;
        to[0]=x;to[1]=y;to[2]=targetX;to[3]=targetY;
        to[4]=x-ty/length*10;to[5]=y+tx/length*10;
        matrix.setPolyToPoly(from,0,to,0,3);
        c.save();
        c.concat(matrix);
        int offset=tile==FORE?49:0;
        destination.set(0,offset,tile.width(),offset+tile.height());
        c.drawBitmap(atlas,tile,destination,brush);
        c.restore();
    }

    private void forearm(Canvas c,PetSeat pose){
        bone(c,FORE,17,67,17,138,pose.elbowX,pose.elbowY,pose.handX,pose.handY);
    }

    private void body(Canvas c,Bitmap image,Rect area,float nod){
        if(nod<.015f){
            destination.set(area);
            c.drawBitmap(image,null,destination,brush);
            return;
        }
        float angle=(float)Math.toRadians(nod*1.20f);
        float cos=(float)Math.cos(angle),sin=(float)Math.sin(angle);
        int i=0;
        for(int row=0;row<=16;row++){
            float y=area.top+area.height()*row/16f;
            float weight=PetMotion.ease((310-y)/105f);
            for(int col=0;col<=2;col++){
                float x=area.left+area.width()*col/2f;
                bodyMesh[i++]=x+((cos-1)*(x-160)-sin*(y-213)+nod*.16f)*weight;
                bodyMesh[i++]=y+(sin*(x-160)+(cos-1)*(y-213)+nod*.48f)*weight;
            }
        }
        c.drawBitmapMesh(image,2,16,bodyMesh,0,null,0,brush);
    }

    void draw(Canvas c,Bitmap image,Rect area,PetSeat pose){
        if(pose.activity!=PetSeat.Activity.DOZE&&pose.reveal>0){
            bone(c,UPPER,31,0,17,67,175,222,pose.elbowX,pose.elbowY);
            forearm(c,pose);
        }
        body(c,image,area,pose.nod);
        if(pose.closeEyes>0||pose.activity==PetSeat.Activity.BOOK&&pose.reveal>0){
            c.save();
            c.translate(pose.nod*.16f,pose.nod*.48f);
            c.rotate(pose.nod*1.20f,160,213);
            if(pose.closeEyes>0)sprite(c,atlas,LIDS,146,138,55,31,pose.closeEyes);
            else sprite(c,atlas,GAZE,146,138,55,31,pose.reveal);
            c.restore();
        }
        if(pose.reveal<=0)return;
        c.save();
        c.clipRect(194,170,340,342);
        brush.setAlpha(Math.round(255*pose.reveal));
        forearm(c,pose);
        brush.setAlpha(255);
        c.restore();
        c.save();
        c.translate(PetTrickTiming.mix(pose.handX,228,pose.lap),PetTrickTiming.mix(pose.handY,316,pose.lap));
        c.rotate(pose.propAngle);
        if(pose.activity==PetSeat.Activity.TEA){
            sprite(c,atlas,CUP,-22,-22,36,31,pose.reveal);
        }else if(pose.activity==PetSeat.Activity.BOOK){
            sprite(c,atlas,BOOK,-9,-32,62,42,pose.reveal);
            if(pose.page>.01f&&pose.lap<.05f){
                c.save();
                c.rotate(-67*(1-pose.page),22,-23);
                sprite(c,atlas,PAGE,7,-47,18,26,pose.reveal*pose.page);
                c.restore();
            }
        }else if(pose.activity==PetSeat.Activity.SMOKE){
            sprite(c,cigarette,null,-19,-4,37,4.7f,pose.reveal);
        }
        c.restore();
        if(pose.marker>0){
            c.save();
            c.translate(pose.markerX,pose.markerY);
            c.rotate(pose.markerAngle);
            sprite(c,atlas,BOOKMARK,-4,-9,9,20,pose.marker);
            c.restore();
        }
        if(pose.puff>0){
            float t=pose.puff;
            float w=8+29*t,h=16+46*t;
            sprite(c,smoke,null,192+30*t,179-32*t-h,w,h,(float)Math.sin(Math.PI*t)*.48f*pose.reveal);
        }
    }
}
