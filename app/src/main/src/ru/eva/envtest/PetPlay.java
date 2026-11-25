package ru.eva.envtest;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

final class PetPlay {
    enum Act {
        THROW(5700,1260,1260), DRIBBLE(5800,1040,1130), SMOKE(5100,0,2340), LEAF(3900,0,1580),
        CAMERA(3600,0,1750), DANCE(4700,0,1160), DUST(3800,0,1430), BALANCE(4200,0,1090),
        PLANE(4500,1250,1250), FLASHLIGHT(4100,0,1450),
        BALL_SPIN(4800,0,1510), LEAF_FAN(4600,0,1490), CAMERA_REVIEW(4500,0,1740),
        BROOM_GUITAR(5100,0,1580), PLANE_TEST(4800,0,1680), TORCH_SIGNAL(4900,0,1720),
        HEADPHONE_CHECK(4700,0,1690), BOW(4500,0,1720), SNEEZE(3900,0,1610),
        SHOULDER_ROLL(5100,0,1570);

        final int duration,release,signatureMillis;
        Act(int duration,int release,int signatureMillis){
            this.duration=duration;this.release=release;this.signatureMillis=signatureMillis;
        }
        boolean ball(){return this==THROW||this==DRIBBLE;}
        boolean onLedge(){
            return this==DUST||this==BALANCE||this==FLASHLIGHT||this==LEAF_FAN||
                this==PLANE_TEST||this==TORCH_SIGNAL||this==CAMERA_REVIEW;
        }
    }

    static final class Pose {
        float near,far,lean,reveal,accent,kick,sink,shift;
        float nearShoulder=Float.NaN,farShoulder=Float.NaN;
        float upperDepth=1,foreDepth=1;
        float propAngle,bodyDepth=1;
        boolean wink;
        void resetArms(){
            nearShoulder=farShoulder=Float.NaN;
            upperDepth=foreDepth=bodyDepth=1;
            propAngle=0;
        }
        void reachMouth(float t){
            // Seen from the front, the elbow moves toward the viewer as the hand rises.
            // Keep its bend on one side and preserve the drawn hand at the lip.
            near+=(170-near)*t;
            nearShoulder=37*t-56*t*(1-t);
            upperDepth=1-.59f*t;
            foreDepth=1-1.36f*t*(1-t);
        }
        float upperFar(){return Float.isNaN(farShoulder)?PetRig.upperArm(far):farShoulder;}
        float upper(){return Float.isNaN(nearShoulder)?PetRig.upperArm(near):nearShoulder;}
        float farHandX(){return PetRig.elbowX(false,upperFar(),1)+PetRig.rotateX(0,PetRig.GRIP_Y-PetRig.ELBOW_Y,far);}
        float farHandY(){return PetRig.elbowY(false,upperFar(),1)+PetRig.rotateY(0,PetRig.GRIP_Y-PetRig.ELBOW_Y,far);}
        float handX(){return PetRig.elbowX(true,upper(),upperDepth)+PetRig.rotateX(0,(PetRig.GRIP_Y-PetRig.ELBOW_Y)*foreDepth,near);}
        float handY(){return PetRig.elbowY(true,upper(),upperDepth)+PetRig.rotateY(0,(PetRig.GRIP_Y-PetRig.ELBOW_Y)*foreDepth,near);}
        float worldHandX(){
            return PetRig.PELVIS_X+shift+PetRig.rotateX(handX()-PetRig.PELVIS_X,handY()-PetRig.PELVIS_Y,lean);
        }
        float worldHandY(){
            return PetRig.PELVIS_Y+sink+PetRig.rotateY(handX()-PetRig.PELVIS_X,handY()-PetRig.PELVIS_Y,lean);
        }
    }

    private final List<Act> bag=new ArrayList<>();
    private final Random random;
    private Act previous;

    PetPlay(Random random){this.random=random;}

    Act next(boolean ledge){
        if(bag.isEmpty()){
            Collections.addAll(bag,Act.values());
            Collections.shuffle(bag,random);
            if(bag.get(0)==previous)Collections.swap(bag,0,1);
        }
        int i=bag.get(0)==previous&&bag.size()>1?1:0;
        if(ledge){
            for(int index=0;index<bag.size();index++){
                Act candidate=bag.get(index);
                if(candidate!=previous&&candidate.onLedge()){i=index;break;}
            }
        }
        previous=bag.remove(i);
        return previous;
    }

    static void sample(Pose p,Act act,long elapsed){
        float t=elapsed>=act.duration?act.duration:PetMotion.poseTime(elapsed);
        float ready=PetMotion.ease(t/600),rest=PetMotion.ease((act.duration-t)/660);
        float hold=ready*rest;
        p.reveal=hold;
        p.accent=p.near=p.far=p.lean=p.kick=p.sink=p.shift=0;
        p.resetArms();
        p.wink=false;
        switch(act){
            case THROW:
            case PLANE:
                float wind=PetMotion.ease((t-230)/510);
                float fling=PetMotion.ease((t-800)/(act.release-800f));
                float lower=PetMotion.ease((t-act.release-180)/650);
                p.nearShoulder=hold*(-29*wind-36*fling+57*lower);
                p.near=hold*(-169*wind+77*fling+72*lower);
                float extension=hold*fling*(1-lower);
                p.upperDepth=1-.18f*extension;
                p.foreDepth=1-.30f*extension;
                p.far=-18*hold;
                p.lean=hold*(-5*wind+10*fling-7*lower);
                p.sink=hold*(4+9*wind*(1-fling));
                p.shift=hold*(-8*wind+14*fling-4*lower);
                p.reveal=elapsed<act.release?ready:0;
                break;
            case DRIBBLE:
                float bounce=sin(t/270)*hold;
                float follow=PetMotion.ease((t-act.release)/390);
                p.near=-hold*(24+27*follow)-(10+6*follow)*bounce;
                p.far=-22*hold;
                p.lean=4*hold+3*bounce;
                p.sink=6*hold+4*bounce;
                p.shift=-6*hold+3*bounce;
                p.reveal=t<act.release?hold:0;
                break;
            case SMOKE:
                float drag=pulse(t,630,1310,2020,2820);
                p.near=8*hold;
                p.reachMouth(drag);
                p.far=-5*hold;
                p.lean=2*hold-3*drag;
                p.sink=4*hold;
                p.accent=pulse(t,2140,2460,3370,4570);
                break;
            case LEAF:
                float reach=pulse(t,320,770,1280,1710);
                p.near=hold*(-30-87*pulse(t,1370,1760,2780,3200));
                p.far=-34*reach;
                p.lean=26*reach;
                p.sink=33*reach;
                p.shift=-8*reach;
                p.reveal=pulse(t,740,1100,3080,3600);
                break;
            case CAMERA:
                p.near=-151*hold;
                p.far=144*hold;
                p.lean=-5*hold+5*pulse(t,1480,1700,1790,2000);
                p.sink=5*hold;
                p.accent=pulse(t,1710,1785,1850,2080);
                break;
            case DANCE:
                float beat=sin(t/390)*hold;
                p.near=-74*hold-49*beat;
                p.far=80*hold-45*beat;
                p.lean=8*beat;
                p.shift=10*beat;
                p.sink=hold*(5+6*sin(t/192));
                p.accent=hold;
                break;
            case DUST:
                float sweep=sin(t/430)*hold;
                p.near=-36*hold-26*sweep;
                p.far=-32*hold;
                p.lean=7*hold+3*sweep;
                p.sink=hold*9+2*sweep;
                p.shift=5*hold+5*sweep;
                p.accent=hold;
                break;
            case BALANCE:
                float sway=sin(t/760)*hold;
                p.near=-96*hold-30*sway;
                p.far=105*hold-40*sway;
                p.lean=12*sway;
                p.shift=13*sway;
                p.sink=6*hold;
                break;
            case FLASHLIGHT:
                p.near=-40*hold-13*sin(t/940)*hold;
                p.far=-12*hold;
                p.lean=9*hold;
                p.sink=13*hold;
                p.shift=5*hold;
                p.accent=hold;
                break;
            case BALL_SPIN:{
                float spin=pulse(t,420,1050,3500,4150);
                p.near=-hold*(22+83*spin);
                p.far=hold*(10+12*spin);
                p.lean=-4*spin;p.shift=-5*spin;
                p.propAngle=360*(t/660f);
                break;
            }
            case LEAF_FAN:{
                float fan=pulse(t,420,930,3350,4050);
                float flick=sin(t/265)*fan;
                p.near=-hold*31-104*fan+11*flick;
                p.far=17*fan;p.lean=-5*fan-2*flick;
                p.propAngle=-22+58*flick;
                break;
            }
            case CAMERA_REVIEW:{
                float inspect=pulse(t,380,1120,3160,3850);
                float thumb=pulse(t,1580,1770,1930,2150);
                p.nearShoulder=9*inspect;p.near=110*inspect+6*thumb;
                p.farShoulder=-20*inspect;p.far=-89*inspect;
                p.lean=3*inspect;p.sink=5*inspect;
                p.bodyDepth=1-.045f*inspect;p.propAngle=9*inspect-8*thumb;
                break;
            }
            case BROOM_GUITAR:{
                float riff=pulse(t,450,1050,3900,4520);
                float pick=sin((t-820)/285)*riff;
                p.farShoulder=-18*riff;p.far=70*riff;
                p.nearShoulder=9*riff;p.near=25*riff+12*pick;
                p.lean=-4*riff+3*pick;p.shift=4*pick;p.sink=5*riff+3*pick;
                p.propAngle=-69*riff;p.accent=riff;
                break;
            }
            case PLANE_TEST:{
                float test=pulse(t,460,1100,3440,4080);
                float bank=sin((t-970)/740)*test;
                p.near=-hold*14-91*test+11*bank;
                p.far=15*test;p.lean=-4*bank;p.shift=-3*bank;
                p.propAngle=29*bank;
                break;
            }
            case TORCH_SIGNAL:{
                float signal=pulse(t,410,1010,3620,4280);
                p.near=-hold*19-84*signal;
                p.far=14*signal;p.lean=-4*signal;
                // Three separated, soft-edged bursts; the body of the torch stays visible.
                p.accent=pulse(t,1110,1190,1350,1460)+pulse(t,1630,1710,1890,2000)+pulse(t,2340,2460,2910,3080);
                break;
            }
            case HEADPHONE_CHECK:{
                float listen=pulse(t,480,1430,3070,3930);
                p.near=-198*listen;p.nearShoulder=-35*listen;
                p.upperDepth=1-.64f*listen;
                p.far=-14*listen;p.lean=4*listen+2*listen*sin(t/650);
                p.accent=pulse(t,140,630,3800,4350);
                break;
            }
            case BOW:{
                float bow=pulse(t,530,1570,2330,3520);
                p.near=104*bow;p.nearShoulder=17*bow;
                p.far=23*bow;p.lean=5*bow;
                p.bodyDepth=1-.17f*bow;p.sink=13*bow;p.shift=-4*bow;
                break;
            }
            case SNEEZE:{
                float cover=pulse(t,390,1190,1990,2750);
                float inhale=pulse(t,500,1060,1360,1520);
                float recoil=pulse(t,1450,1600,1650,2140);
                p.near=93*cover;p.nearShoulder=146*cover;
                p.far=-9*cover-32*recoil;
                p.lean=-5*inhale+10*recoil;p.sink=11*recoil;
                p.bodyDepth=1-.09f*recoil;
                break;
            }
            case SHOULDER_ROLL:{
                float loosen=pulse(t,370,950,3840,4530);
                float roll=sin((t-900)/830)*loosen;
                float circle=sin((t-900)/830+.5f)*loosen;
                p.nearShoulder=-22*loosen-15*roll;p.farShoulder=22*loosen-15*roll;
                p.near=-39*loosen-24*circle;p.far=39*loosen-24*circle;
                p.lean=3*roll;p.sink=4*circle;p.shift=3*roll;
                break;
            }
        }
    }

    static float sin(float phase){return (float)Math.sin(Math.PI*phase);}

    private static float pulse(float t,int a,int b,int c,int d){
        return PetMotion.ease((t-a)/(b-a))*PetMotion.ease((d-t)/(d-c));
    }
}
