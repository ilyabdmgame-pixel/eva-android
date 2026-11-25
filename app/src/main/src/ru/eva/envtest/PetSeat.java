package ru.eva.envtest;

import java.util.Random;

/** Hips and the bracing hand stay on the ledge throughout each activity. */
final class PetSeat {
    enum Activity { TEA, BOOK, SMOKE, DOZE }
    static final int MIN_MS=25000,MAX_MS=40000;
    private final Random random;
    private final Activity[] order=Activity.values();
    private int picked=order.length;
    Activity activity;
    int duration;
    float lap,marker,markerX,markerY,markerAngle;
    float reveal,handX,handY,elbowX,elbowY,nod,closeEyes,page,puff,propAngle;

    PetSeat(Random random){this.random=random;}

    void begin(){
        if(picked==order.length){
            for(int i=order.length-1;i>0;i--){
                int j=random.nextInt(i+1);
                Activity tmp=order[i];order[i]=order[j];order[j]=tmp;
            }
            if(order[0]==activity){
                Activity tmp=order[0];order[0]=order[1];order[1]=tmp;
            }
            picked=0;
        }
        activity=order[picked++];
        duration=MIN_MS+random.nextInt(MAX_MS-MIN_MS+1);
        sample(0);
    }

    private static float wave(float phase){
        return .5f-.5f*(float)Math.cos(phase*2*Math.PI);
    }

    private static float between(float t,float a,float b,float c,float d){
        return PetMotion.ease((t-a)/(b-a))*(1-PetMotion.ease((t-c)/(d-c)));
    }

    void sample(long elapsed){
        float t=elapsed>=duration?duration:PetMotion.poseTime(elapsed);
        float engage=PetMotion.ease(t/2100f)*PetMotion.ease((duration-t)/2300f);
        lap=marker=markerX=markerY=markerAngle=0;
        closeEyes=page=puff=propAngle=0;
        nod=reveal=0;
        handX=167;handY=298;
        if(activity==Activity.DOZE){
            float breathing=wave(t/4600f),sleep=PetMotion.ease((t-900)/2400)*PetMotion.ease((duration-t-450)/1800);
            closeEyes=sleep;
            nod=(5+2.6f*breathing)*sleep;
            return;
        }
        float x=220,y=277;
        switch(activity){
            case TEA:{
                float phase=Math.max(0,t-3000)%8400;
                float sip=between(phase,600,1940,3060,4760);
                x=236-39*sip;y=279-85*sip;
                propAngle=-10*sip;
                nod=engage*(1.2f+2*sip);
                break;
            }
            case BOOK:{
                float phase=Math.max(0,t-3100)%7000;
                page=between(phase,2650,3500,3660,4600)*engage;
                x=240+2*page;y=273-4*page;
                propAngle=-6+3*page;
                nod=engage*(4.0f+1.2f*wave(t/4900f));
                break;
            }
            case SMOKE:{
                float phase=Math.max(0,t-2800)%9000;
                float drag=between(phase,650,2020,2890,4320);
                x=235-36*drag;y=281-95*drag;
                propAngle=4-12*drag;
                if(phase>3150&&phase<5320)puff=(phase-3150)/2170f*engage;
                nod=drag*1.8f*engage;
                break;
            }
            default:break;
        }
        handX+=(x-handX)*engage;handY+=(y-handY)*engage;
        // Both arm bones project toward screen right. Keep the elbow below
        // the shoulder when lifting the hand and behind the visible wrist.
        float lift=PetMotion.clamp((280-handY)/90f,0,1);
        elbowX=177+engage*(29+18*lift);
        elbowY=277+engage*(24-43*lift);
        reveal=PetMotion.ease((engage-.23f)/.68f);
        if(activity==Activity.BOOK)PetTrickTiming.book(this,t,engage);
    }
}
