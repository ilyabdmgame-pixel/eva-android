package ru.eva.envtest;

/** Screen-space rope movement. Registered artwork supplies the contacting hand or shoe. */
final class PetRopeMotion {
    static final int HANDOFF=2, MOUNT_MS=670, CYCLE_MS=1450, RELEASE_MS=870;
    static final int FAR_HAND_MS=755;
    static final float REACH=74f;
    static final int FOOT_CONTACT_KEY=4, FOOT_X=245;

    final int edge,top,bottom,width,height,cycles,tailMs,duration;
    final boolean left;
    private final float stride,remainder;
    private final int gripY,gripX,releaseDrop;
    int x,y;
    float swing;

    PetRopeMotion(int edge,int top,int bottom,int width,int height,boolean left){
        this.edge=edge;this.top=top;this.bottom=bottom;
        this.width=width;this.height=height;this.left=left;
        gripX=edge-PetMotion.ropeHandX(width,left);
        gripY=PetMotion.ropeCatchY(top,height);
        stride=2*REACH*height/540f;
        int distance=Math.max(0,bottom-gripY);
        releaseDrop=Math.min(distance,Math.round(22f*height/540));
        distance-=releaseDrop;
        cycles=(int)(distance/stride);
        remainder=distance-cycles*stride;
        // Use the shoes to brake the leftover slide. Never rewind a half-finished grip.
        tailMs=remainder<.5f?0:Math.round(490+560*remainder/stride);
        duration=MOUNT_MS+cycles*CYCLE_MS+tailMs+RELEASE_MS;
    }

    static float lowering(float u){return PetMotion.ease((u-.10f)/.72f);}
    static float reach(float u){return PetMotion.ease((u-.28f)/.60f);}
    static float footFeed(float u){return PetMotion.ease((u-.02f)/.40f);}

    void sample(PetMotion.Pose pose,long elapsed){
        int ms=(int)Math.max(0,Math.min(duration,elapsed));
        pose.mirrored=left;
        pose.shiftY=0;
        swing=0;
        if(ms<MOUNT_MS){
            int key=transitionFrame(ms,MOUNT_MS);
            float t=PetMotion.ease(key/(float)(PetMotion.ROPE_KEYS-1));
            float startHand=PetClimb.handX(HANDOFF,left)/402f;
            float endHand=left?1-PetMotion.ROPE_HAND_X:PetMotion.ROPE_HAND_X;
            x=edge-Math.round(width*(startHand+(endHand-startHand)*t));
            float startHeight=PetMotion.mantleContactAt(HANDOFF)/540f;
            y=top-Math.round(height*(startHeight+(PetMotion.ROPE_HAND_Y-startHeight)*t));
            pose.frame=PetMotion.ROPE_MOUNT+key;
            return;
        }

        x=gripX;
        int gripTime=ms-MOUNT_MS;
        int fullTime=cycles*CYCLE_MS;
        if(gripTime<fullTime){
            int cycle=gripTime/CYCLE_MS;
            int inCycle=gripTime%CYCLE_MS;
            boolean near=inCycle>=FAR_HAND_MS;
            float u=near?(inCycle-FAR_HAND_MS)/(float)(CYCLE_MS-FAR_HAND_MS):inCycle/(float)FAR_HAND_MS;
            int half=PetMotion.ROPE_GRIPS/2;
            int k=Math.round(u*half);
            int frame=((near?half:0)+k)%PetMotion.ROPE_GRIPS;
            float drop=lowering(u);
            y=gripY+Math.round(stride*(cycle+((near?1:0)+drop)/2));
            pose.frame=PetMotion.ROPE_GRIP+frame;
            // While the free hand passes the supporting hand, the latter stays fixed
            // in the world. Correct the subframe difference between sprite and root.
            pose.shiftY=(lowering(k/(float)half)-drop)*REACH/540f;
            swing=(near?-1:1)*(footFeed(u)-drop);
        }else if(gripTime<fullTime+tailMs){
            int time=gripTime-fullTime;
            float u=time/(float)tailMs;
            y=gripY+Math.round(stride*cycles+remainder*PetMotion.ease((u-.10f)/.74f));
            pose.frame=PetMotion.ROPE_BRAKE+transitionFrame(time,tailMs);
            swing=(float)Math.sin(Math.PI*2*u)*Math.min(1,remainder/stride);
        }else{
            int releaseTime=gripTime-fullTime-tailMs;
            int key=transitionFrame(releaseTime,RELEASE_MS);
            // The hips keep lowering while the first shoe opens from the rope.
            // Bind the last increment to the first drawn frame that touches ground.
            float contact=PetMotion.ease(releaseTime/(float)RELEASE_MS*(PetMotion.ROPE_KEYS-1)/(FOOT_CONTACT_KEY-.5f));
            y=bottom-Math.round(releaseDrop*(1-contact));
            pose.frame=PetMotion.ROPE_RELEASE+key;
        }
    }

    private static int transitionFrame(int ms,int duration){
        return Math.round((PetMotion.ROPE_KEYS-1)*PetMotion.clamp(ms/(float)duration,0,1));
    }

    // The seated shoe still bears weight while the upper body rolls across the lip.
    // The registered edge drawings use this same vertical palm path.
    private static final int[] EDGE_KEYS={0,9,14,17,21,26,31,36};
    private static final int[] EDGE_PALM_Y={374,326,302,300,275,224,162,110};

    static float edgePalmY(float frame){
        int k=1;
        while(k<EDGE_KEYS.length-1&&frame>EDGE_KEYS[k])k++;
        float t=PetMotion.clamp((frame-EDGE_KEYS[k-1])/(EDGE_KEYS[k]-EDGE_KEYS[k-1]),0,1);
        return EDGE_PALM_Y[k-1]+t*(EDGE_PALM_Y[k]-EDGE_PALM_Y[k-1]);
    }

    private static int edgeRootX(PetClimb.Track track,float u){
        float first=PetClimb.handX(11,track.left),last=PetClimb.handX(HANDOFF,track.left);
        int offset=track.startX-(track.edge-Math.round(track.width*first/402f));
        return track.edge-Math.round(track.width*(first+(last-first)*PetMotion.ease(u))/402f)
            +Math.round(offset*(1-PetMotion.ease(u/.25f)));
    }

    static boolean fitsEdge(PetClimb.Track track,int maxX,int floor){
        if(track.startY<0||track.endY>floor)return false;
        for(int k=0;k<PetMotion.ROPE_EDGE_KEYS;k++){
            int x=edgeRootX(track,k/(float)(PetMotion.ROPE_EDGE_KEYS-1));
            if(x<0||x>maxX)return false;
        }
        return true;
    }

    void sampleEdge(PetMotion.Pose pose,PetClimb.Track track,float u,float sampled){
        int last=PetMotion.ROPE_EDGE_KEYS-1;
        int key=Math.round(PetMotion.clamp(sampled,0,1)*last);
        float hand0=PetClimb.handX(11,left),hand1=PetClimb.handX(HANDOFF,left);
        float contact=edgePalmY(u*last);
        x=edgeRootX(track,u);
        y=Math.round(track.startY+(track.endY-track.startY)*(374-contact)/(374-110));
        pose.frame=PetMotion.ROPE_EDGE+key;
        pose.shiftX=(PetMotion.ease(u)-PetMotion.ease(key/(float)last))*(hand1-hand0)/402f;
        pose.shiftY=(contact-edgePalmY(key))/540f;
        pose.mirrored=left;
    }
}
