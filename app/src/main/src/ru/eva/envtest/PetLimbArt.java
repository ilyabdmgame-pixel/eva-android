package ru.eva.envtest;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;

final class PetLimbArt {
    private static final int ROWS=24;
    private final float[] vertices=new float[(ROWS+1)*4];
    private final PetRig.Knee knee=new PetRig.Knee();

    void arm(Canvas c,Bitmap sleeve,Bitmap forearm,boolean near,PetPlay.Pose pose,Paint paint){
        float left=near?222:130;
        float shoulder=near?PetRig.NEAR_SHOULDER_X:PetRig.FAR_SHOULDER_X;
        float elbow=near?PetRig.NEAR_ELBOW_X:PetRig.FAR_ELBOW_X;
        float upper=near?pose.upper():pose.upperFar();
        float depth=near?pose.upperDepth:1;
        c.save();
        c.translate(shoulder,PetRig.SHOULDER_Y);
        c.rotate(upper);
        c.scale(1,depth);
        c.drawBitmap(sleeve,left-shoulder,0,paint);
        c.restore();
        c.save();
        c.translate(PetRig.elbowX(near,upper,depth),PetRig.elbowY(near,upper,depth));
        c.rotate(near?pose.near:pose.far);
        float top=PetRig.SHOULDER_Y-PetRig.ELBOW_Y;
        if(near&&pose.foreDepth<1){
            // Shorten the sleeve up to its cuff in projection. Keep the ink of the hand at native scale.
            float cuff=48,shorten=(1-pose.foreDepth)*(PetRig.GRIP_Y-PetRig.ELBOW_Y);
            c.save();
            c.clipRect(left-elbow,top,left-elbow+forearm.getWidth(),cuff-shorten);
            c.scale(1,(cuff-shorten)/cuff);
            c.drawBitmap(forearm,left-elbow,top,paint);
            c.restore();
            c.clipRect(left-elbow,cuff-shorten,left-elbow+forearm.getWidth(),top+forearm.getHeight());
            top-=shorten;
        }
        c.drawBitmap(forearm,left-elbow,top,paint);
        c.restore();
    }

    void leg(Canvas c,Bitmap bitmap,boolean near,PetPlay.Pose pose,Paint paint){
        float hipX=PetRig.hipX(near,pose.shift,pose.lean);
        float hipY=PetRig.hipY(near,pose.sink,pose.lean);
        float baseHip=near?220:182;
        float ankle=near?220:184;
        float kick=near?PetMotion.clamp(pose.kick/17,0,1):0;
        float footX=ankle+kick*30,footY=488-kick*35;
        float footCos=PetRig.cosine(-17*kick),footSin=PetRig.sine(-17*kick);
        PetRig.knee(knee,hipX,hipY,footX,footY,near);
        float left=near?202:150;
        for(int row=0;row<=ROWS;row++){
            float y=PetRig.PELVIS_Y+row*bitmap.getHeight()/(float)ROWS;
            float original,moveX,moveY;
            if(y<395){
                float t=(y-PetRig.PELVIS_Y)/(395-PetRig.PELVIS_Y);
                original=mix(baseHip,ankle,t);
                moveX=mix(hipX,knee.x,t);
                moveY=mix(hipY,knee.y,t);
            }else{
                float t=PetMotion.clamp((y-395)/93,0,1);
                original=ankle;
                moveX=mix(knee.x,footX,t);
                moveY=mix(knee.y,footY,t);
            }
            for(int side=0;side<2;side++){
                float x=left+side*bitmap.getWidth();
                if(y>488){
                    vertex(row,side,footX+(x-ankle)*footCos-(y-488)*footSin,
                        footY+(x-ankle)*footSin+(y-488)*footCos);
                }else vertex(row,side,moveX+x-original,moveY);
            }
        }
        c.drawBitmapMesh(bitmap,1,ROWS,vertices,0,null,0,paint);
    }

    private void vertex(int row,int side,float x,float y){
        int index=row*4+side*2;
        vertices[index]=x;
        vertices[index+1]=y;
    }

    private static float mix(float a,float b,float t){return a+(b-a)*t;}
}
