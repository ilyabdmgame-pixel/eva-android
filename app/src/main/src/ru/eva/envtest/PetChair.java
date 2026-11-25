package ru.eva.envtest;

/** One reversible timeline: unfold first, put weight on the seat second. */
final class PetChair {
    static final int DURATION=1400;
    private long began;
    private float start;
    boolean deployed;

    void set(boolean open,long now,boolean animate){
        start=animate?phase(now):(open?1:0);
        began=now;
        deployed=open;
    }

    float phase(long now){
        float elapsed=Math.max(0,now-began)/(float)DURATION;
        return PetMotion.clamp(start+(deployed?elapsed:-elapsed),0,1);
    }

    static float unfolding(float phase){return PetMotion.ease(phase/.48f);}
    static float sitting(float phase){return PetMotion.ease((phase-.48f)/.52f);}

    static boolean hipOn(int left,int top,int right,int x,int y,int w,int h,boolean mirrored,int tolerance){
        float hip=x+w*(mirrored?.55f:.45f);
        return hip>=left-tolerance&&hip<=right+tolerance&&
            Math.abs(y+Math.round(h*PetPlacement.SEAT_CONTACT)-top)<=tolerance;
    }
}
