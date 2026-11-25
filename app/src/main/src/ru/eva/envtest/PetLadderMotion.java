package ru.eva.envtest;

/** Screen-space rungs and contacts shared by the route, prop and painted rear-view rig. */
final class PetLadderMotion {
    static final int COLS=32, ROWS=42;
    static final int REAR_KEY=12, LAST_KEY=23;
    static final float LEFT_HAND=119, RIGHT_HAND=283, HAND_Y=116, SOLE=530;
    static final int MOUNT_MS=310, TRANSFER_MS=690;
    final int width,height,edge,top,bottom,center,halfSpan,rungs,reach,steps;
    final boolean left;
    final float pitch;
    final int startX,startY,endX,endY;

    PetLadderMotion(int edge,int top,int bottom,int w,int h,boolean left){
        this(edge,top,bottom,w,h,left,edge+(left?halfSpan(w):-halfSpan(w)));
    }

    PetLadderMotion(int edge,int top,int bottom,int w,int h,boolean left,int axis){
        this.edge=edge;this.top=top;this.bottom=bottom;this.width=w;this.height=h;this.left=left;
        halfSpan=halfSpan(w);
        center=axis;
        rungs=Math.max(1,Math.round((bottom-top)/(h*.079f)));
        pitch=(bottom-top)/(float)rungs;
        reach=Math.min(rungs,Math.max(1,Math.round((SOLE-HAND_Y)*h/(540*pitch))));
        steps=rungs-reach;
        startX=center-Math.round(width*.5f);
        startY=bottom-Math.round(h*SOLE/540);
        endX=PetClimb.rootForHand(edge,w,2,left);
        endY=top-Math.round(h*PetMotion.mantleContactAt(2)/540);
    }

    static int halfSpan(int width){return Math.round(width*.224f);}
    boolean fitsViewport(int maxX,int maxY){
        Sample p=new Sample();
        int duration=duration(1);
        int start=duration-TRANSFER_MS;
        if(startX<0||startX>maxX||startY<0||startY>maxY)return false;
        for(int ms=start;ms<=duration;ms+=4){
            sample(p,ms,duration);
            if(p.x<0||p.x>maxX||p.y<0||p.y>maxY)return false;
        }
        return endX>=0&&endX<=maxX&&endY>=0&&endY<=maxY;
    }
    float rung(float number){return bottom-number*pitch;}
    int duration(float density){
        return MOUNT_MS+TRANSFER_MS+Math.max(440,Math.round(1000*steps*pitch/(density*36f)));
    }

    static final class Sample {
        int x,y,key=REAR_KEY;
        float leftHand,rightHand,leftFoot,rightFoot,bodyShift,sway;
        float insetY;
        boolean mesh;
    }

    // In a stride the planted limb holds its previous rung while the other overtakes it.
    private float step(float travel,boolean first){
        int n=(int)travel;
        if(n>=steps)return steps;
        float f=travel-n;
        if(((n&1)==0)==first){
            float from=Math.max(0,n-1);
            return from+(n+1-from)*PetMotion.ease(f);
        }
        return n;
    }

    void sample(Sample p,long time,int duration){
        int walking=Math.max(1,duration-MOUNT_MS-TRANSFER_MS);
        float t=PetMotion.clamp((time-MOUNT_MS)/(float)walking,0,1);
        float travel=steps*PetMotion.travel(t);
        // Finish with one foot on the last rung and the other a rung lower.
        // During the weight transfer the trailing foot joins the planted one.
        float transfer=PetMotion.clamp((time-MOUNT_MS-walking)/(float)TRANSFER_MS,0,1);
        boolean lastFirst=(steps&1)==1;
        float a,b;
        if(steps>0&&travel>=steps){
            float trailing=steps-1+PetMotion.ease(transfer/.28f);
            a=lastFirst?steps:trailing;
            b=lastFirst?trailing:steps;
        }else{a=step(travel,true);b=step(travel,false);}
        float lift=1-PetMotion.ease(transfer/.28f);
        float footLow=Math.min(a,b);
        p.y=Math.round(rung(footLow)-height*SOLE/540);
        p.x=startX;
        float unit=540f/height;
        float mount=PetMotion.ease(time/(float)MOUNT_MS);
        p.leftFoot=(rung(a)-p.y)*unit-SOLE;
        p.rightFoot=(rung(b)-p.y)*unit-SOLE;
        float leftContact=(rung(Math.min(rungs,reach+b))-p.y)*unit-HAND_Y;
        float rightContact=(rung(Math.min(rungs,reach+a))-p.y)*unit-HAND_Y;
        p.leftHand=leftContact*mount;
        p.rightHand=rightContact*mount;
        p.bodyShift=(footLow-travel)*pitch*unit*.65f;
        p.sway=(float)Math.sin(Math.PI*travel)*4f*lift;
        p.key=REAR_KEY;
        p.mesh=true;
        p.insetY=0;
        if(transfer>.28f){
            float u=PetMotion.ease((transfer-.28f)/.72f);
            p.key=REAR_KEY+Math.round((LAST_KEY-REAR_KEY)*u);
            if(p.key==REAR_KEY)return;
            p.mesh=false;
            // Keep the weight-bearing hand attached as the shoulder turns over the ledge.
            int i=p.key-REAR_KEY;
            float gripX=HANDOFF_X[i],gripY=HANDOFF_Y[i];
            float rearGrip=center+(left?-1:1)*width*(RIGHT_HAND-201)/402f;
            float gripWorld=rearGrip+(edge-rearGrip)*u;
            p.x=Math.round(gripWorld-width*(left?402-gripX:gripX)/402f);
            float rootY=top-gripY*height/540f;
            p.y=Math.min(startY,Math.round(rootY));
            p.insetY=(rootY-p.y)*540f/height;
        }
    }

    // Registered landmarks on the painted inner hand, rear_12 through mantle_02.
    private static final float[] HANDOFF_X={283,290,308,332,356,374,381,370,342,310,282,271};
    private static final float[] HANDOFF_Y={116,114,109,102,96,91,89,91,96,103,108,110};

    private static float ease(float low,float high,float at){return PetMotion.ease((at-low)/(high-low));}

    /** Map a point on the full 402x540 painting; Android draws the same map on its bitmap mesh. */
    static void vertex(float x,float y,Sample p,float[] out,int i){
        float across=ease(187,215,x);
        float foot=p.leftFoot+(p.rightFoot-p.leftFoot)*across;
        float hand=p.leftHand+(p.rightHand-p.leftHand)*across;
        float armMask=(1-ease(137,169,Math.min(x,402-x)))*(1-ease(183,231,y));
        float wrist=1-ease(132,213,y);
        float leg=ease(285,500,y);
        float side=x<201?-1:1;
        float knee=ease(300,376,y)*(1-ease(400,490,y));
        float lifted=Math.max(0,p.bodyShift-foot);
        float dy=p.bodyShift+(foot-p.bodyShift)*leg;
        dy+=(hand-dy)*armMask*(.35f+.65f*wrist);
        float fixed=1-Math.max(leg,armMask*wrist);
        out[i]=x+p.sway*fixed+side*knee*lifted*.22f;
        out[i+1]=y+dy;
    }
}
