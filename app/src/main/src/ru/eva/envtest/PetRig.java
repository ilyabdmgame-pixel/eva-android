package ru.eva.envtest;

final class PetRig {
    static final float PELVIS_X=201,PELVIS_Y=303;
    static final float NEAR_SHOULDER_X=242,FAR_SHOULDER_X=161,SHOULDER_Y=190;
    static final float NEAR_ELBOW_X=254,FAR_ELBOW_X=147,ELBOW_Y=257,GRIP_Y=328;

    private PetRig(){}

    static float cosine(float degrees){return (float)Math.cos(Math.toRadians(degrees));}
    static float sine(float degrees){return (float)Math.sin(Math.toRadians(degrees));}
    static float rotateX(float x,float y,float degrees){return x*cosine(degrees)-y*sine(degrees);}
    static float rotateY(float x,float y,float degrees){return x*sine(degrees)+y*cosine(degrees);}
    static float upperArm(float angle){return PetMotion.clamp(angle*.31f,-45,45);}

    static float elbowX(boolean near,float upper,float depth){
        float shoulder=near?NEAR_SHOULDER_X:FAR_SHOULDER_X;
        float elbow=near?NEAR_ELBOW_X:FAR_ELBOW_X;
        return shoulder+rotateX(elbow-shoulder,(ELBOW_Y-SHOULDER_Y)*depth,upper);
    }

    static float elbowY(boolean near,float upper,float depth){
        float width=near?NEAR_ELBOW_X-NEAR_SHOULDER_X:FAR_ELBOW_X-FAR_SHOULDER_X;
        return SHOULDER_Y+rotateY(width,(ELBOW_Y-SHOULDER_Y)*depth,upper);
    }

    static float hipX(boolean near,float shift,float lean){
        return PELVIS_X+shift+rotateX(near?19:-19,0,lean);
    }

    static float hipY(boolean near,float sink,float lean){
        return PELVIS_Y+sink+rotateY(near?19:-19,0,lean);
    }

    static final class Knee {
        float x,y;
    }

    static void knee(Knee joint,float hipX,float hipY,float footX,float footY,boolean near){
        float x=footX-hipX,y=footY-hipY;
        float length=(float)Math.hypot(x,y);
        float fold=(float)Math.sqrt(Math.max(0,185f*185f-length*length))*.25f;
        float normal=(near?fold:-fold)/Math.max(1,length);
        joint.x=(hipX+footX)*.5f+y*normal;
        joint.y=(hipY+footY)*.5f-x*normal;
    }
}
