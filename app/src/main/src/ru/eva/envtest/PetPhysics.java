package ru.eva.envtest;

final class PetPhysics {
    private static final float GRAVITY_DP_PER_SECOND_SQUARED=900f;

    private PetPhysics() {}

    static int fallTime(int pixels,float density) {
        return fallTime(pixels,density,1f);
    }

    static int fallTime(int pixels,float density,float strength) {
        return Math.max(1,Math.round(1000f*(float)Math.sqrt(2f*Math.max(0,pixels)/
            (density*GRAVITY_DP_PER_SECOND_SQUARED*strength))));
    }

    static int jumpTime(int verticalPixels,int horizontalPixels,float density) {
        int flight=fallTime(Math.abs(verticalPixels)+Math.round(60*density),density);
        int lateral=Math.round(1000f*horizontalPixels/(density*265f));
        return Math.max(250,Math.max(flight,lateral));
    }

    static int jumpTimeForRise(int pixels,float density) {
        return Math.max(1,(int)Math.ceil(1000*Math.sqrt(8d*Math.max(0,pixels)/(density*GRAVITY_DP_PER_SECOND_SQUARED))));
    }

    static int jumpTimeForLanding(int displacement,int clearance,float density){
        int rise=Math.max(0,-displacement)+clearance;
        int descent=Math.max(0,displacement)+clearance;
        return fallTime(rise,density)+fallTime(descent,density);
    }

    static int fallY(int from,int ground,float fraction) {
        float t=PetMotion.clamp(fraction,0,1);
        return Math.round(from+(ground-from)*t*t);
    }

    static int jumpY(int from,int to,float fraction,int flightTime,float density) {
        float t=PetMotion.clamp(fraction,0,1);
        float seconds=flightTime/1000f;
        float curvature=.5f*GRAVITY_DP_PER_SECOND_SQUARED*density*seconds*seconds;
        return Math.round(from+(to-from)*t-curvature*t*(1f-t));
    }
}
