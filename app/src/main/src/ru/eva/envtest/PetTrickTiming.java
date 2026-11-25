package ru.eva.envtest;

/** One complete sleight of hand, including returning what Eva borrowed. */
final class PetTrickTiming {
    static final long IDLE_MS=35_000,COOLDOWN_MS=75_000;
    static final int DURATION=6600;

    static float ramp(float t,float a,float b){return PetMotion.ease((t-a)/(b-a));}
    static float window(float t,float a,float b,float c,float d){return ramp(t,a,b)*(1-ramp(t,c,d));}
    static float lifted(float t){return window(t,750,1900,4970,6050);}
    static float tucked(float t){return window(t,2000,3000,3880,4800);}
    static float swapped(float t){return window(t,1250,2350,4260,5510);}
    static float mix(float a,float b,float f){return a+(b-a)*f;}

    static void gesture(PetPlay.Pose p,long t){
        float reach=window(t,200,950,1750,2700)+window(t,4270,5060,5690,6450);
        float pocket=window(t,1620,2750,3890,4810);
        p.resetArms();p.wink=false;
        p.near=-72*reach+14*pocket;p.far=-10*reach+6*pocket;
        p.lean=12*reach-4*pocket;p.sink=11*reach;
        p.shift=11*reach-3*pocket;p.reveal=p.accent=p.kick=0;
    }

    static void book(PetSeat p,float t,float engage){
        // A bookmark slips onto her knee. She sets the open book down, fishes
        // the marker out of the fold of her jeans, then reopens the same page.
        p.lap=window(t,11000,12800,17500,19200)*engage;
        float reach=window(t,12400,14800,16500,18100)*engage;
        p.handX=mix(p.handX,249,reach);p.handY=mix(p.handY,334,reach);
        p.elbowX=mix(p.elbowX,199,reach);p.elbowY=mix(p.elbowY,289,reach);
        p.nod+=reach*5;
        if(t<8800||t>18100)return;
        p.marker=window(t,8800,9160,17500,18100)*engage;
        float slip=ramp(t,9000,10600),retrieve=ramp(t,15000,17100);
        p.markerX=mix(mix(245,252,slip)+8*(float)Math.sin(slip*Math.PI*2),p.handX,retrieve);
        p.markerY=mix(mix(250,330,slip*slip),p.handY-3,retrieve);
        p.markerAngle=9+63*(float)Math.sin(slip*Math.PI)-18*retrieve;
    }
}
