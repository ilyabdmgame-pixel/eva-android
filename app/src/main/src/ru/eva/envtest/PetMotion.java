package ru.eva.envtest;

final class PetMotion {
    static final int IDLE=0, WAVE=1, CURIOUS=2, SIT=3, WALK=4, CLIMB=8, PEEK=9, LAND=10, SMILE=11, POINT=12, LEAN=13, STRETCH=14, DOZE=15, CLIMB_A=16, CLIMB_B=17, GRAB=18, FALL=19;
    static final int POCKET=20, BOOK_TAKE=21, BOOK_READ=22, BOOK_PAGE=23, BOOK_CLOSE=24, BOOK_STORE=25;
    static final int CUP_HOLD=26, CUP_RAISE=27, CUP_SIP=28, CUP_LOWER=29, WINK=30, YAWN=31;
    static final int ENTER_BOTTOM=0, ENTER_SIDE=1, CROSS=2, LEAVE_SIDE=3, GREET=4, HOP=5, GRAVITY_FALL=6, EDGE_LEAN=7, STRETCHING=8, LANDING=9, IDLE_BOOK=10, IDLE_TEA=11, IDLE_WINK=12, IDLE_YAWN=13, HOME_WALK=14, CRAWLING=15, PLACE_LADDER=16, LADDER_UP=17, MANTLE_UP=18, LOOK_AROUND=19, PERCH_LOOK=20, PERCH_STAND=21, ROPE_DOWN=22, SEATED_PEEK=23, ROPE_REACH=24, SHORT_DROP=25;
    static final int WALK_SECOND_HALF=32, WALK_FINAL_PHASES=60;
    static final int CRAWL_DOWN=36, CRAWL_A=37, CRAWL_B=38, CRAWL_UP=39;
    static final int LADDER_HOLD=40, LADDER_A=41, LADDER_B=42, LADDER_HIGH=43;
    static final int MANTLE_HANG=44, MANTLE_PULL=45, MANTLE_KNEE=46, MANTLE_STAND=47;
    static final int POSE_FPS=30, MANTLE_FRAME_MS=167;
    static final long FRAME_NANOS=1_000_000_000L/POSE_FPS;
    static final int MANTLE_DOWN=26, TILT_FALL=27, PERCH_SIT=28, PLAY=29, ROPE_SETTLE=30;
    static final int TAKEOFF_MS=500, TOUCHDOWN_MS=670, SIDE_PASS_MS=1900, SPRING=64, GENERATED_FRAMES=24;
    static final int REACH_BOOK=SPRING+GENERATED_FRAMES, REACH_TEA=REACH_BOOK+GENERATED_FRAMES;
    static final int SEAT_SWING=REACH_TEA+GENERATED_FRAMES, ROPE_GRIP=SEAT_SWING+GENERATED_FRAMES;
    static final int ROPE_GRIPS=36;
    static final int CRAWL_STEP=ROPE_GRIP+ROPE_GRIPS, LEAN_FRAME=CRAWL_STEP+GENERATED_FRAMES;
    static final int RISE_FRAME=LEAN_FRAME+GENERATED_FRAMES;
    static final int GAIT=RISE_FRAME+GENERATED_FRAMES, CRAWL_FOLD=GAIT+GENERATED_FRAMES;
    static final int GAIT_MID=CRAWL_FOLD+GENERATED_FRAMES;
    static final int WALK_PIVOT=GAIT_MID+GENERATED_FRAMES, WALK_PIVOTS=12, WALK_PIVOT_MS=500;
    static final int MANTLE_BETWEEN=WALK_PIVOT+WALK_PIVOTS;
    static final int MANTLE_INBETWEENS=11, ROPE_KEYS=12;
    static final int ROPE_MOUNT=MANTLE_BETWEEN+MANTLE_INBETWEENS, ROPE_RELEASE=ROPE_MOUNT+ROPE_KEYS;
    static final int ROPE_EDGE=ROPE_RELEASE+ROPE_KEYS, ROPE_EDGE_KEYS=37;
    static final int ROPE_BRAKE=ROPE_EDGE+ROPE_EDGE_KEYS, ROPE_RECOVER=ROPE_BRAKE+ROPE_KEYS;
    static final int POSE_COUNT=ROPE_RECOVER+ROPE_KEYS;
    static final int LOAD_HOLD_MS=1200, RECOVER_MS=900;
    static final int SEATED_DURATION=32000,GAIT_CYCLE=240;
    static final float ROPE_HAND_X=301f/402f, ROPE_HAND_Y=94f/540f;
    private static final int WALK_RAMP_MS=500, WALK_FRAME_MS=150;
    static final int CRAWL_FOLD_MS=1330;
    static final int WALK_READY=WALK+1;
    static final int MANTLE_FIRST=48, MANTLE_LAST=59;
    private static final int[] MANTLE_CONTACTS={36,56,110,132,168,193,260,278,325,350,374,374};
    private static final int[] WALK_KEYS={WALK,WALK+1,WALK+2,WALK+3,
        WALK_SECOND_HALF,WALK_SECOND_HALF+1,WALK_SECOND_HALF+2,WALK_SECOND_HALF+3,
        WALK_FINAL_PHASES,WALK_FINAL_PHASES+1,WALK_FINAL_PHASES+2,WALK_FINAL_PHASES+3};
    static final class Pose {
        int frame, nextFrame=-1, nearbyFrame=-1, blendOrigin=-1;
        float nearbyWeight, nearbyFootX;
        float blend, shiftX, shiftY, gaitFootX, angle,airPhase=-1,airAmplitude=1;
        boolean mirrored, seatedPivot;
    }

    private PetMotion() {}

    static float clamp(float value, float min, float max) {
        return Math.max(min, Math.min(max, value));
    }

    static float ease(float fraction) {
        float t=clamp(fraction,0,1);
        return t*t*(3f-2f*t);
    }

    static float travel(float progress){
        return travel(progress,.12f);
    }

    private static float travel(float progress,float ramp){
        float t=clamp(progress,0,1);
        if(t<ramp)return t*t/(2f*ramp*(1f-ramp));
        if(t>1f-ramp)return 1f-travel(1f-t,ramp);
        return (t-ramp/2f)/(1f-ramp);
    }

    static float walkTravel(float progress,int duration){
        return travel(progress,walkRamp(duration)/(float)duration);
    }

    static void groundStride(Pose pose,float distance,int width){
        groundStride(pose,distance,width,.25f);
    }

    static void groundStride(Pose pose,float distance,int width,float start){
        // Sample the legs by distance. The window already carries the whole body continuously.
        float sequence=(start+strideCycles(distance,width))*2*GENERATED_FRAMES;
        int key=Math.round(sequence);
        int neighbor=sequence<key?key-1:key+1;
        float artUnits=GAIT_CYCLE/(2*GENERATED_FRAMES);
        pose.gaitFootX=(key-sequence)*artUnits;
        pose.nearbyFootX=(neighbor-sequence)*artUnits;
        pose.frame=pose.blendOrigin=gaitCel(key);
        pose.nearbyFrame=gaitCel(neighbor);
        pose.nearbyWeight=Math.abs(sequence-key);
        pose.nextFrame=-1;
    }

    private static int gaitCel(int key){
        int phase=Math.floorMod(key,2*GENERATED_FRAMES);
        return ((phase&1)==0?GAIT:GAIT_MID)+phase/2;
    }

    static void inBetween(Pose pose,int first,int count,float progress){
        float index=clamp(progress,0,count-1);
        int main=Math.round(index);
        pose.frame=pose.blendOrigin=first+main;
        pose.nearbyFrame=first+Math.max(0,Math.min(count-1,index<main?main-1:main+1));
        pose.nearbyWeight=Math.abs(index-main);
        pose.nextFrame=-1;
    }

    static boolean gaitFrame(int frame){
        return frame>=GAIT&&frame<GAIT+GENERATED_FRAMES||frame>=GAIT_MID&&frame<GAIT_MID+GENERATED_FRAMES;
    }

    static float gaitOffsetAt(float artY,float footOffset){
        return footOffset*ease(clamp((artY-315)/165,0,1));
    }

    static boolean frontForWalk(Pose p){
        int frame=p.nextFrame<0||p.blend<.5f?p.frame:p.nextFrame;
        return frame==IDLE||frame==RISE_FRAME+GENERATED_FRAMES-1||frame==REACH_BOOK||frame==REACH_TEA||
            frame>=SPRING&&frame<REACH_BOOK||frame>=LEAN_FRAME&&frame<RISE_FRAME;
    }

    static void depart(Pose p,long time,float distance,float total,int width){
        if(time<WALK_PIVOT_MS){
            inBetween(p,WALK_PIVOT,WALK_PIVOTS,time*(WALK_PIVOTS-1f)/WALK_PIVOT_MS);
            p.shiftX=0;
            return;
        }
        float phase=7f/GENERATED_FRAMES;
        // For normal routes, settle with both shoes down without replacing the first planted frame.
        if(strideCycles(total,width)>.4f){
            float correction=strideStart(total,width)-phase;
            correction-=Math.round(correction/.5f)*.5f;
            phase+=correction*ease(distance/total);
        }
        groundStride(p,distance,width,phase);
    }

    static float strideStart(float distance,int width){
        float phase=.05f-strideCycles(distance,width)% .5f;
        return phase<0?phase+.5f:phase;
    }

    private static float strideCycles(float distance,int width){
        return distance*402/(width*GAIT_CYCLE);
    }

    static float mantleSample(float clock){return Math.round(clamp(clock,0,11)*2)/2f;}

    static int mantleArtwork(float frame){
        int step=Math.round(frame*2);
        return (step&1)==0?MANTLE_FIRST+step/2:MANTLE_BETWEEN+step/2;
    }

    private static int walkRamp(int duration){return Math.min(WALK_RAMP_MS,duration/3);}

    static int rebaseX(int x,int oldMaxX,int newMaxX){
        return oldMaxX>0?Math.round(x*(float)newMaxX/oldMaxX):newMaxX/2;
    }

    static int rebaseY(int y,int oldFloor,int newFloor){
        return Math.max(0,newFloor-(oldFloor-y));
    }

    static final class Position {
        final int x,y;
        Position(int x,int y){this.x=x;this.y=y;}
    }

    static Position rotatePosition(int x,int y,int w,int h,int oldMaxX,int oldMaxY,
            int newMaxX,int newMaxY,int turns){
        return rotatePosition(x,y,w,h,oldMaxX,oldMaxY,w,h,newMaxX,newMaxY,turns);
    }

    static Position rotatePosition(int x,int y,int oldW,int oldH,int oldMaxX,int oldMaxY,
            int w,int h,int newMaxX,int newMaxY,int turns){
        int delta=turns&3;
        if(delta==0){
            return new Position(rebaseX(PetGravity.centeredStart(x,oldW,w),oldMaxX+oldW-w,newMaxX),
                rebaseY(PetGravity.centeredStart(y,oldH,h),oldMaxY+oldH-h,newMaxY));
        }
        float u=(x+oldW/2f)/(oldMaxX+oldW),v=(y+oldH/2f)/(oldMaxY+oldH);
        float newU=delta==1?v:delta==2?1-u:1-v;
        float newV=delta==1?1-u:delta==2?1-v:u;
        int newX=Math.round(newU*(newMaxX+w)-w/2f),newY=Math.round(newV*(newMaxY+h)-h/2f);
        return new Position(Math.max(0,Math.min(newX,newMaxX)),Math.max(0,Math.min(newY,newMaxY)));
    }

    static float standingAmount(float progress,boolean sitting){
        float amount=ease(sitting?(progress-.08f)/.82f:(progress-.04f)/.86f);
        return sitting?1-amount:amount;
    }

    static float riseContact(float progress){return ease((progress-.08f)/.80f);}

    // One full cycle of the painted rig travels 104 pixels on its 402-pixel canvas.
    static int crawlCycles(float distance,int bodyWidth){
        if(distance==0 || bodyWidth<=0)return 0;
        return Math.max(1,Math.round(Math.abs(distance)*402f/(104f*bodyWidth)));
    }

    static int crawlStep(float travel,int cycles){
        int phase=Math.round(clamp(travel,0,1)*cycles*GENERATED_FRAMES);
        return CRAWL_STEP+phase%GENERATED_FRAMES;
    }

    static float crawlTravel(float progress,int duration){
        int fold=Math.min(CRAWL_FOLD_MS,duration/3);
        return clamp((progress*duration-fold)/(duration-2f*fold),0,1);
    }

    static float airborne(long time,int duration){
        return clamp((time-TAKEOFF_MS)/(float)(duration-TAKEOFF_MS-TOUCHDOWN_MS),0,1);
    }

    static int duration(int mode) {

        switch (mode) {
            case ENTER_BOTTOM: return 1950;
            case ENTER_SIDE: return SIDE_PASS_MS;
            case CROSS: return 4100;
            case LEAVE_SIDE: return SIDE_PASS_MS;
            case GREET: return 1500;
            case IDLE_WINK: return 3800;
            case IDLE_YAWN: return 4850;
            case HOP: return TAKEOFF_MS+670+TOUCHDOWN_MS;
            case EDGE_LEAN: return 1860;
            case STRETCHING: return 2400;
            case LOOK_AROUND: return 1550;
            case IDLE_BOOK: return 4900;
            case IDLE_TEA: return 3900;
            case PERCH_LOOK: return 1800;
            case PERCH_STAND: return 790;
            case PERCH_SIT: return 930;
            case ROPE_DOWN: return 1800;
            case ROPE_SETTLE: return LOAD_HOLD_MS+RECOVER_MS;
            case MANTLE_DOWN: return 1700;
            case TILT_FALL: return 650;
            case ROPE_REACH: return 600;
            case SHORT_DROP: return 600;
            case SEATED_PEEK: return SEATED_DURATION;
            case GRAVITY_FALL: return 600;
            case LANDING: return TOUCHDOWN_MS;
            case HOME_WALK: return 1250;
            case CRAWLING: return 2*CRAWL_FOLD_MS+1250;
            case PLACE_LADDER: return 1480;
            case LADDER_UP: return 1500;
            case MANTLE_UP: return 12*MANTLE_FRAME_MS;
            default: throw new IllegalArgumentException("Unknown pose sequence");
        }
    }

    static int displacementTime(int mode,float dp){
        float distance=Math.abs(dp);
        switch(mode){
            case CROSS:
            case HOME_WALK:
                return Math.max(750,(int)Math.ceil(1000f*distance/63f)+400);
            case CRAWLING:
                return 2*CRAWL_FOLD_MS+Math.max(720,(int)Math.ceil(1000f*distance/55f));
            default:
                throw new IllegalArgumentException("Unknown displacement mode");
        }
    }

    static int beforeRouteStep(int mode){
        switch(mode){
            case PetHomeMap.CRAWL: return 240;
            case PetHomeMap.JUMP: return 340;
            case PetHomeMap.PLACE: return 380;
            case PetHomeMap.LADDER: return 320;
            case PetHomeMap.MANTLE: return 420;
            default: return 0;
        }
    }

    static long poseTime(long elapsed){
        return (Math.max(0,elapsed)*POSE_FPS/1000*1000+POSE_FPS-1)/POSE_FPS;
    }

    static float mantleClock(float first,long elapsed){
        return first+Math.max(0,elapsed)/(float)MANTLE_FRAME_MS;
    }

    static void sample(Pose p,int mode,long time,boolean left) {
        sample(p,mode,time,duration(mode),left);
    }

    static void sample(Pose p,int mode,long time,int duration,boolean left) {
        sample(p,mode,time,duration,left,1);
    }

    static void sample(Pose p,int mode,long time,int duration,boolean left,int crawlCycles) {
        float motion=clamp(time/(float)duration,0,1);
        long elapsed=time;
        time=motion>=1?duration:poseTime(time);
        if(mode==HOP&&elapsed>=duration-TOUCHDOWN_MS&&time<duration-TOUCHDOWN_MS)
            time=duration-TOUCHDOWN_MS;
        float t=clamp(time/(float)duration,0,1);
        p.frame=IDLE;
        p.airPhase=-1;
        p.airAmplitude=1;
        p.nextFrame=p.nearbyFrame=-1;
        p.nearbyWeight=0;
        p.blend=0;
        p.shiftX=p.shiftY=p.gaitFootX=0;
        p.angle=0;
        p.mirrored=p.seatedPivot=false;

        switch (mode) {
            case ENTER_BOTTOM:
                if(t<.31f)blend(p,PEEK,CLIMB,t/.31f);
                else if(t<.68f)blend(p,CLIMB,LAND,(t-.31f)/.37f);
                else blend(p,LAND,IDLE,(t-.68f)/.32f);
                p.shiftY=1f-ease(motion);
                break;
            case ENTER_SIDE:
            case LEAVE_SIDE:
                p.mirrored=mode==ENTER_SIDE?left:!left;
                boolean entering=mode==ENTER_SIDE;
                long gaitTime=entering?duration-WALK_RAMP_MS+time:time-WALK_RAMP_MS;
                walk(p,gaitTime,2*duration-WALK_RAMP_MS);
                p.shiftX=(left?1:-1)*(entering?(1f-motion)*(1f-motion):motion*motion);
                break;
            case CROSS:
            case HOME_WALK:
                p.mirrored=left;
                int ramp=walkRamp(duration);
                walk(p,time-ramp,duration-ramp);
                break;
            case GREET:
            case STRETCHING:
            case IDLE_WINK:
            case IDLE_YAWN:
                // The standing character's textured rig performs these gestures.
                break;
            case HOP:
                if(elapsed<TAKEOFF_MS){
                    float takeoff=elapsed/(float)TAKEOFF_MS;
                    spring(p,takeoff<.6f?ease(takeoff/.6f):1-.8f*ease((takeoff-.6f)/.4f));
                }else if(time<duration-TOUCHDOWN_MS){
                    air(p,airborne(time,duration),clamp((duration-TAKEOFF_MS-TOUCHDOWN_MS)/650f,.55f,1));
                }else spring(p,landingBend((elapsed-duration+TOUCHDOWN_MS)/(float)TOUCHDOWN_MS));
                p.mirrored=left;
                break;
            case EDGE_LEAN:
            case PERCH_LOOK:
                p.mirrored=left;
                float reach=ease(motion/.36f)*(1f-ease((motion-.68f)/.32f));
                inBetween(p,LEAN_FRAME,GENERATED_FRAMES,reach*(mode==PERCH_LOOK?23:17));
                break;
            case SEATED_PEEK:
                p.mirrored=left;
                p.seatedPivot=true;
                p.frame=SEAT_SWING;
                long seatTime=elapsed%12000;
                if(elapsed<duration-1500){
                    if(seatTime>=2400&&seatTime<4800)seatSwing(p,seatTime-2400,1200);
                    else if(seatTime>=7600&&seatTime<10000)seatSwing(p,seatTime-7600,1200);
                }
                break;
            case PERCH_STAND:
            case PERCH_SIT:
                p.mirrored=left;
                inBetween(p,RISE_FRAME,GENERATED_FRAMES,(GENERATED_FRAMES-1)*standingAmount(motion,mode==PERCH_SIT));
                break;
            case IDLE_BOOK:
            case IDLE_TEA:
                int base=mode==IDLE_BOOK?REACH_BOOK:REACH_TEA;
                float reachProp=ease(elapsed/1100f)*ease((duration-elapsed)/1100f);
                inBetween(p,base,GENERATED_FRAMES,reachProp*(GENERATED_FRAMES-1));
                p.angle=reachProp*(mode==IDLE_BOOK?2f:-4f)*(float)Math.sin(Math.PI*t);
                break;
            case ROPE_REACH:
                p.mirrored=left;
                air(p,t,.72f);
                p.angle=12f*(left?-1:1)*(float)Math.sin(Math.PI*t);
                break;
            case SHORT_DROP:
                p.mirrored=left;
                air(p,t,.55f);
                p.angle=7f*(left?-1:1)*(float)Math.sin(Math.PI*t);
                break;
            case ROPE_DOWN:
                p.mirrored=left;
                p.frame=ROPE_GRIP; // PetRopeMotion samples the grip for this particular ledge and drop.
                break;
            case ROPE_SETTLE:
                p.mirrored=left;
                inBetween(p,ROPE_RECOVER,ROPE_KEYS,(ROPE_KEYS-1)*(elapsed-LOAD_HOLD_MS)/(float)RECOVER_MS);
                break;
            case LOOK_AROUND:
                spring(p,.38f*(float)Math.sin(Math.PI*motion));
                p.angle=3.5f*(float)Math.sin(2*Math.PI*t);
                p.mirrored=left;
                break;
            case GRAVITY_FALL:
                air(p,t,clamp(duration/580f,.35f,1));
                p.mirrored=left;
                break;
            case LANDING:
                p.mirrored=left;
                spring(p,landingBend(motion));
                break;
            case CRAWLING:
                p.mirrored=left;
                int fold=Math.min(CRAWL_FOLD_MS,duration/3);
                if(elapsed<fold||elapsed>duration-fold){
                    float amount=Math.min(elapsed,duration-elapsed)/(float)fold;
                    inBetween(p,CRAWL_FOLD,GENERATED_FRAMES,(GENERATED_FRAMES-1)*amount);
                }else{
                    p.frame=crawlStep(travel(crawlTravel(motion,duration)),crawlCycles);
                }
                break;
            case PLACE_LADDER:
            case LADDER_UP:
                p.mirrored=left;
                break;
            case MANTLE_UP:
            case MANTLE_DOWN:
                p.mirrored=left;
                p.frame=MANTLE_FIRST+Math.min(MANTLE_LAST-MANTLE_FIRST,(int)mantleClock(0,time));
                break;
            case TILT_FALL:
                p.mirrored=left;
                air(p,t,.90f);
                break;
            case PLAY:
                p.mirrored=left;
                break;
            default:
                throw new IllegalArgumentException("Unknown pose sequence");
        }
    }

    private static void walk(Pose p,long time,int length) {
        int ramp=Math.min(WALK_RAMP_MS,length/2);
        if(time<0){
            blend(p,IDLE,WALK_READY,(time+ramp)/(float)ramp);
            return;
        }
        int braking=length-ramp;
        int halfSteps=Math.round(braking/(6f*WALK_FRAME_MS));
        int key=1+(int)(Math.min(time,braking)*6*halfSteps/braking);
        p.frame=WALK_KEYS[key%WALK_KEYS.length];
        if(time>=braking)blend(p,p.frame,IDLE,(time-braking)/(float)ramp);
    }

    private static void blend(Pose p,int start,int end,float ratio){
        p.frame=start;
        p.nextFrame=end;
        p.blend=clamp(ratio,0,1);
    }

    private static void air(Pose p,float phase,float amplitude){
        p.frame=PetAir.CONTACT;
        p.airAmplitude=amplitude;
        // Entry and first weight-bearing frame use the very same bitmap.
        if(phase>0&&phase<1)p.airPhase=phase;
    }

    private static void spring(Pose p,float bend){
        inBetween(p,SPRING,GENERATED_FRAMES,bend*(GENERATED_FRAMES-1));
    }

    static float landingBend(float time){
        return landingBend(time,1);
    }

    private static float landingBend(float time,float impact){
        return time<.25f?.20f+(impact-.20f)*ease(time/.25f):impact*(1f-ease((time-.25f)/.75f));
    }

    static int landingFrame(long time,int duration,float impact){
        return SPRING+Math.round((GENERATED_FRAMES-1)*
            landingBend(time>=duration?1:clamp(poseTime(time)/(float)duration,0,1),impact));
    }

    static void sampleLanding(Pose pose,long time,int duration,float impact){
        spring(pose,landingBend(clamp(time/(float)duration,0,1),impact));
    }

    private static void seatSwing(Pose pose,long time,int cycle){
        float index=(time%cycle)*GENERATED_FRAMES/(float)cycle;
        inBetween(pose,SEAT_SWING,GENERATED_FRAMES,index);
        if(index>GENERATED_FRAMES-1){
            float tail=index-(GENERATED_FRAMES-1);
            pose.frame=pose.blendOrigin=SEAT_SWING+(tail<.5f?GENERATED_FRAMES-1:0);
            pose.nearbyFrame=SEAT_SWING+(tail<.5f?0:GENERATED_FRAMES-1);
            pose.nearbyWeight=Math.min(tail,1-tail);
        }
    }

    static int ropeHandX(int width,boolean mirrored){
        return Math.round(width*(mirrored?1f-ROPE_HAND_X:ROPE_HAND_X));
    }

    static int ropeCatchY(int ledge,int height){return ledge-Math.round(height*ROPE_HAND_Y);}

    static int mantleFrame(int index){return MANTLE_FIRST+index;}

    static int mantleContact(int frame){return MANTLE_CONTACTS[frame-MANTLE_FIRST];}

    static float mantleStart(float contact){
        if(contact<=MANTLE_CONTACTS[0])return 0;
        for(int i=1;i<MANTLE_CONTACTS.length;i++){
            if(contact<=MANTLE_CONTACTS[i]){
                int before=MANTLE_CONTACTS[i-1];
                return i-1+(contact-before)/(MANTLE_CONTACTS[i]-before);
            }
        }
        return MANTLE_CONTACTS.length-1;
    }

    static float mantleContactAt(float clock){
        int first=Math.min((int)clock,MANTLE_CONTACTS.length-1);
        int second=Math.min(first+1,MANTLE_CONTACTS.length-1);
        return MANTLE_CONTACTS[first]+(MANTLE_CONTACTS[second]-MANTLE_CONTACTS[first])*(clock-first);
    }


}
