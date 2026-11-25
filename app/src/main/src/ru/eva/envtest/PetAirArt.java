package ru.eva.envtest;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Rect;

/** Three small textures share the original contact illustration and native ink registration. */
final class PetAirArt {
    private static final int LEFT=151,SPLIT=201,RIGHT=251;
    private final Bitmap body,left,right;
    private final int bodyLeft,bodyTop;
    private final PetAir.Leg leg=new PetAir.Leg();
    private final float[] legMesh=new float[2*(PetAir.ROWS+1)*(PetAir.COLS+1)];
    private final float[] bodyMesh=new float[2*(PetAir.BODY_ROWS+1)*(PetAir.BODY_COLS+1)];

    PetAirArt(Bitmap original,Rect bounds){
        bodyLeft=bounds.left;bodyTop=bounds.top;
        int bodyHeight=349-bodyTop;
        int[] top=new int[bounds.width()*bodyHeight];
        original.getPixels(top,0,bounds.width(),0,0,bounds.width(),bodyHeight);
        int height=PetAir.BOTTOM-PetAir.TOP;
        int[] legs=new int[(RIGHT-LEFT)*height];
        // The registered original ends at y530; y530 is transparent padding.
        original.getPixels(legs,0,RIGHT-LEFT,LEFT-bounds.left,PetAir.TOP-bodyTop,
            RIGHT-LEFT,Math.min(height,bounds.bottom-PetAir.TOP));
        for(int y=PetAir.TOP;y<349;y++)for(int x=LEFT;x<RIGHT;x++){
            int legAt=(y-PetAir.TOP)*(RIGHT-LEFT)+x-LEFT;
            float fingers=PetMotion.ease((y-325)/22f);
            boolean outer=x<Math.round(154+2*fingers)||x>Math.round(245-2*fingers);
            if(outer)legs[legAt]=0;
            // Keep the actual jacket hem, which overlaps both thighs.
            else if(y>313)top[(y-bodyTop)*bounds.width()+x-bodyLeft]=0;
        }
        body=Bitmap.createBitmap(top,bounds.width(),bodyHeight,Bitmap.Config.ARGB_8888);
        left=Bitmap.createBitmap(legs,0,RIGHT-LEFT,SPLIT-LEFT,height,Bitmap.Config.ARGB_8888);
        right=Bitmap.createBitmap(legs,SPLIT-LEFT,RIGHT-LEFT,RIGHT-SPLIT,height,Bitmap.Config.ARGB_8888);
        body.prepareToDraw();left.prepareToDraw();right.prepareToDraw();
    }

    private void leg(Canvas canvas,Paint paint,boolean lead,float phase,float amplitude){
        Bitmap image=lead?right:left;
        int start=lead?SPLIT:LEFT;
        PetAir.sample(leg,lead,phase,amplitude);
        int at=0;
        for(int row=0;row<=PetAir.ROWS;row++){
            float y=PetAir.TOP+image.getHeight()*row/(float)PetAir.ROWS;
            for(int col=0;col<=PetAir.COLS;col++){
                PetAir.legVertex(leg,start+image.getWidth()*col/(float)PetAir.COLS,y,legMesh,at);
                at+=2;
            }
        }
        canvas.drawBitmapMesh(image,PetAir.COLS,PetAir.ROWS,legMesh,0,null,0,paint);
    }

    void draw(Canvas canvas,Paint paint,float phase,float amplitude){
        leg(canvas,paint,false,phase,amplitude);
        leg(canvas,paint,true,phase,amplitude);
        float weight=amplitude*(float)Math.sin(Math.PI*phase);
        int at=0;
        for(int r=0;r<=PetAir.BODY_ROWS;r++){
            float y=bodyTop+body.getHeight()*r/(float)PetAir.BODY_ROWS;
            for(int c=0;c<=PetAir.BODY_COLS;c++){
                float x=bodyLeft+body.getWidth()*c/(float)PetAir.BODY_COLS;
                PetAir.bodyVertex(x,y,weight,bodyMesh,at);at+=2;
            }
        }
        canvas.drawBitmapMesh(body,PetAir.BODY_COLS,PetAir.BODY_ROWS,bodyMesh,0,null,0,paint);
    }
}
