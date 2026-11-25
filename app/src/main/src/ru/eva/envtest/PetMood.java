package ru.eva.envtest;

import java.util.Random;

import ru.eva.envtest.PetRemarks.Moment;

final class PetMood {
    enum Face { NEUTRAL, FOCUS, CURIOUS, WRY, PLEASED, SURPRISED, BLINK, BUFFERING, SMUG, SUS }
    enum Cue { NONE, BOUNCE, ICON, KICK, SURFACE }

    Face face=Face.NEUTRAL;
    float weight;
    String quip;
    float quipWeight;
    private final PetRemarks remarks;
    private boolean prompted,openingTried,sceneTried,motionTried,seatedPropTried;
    private long motionBegan,captionBegan,captionEnd,captionWakeAt,ambientAfter;
    private long lastCueAt;

    PetMood(){this(new Random());}
    PetMood(Random random){remarks=new PetRemarks(random);}

    void clear(){
        endGame();
        quip=null;
        quipWeight=0;
        captionEnd=0;
    }

    void endGame(){show(Face.NEUTRAL,0);}

    void scene(boolean prompted){this.prompted=prompted;}

    void beginMotion(long now){
        motionBegan=now;
        lastCueAt=Long.MIN_VALUE;
        openingTried=sceneTried=motionTried=seatedPropTried=false;
    }

    void play(PetPlay.Act act,long time,Cue cue,long sinceCue){
        play(act,time,cue,sinceCue,true);
    }

    void play(PetPlay.Act act,long time,Cue cue,long sinceCue,boolean ambientLines){
        if(ambientLines)words(act,time,cue,sinceCue);
        if(cue!=Cue.NONE&&sinceCue>=0&&sinceCue<970){
            Face reaction=cue==Cue.KICK?Face.PLEASED:cue==Cue.ICON?Face.WRY:Face.SURPRISED;
            show(reaction,pulse(sinceCue,25,125,580,970));
            return;
        }
        long blinkAt=780+act.ordinal()*119L;
        float blink=pulse(time,blinkAt,blinkAt+55,blinkAt+100,blinkAt+185);
        if(blink>0){show(Face.BLINK,blink);return;}
        switch(act){
            case BALL_SPIN:
            case TORCH_SIGNAL:
            case PLANE_TEST:
                show(Face.FOCUS,pulse(time,260,act.signatureMillis-180,act.duration-1200,act.duration-520));
                break;
            case CAMERA_REVIEW:
                if(time<1460)show(Face.CURIOUS,pulse(time,300,650,1210,1460));
                else show(Face.BUFFERING,pulse(time,1460,1690,2900,3520));
                break;
            case HEADPHONE_CHECK:
                show(Face.SUS,pulse(time,1050,1600,2770,3330));
                break;
            case BOW:
                show(Face.SMUG,pulse(time,650,1400,2550,3350));
                break;
            case LEAF_FAN:
            case BROOM_GUITAR:
            case SHOULDER_ROLL:
                show(Face.PLEASED,.7f*pulse(time,400,act.signatureMillis,act.duration-1200,act.duration-480));
                break;
            case SNEEZE:
                show(Face.BLINK,pulse(time,1430,1550,1740,1960));
                break;
            case THROW:
            case PLANE:
                if(time<act.release)show(Face.FOCUS,pulse(time,230,620,act.release-90,act.release));
                else show(Face.CURIOUS,pulse(time,act.release,act.release+325,act.release+1230,act.release+1740));
                break;
            case DRIBBLE:
                show(Face.FOCUS,pulse(time,250,680,2100,2700));
                break;
            case LEAF:
                if(time<1550)show(Face.CURIOUS,pulse(time,250,650,1060,1550));
                else show(Face.PLEASED,pulse(time,1550,1920,2860,3530));
                break;
            case CAMERA:
                if(time<1730)show(Face.FOCUS,pulse(time,260,620,1360,1730));
                else show(Face.WRY,pulse(time,1780,2130,2830,3390));
                break;
            case BALANCE:
            case FLASHLIGHT:
                show(Face.CURIOUS,pulse(time,280,700,act.duration-900,act.duration-330));
                break;
            case DANCE:
                show(Face.PLEASED,.66f*pulse(time,400,820,3300,4300));
                break;
            case DUST:
                show(Face.WRY,pulse(time,1520,1990,2820,3440));
                break;
            case SMOKE:
                if(time<2140)show(Face.FOCUS,pulse(time,640,1170,1600,2140)*.68f);
                else show(Face.WRY,pulse(time,2230,2700,3600,4510));
                break;
        }
    }

    void motion(int mode,long time,float impact){
        if(mode==PetMotion.PERCH_LOOK||mode==PetMotion.EDGE_LEAN||mode==PetMotion.LOOK_AROUND)
            show(Face.CURIOUS,pulse(time,250,590,1120,1510));
        else if(mode==PetMotion.LANDING&&impact>.71f)
            show(Face.SURPRISED,pulse(time,0,85,170,500));
        else show(Face.NEUTRAL,0);

        long cueTime=mode==PetMotion.CRAWLING?PetMotion.CRAWL_FOLD_MS+180:
            mode==PetMotion.LANDING?85:410;
        if(motionTried||time<cueTime)return;
        motionTried=true;
        long now=motionBegan+time;
        boolean hard=mode==PetMotion.LANDING&&impact>.71f;
        if(!hard&&now<ambientAfter)return;
        Moment moment;
        switch(mode){
            case PetMotion.LADDER_UP: moment=Moment.LADDER;break;
            case PetMotion.MANTLE_UP: moment=Moment.MANTLE;break;
            case PetMotion.MANTLE_DOWN: moment=Moment.DESCENT;break;
            case PetMotion.ROPE_DOWN: moment=Moment.ROPE;break;
            case PetMotion.EDGE_LEAN:
            case PetMotion.PERCH_LOOK: moment=Moment.EDGE;break;
            case PetMotion.CRAWLING: moment=Moment.CRAWL;break;
            case PetMotion.SEATED_PEEK: moment=Moment.SEAT;break;
            case PetMotion.IDLE_BOOK: moment=Moment.BOOK;break;
            case PetMotion.IDLE_TEA: moment=Moment.TEA;break;
            case PetMotion.IDLE_YAWN: moment=Moment.YAWN;break;
            case PetMotion.GREET: moment=Moment.GREET;break;
            case PetMotion.LANDING:
                if(!hard)return;
                moment=Moment.HARD_LANDING;
                break;
            default:return;
        }
        say(moment,now);
    }

    void seated(PetSeat seat,long elapsed){
        long now=motionBegan+elapsed;
        if(seat.activity==PetSeat.Activity.DOZE)return;
        if(!motionTried&&elapsed>=500){
            motionTried=true;
            if(elapsed<1400&&now>=ambientAfter)say(Moment.SEAT,now);
        }
        if(seatedPropTried||now<ambientAfter||elapsed<3600||elapsed>8400||seat.reveal<.85f)return;
        Moment moment;
        switch(seat.activity){
            case BOOK:moment=Moment.BOOK;break;
            case SMOKE:moment=Moment.SMOKE;break;
            case TEA:moment=Moment.TEA;break;
            default:return;
        }
        seatedPropTried=say(moment,now);
    }

    private void words(PetPlay.Act act,long time,Cue cue,long sinceCue){
        long now=motionBegan+time;
        if(prompted&&!openingTried&&time>=50){
            openingTried=true;
            if(time<650)say(Moment.TOUCH,now);
        }
        if(cue!=Cue.NONE&&cue!=Cue.SURFACE&&sinceCue>=65&&sinceCue<=650&&time-sinceCue!=lastCueAt){
            if(say(Moment.valueOf(cue.name()),now))lastCueAt=time-sinceCue;
        }
        if(sceneTried)return;
        // Ball scenes leave room for the actual collision, where and when it happens.
        int beat=act.signatureMillis;
        if(time<beat)return;
        if(prompted&&act.ball()){sceneTried=true;return;}
        // The opening line needs time to finish before a second beat can be read.
        if(now<captionEnd+180){
            if(time>beat+820)sceneTried=true;
            return;
        }
        sceneTried=true;
        if(time<=beat+820)
            say(Moment.valueOf(act.name()),now);
    }

    void prank(boolean letters,long now){say(letters?Moment.LETTERS:Moment.POCKETED,now);}
    void pickedUp(boolean wasReading,long now){
        if(now>=ambientAfter||wasReading)say(wasReading?Moment.LOST_PAGE:Moment.TOUCH,now);
    }

    private boolean say(Moment moment,long now){
        if(captionEnd!=0&&now<captionEnd+180)return false;
        return sayLine(remarks.draw(moment),now);
    }

    boolean sayLine(String line,long now){
        if(captionEnd!=0&&now<captionEnd+180)return false;
        quip=line;
        captionBegan=now;
        captionWakeAt=0;
        captionEnd=now+Math.max(1660,860+quip.length()*47);
        ambientAfter=captionEnd+2600;
        quipWeight=0;
        return true;
    }

    // Called from drawing too, so the last caption fades even on a stationary perch.
    long updateCaption(long now){
        if(quip==null)return 0;
        if(now>=captionEnd){
            quip=null;
            quipWeight=0;
            return 0;
        }
        quipWeight=PetMotion.ease((now-captionBegan)/125f)*PetMotion.ease((captionEnd-now)/220f);
        if(now<captionWakeAt)return 0;
        long delay=now<captionBegan+125||now>=captionEnd-220?42:captionEnd-220-now;
        captionWakeAt=now+delay;
        return delay;
    }

    private void show(Face face,float weight){
        this.face=weight>.015f?face:Face.NEUTRAL;
        this.weight=weight;
    }

    private static float pulse(long time,long start,long peak,long sustain,long end){
        return PetMotion.ease((time-start)/(float)(peak-start))*
            PetMotion.ease((end-time)/(float)(end-sustain));
    }
}
