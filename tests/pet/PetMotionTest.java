package ru.eva.envtest;

public final class PetMotionTest {
    private static final PetMotion.Pose pose = new PetMotion.Pose();

    private static void verifySeatedActivities(){
        PetSeat seat=new PetSeat(new java.util.Random(113));
        java.util.EnumSet<PetSeat.Activity> seen=java.util.EnumSet.noneOf(PetSeat.Activity.class);
        PetSeat.Activity last=null;
        for(int visit=0;visit<12;visit++){
            seat.begin();
            check(seat.duration>=25000&&seat.duration<=40000&&seat.activity!=last,"seat length and variety");
            if(visit%4==0)seen.clear();
            check(seen.add(seat.activity),"all four seated activities before repeating");
            last=seat.activity;
            float highest=540,page=0,puff=0,closed=0;
            for(int ms=0;ms<seat.duration;ms+=42){
                seat.sample(ms);
                check(seat.activity==last,"the held prop changed during one rest");
                highest=Math.min(highest,seat.handY);
                page=Math.max(page,seat.page);puff=Math.max(puff,seat.puff);closed=Math.max(closed,seat.closeEyes);
                for(boolean left:new boolean[]{true,false}){
                    PetMotion.sample(pose,PetMotion.SEATED_PEEK,ms,seat.duration,left);
                    check(pose.mirrored==left&&pose.seatedPivot&&pose.shiftY==0,"seat stays on its ledge when mirrored");
                }
            }
            switch(seat.activity){
                case TEA:check(highest<204,"cup reaches her mouth");break;
                case BOOK:check(page>.9f,"painted page turns");break;
                case SMOKE:check(puff>.8f&&highest<189,"draw and exhale");break;
                case DOZE:check(closed>.98f,"eyes close while dozing");break;
            }
            seat.sample(seat.duration);
            check(seat.reveal==0&&seat.closeEyes==0&&seat.nod==0,"no prop or bend remains before standing");
        }
    }

    private static double signedArea(float[] mesh,int a,int b,int c){
        return (mesh[b]-mesh[a])*(mesh[c+1]-mesh[a+1])-(mesh[b+1]-mesh[a+1])*(mesh[c]-mesh[a]);
    }

    private static void verifyFlight(){
        PetAir.Leg lead=new PetAir.Leg(),trail=new PetAir.Leg();
        float[] vertices=new float[(PetAir.ROWS+1)*(PetAir.COLS+1)*2];
        for(int step=0;step<=240;step++){
            float t=step/240f;
            PetAir.sample(lead,true,t,1);
            PetAir.sample(trail,false,t,1);
            if(step==120)check(trail.ankleY-lead.ankleY>32,"shoes must separate during the tuck");
            if(step==216)check(lead.ankleY>trail.ankleY+8,"lead leg reaches the floor first");
            for(int side=0;side<2;side++){
                PetAir.Leg leg=side==0?trail:lead;
                int start=side==0?151:201,at=0;
                for(int row=0;row<=PetAir.ROWS;row++)for(int col=0;col<=PetAir.COLS;col++){
                    float x=start+50f*col/PetAir.COLS,y=PetAir.TOP+(PetAir.BOTTOM-PetAir.TOP)*(row/(float)PetAir.ROWS);
                    PetAir.legVertex(leg,x,y,vertices,at);
                    if(step==0||step==240)
                        check(Math.abs(x-vertices[at])<.01&&Math.abs(y-vertices[at+1])<.01,"contact texture moved at the seam");
                    at+=2;
                }
                int stride=(PetAir.COLS+1)*2;
                for(int row=0;row<PetAir.ROWS;row++)for(int col=0;col<PetAir.COLS;col++){
                    int a=row*stride+2*col;
                    check(signedArea(vertices,a,a+2,a+stride)>4&&
                        signedArea(vertices,a+2,a+stride+2,a+stride)>4,"inverted fabric across the bent knee");
                }
            }
        }
        int[] modes={PetMotion.GRAVITY_FALL,PetMotion.TILT_FALL,PetMotion.ROPE_REACH,PetMotion.SHORT_DROP,PetMotion.HOP};
        for(int mode:modes)for(int flight:new int[]{268,603,917})for(boolean mirrored:new boolean[]{false,true}){
            int start=mode==PetMotion.HOP?PetMotion.TAKEOFF_MS:0;
            int duration=start+flight+(mode==PetMotion.HOP?PetMotion.TOUCHDOWN_MS:0);
            PetMotion.sample(pose,mode,start+flight/2,duration,mirrored);
            check(pose.airPhase>.31f&&pose.airPhase<.53f&&pose.airAmplitude>.3f&&pose.mirrored==mirrored,"wrong airborne phase");
            PetMotion.sample(pose,mode,start+flight,duration,mirrored);
            check(pose.frame==PetMotion.landingFrame(0,670,.85f)&&pose.airPhase<0,"first contact still displays an airborne leg");
        }
    }

    private static void verifyRopeDescent(){
        PetMotion.Pose pose=new PetMotion.Pose();
        boolean[] seen=new boolean[PetMotion.ROPE_GRIPS];
        for(int h:new int[]{260,335,410,540}){
            int w=Math.round(h*402f/540),ledge=460,edge=510;
            for(boolean left:new boolean[]{false,true}){
                int startX=PetClimb.rootForHand(edge,w,11,left)+(left?-15:15);
                int startY=ledge-Math.round(374*h/540f);
                int endY=ledge-Math.round(110*h/540f);
                PetClimb.Track approach=new PetClimb.Track(startX,startY,PetClimb.rootForHand(edge,w,2,left),
                    endY,edge,w,left,11,2);
                boolean[] ledgeKeys=new boolean[PetMotion.ROPE_EDGE_KEYS];
                PetRopeMotion approachRoute=new PetRopeMotion(edge,ledge,900,w,h,left);
                for(int ms=0;ms<=approach.duration();ms++){
                    float t=ms/(float)approach.duration();
                    float sample=ms==approach.duration()?1:PetMotion.poseTime(ms)/(float)approach.duration();
                    approachRoute.sampleEdge(pose,approach,t,sample);
                    int key=pose.frame-PetMotion.ROPE_EDGE;
                    ledgeKeys[key]=true;
                    float mix=PetMotion.ease(key/(float)(ledgeKeys.length-1));
                    float localX=164+(271-164)*mix;
                    float actualX=approachRoute.x+w*(pose.shiftX+(left?402-localX:localX)/402);
                    float actualY=approachRoute.y+h*(pose.shiftY+PetRopeMotion.edgePalmY(key)/540);
                    check(t<.25f||Math.abs(actualX-edge)<=.51f,"Palm must reach and remain on the real ledge");
                    check(Math.abs(actualY-ledge)<=1.1f,"Drawn hand must support the transition");
                    if(ms==0)check(approachRoute.x==startX&&approachRoute.y==startY,"Leave the actual sitting position");
                    if(ms==approach.duration())check(approachRoute.x==approach.endX&&approachRoute.y==endY,"Continuous rope entry");
                }
                for(boolean exposed:ledgeKeys)check(exposed,"Expose all ledge keys at the artwork cadence");
                for(int distance:new int[]{1,17,54,123,410,705}){
                    int start=PetMotion.ropeCatchY(ledge,h),bottom=start+distance;
                    PetRopeMotion track=new PetRopeMotion(edge,ledge,bottom,w,h,left);
                    int previousY=Integer.MIN_VALUE;
                    for(int ms=0;ms<=track.duration;ms+=4){
                        PetMotion.sample(pose,PetMotion.ROPE_DOWN,ms,track.duration,left);
                        track.sample(pose,ms);
                        check(track.y>=previousY&&track.y<=bottom,"Rope descent must not reverse or pass the support");
                        previousY=track.y;
                        check(pose.mirrored==left,"Rope facing changed");
                        if(ms<PetRopeMotion.MOUNT_MS){
                            int key=pose.frame-PetMotion.ROPE_MOUNT;
                            float t=PetMotion.ease(key/(float)(PetMotion.ROPE_KEYS-1));
                            float handX=271+30*t,handY=110-16*t;
                            check(Math.abs(track.x+(left?402-handX:handX)*w/402-edge)<=.51f&&
                                Math.abs(track.y+handY*h/540-ledge)<=.51f,"Mount palm left the ledge");
                        }else if(pose.frame>=PetMotion.ROPE_GRIP&&pose.frame<PetMotion.CRAWL_STEP){
                            int time=ms-PetRopeMotion.MOUNT_MS;
                            int inCycle=time%PetRopeMotion.CYCLE_MS;
                            boolean near=inCycle>=PetRopeMotion.FAR_HAND_MS;
                            float u=near?(inCycle-PetRopeMotion.FAR_HAND_MS)/(float)(PetRopeMotion.CYCLE_MS-PetRopeMotion.FAR_HAND_MS):
                                inCycle/(float)PetRopeMotion.FAR_HAND_MS;
                            int half=PetMotion.ROPE_GRIPS/2,key=Math.round(u*half);
                            int actualFrame=pose.frame-PetMotion.ROPE_GRIP;
                            check(actualFrame==(key+(near?half:0))%PetMotion.ROPE_GRIPS,"Wrist order was reversed");
                            seen[actualFrame]=true;
                            float drawn=key/(float)half;
                            float armY=168-PetRopeMotion.REACH*PetRopeMotion.lowering(drawn);
                            float actual=track.y+(pose.shiftY+armY/540f)*h;
                            int stroke=2*(time/PetRopeMotion.CYCLE_MS)+(near?1:0);
                            float pin=start+(168+stroke*PetRopeMotion.REACH)*h/540f;
                            check(Math.abs(actual-pin)<=.51f,"Loaded wrist slipped in screen coordinates");
                            check(Math.abs(track.x+PetMotion.ropeHandX(w,left)-edge)<=1,"Wrist misses rope axis");
                        }else if(ms<track.duration-PetRopeMotion.RELEASE_MS){
                            check(pose.frame>=PetMotion.ROPE_BRAKE&&pose.frame<PetMotion.ROPE_RECOVER,
                                "Use the shoe brake for the remaining distance");
                        }else{
                            int key=pose.frame-PetMotion.ROPE_RELEASE;
                            check(key>=0&&key<PetMotion.ROPE_KEYS,"Invalid release frame");
                            if(key>=PetRopeMotion.FOOT_CONTACT_KEY)check(track.y==bottom,"Sole moved after planting");
                        }
                    }
                    track.sample(pose,track.duration);
                    check(track.y==bottom&&pose.frame==PetMotion.ROPE_RELEASE+PetMotion.ROPE_KEYS-1,
                        "Finish in the planted side stance");
                }
            }
        }
        boolean[] recovery=new boolean[PetMotion.ROPE_KEYS];
        for(int t=0;t<=PetMotion.duration(PetMotion.ROPE_SETTLE);t++){
            PetMotion.sample(pose,PetMotion.ROPE_SETTLE,t,true);
            int key=pose.frame-PetMotion.ROPE_RECOVER;
            recovery[key]=true;
            check(pose.mirrored&&(t>=PetMotion.LOAD_HOLD_MS||key==0),"Hold the landing before turning");
        }
        for(boolean exposed:recovery)check(exposed,"The recovery must reach every drawing");
        for(boolean exposed:seen)check(exposed,"Long descents must use the complete grip cycle");
    }

    public static void main(String[] args) {
        verifyFlight();
        verifySeatedActivities();
        for (int mode=0; mode<=PetMotion.PERCH_SIT; mode++) {
            for (int time=-10; time<PetMotion.duration(mode)+50; time+=10) {
                for (boolean left : new boolean[]{false,true}) {
                    PetMotion.sample(pose,mode,time,left);
                    check(pose.frame>=0 && pose.frame<PetMotion.POSE_COUNT,"Invalid atlas frame");
                    check(pose.nextFrame>=-1&&pose.nextFrame<PetMotion.POSE_COUNT&&pose.blend>=0&&pose.blend<=1,"Invalid transition");
                    check(Math.abs(pose.shiftX)<=1 && Math.abs(pose.shiftY)<=1,"Translation exceeds one window");

                }
            }
        }
        PetPlay.Pose gesture=new PetPlay.Pose();
        PetMood expression=new PetMood();
        for(int animation:new int[]{PetMotion.GREET,PetMotion.STRETCHING,PetMotion.IDLE_WINK,PetMotion.IDLE_YAWN}){
            int length=PetMotion.duration(animation);
            float lastX=0,lastY=0,maxReach=0;
            for(int t=0;t<=length;t+=20){
                PetGesture.sample(gesture,animation,PetMotion.poseTime(t),length,expression);
                float x=gesture.worldHandX(),y=gesture.worldHandY();
                check(t==0||Math.hypot(x-lastX,y-lastY)<44,"Gesture hands must pass through the intervening arc");
                maxReach=Math.max(maxReach,PetRig.GRIP_Y-y);
                lastX=x; lastY=y;
            }
            PetGesture.sample(gesture,animation,length,length,expression);
            check(maxReach>78&&Math.abs(gesture.near)<.001f&&Math.abs(gesture.far)<.001f,
                "The gesture must travel and recover to the shared stance");
        }
        PetGesture.sample(gesture,PetMotion.IDLE_WINK,1520,3800,expression);
        check(gesture.wink&&expression.face==PetMood.Face.BLINK,"A wink closes a single eye");
        PetPlay.sample(gesture,PetPlay.Act.CAMERA,0);
        check(!gesture.wink&&Float.isNaN(gesture.farShoulder),"Gestures must release face and shoulder overrides before play");
        PetMotion.sample(pose,PetMotion.ENTER_BOTTOM,0,false);
        check(pose.frame==PetMotion.PEEK && pose.shiftY==1,"Bottom entrance must start below the viewport");
        PetMotion.sample(pose,PetMotion.ENTER_BOTTOM,500,false);
        check(pose.nextFrame==PetMotion.CLIMB && pose.blend>.5f && pose.shiftY>0 && pose.shiftY<1,"Missing climb transition");
        PetMotion.sample(pose,PetMotion.ENTER_BOTTOM,PetMotion.duration(PetMotion.ENTER_BOTTOM),false);
        check(pose.nextFrame==PetMotion.IDLE && pose.blend==1 && pose.shiftY==0,"Missing bottom landing");
        for (boolean left : new boolean[]{false,true}) {
            PetMotion.sample(pose,PetMotion.ENTER_SIDE,0,left);
            check(pose.shiftX==(left?1:-1) && pose.mirrored==left,"Incorrect side entrance direction");
            int passingFrame=pose.frame;
            PetMotion.sample(pose,PetMotion.LEAVE_SIDE,PetMotion.SIDE_PASS_MS,!left);
            check(pose.frame==passingFrame && pose.mirrored==left,"The stride must continue across the edge");
            PetMotion.sample(pose,PetMotion.LEAVE_SIDE,PetMotion.SIDE_PASS_MS,left);
            check(pose.shiftX==(left?1:-1) && pose.mirrored!=left,"Incorrect side exit direction");
        }
        PetMotion.sample(pose,PetMotion.CROSS,250,true);
        check(pose.frame==PetMotion.IDLE&&pose.nextFrame==PetMotion.WALK_READY&&pose.blend>.4f&&pose.blend<.6f,
            "Walking should start with weight transfer");
        PetMotion.sample(pose,PetMotion.CROSS,3850,true);
        check(pose.nextFrame==PetMotion.IDLE&&pose.blend>0&&pose.blend<1,
            "Walking should settle into a standing pose before the next action");
        boolean[] seen = new boolean[64];
        for(int time=500;time<=3600;time+=40) {
            PetMotion.sample(pose,PetMotion.CROSS,time,true);
            seen[pose.frame]=true;
            check(pose.mirrored,"The walk must face left");
        }
        for(int i=0;i<4;i++){
            check(seen[PetMotion.WALK+i],"First half of the new walk cycle is incomplete");
            check(seen[PetMotion.WALK_SECOND_HALF+i],"Middle walk phases are incomplete");
            check(seen[PetMotion.WALK_FINAL_PHASES+i],"Final walk phases are incomplete");
        }
        check(PetMotion.travel(0)==0&&PetMotion.travel(1)==1&&
            PetMotion.travel(.05f)<.05f&&PetMotion.travel(.95f)>.95f,"Walking should ease in and out");
        for(boolean mirror:new boolean[]{false,true}){
            int sign=mirror?-1:1;
            float previous=0;
            boolean[] phases=new boolean[48];
            for(int i=0;i<=480;i++){
                float distance=i*306f*PetMotion.GAIT_CYCLE/(480f*402);
                pose.mirrored=mirror;
                pose.shiftX=0;
                PetMotion.groundStride(pose,distance,306,0);
                float center=sign*distance+306*pose.shiftX;
                if(i>0)check(Math.abs(center-previous-sign*distance/i)<.001f,
                    "The torso must advance on every tick, including gait key changes");
                previous=center;
                int index=pose.frame>=PetMotion.GAIT_MID?2*(pose.frame-PetMotion.GAIT_MID)+1:2*(pose.frame-PetMotion.GAIT);
                phases[index]=true;
            }
            for(boolean visited:phases)check(visited,"All full and half steps must enter the walk cycle");
        }
        for(int distance:new int[]{19,118,306,765}){
            pose.shiftX=0;
            PetMotion.groundStride(pose,distance,306,PetMotion.strideStart(distance,306));
            check((pose.frame-PetMotion.GAIT)%12==1,"End a stride with both soles down");
        }
        for(boolean mirror:new boolean[]{false,true}){
            pose.mirrored=mirror;
            for(int t=0;t<PetMotion.WALK_PIVOT_MS;t+=10){
                PetMotion.depart(pose,t,0,350,306);
                check(pose.frame>=PetMotion.WALK_PIVOT&&pose.frame<PetMotion.WALK_PIVOT+12&&
                    pose.nextFrame==-1&&pose.shiftX==0&&pose.mirrored==mirror,"Pivot at the current foot contact");
            }
            PetMotion.depart(pose,PetMotion.WALK_PIVOT_MS,0,350,306);
            check(pose.frame==PetMotion.GAIT+7&&pose.shiftX==0,"Enter the same profile used by the drawn pivot endpoint");
        }
        PetMotion.inBetween(pose,PetMotion.RISE_FRAME,PetMotion.GENERATED_FRAMES,8.25f);
        check(pose.frame==PetMotion.RISE_FRAME+8&&pose.nearbyFrame==pose.frame+1&&pose.nearbyWeight==.25f,
            "Standing must include an interpolated sample between neighboring drawings");
        PetMotion.inBetween(pose,PetMotion.RISE_FRAME,PetMotion.GENERATED_FRAMES,8.75f);
        check(pose.nearbyFrame==pose.frame-1&&pose.nearbyWeight==.25f,
            "The neighboring sample must stay continuous when the nearest drawing changes");
        PetMotion.sampleLanding(pose,0,670,1);
        check(pose.frame==PetMotion.landingFrame(0,670,1),"Landing must keep the first contact image");
        PetMotion.sample(pose,PetMotion.GREET,0,false);
        check(pose.nearbyFrame<0,"A new motion must clear the previous neighboring drawing");
        pose.frame=PetMotion.RISE_FRAME+23;pose.nextFrame=-1;
        check(PetMotion.frontForWalk(pose),"Standing from a seat must turn towards the first step");
        check(PetMotion.mantleArtwork(PetMotion.mantleSample(6.51f))==PetMotion.MANTLE_BETWEEN+6&&
            PetMotion.mantleArtwork(PetMotion.mantleSample(11))==PetMotion.MANTLE_LAST,
            "Ascents and descents must share an in-between without changing the seated endpoint");
        for(boolean left:new boolean[]{false,true}){
            pose.mirrored=left;
            float previousContact=Float.NaN;
            int sign=left?-1:1;
            for(int i=0;i<=240;i++){
                float d=i/4f;
                PetMotion.groundStride(pose,d,402);
                int key=pose.frame>=PetMotion.GAIT_MID?2*(pose.frame-PetMotion.GAIT_MID)+1:2*(pose.frame-PetMotion.GAIT);
                // The planted foot in the baked images travels five design pixels per half-key.
                float contact=sign*(d-key*5+PetMotion.gaitOffsetAt(520,pose.gaitFootX));
                int next=pose.nearbyFrame>=PetMotion.GAIT_MID?2*(pose.nearbyFrame-PetMotion.GAIT_MID)+1:
                    2*(pose.nearbyFrame-PetMotion.GAIT);
                float paired=sign*(d-next*5+PetMotion.gaitOffsetAt(520,pose.nearbyFootX));
                check(Math.abs(contact-paired)<.001f,"Both walking drawings must place the planted shoe together");
                if(i>0)check(Math.abs(contact-previousContact)<.001f,"Planted shoe must stay put across keys");
                previousContact=contact;
                check(PetMotion.gaitOffsetAt(300,pose.gaitFootX)==0,"Shoe correction must not pin the torso");
            }
        }
        PetMotion.sample(pose,PetMotion.LADDER_UP,300,2200,true);
        check(pose.mirrored&&pose.shiftX==0&&pose.shiftY==0,"The rear rig owns all rung offsets");
        PetMotion.sample(pose,PetMotion.EDGE_LEAN,1000,false);
        check(pose.frame>PetMotion.LEAN_FRAME&&pose.angle==0&&pose.nextFrame==-1,
            "Lean should preserve foot contact and bend at the waist");
        int lean=pose.frame;
        PetMotion.sample(pose,PetMotion.EDGE_LEAN,1000,true);
        check(pose.mirrored&&pose.frame==lean,"The same registered lean works on both sides");
        PetMotion.sample(pose,PetMotion.EDGE_LEAN,1860,true);
        check(pose.frame==PetMotion.LEAN_FRAME,"Lean should recover to the original frame");
        int riseDuration=PetMotion.duration(PetMotion.PERCH_STAND);
        PetMotion.sample(pose,PetMotion.PERCH_STAND,0,true);
        check(pose.frame==PetMotion.RISE_FRAME&&pose.mirrored,"Keep the seated direction when standing up");
        PetMotion.sample(pose,PetMotion.PERCH_STAND,riseDuration,true);
        check(pose.frame==PetMotion.RISE_FRAME+23&&PetMotion.riseContact(.9f)==1&&PetMotion.riseContact(.08f)==0,
            "Start with hips on the platform and finish extending after the feet are planted");
        PetPlacement dock=PetPlacement.onSurface("launcher:dock",true,52,2188,1148,2445,306,410,894,2035,850);
        check(dock!=null&&dock.seated&&Math.abs(dock.y+410*PetPlacement.SEAT_CONTACT-2188)<1,"Hips must meet the measured dock");
        PetPlacement chrome=PetPlacement.onSurface("chrome:toolbar",false,0,0,1200,182,306,410,894,2035,850);
        check(chrome!=null&&!chrome.seated&&chrome.left,"Chrome toolbar should use pointing");
        check(!dock.sameSurface(chrome,26)&&!dock.sameSurface(null,26),"Release an anchor after switching screens");
        check(PetPlacement.onSurface("unfit",true,0,20,1200,200,306,410,894,2035,680)==null,"Reject seats outside the visible frame");
        int drop=600;
        int slow=PetPhysics.fallY(0,drop,.25f), fast=PetPhysics.fallY(0,drop,.5f)-slow;
        check(slow<fast&&PetPhysics.fallY(0,drop,1)==drop,"Falling must accelerate and stop on the floor");
        check(PetPhysics.fallTime(drop,3)>PetPhysics.fallTime(drop/2,3),"Longer falls take more time");
        int time=PetPhysics.jumpTime(-150,120,3);
        check(PetPhysics.jumpY(700,550,0,time,3)==700&&PetPhysics.jumpY(700,550,1,time,3)==550,
            "The jump must meet the old and new elevations exactly");
        check(PetPhysics.jumpY(700,550,.8f,time,3)<550,"The jump must descend onto the target");
        PetMotion.sample(pose,PetMotion.LANDING,333,false);
        check(pose.frame>PetMotion.SPRING&&pose.nextFrame==-1,"Landing must bend a complete body over fixed feet");
        PetMotion.sample(pose,PetMotion.LANDING,PetMotion.duration(PetMotion.LANDING),false);
        check(pose.frame==PetMotion.SPRING,"Landing must finish in the identical standing rig");
        checkProp(PetMotion.IDLE_BOOK,PetMotion.REACH_BOOK);
        checkProp(PetMotion.IDLE_TEA,PetMotion.REACH_TEA);
        PetMotion.sample(pose,PetMotion.SEATED_PEEK,2700,true);
        check(pose.frame>PetMotion.SEAT_SWING&&pose.frame<PetMotion.SEAT_SWING+12&&pose.seatedPivot,
            "Seated movement needs to stay anchored to the hips");
        check(PetMotion.duration(PetMotion.SEATED_PEEK)>=11000,"A seat needs time to read as a rest");
        PetMotion.sample(pose,PetMotion.SEATED_PEEK,5900,true);
        check(pose.frame==PetMotion.SEAT_SWING,"The seated scene pauses between motions");
        PetMotion.sample(pose,PetMotion.SEATED_PEEK,PetMotion.SEATED_DURATION,true);
        check(pose.frame==PetMotion.SEAT_SWING,"Stand up from the matching seated frame");
        PetMotion.sample(pose,PetMotion.GRAVITY_FALL,PetMotion.duration(PetMotion.GRAVITY_FALL),false);
        int firstContact=pose.frame;
        PetMotion.sample(pose,PetMotion.LANDING,0,false);
        check(pose.frame==firstContact,"The falling frame must match the start of floor contact");
        verifyRopeDescent();
        PetIdle idle=new PetIdle(new java.util.Random(7));
        PetIdle.Activity last=null;
        for(int cycle=0;cycle<20;cycle++){
            java.util.EnumSet<PetIdle.Activity> seenBehaviors=java.util.EnumSet.noneOf(PetIdle.Activity.class);
            for(int i=0;i<PetIdle.Activity.values().length;i++){
                PetIdle.Activity next=idle.next();
                check(next!=last&&seenBehaviors.add(next),"Idle activity repeated too early");
                last=next;
            }
        }
        for(int i=0;i<12;i++){
            PetMotion.sample(pose,PetMotion.MANTLE_UP,sampleAtOrAfter(i*PetMotion.MANTLE_FRAME_MS),false);
            check(pose.frame==PetMotion.MANTLE_FIRST+i,"Slower mantle must still expose all 12 authored poses");
        }
        check(PetMotion.mantleContact(PetMotion.MANTLE_LAST)==374,"Seat contact must remain on the ledge");
        check(Math.abs(PetMotion.mantleContactAt(PetMotion.mantleStart(337.5f))-337.5f)<.01f,
            "Starting partway through a pull-up must preserve the hand contact");
        java.util.Set<Long> sampled=new java.util.HashSet<>();
        for(int ms=0;ms<1000;ms++)sampled.add(PetMotion.poseTime(ms));
        check(sampled.size()==30 && PetMotion.poseTime(33)==0 && PetMotion.poseTime(34)==34 &&
            PetMotion.poseTime(1000)==1000, "30 distinct timeline samples per second");
        check(PetMotion.displacementTime(PetMotion.HOME_WALK,200)>=2000
            &&new PetLadderMotion(402,286,877,306,410,false).duration(3.25f)>=2400,
            "Walking and climbing must use the slower pace");
        for(int width:new int[]{201,402,804}){
            for(int sign:new int[]{-1,1}){
                int cycles=PetMotion.crawlCycles(sign*width*208/402,width);
                check(cycles==2,"Crawl stride must follow distance at each scale and direction");
                for(int key=0;key<=48;key++){
                    check(PetMotion.crawlStep(key/48f,cycles)==PetMotion.CRAWL_STEP+key%24,
                        "Every crawl key including both endpoint joins must play in order");
                }
            }
        }
        check(PetMotion.crawlCycles(0,402)==0,"Stationary pet must not pedal");
        int crawl=PetMotion.displacementTime(PetMotion.CRAWLING,200);
        check(crawl-2*PetMotion.CRAWL_FOLD_MS>=1000f*200/55,
            "Account for the stationary entry and exit at crawl speed");
        int fold=PetMotion.CRAWL_FOLD_MS;
        check(PetMotion.crawlTravel(fold/(float)crawl,crawl)==0&&
            PetMotion.crawlTravel(1-fold/(float)crawl,crawl)>.9999f,"Only travel with hands planted");
        for(boolean mirror:new boolean[]{false,true}){
            int lastFold=-1;
            for(int t=0;t<fold;t+=42){
                PetMotion.sample(pose,PetMotion.CRAWLING,t,crawl,mirror);
                check(pose.frame>=PetMotion.CRAWL_FOLD&&pose.frame<PetMotion.CRAWL_FOLD+24&&
                    pose.frame>=lastFold&&(lastFold<0||pose.frame<=lastFold+1)&&pose.nextFrame==-1&&pose.mirrored==mirror,
                    "Lower into crawling through consecutive opaque body poses");
                lastFold=pose.frame;
            }
            PetMotion.sample(pose,PetMotion.CRAWLING,crawl,crawl,mirror);
            check(pose.frame==PetMotion.CRAWL_FOLD,"End at the same standing pose used to enter the crawl");
        }
        check(PetMotion.beforeRouteStep(PetHomeMap.JUMP)>=300
            &&PetMotion.beforeRouteStep(PetHomeMap.MANTLE)>=400,"Prepare before jumping or pulling up");
        int airTime=PetPhysics.jumpTimeForRise(60,3.25f);
        check(airTime>=400&&PetPhysics.jumpY(380,380,.5f,airTime,3.25f)<=320,
            "Slower arc must still clear the obstacle");
        int hopDuration=PetMotion.TAKEOFF_MS+airTime+PetMotion.TOUCHDOWN_MS;
        check(PetMotion.airborne(PetMotion.TAKEOFF_MS-1,hopDuration)==0
            &&PetMotion.airborne(PetMotion.TAKEOFF_MS+airTime/2,hopDuration)>.49f
            &&PetMotion.airborne(hopDuration-PetMotion.TOUCHDOWN_MS,hopDuration)==1,
            "Takeoff and landing periods must preserve the physical arc");
        check(PetMotion.rebaseX(224,894,2139)==536&&PetMotion.rebaseX(894,894,2139)==2139,
            "The left/right spacing and wall must follow the new width");
        check(PetMotion.rebaseY(2035,2035,685)==685&&PetMotion.rebaseY(1700,2035,685)==350
            &&PetMotion.rebaseY(500,2035,685)==0,"Floor contact and height need the rotated bounds");
        PetMotion.Position right=PetMotion.rotatePosition(894,2035,306,410,894,2035,2211,595,1);
        PetMotion.Position left=PetMotion.rotatePosition(0,2035,306,410,894,2035,2211,595,1);
        check(right.x==2153&&right.y==0&&left.x==right.x&&left.y==595,
            "A quarter turn must map opposite portrait sides to opposite vertical positions");
        PetMotion.Position reverse=PetMotion.rotatePosition(894,2035,306,410,894,2035,2211,595,3);
        check(reverse.x==58&&reverse.y==595,"Reverse landscape must use the opposite direction");
        PetMotion.Position upside=PetMotion.rotatePosition(0,0,306,410,894,2035,894,2035,2);
        check(upside.x==894&&upside.y==2035,"A half turn changes both coordinates at unchanged screen size");
        PetMotion.Position afterTilt=PetMotion.rotatePosition(500,700,410,306,790,2139,306,410,2211,595,1);
        check(afterTilt.x==725&&afterTilt.y==210,"Rotation must remap the center of the sideways body");
        check(PetGravity.centeredStart(300,306,410)==248&&PetGravity.centeredStart(500,410,306)==552,
            "Swapping the overlay extents must keep the same body center");
        check(PetGravity.bodyAngle(PetGravity.LEFT)==90&&PetGravity.bodyAngle(PetGravity.RIGHT)==-90
            &&PetGravity.bodyAngle(PetGravity.UP)==180&&PetGravity.bodyAngle(PetGravity.DOWN)==0
            &&PetGravity.sideways(PetGravity.LEFT)&&PetGravity.sideways(PetGravity.RIGHT)
            &&!PetGravity.sideways(PetGravity.UP),"The soles must face the active gravity edge");
        PetClimb.Track up=new PetClimb.Track(72,970,198,760,301,306,false,1.5f,11);
        PetClimb.Track down=new PetClimb.Track(198,760,72,970,301,306,false,11,1.5f);
        for(PetClimb.Track track:new PetClimb.Track[]{up,down}){
            check(track.position(0).x==track.startX&&track.position(0).y==track.startY,
                "The ascent and descent start at the current window without a snap");
            check(track.position(1).x==track.endX&&track.position(1).y==track.endY,
                "The route must finish at a known contact");
            int previous=track.startY;
            for(int i=1;i<=40;i++){
                int nextY=track.position(i/40f).y;
                check((nextY-previous)*(track.endY-track.startY)>=0,"The vertical contact path cannot reverse");
                previous=nextY;
            }
        }
        check(PetMotion.landingFrame(0,670,.45f)==PetMotion.landingFrame(0,670,1),
            "Impact strength cannot cause an abrupt first frame");
        check(PetMotion.landingFrame(167,670,.45f)<PetMotion.landingFrame(167,670,1),
            "Short drops should flex the knees less than long ones");
        PetGravity gravity=new PetGravity();
        gravity.read(0,9.81f,0,false);
        check(gravity.direction(0,1000)==PetGravity.DOWN,"Upright physical gravity points to the floor");
        check(gravity.direction(1,1000)==PetGravity.DOWN&&gravity.direction(1,1441)==PetGravity.RIGHT,
            "A change of screen axes must use sustained sensor gravity");
        PetMotion.Position edge=gravity.destination(PetGravity.RIGHT,1,60,150,440,210);
        check(edge.x==440&&edge.y==150,"Side gravity starts from the current height");
        gravity.read(9.81f,0,0,false);
        check(gravity.direction(1,1460)==PetGravity.RIGHT&&gravity.direction(1,1901)==PetGravity.DOWN,
            "Physical rotation of the handset realigns gravity with the new floor");
        gravity.read(0,0,9.81f,false);
        check(gravity.direction(1,2450)==PetGravity.DOWN&&gravity.strength(1)==1,
            "A flat handset should stop producing spurious in-plane directions");
        System.out.println("PetMotion: eased starts and stops, continuous stride, jump timing and rotation geometry checked");
    }

    private static long sampleAtOrAfter(int ms){
        long tick=(ms*24L+999)/1000;
        return (tick*1000+23)/24;
    }

    private static void checkProp(int mode,int first){
        int duration=PetMotion.duration(mode);
        PetMotion.sample(pose,mode,0,false);
        check(pose.frame==first,"A prop scene must start in the same steady pose");
        PetMotion.sample(pose,mode,500,false);
        check(pose.frame>first&&pose.frame<first+23&&pose.nextFrame==-1,"Use rendered arm phases while reaching");
        PetMotion.sample(pose,mode,1800,false);
        check(pose.frame==first+23,"Show the fully held prop");
        PetMotion.sample(pose,mode,duration,false);
        check(pose.frame==first,"Put the prop away before changing state");
    }

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
}
