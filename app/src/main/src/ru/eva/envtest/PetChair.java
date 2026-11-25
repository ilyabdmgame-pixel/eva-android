package ru.eva.envtest;

/** One reversible timeline: unfold first, put weight on the seat second. */
final class PetChair {
    static final int OPEN_DURATION=820,CLOSE_DURATION=680;
    // Lower edge and horizontal span of both feet on the 402 × 540 chair sprite.
    static final float FLOOR_CONTACT=529f/540f, FOOT_INSET=105f/402f;
    private static final float FOLDED=.42f;
    private long began;
    private float start;
    boolean deployed;

    void set(boolean open,long now,boolean animate){
        start=animate?phase(now):(open?1:0);
        began=now;
        deployed=open;
    }

    float phase(long now){
        float elapsed=Math.max(0,now-began)/(float)(deployed?OPEN_DURATION:CLOSE_DURATION);
        return PetMotion.clamp(start+(deployed?elapsed:-elapsed),0,1);
    }

    static float unfolding(float phase){return PetMotion.ease(phase/FOLDED);}
    static float sitting(float phase){return PetMotion.ease((phase-FOLDED)/(1f-FOLDED));}

    static boolean hipOn(int left,int top,int right,int x,int y,int w,int h,boolean mirrored,int tolerance){
        float hip=x+w*(mirrored?.55f:.45f);
        return hip>=left-tolerance&&hip<=right+tolerance&&
            Math.abs(y+Math.round(h*PetPlacement.SEAT_CONTACT)-top)<=tolerance;
    }
}
