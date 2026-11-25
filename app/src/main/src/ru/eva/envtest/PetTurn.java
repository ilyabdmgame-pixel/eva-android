package ru.eva.envtest;

final class PetTurn {
    static final int MIN_DURATION=1000;
    final float fromX,fromY,toX,toY,fromAngle,toAngle;

    PetTurn(float x,float y,float toX,float toY,float angle,int down){
        fromX=x;fromY=y;this.toX=toX;this.toY=toY;fromAngle=angle;
        float difference=PetGravity.bodyAngle(down)-angle;
        while(difference>180)difference-=360;
        while(difference<-180)difference+=360;
        toAngle=angle+difference;
    }

    float angle(long time,int duration){
        long sample=time>=duration?duration:PetMotion.poseTime(time);
        return fromAngle+(toAngle-fromAngle)*PetMotion.ease(sample/(float)duration);
    }

    float x(float t){return fromX+(toX-fromX)*t*t;}
    float y(float t){return fromY+(toY-fromY)*t*t;}
}
